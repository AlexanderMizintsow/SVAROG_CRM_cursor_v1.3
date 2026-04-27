import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import Toastify from 'toastify-js'
import { MdContactSupport } from 'react-icons/md'
import useUserStore from '../../../store/userStore'
import EditorToolbarSimple from '../../../components/EditorToolbarSimple/EditorToolbarSimple'
import ConfirmationDialog from '../../../components/confirmationDialog/ConfirmationDialog'
import HelpModalMobileAppNews from './HelpModalMobileAppNews'
import { API_BASE_URL } from '../../../../config'
import { newsApi } from './api/newsApi'
import './mobileAppNewsManagement.scss'

const EMPTY_FORM = {
  id: null,
  title: '',
  summary: '',
  coverImageUrl: '',
  status: 'draft',
  publishAt: '',
  unpublishAt: '',
  segments: {
    regions: [],
    cities: [],
    companies: [],
  },
  media: [],
}

const SYMBOL_LIBRARY = ['✓', '★', '✔', '⚙', '📌', '🔥', '✅', '📦', '💡', '🚚', '📣']
const REGION_OPTIONS = ['Север', 'Юг', 'Центр', 'Урал', 'Сибирь', 'Дальний Восток']
const STATUS_LABELS = {
  draft: 'Черновик',
  scheduled: 'Запланировано',
  published: 'Опубликовано',
  archived: 'Снято с публикации',
}
const ACTION_LABELS = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
}
const EDITOR_STATUS_OPTIONS = {
  default: [
    { value: 'draft', label: 'Черновик' },
    { value: 'scheduled', label: 'Запланировано' },
    { value: 'published', label: 'Опубликовано' },
    { value: 'archived', label: 'Снято с публикации' },
  ],
  published: [
    { value: 'published', label: 'Опубликовано (текущий)', disabled: true },
    { value: 'archived', label: 'Снято с публикации' },
  ],
}

