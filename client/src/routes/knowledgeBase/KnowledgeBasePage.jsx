import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import Toastify from 'toastify-js'
import {
  FaBookOpen,
  FaDownload,
  FaEdit,
  FaPlus,
  FaSearch,
  FaTrash,
  FaFileAlt,
  FaExternalLinkAlt,
  FaQuestionCircle,
  FaHistory,
  FaEye,
  FaCog,
  FaRegStar,
  FaStar,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileArchive,
} from 'react-icons/fa'
import { API_BASE_URL } from '../../../config'
import useUserStore from '../../store/userStore'
import ImageViewer from '../kanbanBoard/Task/subcomponents/ImageViewer'
import ConfirmationDialog from '../../components/confirmationDialog/ConfirmationDialog'
import { knowledgeBaseApi } from './knowledgeBaseApi'
import KnowledgeDocumentForm from './KnowledgeDocumentForm'
import KnowledgeSidebar from './KnowledgeSidebar'
import HelpModalKnowledge from './HelpModalKnowledge'
import KnowledgeTaxonomyAdmin from './KnowledgeTaxonomyAdmin'
import './knowledgeBase.scss'

const toast = (text, ok = true) => {
  Toastify({
    text,
    duration: 3200,
    close: true,
    gravity: 'top',
    position: 'right',
    backgroundColor: ok
      ? 'linear-gradient(to right, #0f766e, #14b8a6)'
      : 'linear-gradient(to right, #8B0000, #ff0000)',
  }).showToast()
}

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

