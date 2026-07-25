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
import { staffNewsApi, staffNewsMediaUrl } from './api/staffNewsApi'
import '../mobileAppNews/mobileAppNewsManagement.scss'

const EMPTY_FORM = {
  id: null,
  title: '',
  summary: '',
  coverImageUrl: '',
  status: 'draft',
  importance: 'normal',
  isPinned: false,
  requiresAck: false,
  commentsEnabled: true,
  pollEnabled: false,
  pollQuestion: '',
  pollMultiple: false,
  pollOptions: ['', ''],
  publishAt: '',
  unpublishAt: '',
  segments: { departments: [], roles: [], users: [] },
  media: [],
  attachments: [],
}

const REACTION_LABELS = {
  like: 'Нравится',
  useful: 'Полезно',
  clarify: 'Нужны уточнения',
}

const STATUS_LABELS = {
  draft: 'Черновик',
  scheduled: 'Запланировано',
  published: 'Опубликовано',
  archived: 'Снято с публикации',
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
    style: { background: 'linear-gradient(to right, #ff5f6d, #ffc371)' },
  }).showToast()

const USER_CHIP_SEARCH_KEYS = ['roleName', 'departmentName', 'hint']

const ChipSelect = ({
  options,
  selected,
  onToggle,
  labelKey = 'name',
  valueKey = 'id',
  searchable = false,
  searchPlaceholder = 'Поиск…',
  searchKeys = null,
  scrollable = false,
}) => {
  const [query, setQuery] = useState('')
  const selectedSet = useMemo(
    () => new Set((selected || []).map(String)),
    [selected]
  )

  const visible = useMemo(() => {
    const list = options || []
    const q = query.trim().toLowerCase()
    if (!searchable || !q) return list
    const matched = list.filter((opt) => {
      const parts = [opt?.[labelKey]]
      if (Array.isArray(searchKeys)) {
        searchKeys.forEach((key) => parts.push(opt?.[key]))
      }
      return parts.filter(Boolean).join(' ').toLowerCase().includes(q)
    })
    const matchedIds = new Set(matched.map((opt) => String(opt[valueKey])))
    const selectedExtra = list.filter(
      (opt) =>
        selectedSet.has(String(opt[valueKey])) &&
        !matchedIds.has(String(opt[valueKey]))
    )
    return [...selectedExtra, ...matched]
  }, [options, query, searchable, labelKey, searchKeys, valueKey, selectedSet])

  return (
    <div className="mobile-news__chip-select">
      {searchable ? (
        <div className="mobile-news__chip-search-row">
          <input
            type="search"
            className="mobile-news__chip-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
          />
          {selectedSet.size > 0 ? (
            <span className="mobile-news__chip-selected-count">
              Выбрано: {selectedSet.size}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className={`mobile-news__chips${scrollable ? ' mobile-news__chips--scrollable' : ''}`}
      >
        {visible.length === 0 ? (
          <span className="mobile-news__chip-empty">Ничего не найдено</span>
        ) : (
          visible.map((opt) => {
            const value = String(opt[valueKey])
            const active = selectedSet.has(value)
            const hint = opt.hint || ''
            return (
              <button
                key={value}
                type="button"
                className={`mobile-news__chip ${active ? 'active' : ''}`}
                onClick={() => onToggle(value)}
                title={hint || opt[labelKey]}
              >
                {opt[labelKey]}
                {hint ? <span className="mobile-news__chip-hint">{hint}</span> : null}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

const StaffNewsManagement = () => {
  const { user } = useUserStore()
  const isAdmin = user?.role_name === 'Администратор'
  const [activeTab, setActiveTab] = useState('news')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [taxonomy, setTaxonomy] = useState({
    departments: [],
    roles: [],
    users: [],
  })
  const [audienceCount, setAudienceCount] = useState(null)
  const [changeLog, setChangeLog] = useState([])
  const [permissions, setPermissions] = useState([])
  const [permissionUserId, setPermissionUserId] = useState('')
  const [allUsers, setAllUsers] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [previewNews, setPreviewNews] = useState(null)
  const [ackReport, setAckReport] = useState(null)
  const [ackReportLoading, setAckReportLoading] = useState(false)
  const [ackReportTab, setAckReportTab] = useState('pending')
  const [ackReportSearch, setAckReportSearch] = useState('')
  const [engagement, setEngagement] = useState(null)
  const [engagementLoading, setEngagementLoading] = useState(false)
  const [engagementTab, setEngagementTab] = useState('reactions')
  const coverInputRef = useRef(null)
  const mediaInputRef = useRef(null)

  const editor = useEditor({
    extensions: [StarterKit, Underline, Image],
    content: '',
  })

  const resetForm = () => {
    setForm(EMPTY_FORM)
    editor?.commands?.setContent('')
    setAudienceCount(null)
  }

  const loadBase = useCallback(async () => {
    setLoading(true)
    try {
      const [perm, list, tax] = await Promise.all([
        staffNewsApi.getPermissions(user),
        staffNewsApi.listNews(user),
        staffNewsApi.getTaxonomy(user).catch(() => ({
          departments: [],
          roles: [],
          users: [],
        })),
      ])
      setCanEdit(Boolean(perm?.canEdit) || isAdmin || user?.role_name === 'Директор')
      setItems(list?.items || [])
      setTaxonomy({
        departments: tax.departments || [],
        roles: tax.roles || [],
        users: tax.users || [],
      })
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [user, isAdmin])

  useEffect(() => {
    if (user?.id) loadBase()
  }, [user?.id, loadBase])

  useEffect(() => {
    if (activeTab !== 'history') return
    staffNewsApi
      .listChangeLog(user)
      .then((data) => setChangeLog(data?.items || []))
      .catch(() => setChangeLog([]))
  }, [activeTab, user])

  useEffect(() => {
    if (activeTab !== 'permissions' || !isAdmin) return
    Promise.all([staffNewsApi.listPermissions(user), staffNewsApi.loadUsers()])
      .then(([perms, users]) => {
        setPermissions(perms?.items || [])
        setAllUsers(users || [])
      })
      .catch(() => {})
  }, [activeTab, isAdmin, user])

  const filteredNews = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (n) =>
        String(n.title || '').toLowerCase().includes(q) ||
        String(n.summary || '').toLowerCase().includes(q)
    )
  }, [items, search])

  const openAckReport = async (newsId) => {
    setAckReportLoading(true)
    setAckReportSearch('')
    setAckReportTab('pending')
    try {
      const data = await staffNewsApi.getAckReport(user, newsId)
      setAckReport(data)
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Не удалось загрузить отчёт')
      setAckReport(null)
    } finally {
      setAckReportLoading(false)
    }
  }

  const openEngagement = async (newsId) => {
    setEngagementLoading(true)
    setEngagementTab('reactions')
    try {
      const data = await staffNewsApi.getEngagementReport(user, newsId)
      setEngagement(data)
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Не удалось загрузить вовлечённость')
      setEngagement(null)
    } finally {
      setEngagementLoading(false)
    }
  }

  const ackReportUsers = useMemo(() => {
    if (!ackReport) return []
    const list =
      ackReportTab === 'acked'
        ? ackReport.ackedUsers || []
        : ackReport.pendingUsers || []
    const q = ackReportSearch.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (u) =>
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.department || '').toLowerCase().includes(q) ||
        String(u.role || '').toLowerCase().includes(q)
    )
  }, [ackReport, ackReportTab, ackReportSearch])

  const audienceUserOptions = useMemo(() => {
    const depMap = Object.fromEntries(
      (taxonomy.departments || []).map((d) => [String(d.id), d.name || ''])
    )
    return (taxonomy.users || []).map((u) => {
      const departmentName = depMap[String(u.departmentId)] || ''
      const roleName = u.roleName || ''
      const hint = [departmentName, roleName].filter(Boolean).join(' · ')
      return {
        ...u,
        departmentName,
        roleName,
        hint,
      }
    })
  }, [taxonomy.departments, taxonomy.users])

  const openEditor = async (newsId = null) => {
    if (!newsId) {
      resetForm()
      setActiveTab('editor')
      return
    }
    try {
      const news = await staffNewsApi.getNews(user, newsId)
      setForm({
        id: news.id,
        title: news.title || '',
        summary: news.summary || '',
        coverImageUrl: news.cover_image_url || '',
        status: news.status || 'draft',
        importance: news.importance || 'normal',
        isPinned: Boolean(news.is_pinned),
        requiresAck: Boolean(news.requires_ack),
        commentsEnabled: news.comments_enabled !== false,
        pollEnabled: Boolean(news.poll?.question),
        pollQuestion: news.poll?.question || '',
        pollMultiple: Boolean(news.poll?.isMultiple),
        pollOptions:
          news.poll?.options?.length >= 2
            ? news.poll.options.map((o) => o.label)
            : ['', ''],
        publishAt: toDateTimeLocalValue(news.publish_at),
        unpublishAt: toDateTimeLocalValue(news.unpublish_at),
        segments: {
          departments: (news.segments?.departments || []).map(String),
          roles: (news.segments?.roles || []).map(String),
          users: (news.segments?.users || []).map(String),
        },
        media: news.media || [],
        attachments: news.attachments || [],
      })
      editor?.commands?.setContent(news.content_html || '')
      setActiveTab('editor')
      refreshAudience({
        departments: (news.segments?.departments || []).map(String),
        roles: (news.segments?.roles || []).map(String),
        users: (news.segments?.users || []).map(String),
      })
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Не удалось открыть новость')
    }
  }

  const refreshAudience = async (segments) => {
    try {
      const data = await staffNewsApi.estimateAudience(user, segments)
      setAudienceCount(data?.count ?? null)
    } catch {
      setAudienceCount(null)
    }
  }

  const toggleSegment = (type, value) => {
    setForm((prev) => {
      const key =
        type === 'department' ? 'departments' : type === 'role' ? 'roles' : 'users'
      const list = prev.segments[key] || []
      const nextList = list.includes(value)
        ? list.filter((x) => x !== value)
        : [...list, value]
      const nextSegments = { ...prev.segments, [key]: nextList }
      refreshAudience(nextSegments)
      return { ...prev, segments: nextSegments }
    })
  }

  const uploadCover = async (file) => {
    if (!file) return
    try {
      const data = await staffNewsApi.uploadImage(user, file, form.title)
      setForm((prev) => ({ ...prev, coverImageUrl: data.file_url }))
      toastOk('Обложка загружена')
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Ошибка загрузки обложки')
    }
  }

  const uploadMedia = async (file) => {
    if (!file) return
    try {
      const data = await staffNewsApi.uploadImage(user, file, form.title)
      const src = staffNewsMediaUrl(data.file_url)
      editor?.chain().focus().setImage({ src }).run()
      setForm((prev) => ({
        ...prev,
        media: [
          ...prev.media,
          {
            file_url: data.file_url,
            file_name: data.file_name,
            file_size_bytes: data.file_size_bytes,
            mime_type: data.mime_type,
          },
        ],
      }))
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Ошибка загрузки изображения')
    }
  }

  const saveNews = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        summary: form.summary,
        coverImageUrl: form.coverImageUrl,
        contentHtml: editor?.getHTML() || '',
        status: form.status,
        importance: form.importance,
        isPinned: form.isPinned,
        requiresAck: form.requiresAck,
        commentsEnabled: form.commentsEnabled,
        publishAt: form.publishAt || null,
        unpublishAt: form.unpublishAt || null,
        segments: form.segments,
        media: form.media,
        attachments: form.attachments,
        poll: form.pollEnabled
          ? {
              question: form.pollQuestion,
              isMultiple: form.pollMultiple,
              options: form.pollOptions,
            }
          : null,
      }
      if (form.id) await staffNewsApi.updateNews(user, form.id, payload)
      else await staffNewsApi.createNews(user, payload)
      toastOk('Новость сохранена')
      await loadBase()
      setActiveTab('news')
      resetForm()
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    try {
      await staffNewsApi.deleteNews(user, confirmDelete)
      toastOk('Новость удалена')
      setConfirmDelete(null)
      await loadBase()
    } catch (error) {
      toastErr(error?.response?.data?.message || 'Ошибка удаления')
    }
  }

  if (loading) return <div className="mobile-news__loading">Загрузка...</div>

  return (
    <div className="mobile-news">
      <div className="mobile-news__header">
        <div className="mobile-news__header-row">
          <h1>Управление новостями (сотрудники)</h1>
          <MdContactSupport
            className="mobile-news__help-icon"
            title="Новости для POZ-Staff: отделы, роли, сотрудники"
          />
        </div>
        <p>
          Публикации для мобильного приложения сотрудников. Пустая аудитория = всем.
          Отделы, роли и сотрудники <strong>складываются</strong> (объединение): выбранный
          отдел + сотрудник из другого отдела — оба получат новость.
        </p>
      </div>

      <div className="mobile-news__tabs">
        <button
          type="button"
          className={`mobile-news__tab ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          Новости
        </button>
        <button
          type="button"
          className={`mobile-news__tab ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          Создание / редактирование
        </button>
        {isAdmin && (
          <button
            type="button"
            className={`mobile-news__tab ${activeTab === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('permissions')}
          >
            Права доступа
          </button>
        )}
        <button
          type="button"
          className={`mobile-news__tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          История
        </button>
      </div>

      {activeTab === 'news' && (
        <div className="mobile-news__panel">
          <div className="mobile-news__panel-head">
            <input
              className="mobile-news__search"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="mobile-news__primary-btn"
              onClick={() => openEditor(null)}
              disabled={!canEdit}
            >
              Создать новость
            </button>
          </div>
          <div className="mobile-news__list">
            {filteredNews.map((n) => (
              <div key={n.id} className="mobile-news__card">
                <div className="mobile-news__card-main">
                  <strong>
                    {n.is_pinned ? '📌 ' : ''}
                    {n.importance === 'high' ? '⚠ ' : ''}
                    {n.title}
                  </strong>
                  <div>{STATUS_LABELS[n.status] || n.status}</div>
                  {n.requires_ack ? (
                    <div className="mobile-news__publish-date">Ознакомление обязательно</div>
                  ) : null}
                  {n.publish_at && (
                    <div className="mobile-news__publish-date">
                      {new Date(n.publish_at).toLocaleString('ru-RU')}
                    </div>
                  )}
                </div>
                <div className="mobile-news__card-actions">
                  <button type="button" onClick={() => openEditor(n.id)}>
                    Открыть
                  </button>
                  {n.requires_ack ? (
                    <button type="button" onClick={() => openAckReport(n.id)}>
                      Ознакомление
                    </button>
                  ) : null}
                  <button type="button" onClick={() => openEngagement(n.id)}>
                    Вовлечённость
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const full = await staffNewsApi.getNews(user, n.id)
                      setPreviewNews(full)
                    }}
                  >
                    Превью
                  </button>
                  {canEdit && (
                    <button type="button" onClick={() => setConfirmDelete(n.id)}>
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!filteredNews.length && (
              <div className="mobile-news__empty">Новостей пока нет</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'editor' && (
        <div className="mobile-news__panel">
          {!canEdit && (
            <div className="mobile-news__warning">Нет прав на редактирование.</div>
          )}
          <div className="mobile-news__grid">
            <label>
              Заголовок
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                disabled={!canEdit}
              />
            </label>
            <label>
              Краткое описание
              <textarea
                value={form.summary}
                onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                disabled={!canEdit}
                rows={3}
              />
            </label>
            <label>
              Статус
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                disabled={!canEdit}
              >
                <option value="draft">Черновик</option>
                <option value="scheduled">Запланировано</option>
                <option value="published">Опубликовано</option>
                <option value="archived">Снято с публикации</option>
              </select>
            </label>
            <label>
              Важность
              <select
                value={form.importance}
                onChange={(e) => setForm((p) => ({ ...p, importance: e.target.value }))}
                disabled={!canEdit}
              >
                <option value="normal">Обычная</option>
                <option value="high">Важная</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.isPinned}
                onChange={(e) => setForm((p) => ({ ...p, isPinned: e.target.checked }))}
                disabled={!canEdit}
              />{' '}
              Закрепить сверху ленты
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.requiresAck}
                onChange={(e) => setForm((p) => ({ ...p, requiresAck: e.target.checked }))}
                disabled={!canEdit}
              />{' '}
              Обязательное ознакомление (кнопка «Подтверждаю» в приложении)
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.commentsEnabled}
                onChange={(e) =>
                  setForm((p) => ({ ...p, commentsEnabled: e.target.checked }))
                }
                disabled={!canEdit}
              />{' '}
              Комментарии в приложении
            </label>
            {form.status === 'scheduled' && (
              <label>
                Дата публикации
                <input
                  type="datetime-local"
                  value={form.publishAt}
                  onChange={(e) => setForm((p) => ({ ...p, publishAt: e.target.value }))}
                  disabled={!canEdit}
                />
              </label>
            )}
            <label>
              Снять с публикации (опционально)
              <input
                type="datetime-local"
                value={form.unpublishAt}
                onChange={(e) => setForm((p) => ({ ...p, unpublishAt: e.target.value }))}
                disabled={!canEdit}
              />
            </label>
          </div>

          <div className="mobile-news__section">
            <h3>Обложка</h3>
            <div className="mobile-news__upload-row">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="mobile-news__hidden-input"
                onChange={(e) => uploadCover(e.target.files?.[0])}
              />
              <button
                type="button"
                className="mobile-news__upload-btn"
                disabled={!canEdit}
                onClick={() => coverInputRef.current?.click()}
              >
                Загрузить обложку
              </button>
              {form.coverImageUrl ? (
                <div className="mobile-news__cover-preview-wrap">
                  <img
                    src={staffNewsMediaUrl(form.coverImageUrl)}
                    alt="cover"
                    className="mobile-news__preview"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mobile-news__section">
            <h3>Текст</h3>
            <EditorToolbarSimple editor={editor} />
            <EditorContent editor={editor} className="mobile-news__editor" />
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mobile-news__hidden-input"
              onChange={(e) => uploadMedia(e.target.files?.[0])}
            />
            <button
              type="button"
              className="mobile-news__upload-btn"
              disabled={!canEdit}
              onClick={() => mediaInputRef.current?.click()}
            >
              Вставить изображение в текст
            </button>
          </div>

          <div className="mobile-news__section">
            <h3>Вложения (PDF)</h3>
            <input
              type="file"
              accept="application/pdf"
              className="mobile-news__hidden-input"
              id="staff-news-pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const data = await staffNewsApi.uploadAttachment(user, file, form.title)
                  setForm((prev) => ({
                    ...prev,
                    attachments: [
                      ...prev.attachments,
                      {
                        file_url: data.file_url,
                        file_name: data.file_name,
                        file_size_bytes: data.file_size_bytes,
                        mime_type: data.mime_type,
                        media_type: 'pdf',
                      },
                    ],
                  }))
                  toastOk('PDF добавлен')
                } catch (error) {
                  toastErr(error?.response?.data?.message || 'Ошибка загрузки PDF')
                }
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="mobile-news__upload-btn"
              disabled={!canEdit}
              onClick={() => document.getElementById('staff-news-pdf')?.click()}
            >
              Прикрепить PDF
            </button>
            <div className="mobile-news__media-list">
              {(form.attachments || []).map((item, idx) => (
                <div key={`${item.file_url}_${idx}`} className="mobile-news__media-item">
                  <span>{item.file_name || item.file_url}</span>
                  <div className="mobile-news__media-actions">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          attachments: prev.attachments.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      Убрать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mobile-news__section">
            <h3>Опрос (опционально)</h3>
            <p className="mobile-news__hint">
              Изменение вариантов опроса при сохранении сбрасывает голоса.
            </p>
            <label>
              <input
                type="checkbox"
                checked={form.pollEnabled}
                onChange={(e) =>
                  setForm((p) => ({ ...p, pollEnabled: e.target.checked }))
                }
                disabled={!canEdit}
              />{' '}
              Добавить опрос к новости
            </label>
            {form.pollEnabled ? (
              <div className="mobile-news__grid" style={{ marginTop: 10 }}>
                <label>
                  Вопрос
                  <input
                    value={form.pollQuestion}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, pollQuestion: e.target.value }))
                    }
                    disabled={!canEdit}
                    placeholder="Например: Удобен ли новый регламент?"
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.pollMultiple}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, pollMultiple: e.target.checked }))
                    }
                    disabled={!canEdit}
                  />{' '}
                  Можно выбрать несколько вариантов
                </label>
                {(form.pollOptions || []).map((opt, idx) => (
                  <label key={`poll-opt-${idx}`}>
                    Вариант {idx + 1}
                    <div className="mobile-news__upload-row">
                      <input
                        value={opt}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...(p.pollOptions || [])]
                            next[idx] = e.target.value
                            return { ...p, pollOptions: next }
                          })
                        }
                        disabled={!canEdit}
                      />
                      {form.pollOptions.length > 2 ? (
                        <button
                          type="button"
                          className="mobile-news__ghost-btn"
                          disabled={!canEdit}
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              pollOptions: p.pollOptions.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Убрать
                        </button>
                      ) : null}
                    </div>
                  </label>
                ))}
                {form.pollOptions.length < 8 ? (
                  <button
                    type="button"
                    className="mobile-news__ghost-btn"
                    disabled={!canEdit}
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        pollOptions: [...(p.pollOptions || []), ''],
                      }))
                    }
                  >
                    + Вариант
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mobile-news__section">
            <h3>Аудитория (сотрудники)</h3>
            <p className="mobile-news__hint">
              Охват сейчас: {audienceCount == null ? '—' : `${audienceCount} чел.`} —
              отделы, роли и люди объединяются (плюсуются).
            </p>
            <h4>Отделы</h4>
            <ChipSelect
              options={taxonomy.departments}
              selected={form.segments.departments}
              onToggle={(v) => toggleSegment('department', v)}
              searchable
              searchPlaceholder="Найти отдел…"
              scrollable={taxonomy.departments.length > 12}
            />
            <h4>Роли</h4>
            <ChipSelect
              options={taxonomy.roles}
              selected={form.segments.roles}
              onToggle={(v) => toggleSegment('role', v)}
              valueKey="name"
              searchable
              searchPlaceholder="Найти роль…"
              scrollable={taxonomy.roles.length > 12}
            />
            <h4>Сотрудники (точечно)</h4>
            <ChipSelect
              options={audienceUserOptions}
              selected={form.segments.users}
              onToggle={(v) => toggleSegment('user', v)}
              searchable
              searchPlaceholder="ФИО, отдел или роль…"
              searchKeys={USER_CHIP_SEARCH_KEYS}
              scrollable
            />
          </div>

          <div className="mobile-news__actions">
            <button
              type="button"
              className="mobile-news__primary-btn"
              onClick={saveNews}
              disabled={saving || !canEdit}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            {form.id && form.requiresAck ? (
              <button
                type="button"
                className="mobile-news__ghost-btn"
                onClick={() => openAckReport(form.id)}
              >
                Отчёт по ознакомлению
              </button>
            ) : null}
            {form.id ? (
              <button
                type="button"
                className="mobile-news__ghost-btn"
                onClick={() => openEngagement(form.id)}
              >
                Вовлечённость
              </button>
            ) : null}
            <button type="button" className="mobile-news__ghost-btn" onClick={resetForm}>
              Сбросить
            </button>
          </div>
        </div>
      )}

      {activeTab === 'permissions' && isAdmin && (
        <div className="mobile-news__panel">
          <div className="mobile-news__permission-row">
            <select
              value={permissionUserId}
              onChange={(e) => setPermissionUserId(e.target.value)}
            >
              <option value="">Выберите сотрудника</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.last_name} {u.first_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="mobile-news__primary-btn"
              onClick={async () => {
                if (!permissionUserId) return
                await staffNewsApi.grantPermission(user, Number(permissionUserId))
                const perms = await staffNewsApi.listPermissions(user)
                setPermissions(perms?.items || [])
                toastOk('Права выданы')
              }}
            >
              Выдать право редактирования
            </button>
          </div>
          <div className="mobile-news__permission-list">
            {permissions.map((p) => (
              <div key={p.id} className="mobile-news__permission-item">
                <span>
                  {p.last_name} {p.first_name}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await staffNewsApi.revokePermission(user, p.id)
                    const perms = await staffNewsApi.listPermissions(user)
                    setPermissions(perms?.items || [])
                  }}
                >
                  Отозвать
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="mobile-news__panel">
          <div className="mobile-news__history">
            {changeLog.map((entry) => (
              <div key={entry.id} className="mobile-news__history-item">
                <div>
                  <strong>{entry.action_type}</strong> · новость #{entry.news_id} ·{' '}
                  {entry.last_name} {entry.first_name}
                </div>
                <div>{new Date(entry.created_at).toLocaleString('ru-RU')}</div>
              </div>
            ))}
            {!changeLog.length && (
              <div className="mobile-news__empty">История пока пустая</div>
            )}
          </div>
        </div>
      )}

      {previewNews && (
        <div className="mobile-news__preview-overlay" onClick={() => setPreviewNews(null)}>
          <div
            className="mobile-news__preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="mobile-news__preview-close"
              onClick={() => setPreviewNews(null)}
            >
              ×
            </button>
            <div className="mobile-news__preview-card">
              {previewNews.cover_image_url ? (
                <img
                  src={staffNewsMediaUrl(previewNews.cover_image_url)}
                  alt=""
                  style={{ width: '100%', borderRadius: 8 }}
                />
              ) : null}
              <div className="mobile-news__preview-content">
                <h2>{previewNews.title}</h2>
                <div
                  className="mobile-news__preview-html"
                  dangerouslySetInnerHTML={{ __html: previewNews.content_html || '' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {(ackReport || ackReportLoading) && (
        <div
          className="mobile-news__preview-overlay"
          onClick={() => !ackReportLoading && setAckReport(null)}
        >
          <div
            className="mobile-news__preview-modal mobile-news__ack-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="mobile-news__preview-close"
              onClick={() => setAckReport(null)}
              disabled={ackReportLoading}
            >
              ×
            </button>
            {ackReportLoading || !ackReport ? (
              <div className="mobile-news__empty">Загрузка отчёта...</div>
            ) : (
              <div className="mobile-news__ack-report">
                <h2>Ознакомление</h2>
                <p className="mobile-news__ack-title">{ackReport.title}</p>
                {!ackReport.requiresAck ? (
                  <div className="mobile-news__empty">
                    {ackReport.message || 'Ознакомление не требуется'}
                  </div>
                ) : (
                  <>
                    <div className="mobile-news__ack-summary">
                      <strong>
                        {ackReport.acked} из {ackReport.total}
                      </strong>{' '}
                      ({ackReport.percent}%) ознакомились · ожидают:{' '}
                      <strong>{ackReport.pending}</strong>
                    </div>
                    <div className="mobile-news__ack-tabs">
                      <button
                        type="button"
                        className={ackReportTab === 'pending' ? 'active' : ''}
                        onClick={() => setAckReportTab('pending')}
                      >
                        Не ознакомились ({ackReport.pending})
                      </button>
                      <button
                        type="button"
                        className={ackReportTab === 'acked' ? 'active' : ''}
                        onClick={() => setAckReportTab('acked')}
                      >
                        Ознакомились ({ackReport.acked})
                      </button>
                    </div>
                    <input
                      className="mobile-news__search"
                      placeholder="Поиск по ФИО, отделу, роли..."
                      value={ackReportSearch}
                      onChange={(e) => setAckReportSearch(e.target.value)}
                    />
                    <div className="mobile-news__ack-list">
                      {ackReportUsers.map((u) => (
                        <div key={u.id} className="mobile-news__ack-item">
                          <div>
                            <strong>{u.name || `ID ${u.id}`}</strong>
                            <div className="mobile-news__publish-date">
                              {u.department} · {u.role}
                            </div>
                          </div>
                          {u.ackedAt ? (
                            <div className="mobile-news__publish-date">
                              {new Date(u.ackedAt).toLocaleString('ru-RU')}
                            </div>
                          ) : (
                            <div className="mobile-news__ack-pending">не подтвердил</div>
                          )}
                        </div>
                      ))}
                      {!ackReportUsers.length && (
                        <div className="mobile-news__empty">Список пуст</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {(engagement || engagementLoading) && (
        <div
          className="mobile-news__preview-overlay"
          onClick={() => !engagementLoading && setEngagement(null)}
        >
          <div
            className="mobile-news__preview-modal mobile-news__ack-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="mobile-news__preview-close"
              onClick={() => setEngagement(null)}
            >
              ×
            </button>
            {engagementLoading || !engagement ? (
              <div className="mobile-news__empty">Загрузка...</div>
            ) : (
              <div className="mobile-news__ack-report">
                <h2>Вовлечённость</h2>
                <p className="mobile-news__ack-title">{engagement.title}</p>
                <div className="mobile-news__ack-summary">
                  Реакции: 👍 {engagement.reactionCounts?.like || 0} · полезно{' '}
                  {engagement.reactionCounts?.useful || 0} · уточнения{' '}
                  {engagement.reactionCounts?.clarify || 0} · комментарии:{' '}
                  {engagement.commentsCount || 0}
                </div>
                <div className="mobile-news__ack-tabs">
                  <button
                    type="button"
                    className={engagementTab === 'reactions' ? 'active' : ''}
                    onClick={() => setEngagementTab('reactions')}
                  >
                    Реакции
                  </button>
                  <button
                    type="button"
                    className={engagementTab === 'comments' ? 'active' : ''}
                    onClick={() => setEngagementTab('comments')}
                  >
                    Комментарии ({engagement.commentsCount || 0})
                  </button>
                  <button
                    type="button"
                    className={engagementTab === 'poll' ? 'active' : ''}
                    onClick={() => setEngagementTab('poll')}
                  >
                    Опрос
                  </button>
                </div>
                <div className="mobile-news__ack-list">
                  {engagementTab === 'reactions' &&
                    ['like', 'useful', 'clarify'].map((key) => (
                      <div key={key} className="mobile-news__ack-item" style={{ flexDirection: 'column' }}>
                        <strong>
                          {REACTION_LABELS[key]} ({engagement.reactionCounts?.[key] || 0})
                        </strong>
                        {(engagement.reactionsByType?.[key] || []).length ? (
                          (engagement.reactionsByType[key] || []).map((u) => (
                            <div key={`${key}-${u.userId}`} className="mobile-news__publish-date">
                              {u.name} · {u.department}
                            </div>
                          ))
                        ) : (
                          <div className="mobile-news__publish-date">пока пусто</div>
                        )}
                      </div>
                    ))}
                  {engagementTab === 'comments' &&
                    (engagement.comments || []).map((c) => (
                      <div key={c.id} className="mobile-news__ack-item">
                        <div>
                          <strong>{c.authorName}</strong>
                          <div>{c.body}</div>
                          <div className="mobile-news__publish-date">
                            {c.createdAt
                              ? new Date(c.createdAt).toLocaleString('ru-RU')
                              : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="mobile-news__ghost-btn"
                          onClick={async () => {
                            try {
                              await staffNewsApi.deleteComment(user, c.id)
                              const data = await staffNewsApi.getEngagementReport(
                                user,
                                engagement.newsId
                              )
                              setEngagement(data)
                              toastOk('Комментарий удалён')
                            } catch (error) {
                              toastErr(
                                error?.response?.data?.message || 'Ошибка удаления'
                              )
                            }
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    ))}
                  {engagementTab === 'comments' && !(engagement.comments || []).length && (
                    <div className="mobile-news__empty">Комментариев нет</div>
                  )}
                  {engagementTab === 'poll' && !engagement.poll && (
                    <div className="mobile-news__empty">Опрос не задан</div>
                  )}
                  {engagementTab === 'poll' && engagement.poll && (
                    <>
                      <div className="mobile-news__ack-summary">
                        <strong>{engagement.poll.question}</strong>
                        <div>Голосов: {engagement.poll.totalVotes}</div>
                      </div>
                      {(engagement.poll.options || []).map((o) => (
                        <div key={o.id} className="mobile-news__ack-item">
                          <div>
                            <strong>{o.label}</strong>
                            <div className="mobile-news__publish-date">
                              {o.votes} ({o.percent}%)
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Удалить новость?"
        message="Действие необратимо."
      />
    </div>
  )
}

export default StaffNewsManagement