const toDateTimeLocalValue = (raw) => {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

const toastOk = (text) =>
  Toastify({
    text,
    close: true,
    style: { background: 'linear-gradient(to right, #00b09b, #96c93d)' },
  }).showToast()

const toastErr = (text) =>
  Toastify({
    text,
    close: true,
    style: { background: 'linear-gradient(to right, #FF5F6D, #FFC371)' },
  }).showToast()

const SelectChips = ({ options, values, onChange, getChipState }) => {
  return (
    <div className="mobile-news__chips">
      {options.map((option) => {
        const active = values.includes(option)
        const compatState = getChipState ? getChipState(option) : 'neutral'
        return (
          <button
            key={option}
            type="button"
            className={`mobile-news__chip ${active ? 'active' : ''} mobile-news__chip--${compatState}`}
            onClick={() =>
              onChange(active ? values.filter((x) => x !== option) : [...values, option])
            }
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

const MobileAppNewsManagement = () => {
  const { user } = useUserStore()
  const isAdmin = user?.role_name === 'Администратор'

  const [activeTab, setActiveTab] = useState('news')
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [newsItems, setNewsItems] = useState([])
  const [users, setUsers] = useState([])
  const [permissions, setPermissions] = useState([])
  const [changeLog, setChangeLog] = useState([])
  const [sendLog, setSendLog] = useState([])
  const [regionOptions, setRegionOptions] = useState(REGION_OPTIONS)
  const [cityOptions, setCityOptions] = useState([])
  const [companyOptions, setCompanyOptions] = useState([])
  const [companyMeta, setCompanyMeta] = useState([])
  const [cityRegionMap, setCityRegionMap] = useState({})
  const [regionCityMap, setRegionCityMap] = useState({})
  const [selectedPermissionUser, setSelectedPermissionUser] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [previewNews, setPreviewNews] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [pendingDeleteNewsId, setPendingDeleteNewsId] = useState(null)
  const [pendingSavePayload, setPendingSavePayload] = useState(null)
  const [openHelpModal, setOpenHelpModal] = useState(false)
  const coverFileInputRef = useRef(null)
  const extraFileInputRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
    ],
    content: '',
  })

  const fetchInitial = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [permissionState, companiesData, usersData, listData] = await Promise.all([
        newsApi.getPermissions(user, user.id).catch(() => ({ can_edit: false })),
        newsApi.loadCompanies().catch(() => []),
        newsApi.loadUsers().catch(() => []),
        newsApi.listNews(user).catch(() => ({ items: [] })),
      ])
      setCanEdit(isAdmin || !!permissionState.can_edit)
      setUsers(usersData || [])
      setNewsItems(listData.items || [])
      const taxonomy = await newsApi.getTaxonomy(user).catch(() => ({
        regions: [],
        cities: [],
        companies: [],
        companyMeta: [],
        cityRegionMap: {},
        regionCityMap: {},
      }))
      setRegionOptions(taxonomy.regions?.length ? taxonomy.regions : REGION_OPTIONS)
      setCityOptions(taxonomy.cities || [])
      setCompanyOptions(taxonomy.companies || (companiesData || []).map((x) => x.name_companies).filter(Boolean))
      setCompanyMeta(taxonomy.companyMeta || [])
      setCityRegionMap(taxonomy.cityRegionMap || {})
      setRegionCityMap(taxonomy.regionCityMap || {})
      if (isAdmin) {
        const permissionsData = await newsApi.listPermissions(user).catch(() => [])
        setPermissions(permissionsData || [])
      }
      const logData = await newsApi.listChangeLog(user).catch(() => ({ items: [] }))
      setChangeLog(logData.items || [])
      const sendLogData = await newsApi.listSendLog(user).catch(() => ({ items: [] }))
      setSendLog(sendLogData.items || [])
    } finally {
      setLoading(false)
    }
  }, [isAdmin, user])

  useEffect(() => {
    fetchInitial()
  }, [fetchInitial])

  const setFormField = (key, value) => setEditing((prev) => ({ ...prev, [key]: value }))
  const setSegmentField = (key, value) =>
    setEditing((prev) => ({ ...prev, segments: { ...prev.segments, [key]: value } }))

  const resetForm = () => {
    setEditing(EMPTY_FORM)
    editor?.commands.setContent('')
  }

  const applyEdit = async (id) => {
    try {
      const data = await newsApi.getNews(user, id)
      setEditing({
        id: data.id,
        title: data.title || '',
        summary: data.summary || '',
        coverImageUrl: data.cover_image_url || '',
        status: data.status || 'draft',
        publishAt: toDateTimeLocalValue(data.publish_at),
        unpublishAt: toDateTimeLocalValue(data.unpublish_at),
        segments: data.segments || EMPTY_FORM.segments,
        media: data.media || [],
      })
      editor?.commands.setContent(data.content_html || '')
      setActiveTab('editor')
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Не удалось загрузить новость')
    }
  }

  const validateForm = () => {
    if (!editing.title.trim()) return 'Заполните заголовок'
    if (!editing.coverImageUrl.trim()) return 'Загрузите главную картинку'
    const html = editor?.getHTML() || ''
    if (!html || html === '<p></p>') return 'Заполните текст новости'
    return ''
  }

  const runSaveNews = async (payload) => {
    setSaving(true)
    try {
      if (editing.id) {
        await newsApi.updateNews(user, editing.id, payload)
        toastOk('Новость обновлена')
      } else {
        await newsApi.createNews(user, payload)
        toastOk('Новость создана')
      }
      await fetchInitial()
      resetForm()
      setActiveTab('news')
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Ошибка сохранения новости')
    } finally {
      setSaving(false)
    }
  }

  const saveNews = async () => {
    const msg = validateForm()
    if (msg) {
      toastErr(msg)
      return
    }
    if (!canEdit) {
      toastErr('Недостаточно прав для редактирования новостей')
      return
    }

    const payload = {
      title: editing.title.trim(),
      summary: editing.summary.trim(),
      coverImageUrl: editing.coverImageUrl.trim(),
      status: editing.status,
      publishAt:
        editing.status === 'scheduled' && editing.publishAt ? new Date(editing.publishAt).toISOString() : null,
      unpublishAt: editing.unpublishAt ? new Date(editing.unpublishAt).toISOString() : null,
      contentHtml: editor?.getHTML() || '',
      segments: editing.segments,
      media: editing.media,
    }
    if (payload.segments.companies.includes('Все')) {
      payload.segments.companies = []
    }

    const shouldConfirmPublish =
      payload.status === 'published' || (payload.status === 'scheduled' && !!payload.publishAt)

    if (shouldConfirmPublish) {
      setPendingSavePayload(payload)
      setConfirmPublishOpen(true)
      return
    }

    await runSaveNews(payload)
  }

  const removeNews = async (id) => {
    try {
      await newsApi.deleteNews(user, id)
      toastOk('Новость удалена')
      await fetchInitial()
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Ошибка удаления новости')
    }
  }

  const uploadImage = async (event, isCover = false) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const uploaded = await newsApi.uploadImage(user, file, editing.title || 'news')
      if (isCover) {
        setFormField('coverImageUrl', uploaded.file_url)
      } else {
        setEditing((prev) => ({
          ...prev,
          media: [...prev.media, uploaded],
        }))
      }
      toastOk('Изображение загружено')
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Ошибка загрузки изображения')
    } finally {
      event.target.value = ''
    }
  }

  const removeCoverImage = () => {
    setFormField('coverImageUrl', '')
    toastOk('Главная картинка удалена из формы')
  }

  const removeExtraImage = (index) => {
    setEditing((prev) => ({
      ...prev,
      media: prev.media.filter((_, idx) => idx !== index),
    }))
    toastOk('Дополнительная картинка удалена из формы')
  }

  const insertImageToEditor = (item) => {
    if (!editor) return
    editor
      .chain()
      .focus()
      .insertContent(
        `<p><img src="${API_BASE_URL}5011${item.file_url}" alt="${item.file_name || 'image'}" style="max-width:100%;height:auto;" /></p>`
      )
      .run()
    toastOk('Картинка вставлена в текущую позицию курсора')
  }

  const openPreview = async (item) => {
    setPreviewNews(item)
    setPreviewLoading(true)
    try {
      const full = await newsApi.getNews(user, item.id)
      setPreviewNews(full)
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Не удалось открыть просмотр новости')
    } finally {
      setPreviewLoading(false)
    }
  }

  const formatDateTime = (value) => {
    if (!value) return '-'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString('ru-RU')
  }

  const formatUserShort = (userId) => {
    const found = users.find((u) => u.id === userId)
    if (!found) return `ID ${userId || '-'}`
    const ln = found.last_name || ''
    const fn = found.first_name ? `${found.first_name[0]}.` : ''
    const mn = found.middle_name ? `${found.middle_name[0]}.` : ''
    return `${ln} ${fn}${mn}`.trim()
  }

  const filteredNews = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return newsItems
    return newsItems.filter(
      (item) =>
        String(item.title || '')
          .toLowerCase()
          .includes(q) ||
        String(item.summary || '')
          .toLowerCase()
          .includes(q)
    )
  }, [search, newsItems])

  const selectedCompaniesWithoutAll = useMemo(
    () => editing.segments.companies.filter((x) => x !== 'Все'),
    [editing.segments.companies]
  )

  const selectedCompanyMeta = useMemo(() => {
    const selected = new Set(selectedCompaniesWithoutAll.map((x) => x.toLowerCase()))
    return companyMeta.filter((item) => selected.has(String(item.company_name || '').toLowerCase()))
  }, [companyMeta, selectedCompaniesWithoutAll])

  const getRegionChipState = (region) => {
    const selectedCities = editing.segments.cities
    if (!editing.segments.regions.length && !selectedCities.length && !selectedCompaniesWithoutAll.length) {
      return 'neutral'
    }
    let red = false
    let green = false
    if (selectedCities.length) {
      const hasLinkedCity = selectedCities.some((city) => (regionCityMap[region] || []).includes(city))
      if (!hasLinkedCity) red = true
      else green = true
    }
    if (selectedCompaniesWithoutAll.length) {
      const hasCompany = selectedCompanyMeta.some((item) => (item.regions || []).includes(region))
      if (!hasCompany) red = true
      else green = true
    }
    if (editing.segments.regions.includes(region)) green = true
    if (red) return 'bad'
    if (green) return 'good'
    return 'neutral'
  }

  const getCityChipState = (city) => {
    if (!editing.segments.regions.length && !editing.segments.cities.length && !selectedCompaniesWithoutAll.length) {
      return 'neutral'
    }
    let red = false
    let green = false
    if (editing.segments.regions.length) {
      const allowedRegions = cityRegionMap[city] || []
      const hasRegionMatch = editing.segments.regions.some((region) => allowedRegions.includes(region))
      if (!hasRegionMatch) red = true
      else green = true
    }
    if (selectedCompaniesWithoutAll.length) {
      const hasCompany = selectedCompanyMeta.some((item) => (item.cities || []).includes(city))
      if (!hasCompany) red = true
      else green = true
    }
    if (editing.segments.cities.includes(city)) green = true
    if (red) return 'bad'
    if (green) return 'good'
    return 'neutral'
  }

  const getCompanyChipState = (companyName) => {
    if (editing.segments.companies.includes('Все')) {
      return companyName === 'Все' || companyName ? 'good' : 'neutral'
    }
    if (companyName === 'Все') return 'neutral'
    if (!editing.segments.regions.length && !editing.segments.cities.length && !selectedCompaniesWithoutAll.length) {
      return 'neutral'
    }
    const meta = companyMeta.find(
      (item) => String(item.company_name || '').toLowerCase() === String(companyName).toLowerCase()
    )
    if (!meta) return 'neutral'
    let red = false
    let green = false
    if (editing.segments.regions.length) {
      const hasRegionMatch = editing.segments.regions.some((region) => (meta.regions || []).includes(region))
      if (!hasRegionMatch) red = true
      else green = true
    }
    if (editing.segments.cities.length) {
      const hasCityMatch = editing.segments.cities.some((city) => (meta.cities || []).includes(city))
      if (!hasCityMatch) red = true
      else green = true
    }
    if (selectedCompaniesWithoutAll.includes(companyName)) green = true
    if (red) return 'bad'
    if (green) return 'good'
    return 'neutral'
  }

  const availableUsersForPermission = users.filter((u) => !permissions.some((p) => p.user_id === u.id))
  const statusOptions =
    editing.status === 'published'
      ? EDITOR_STATUS_OPTIONS.published
      : EDITOR_STATUS_OPTIONS.default

  const grantPermission = async () => {
    if (!selectedPermissionUser) return
    try {
      await newsApi.grantPermission(user, parseInt(selectedPermissionUser, 10))
      toastOk('Права выданы')
      setSelectedPermissionUser('')
      setPermissions(await newsApi.listPermissions(user))
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Ошибка выдачи прав')
    }
  }

  const revokePermission = async (permissionId) => {
    try {
      await newsApi.revokePermission(user, permissionId)
      toastOk('Права удалены')
      setPermissions(await newsApi.listPermissions(user))
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Ошибка удаления прав')
    }
  }

  if (loading) return <div className="mobile-news__loading">Загрузка...</div>

  return (
    <div className="mobile-news">
      <div className="mobile-news__header">
        <div className="mobile-news__header-row">
          <h1>Управление новостями мобильного приложения</h1>
          <MdContactSupport
            className="mobile-news__help-icon"
            onClick={() => setOpenHelpModal(true)}
            title="Справка"
          />
        </div>
        <p>
          Форматы изображений: JPG/PNG/WEBP, до 5MB. Используйте только бесплатные и лицензируемые
          материалы.
        </p>
      </div>

      <div className="mobile-news__tabs">
        <button
          className={`mobile-news__tab ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          Новости
        </button>
        <button
          className={`mobile-news__tab ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          Создание/редактирование
        </button>
        {isAdmin && (
          <button
            className={`mobile-news__tab ${activeTab === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('permissions')}
          >
            Права доступа
          </button>
        )}
        <button
          className={`mobile-news__tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          История изменений
        </button>
        <button
          className={`mobile-news__tab ${activeTab === 'send-log' ? 'active' : ''}`}
          onClick={() => setActiveTab('send-log')}
        >
          Лог отправок
        </button>
      </div>

      {activeTab === 'news' && (
        <div className="mobile-news__panel">
          <div className="mobile-news__panel-head">
            <input
              className="mobile-news__search"
              placeholder="Поиск по новостям..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="mobile-news__primary-btn"
              onClick={() => {
                resetForm()
                setActiveTab('editor')
              }}
              disabled={!canEdit}
            >
              Новая новость
            </button>
          </div>

          <div className="mobile-news__list">
            {filteredNews.map((item) => (
              <div
                key={item.id}
                className="mobile-news__card"
                onClick={() => openPreview(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openPreview(item)
                }}
              >
                <div className="mobile-news__card-main">
                  <img src={`${API_BASE_URL}5011${item.cover_image_url}`} alt="" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <span className={`status status--${item.status}`}>{STATUS_LABELS[item.status] || item.status}</span>
                    <div className="mobile-news__publish-date">
                      Дата публикации: {formatDateTime(item.publish_at || item.created_at)}
                    </div>
                  </div>
                </div>
                <div className="mobile-news__card-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      applyEdit(item.id)
                    }}
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPendingDeleteNewsId(item.id)
                      setConfirmDeleteOpen(true)
                    }}
                    disabled={!canEdit}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
            {!filteredNews.length && <div className="mobile-news__empty">Новостей пока нет</div>}
          </div>
        </div>
      )}

      {activeTab === 'editor' && (
        <div className="mobile-news__panel">
          {!canEdit && <div className="mobile-news__warning">У вас нет прав на редактирование новостей.</div>}
          <div className="mobile-news__grid">
            <label>
              Заголовок *
              <input
                value={editing.title}
                onChange={(e) => setFormField('title', e.target.value)}
                placeholder="Введите заголовок новости"
              />
            </label>
            <label>
              Краткое описание
              <textarea
                value={editing.summary}
                onChange={(e) => setFormField('summary', e.target.value)}
                placeholder="Краткое описание для карточки"
              />
            </label>
            <label>
              Статус публикации
              <select
                value={editing.status}
                onChange={(e) => {
                  const next = e.target.value
                  setFormField('status', next)
                  if (next !== 'scheduled') {
                    setFormField('publishAt', '')
                  }
                }}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {editing.status === 'scheduled' && (
              <label>
                Дата/время публикации
                <input
                  type="datetime-local"
                  value={editing.publishAt}
                  onChange={(e) => setFormField('publishAt', e.target.value)}
                />
              </label>
            )}
            <label>
              Дата/время снятия
              <input
                type="datetime-local"
                value={editing.unpublishAt}
                onChange={(e) => setFormField('unpublishAt', e.target.value)}
              />
            </label>
          </div>

          <div className="mobile-news__section">
            <h3>Главная картинка *</h3>
            <div className="mobile-news__upload-row">
              <input
                ref={coverFileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="mobile-news__hidden-input"
                onChange={(e) => uploadImage(e, true)}
              />
              <button
                type="button"
                className="mobile-news__upload-btn"
                onClick={() => coverFileInputRef.current?.click()}
              >
                Выбрать главную картинку
              </button>
              {editing.coverImageUrl && (
                <div className="mobile-news__cover-preview-wrap">
                  <img
                    src={`${API_BASE_URL}5011${editing.coverImageUrl}`}
                    alt=""
                    className="mobile-news__preview"
                  />
                  <button type="button" onClick={removeCoverImage}>
                    Удалить главную картинку
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mobile-news__section">
            <h3>Текст новости *</h3>
            <EditorToolbarSimple editor={editor} />
            <div className="mobile-news__symbols">
              {SYMBOL_LIBRARY.map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => editor?.chain().focus().insertContent(`${symbol} `).run()}
                >
                  {symbol}
                </button>
              ))}
            </div>
            <EditorContent editor={editor} className="mobile-news__editor" />
            <p className="mobile-news__hint">
              Иконки и знаки должны быть бесплатными или зарегистрированными брендовыми материалами компании.
            </p>
          </div>

          <div className="mobile-news__section">
            <h3>Дополнительные изображения в тексте</h3>
            <input
              ref={extraFileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              className="mobile-news__hidden-input"
              onChange={(e) => uploadImage(e, false)}
            />
            <button
              type="button"
              className="mobile-news__upload-btn"
              onClick={() => extraFileInputRef.current?.click()}
            >
              Выбрать дополнительное изображение
            </button>
            <p className="mobile-news__hint">
              После загрузки используйте кнопку &quot;Вставить в текст&quot;: поставьте курсор в нужное
              место и
              нажмите кнопку у нужной картинки.
            </p>
            <p className="mobile-news__hint">
              Для расширенного редактирования изображений можно использовать готовые редакторы:
              <a href="https://www.photopea.com/" target="_blank" rel="noreferrer">
                {' '}
                Photopea
              </a>{' '}
              или
              <a href="https://www.canva.com/" target="_blank" rel="noreferrer">
                {' '}
                Canva
              </a>
              . После редактирования загрузите готовое изображение в новость.
            </p>
            <div className="mobile-news__media-list">
              {editing.media.map((item, idx) => (
                <div key={`${item.file_url}_${idx}`} className="mobile-news__media-item">
                  <img src={`${API_BASE_URL}5011${item.file_url}`} alt="" />
                  <span>{item.file_name}</span>
                  <div className="mobile-news__media-actions">
                    <button type="button" onClick={() => insertImageToEditor(item)}>
                      Вставить в текст
                    </button>
                    <button type="button" onClick={() => removeExtraImage(idx)}>
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mobile-news__section">
            <h3>Сегментация публикации</h3>
            <div className="mobile-news__compat-legend">
              <span className="good">Зеленый — совместимо с текущим выбором</span>
              <span className="bad">Красный — конфликтует с текущим выбором</span>
            </div>
            <div className="mobile-news__seg-grid">
              <div>
                <strong>Регионы</strong>
                <SelectChips
                  options={regionOptions}
                  values={editing.segments.regions}
                  onChange={(val) => setSegmentField('regions', val)}
                  getChipState={getRegionChipState}
                />
              </div>
              <div>
                <strong>Города</strong>
                <SelectChips
                  options={cityOptions}
                  values={editing.segments.cities}
                  onChange={(val) => setSegmentField('cities', val)}
                  getChipState={getCityChipState}
                />
              </div>
              <div>
                <strong>Конкретные компании</strong>
                <SelectChips
                  options={['Все', ...companyOptions.slice(0, 300)]}
                  values={editing.segments.companies}
                  getChipState={getCompanyChipState}
                  onChange={(val) => {
                    if (val.includes('Все')) {
                      setSegmentField('companies', ['Все'])
                      return
                    }
                    setSegmentField('companies', val.filter((x) => x !== 'Все'))
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mobile-news__actions">
            <button className="mobile-news__primary-btn" onClick={saveNews} disabled={saving || !canEdit}>
              {saving ? 'Сохранение...' : editing.id ? 'Сохранить изменения' : 'Создать новость'}
            </button>
            <button className="mobile-news__ghost-btn" onClick={resetForm}>
              Очистить форму
            </button>
          </div>
        </div>
      )}

      {activeTab === 'permissions' && isAdmin && (
        <div className="mobile-news__panel">
          <h3>Права доступа к вкладке управления новостями</h3>
          <div className="mobile-news__permission-row">
            <select
              value={selectedPermissionUser}
              onChange={(e) => setSelectedPermissionUser(e.target.value)}
            >
              <option value="">Выберите пользователя</option>
              {availableUsersForPermission.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.last_name} {u.first_name} ({u.email})
                </option>
              ))}
            </select>
            <button onClick={grantPermission}>Выдать доступ</button>
          </div>
          <div className="mobile-news__permission-list">
            {permissions.map((permission) => {
              const found = users.find((u) => u.id === permission.user_id)
              return (
                <div key={permission.id} className="mobile-news__permission-item">
                  <span>
                    {found
                      ? `${found.last_name} ${found.first_name} (${found.email})`
                      : `user_id ${permission.user_id}`}
                  </span>
                  <button onClick={() => revokePermission(permission.id)}>Удалить</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="mobile-news__panel">
          <h3>История изменений</h3>
          <div className="mobile-news__history">
            {changeLog.map((entry) => (
              <div key={entry.id} className="mobile-news__history-item">
                <strong>{ACTION_LABELS[entry.action_type] || entry.action_type}</strong>
                <span>Новость: {entry.details_json?.title || `ID ${entry.news_id || '-'}`}</span>
                <span>Пользователь: {formatUserShort(entry.user_id)}</span>
                <span>{new Date(entry.created_at).toLocaleString('ru-RU')}</span>
              </div>
            ))}
            {!changeLog.length && <div className="mobile-news__empty">История пока пустая</div>}
          </div>
        </div>
      )}

      {activeTab === 'send-log' && (
        <div className="mobile-news__panel">
          <h3>Лог отправок push-уведомлений</h3>
          <div className="mobile-news__history">
            {sendLog.map((entry) => (
              <div key={entry.id} className="mobile-news__history-item">
                <strong>{entry.event_type}</strong>
                <span>Новость ID: {entry.entity_id || '-'}</span>
                <span>Успешно: {entry.sent_count || 0}</span>
                <span>Ошибки: {entry.error_count || 0}</span>
                <span>Статус: {entry.status}</span>
                <span>{new Date(entry.created_at).toLocaleString('ru-RU')}</span>
              </div>
            ))}
            {!sendLog.length && <div className="mobile-news__empty">Лог отправок пока пустой</div>}
          </div>
        </div>
      )}

      {previewNews && (
        <div className="mobile-news__preview-overlay" onClick={() => setPreviewNews(null)}>
          <div className="mobile-news__preview-modal" onClick={(e) => e.stopPropagation()}>
            <button className="mobile-news__preview-close" onClick={() => setPreviewNews(null)}>
              Закрыть
            </button>
            <div className="mobile-news__preview-card">
              {previewLoading ? (
                <div className="mobile-news__preview-loading">Загрузка новости...</div>
              ) : (
                <>
                  <img src={`${API_BASE_URL}5011${previewNews.cover_image_url}`} alt="" />
                  <div className="mobile-news__preview-content">
                    <h3>{previewNews.title}</h3>
                    <div className="mobile-news__publish-date">
                      {formatDateTime(previewNews.publish_at || previewNews.created_at)}
                    </div>
                    <p>{previewNews.summary}</p>
                    <div
                      className="mobile-news__preview-html"
                      dangerouslySetInnerHTML={{ __html: previewNews.content_html || '' }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={confirmPublishOpen}
        onClose={() => {
          setConfirmPublishOpen(false)
          setPendingSavePayload(null)
        }}
        onConfirm={async () => {
          const payload = pendingSavePayload
          setConfirmPublishOpen(false)
          setPendingSavePayload(null)
          if (payload) await runSaveNews(payload)
        }}
        title="Подтверждение публикации"
        message="После сохранения новость будет опубликована или обновит уже опубликованную версию. Продолжить?"
        btn1="Отмена"
        btn2="Продолжить"
      />

      <ConfirmationDialog
        open={confirmDeleteOpen}
        onClose={() => {
          setConfirmDeleteOpen(false)
          setPendingDeleteNewsId(null)
        }}
        onConfirm={async () => {
          const newsId = pendingDeleteNewsId
          setConfirmDeleteOpen(false)
          setPendingDeleteNewsId(null)
          if (newsId) await removeNews(newsId)
        }}
        title="Удаление новости"
        message="Вы уверены, что хотите удалить эту новость?"
        btn1="Отмена"
        btn2="Удалить"
      />
      <HelpModalMobileAppNews open={openHelpModal} onClose={() => setOpenHelpModal(false)} />
    </div>
  )
}

export default MobileAppNewsManagement