const formatSize = (bytes) => {
  if (bytes == null || Number.isNaN(Number(bytes))) return ''
  const n = Number(bytes)
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`
}

const isPdf = (fileType, fileName) => {
  if (fileType && (fileType === 'application/pdf' || String(fileType).includes('pdf'))) {
    return true
  }
  return Boolean(fileName && String(fileName).toLowerCase().endsWith('.pdf'))
}

const isImage = (fileType, fileName) => {
  if (fileType && String(fileType).startsWith('image/')) return true
  const name = String(fileName || '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
}

const getFileIcon = (fileType, fileName) => {
  const name = String(fileName || '').toLowerCase()
  const type = String(fileType || '').toLowerCase()
  if (isPdf(fileType, fileName)) {
    return { icon: FaFilePdf, className: 'is-pdf' }
  }
  if (isImage(fileType, fileName)) {
    return { icon: FaFileImage, className: 'is-image' }
  }
  if (
    type.includes('word') ||
    /\.(doc|docx|rtf)$/i.test(name)
  ) {
    return { icon: FaFileWord, className: 'is-word' }
  }
  if (
    type.includes('excel') ||
    type.includes('spreadsheet') ||
    /\.(xls|xlsx|csv)$/i.test(name)
  ) {
    return { icon: FaFileExcel, className: 'is-excel' }
  }
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) {
    return { icon: FaFileArchive, className: 'is-archive' }
  }
  return { icon: FaFileAlt, className: 'is-default' }
}

const KnowledgeBasePage = () => {
  const { user } = useUserStore()
  const userId = user?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [documents, setDocuments] = useState([])
  const [treeDocuments, setTreeDocuments] = useState([])
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [permissions, setPermissions] = useState(null)

  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [category, setCategory] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [favoriteOnly, setFavoriteOnly] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewingImage, setViewingImage] = useState(null)
  const [reindexing, setReindexing] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [versionsDoc, setVersionsDoc] = useState(null)
  const [versionsData, setVersionsData] = useState(null)
  const [eventsDoc, setEventsDoc] = useState(null)
  const [events, setEvents] = useState([])
  const [panelLoading, setPanelLoading] = useState(false)
  const [taxonomyOpen, setTaxonomyOpen] = useState(false)
  const [taxonomyBusy, setTaxonomyBusy] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    btn1: 'Отмена',
    btn2: 'ОК',
    onConfirm: null,
  })

  const closeConfirm = () =>
    setConfirmDialog((p) => ({ ...p, open: false, onConfirm: null }))

  const askConfirm = ({ title, message, btn1 = 'Отмена', btn2 = 'ОК', onConfirm }) => {
    setConfirmDialog({
      open: true,
      title,
      message,
      btn1,
      btn2,
      onConfirm,
    })
  }

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 280)
    return () => clearTimeout(t)
  }, [q])

  const isElevated = Boolean(permissions?.isAdmin || permissions?.isDirector)
  const isAdmin = Boolean(permissions?.isAdmin)

  const loadMeta = useCallback(async () => {
    if (!userId) return
    try {
      const [perms, depsRes, usersRes] = await Promise.all([
        knowledgeBaseApi.getPermissions(userId),
        axios.get(`${API_BASE_URL}5000/api/departments`),
        axios.get(`${API_BASE_URL}5000/api/users`),
      ])
      setPermissions(perms)
      setDepartments(Array.isArray(depsRes.data) ? depsRes.data : [])
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : [])
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error || 'Не удалось загрузить справочники базы знаний'
      )
    }
  }, [userId])

  const sortDocuments = (list) =>
    [...(list || [])].sort((a, b) => {
      if (Boolean(a.isFavorite) !== Boolean(b.isFavorite)) {
        return a.isFavorite ? -1 : 1
      }
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      if (tb !== ta) return tb - ta
      return Number(b.id) - Number(a.id)
    })

  const loadTreeDocuments = useCallback(async () => {
    if (!userId) return
    try {
      // Без фильтров дерева (отдел/категория/избранное) — иначе счётчики в сайдбаре «сбиваются»
      const result = await knowledgeBaseApi.listDocuments(userId, {
        q: qDebounced,
        mineOnly,
      })
      setTreeDocuments(sortDocuments(result.documents))
      setFavoriteCount(Number(result.favoriteCount) || 0)
      setTotalCount(Number(result.totalCount) || 0)
    } catch (err) {
      console.error(err)
      setTreeDocuments([])
      setFavoriteCount(0)
      setTotalCount(0)
    }
  }, [userId, qDebounced, mineOnly])

  const loadDocuments = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError('')
    try {
      const result = await knowledgeBaseApi.listDocuments(userId, {
        q: qDebounced,
        category: category || undefined,
        departmentId: departmentId || undefined,
        mineOnly,
        favoriteOnly,
      })
      setDocuments(sortDocuments(result.documents))
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || 'Не удалось загрузить документы')
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [userId, qDebounced, category, departmentId, mineOnly, favoriteOnly])

  const toggleFavorite = async (doc) => {
    if (!userId || !doc?.id) return
    try {
      if (doc.isFavorite) {
        await knowledgeBaseApi.removeFavorite(userId, doc.id)
      } else {
        await knowledgeBaseApi.addFavorite(userId, doc.id)
      }
      const nextFavorite = !doc.isFavorite
      setDocuments((prev) =>
        sortDocuments(
          prev
            .map((item) =>
              item.id === doc.id ? { ...item, isFavorite: nextFavorite } : item
            )
            .filter((item) => (favoriteOnly ? item.isFavorite : true))
        )
      )
      setTreeDocuments((prev) =>
        sortDocuments(
          prev.map((item) =>
            item.id === doc.id ? { ...item, isFavorite: nextFavorite } : item
          )
        )
      )
      setFavoriteCount((prev) => {
        const next = doc.isFavorite ? prev - 1 : prev + 1
        return next < 0 ? 0 : next
      })
    } catch (err) {
      toast(err.response?.data?.error || 'Не удалось обновить избранное', false)
    }
  }

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  useEffect(() => {
    loadTreeDocuments()
  }, [loadTreeDocuments])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const refreshLists = useCallback(async () => {
    await Promise.all([loadDocuments(), loadTreeDocuments()])
  }, [loadDocuments, loadTreeDocuments])

  const categories = permissions?.categories || []
  const tags = permissions?.tags || []
  const visibilityModes = permissions?.visibilityModes || []

  const deptMap = useMemo(() => {
    const map = {}
    departments.forEach((d) => {
      map[String(d.id)] = d.name
    })
    return map
  }, [departments])

  const buildFormData = (payload) => {
    const fd = new FormData()
    fd.append('title', payload.title.trim())
    fd.append('description', payload.description || '')
    fd.append('category', payload.category)
    fd.append('ownerDepartmentId', String(payload.ownerDepartmentId))
    fd.append('visibilityMode', payload.visibilityMode)
    fd.append('tags', payload.tags || '')
    fd.append(
      'segments',
      JSON.stringify({
        departments: payload.departmentIds || [],
        users: payload.userIds || [],
      })
    )
    if (payload.replaceDocumentId) {
      fd.append('replaceDocumentId', String(payload.replaceDocumentId))
    }
    if (payload.forceDuplicate) {
      fd.append('forceDuplicate', '1')
    }
    if (payload.confirmDifferentFileName) {
      fd.append('confirmDifferentFileName', '1')
    }
    if (payload.file) fd.append('file', payload.file)
    return fd
  }

  const handleSubmit = async (payload) => {
    if (!userId) return
    setSaving(true)
    try {
      const fd = buildFormData(payload)
      if (payload.isEdit) {
        await knowledgeBaseApi.updateDocument(userId, payload.id, fd)
        toast('Документ обновлён')
      } else {
        await knowledgeBaseApi.createDocument(userId, fd)
        toast('Документ загружен')
      }
      setFormOpen(false)
      setEditing(null)
      await refreshLists()
    } catch (err) {
      console.error(err)
      const data = err.response?.data
      if (data?.code === 'TITLE_EXISTS' && data.documentId && !payload.isEdit) {
        askConfirm({
          title: 'Заменить новой версией?',
          message: `${data.error} Название документа останется прежним.`,
          btn1: 'Отмена',
          btn2: 'Заменить',
          onConfirm: () => {
            closeConfirm()
            handleSubmit({ ...payload, replaceDocumentId: data.documentId })
          },
        })
      } else if (data?.code === 'FILE_NAME_MISMATCH') {
        askConfirm({
          title: 'Другое имя файла',
          message: `${data.error} Было: «${data.currentFileName || '—'}». Стало: «${data.newFileName || '—'}».`,
          btn1: 'Отмена',
          btn2: 'Всё равно заменить',
          onConfirm: () => {
            closeConfirm()
            handleSubmit({ ...payload, confirmDifferentFileName: true })
          },
        })
      } else if (data?.code === 'DUPLICATE_HASH') {
        toast(data.error || 'Такой файл уже есть в базе', false)
      } else if (data?.code === 'TITLE_LOCKED_ON_VERSION') {
        toast(data.error || 'При новой версии название менять нельзя', false)
      } else {
        toast(data?.error || 'Ошибка сохранения', false)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (doc) => {
    if (!userId || !doc?.canManage) return
    askConfirm({
      title: 'Удалить документ?',
      message: `Удалить документ «${doc.title}»?`,
      btn1: 'Отмена',
      btn2: 'Удалить',
      onConfirm: async () => {
        closeConfirm()
        try {
          await knowledgeBaseApi.deleteDocument(userId, doc.id)
          toast('Документ удалён')
          await refreshLists()
        } catch (err) {
          toast(err.response?.data?.error || 'Ошибка удаления', false)
        }
      },
    })
  }

  const handleDownload = useCallback(
    async (doc) => {
      if (!userId || !doc) return
      const url = knowledgeBaseApi.downloadUrl(userId, doc.id)
      const fileName = doc.fileName || doc.title || 'file'
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error('download failed')
        const blob = await response.blob()
        const blobUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(blobUrl)
      } catch (err) {
        console.error(err)
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },
    [userId]
  )

  const handlePreview = useCallback(
    (doc) => {
      if (!userId || !doc) return
      const viewUrl = knowledgeBaseApi.viewUrl(userId, doc.id)
      if (isImage(doc.fileType, doc.fileName)) {
        setViewingImage({
          fileUrl: viewUrl,
          fileName: doc.fileName || doc.title,
          doc,
        })
        return
      }
      if (isPdf(doc.fileType, doc.fileName)) {
        window.open(viewUrl, '_blank', 'noopener,noreferrer')
      }
    },
    [userId]
  )

  const handleReindex = async () => {
    if (!userId || !isElevated) return
    setReindexing(true)
    try {
      const result = await knowledgeBaseApi.reindex(userId)
      toast(result?.message || 'Индекс поиска обновлён')
      await refreshLists()
    } catch (err) {
      toast(err.response?.data?.error || 'Ошибка переиндексации', false)
    } finally {
      setReindexing(false)
    }
  }

  const openVersions = async (doc) => {
    if (!userId) return
    setPanelLoading(true)
    setVersionsDoc(doc)
    setEventsDoc(null)
    try {
      const data = await knowledgeBaseApi.listVersions(userId, doc.id)
      setVersionsData(data)
    } catch (err) {
      toast(err.response?.data?.error || 'Не удалось загрузить версии', false)
      setVersionsDoc(null)
    } finally {
      setPanelLoading(false)
    }
  }

  const openEvents = async (doc) => {
    if (!userId || !doc.canManage) return
    setPanelLoading(true)
    setEventsDoc(doc)
    setVersionsDoc(null)
    try {
      const list = await knowledgeBaseApi.listEvents(userId, doc.id)
      setEvents(list)
    } catch (err) {
      toast(err.response?.data?.error || 'Не удалось загрузить аудит', false)
      setEventsDoc(null)
    } finally {
      setPanelLoading(false)
    }
  }

  const canPreview = (doc) =>
    isPdf(doc.fileType, doc.fileName) || isImage(doc.fileType, doc.fileName)

  return (
    <div className="kb">
      <header className="kb__header">
        <div>
          <h1>
            <FaBookOpen /> База знаний
            <button
              type="button"
              className="kb__help-btn"
              title="Справка"
              onClick={() => setHelpOpen(true)}
            >
              <FaQuestionCircle />
            </button>
          </h1> 
        </div>
        <div className="kb__header-actions">
          {isAdmin ? (
            <button
              type="button"
              className="kb-btn kb-btn--ghost"
              onClick={() => setTaxonomyOpen(true)}
              title="Справочник категорий и тегов"
            >
              <FaCog /> Категории и теги
            </button>
          ) : null}
          {isElevated ? (
            <button
              type="button"
              className="kb-btn kb-btn--ghost"
              disabled={reindexing}
              onClick={handleReindex}
              title="Повторно извлечь текст уже загруженных файлов. При обычной загрузке/обновлении индекс строится сам."
            >
              {reindexing ? 'Индексация…' : 'Обновить поиск по файлам'}
            </button>
          ) : null}
          {permissions?.canUpload ? (
            <button
              type="button"
              className="kb-btn kb-btn--primary"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <FaPlus /> Загрузить
            </button>
          ) : null}
        </div>
      </header>

      <div className="kb__filters">
        <div className="kb__search-wrap">
          <div className="kb__search">
            <FaSearch />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по названию, описанию, тегам и тексту файла…"
            />
          </div>
          <p className="kb__search-hint">
            Поиск находит <strong>документ (файл)</strong>, а не отдельную ячейку
            Excel. Введите ключевые слова — откройте файл и посмотрите точные
            значения в таблице.
          </p>
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <option value="">Все отделы</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <label className="kb__mine">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
          />
          Только мой отдел
        </label>
        <label className="kb__mine">
          <input
            type="checkbox"
            checked={favoriteOnly}
            onChange={(e) => setFavoriteOnly(e.target.checked)}
          />
          Только избранное
        </label>
      </div>

      {error ? <div className="kb__error">{error}</div> : null}

      <div className="kb__body">
        <KnowledgeSidebar
          departments={departments}
          categories={categories}
          documents={treeDocuments}
          departmentId={departmentId}
          category={category}
          favoriteOnly={favoriteOnly}
          favoriteCount={favoriteCount}
          totalCount={totalCount}
          onSelectDepartment={(id) => {
            setFavoriteOnly(false)
            setDepartmentId(id)
            if (!id) setCategory('')
          }}
          onSelectCategory={(id) => {
            setFavoriteOnly(false)
            setCategory(id)
          }}
          onSelectFavorites={() => {
            setFavoriteOnly(true)
            setDepartmentId('')
            setCategory('')
            setMineOnly(false)
          }}
          onClear={() => {
            setDepartmentId('')
            setCategory('')
            setMineOnly(false)
            setFavoriteOnly(false)
          }}
        />

        <div className="kb__content">
          {loading ? (
            <div className="kb__empty">Загрузка…</div>
          ) : documents.length === 0 ? (
            <div className="kb__empty">
              Документов не найдено. Измените фильтры или загрузите первый файл.
            </div>
          ) : (
            <ul className="kb__list">
              {documents.map((doc) => {
                const fileIcon = getFileIcon(doc.fileType, doc.fileName)
                const FileIcon = fileIcon.icon
                return (
                <li key={doc.id} className="kb__card">
                  <div className={`kb__card-icon ${fileIcon.className}`}>
                    <FileIcon />
                  </div>
                  <div className="kb__card-main">
                    <div className="kb__card-top">
                      <button
                        type="button"
                        className={`kb__fav ${doc.isFavorite ? 'is-on' : ''}`}
                        title={doc.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                        onClick={() => toggleFavorite(doc)}
                      >
                        {doc.isFavorite ? <FaStar /> : <FaRegStar />}
                      </button>
                      <h3 title={doc.title}>{doc.title}</h3>
                      <span className="kb__badge">{doc.categoryLabel}</span>
                      {doc.versionNumber > 1 ? (
                        <span className="kb__badge kb__badge--ver">
                          v{doc.versionNumber}
                        </span>
                      ) : null}
                    </div>
                    {doc.description ? (
                      <p className="kb__desc">{doc.description}</p>
                    ) : null}
                    <div className="kb__meta">
                      <span>
                        {doc.ownerDepartmentName ||
                          deptMap[String(doc.ownerDepartmentId)] ||
                          'Отдел'}
                      </span>
                      <span>·</span>
                      <span>{doc.visibilityLabel}</span>
                      <span>·</span>
                      <span>{formatDate(doc.updatedAt)}</span>
                      {doc.fileSize != null ? (
                        <>
                          <span>·</span>
                          <span>{formatSize(doc.fileSize)}</span>
                        </>
                      ) : null}
                    </div>
                    {doc.tags?.length ? (
                      <div className="kb__tags">
                        {doc.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    ) : null}
                    {doc.fileName ? (
                      <div className="kb__filename">{doc.fileName}</div>
                    ) : null}
                  </div>
                  <div className="kb__card-actions">
                    {canPreview(doc) ? (
                      <button
                        type="button"
                        className="kb-btn kb-btn--ghost"
                        title={
                          isPdf(doc.fileType, doc.fileName)
                            ? 'Открыть PDF'
                            : 'Просмотреть'
                        }
                        onClick={() => handlePreview(doc)}
                      >
                        <FaExternalLinkAlt />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="kb-btn kb-btn--ghost"
                      title="Скачать"
                      onClick={() => handleDownload(doc)}
                    >
                      <FaDownload />
                    </button>
                    <button
                      type="button"
                      className="kb-btn kb-btn--ghost"
                      title="История версий"
                      onClick={() => openVersions(doc)}
                    >
                      <FaHistory />
                    </button>
                    {doc.canManage ? (
                      <>
                        <button
                          type="button"
                          className="kb-btn kb-btn--ghost"
                          title="Аудит просмотров"
                          onClick={() => openEvents(doc)}
                        >
                          <FaEye />
                        </button>
                        <button
                          type="button"
                          className="kb-btn kb-btn--ghost"
                          title="Редактировать"
                          onClick={() => {
                            setEditing(doc)
                            setFormOpen(true)
                          }}
                        >
                          <FaEdit />
                        </button>
                        <button
                          type="button"
                          className="kb-btn kb-btn--danger"
                          title="Удалить"
                          onClick={() => handleDelete(doc)}
                        >
                          <FaTrash />
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              )})}
            </ul>
          )}
        </div>
      </div>

      <KnowledgeDocumentForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        saving={saving}
        departments={departments}
        users={users}
        categories={categories}
        tags={tags}
        visibilityModes={visibilityModes}
        headDepartmentIds={permissions?.headDepartmentIds || []}
        isElevated={isElevated}
        initial={editing}
      />

      <KnowledgeTaxonomyAdmin
        open={taxonomyOpen}
        onClose={() => setTaxonomyOpen(false)}
        categories={categories}
        tags={tags}
        busy={taxonomyBusy}
        onAddCategory={async (label) => {
          if (!userId) return
          setTaxonomyBusy(true)
          try {
            await knowledgeBaseApi.createCategory(userId, label)
            toast('Категория добавлена')
            await loadMeta()
          } catch (err) {
            toast(err.response?.data?.error || 'Ошибка добавления категории', false)
          } finally {
            setTaxonomyBusy(false)
          }
        }}
        onDeleteCategory={(cat) => {
          askConfirm({
            title: 'Удалить категорию?',
            message: `Удалить категорию «${cat.label}»? Можно только если нет документов с этой категорией.`,
            btn1: 'Отмена',
            btn2: 'Удалить',
            onConfirm: async () => {
              closeConfirm()
              if (!userId) return
              setTaxonomyBusy(true)
              try {
                await knowledgeBaseApi.deleteCategory(userId, cat.id)
                toast('Категория удалена')
                if (category === cat.id) setCategory('')
                await loadMeta()
              } catch (err) {
                toast(err.response?.data?.error || 'Ошибка удаления категории', false)
              } finally {
                setTaxonomyBusy(false)
              }
            },
          })
        }}
        onAddTag={async (name) => {
          if (!userId) return
          setTaxonomyBusy(true)
          try {
            await knowledgeBaseApi.createTag(userId, name)
            toast('Тег добавлен')
            await loadMeta()
          } catch (err) {
            toast(err.response?.data?.error || 'Ошибка добавления тега', false)
          } finally {
            setTaxonomyBusy(false)
          }
        }}
        onDeleteTag={(tag) => {
          askConfirm({
            title: 'Удалить тег?',
            message: `Удалить тег «${tag.name}»? Можно только если он не используется в документах.`,
            btn1: 'Отмена',
            btn2: 'Удалить',
            onConfirm: async () => {
              closeConfirm()
              if (!userId) return
              setTaxonomyBusy(true)
              try {
                await knowledgeBaseApi.deleteTag(userId, tag.id)
                toast('Тег удалён')
                await loadMeta()
              } catch (err) {
                toast(err.response?.data?.error || 'Ошибка удаления тега', false)
              } finally {
                setTaxonomyBusy(false)
              }
            },
          })
        }}
      />

      <HelpModalKnowledge open={helpOpen} onClose={() => setHelpOpen(false)} />

      <ConfirmationDialog
        open={confirmDialog.open}
        onClose={closeConfirm}
        onConfirm={() => {
          if (typeof confirmDialog.onConfirm === 'function') confirmDialog.onConfirm()
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        btn1={confirmDialog.btn1}
        btn2={confirmDialog.btn2}
      />

      {versionsDoc ? (
        <div className="kb-modal-overlay">
          <div className="kb-modal">
            <div className="kb-modal__header">
              <h2>Версии: {versionsDoc.title}</h2>
              <button
                type="button"
                className="kb-modal__close"
                onClick={() => setVersionsDoc(null)}
              >
                ×
              </button>
            </div>
            <div className="kb-modal__form">
              {panelLoading ? (
                <p>Загрузка…</p>
              ) : (
                <>
                  <p className="kb__panel-note">
                    Текущая версия: <strong>v{versionsData?.currentVersion || 1}</strong>.
                    В поиске участвует только она. Ниже — предыдущие файлы.
                  </p>
                  {!versionsData?.versions?.length ? (
                    <p>Предыдущих версий пока нет.</p>
                  ) : (
                    <ul className="kb__panel-list">
                      {versionsData.versions.map((v) => (
                        <li key={v.id}>
                          <div>
                            <strong>v{v.versionNumber}</strong> — {v.fileName || 'файл'}
                            <div className="kb__meta">
                              {formatDate(v.createdAt)}
                              {v.uploadedByName ? ` · ${v.uploadedByName}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="kb-btn kb-btn--ghost"
                            onClick={() =>
                              window.open(
                                knowledgeBaseApi.versionDownloadUrl(
                                  userId,
                                  versionsDoc.id,
                                  v.id
                                ),
                                '_blank',
                                'noopener,noreferrer'
                              )
                            }
                          >
                            <FaDownload />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {eventsDoc ? (
        <div className="kb-modal-overlay">
          <div className="kb-modal">
            <div className="kb-modal__header">
              <h2>Аудит: {eventsDoc.title}</h2>
              <button
                type="button"
                className="kb-modal__close"
                onClick={() => setEventsDoc(null)}
              >
                ×
              </button>
            </div>
            <div className="kb-modal__form">
              {panelLoading ? (
                <p>Загрузка…</p>
              ) : !events.length ? (
                <p>Пока нет просмотров и скачиваний.</p>
              ) : (
                <ul className="kb__panel-list">
                  {events.map((ev) => (
                    <li key={ev.id}>
                      <div>
                        <strong>{ev.eventLabel}</strong> — {ev.userName}
                        <div className="kb__meta">{formatDate(ev.createdAt)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {viewingImage &&
        createPortal(
          <ImageViewer
            imageUrl={viewingImage.fileUrl}
            imageName={viewingImage.fileName}
            onClose={() => setViewingImage(null)}
            onDownload={() => {
              if (viewingImage.doc) handleDownload(viewingImage.doc)
            }}
          />,
          document.body
        )}
    </div>
  )
}

export default KnowledgeBasePage
