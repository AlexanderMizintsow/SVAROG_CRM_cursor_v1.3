import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  FaFolder,
  FaFolderOpen,
  FaPencilAlt,
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
import KnowledgeErrorMarks, {
  KnowledgeErrorMarkAddButton,
  hasMyErrorMark,
} from './KnowledgeErrorMarks'
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
  const [folderDoc, setFolderDoc] = useState(null)
  const [folderLoading, setFolderLoading] = useState(false)
  const [fileVersionsTarget, setFileVersionsTarget] = useState(null)
  const [fileVersionsData, setFileVersionsData] = useState(null)
  const [fileVersionsLoading, setFileVersionsLoading] = useState(false)
  const [renameFileTarget, setRenameFileTarget] = useState(null)
  const [renameFileValue, setRenameFileValue] = useState('')
  const deepLinkHandledRef = useRef(false)
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

  const upsertLocalErrorMark = (documentId, mark) => {
    const id = Number(documentId)
    const merge = (item) => {
      if (Number(item.id) !== id) return item
      const prev = Array.isArray(item.errorMarks) ? item.errorMarks : []
      const without = prev.filter((m) => Number(m.id) !== Number(mark.id))
      return { ...item, errorMarks: [mark, ...without] }
    }
    setDocuments((prev) => prev.map(merge))
    setTreeDocuments((prev) => prev.map(merge))
    setFolderDoc((prev) => (prev && Number(prev.id) === id ? merge(prev) : prev))
  }

  const removeLocalErrorMark = (documentId, markId) => {
    const id = Number(documentId)
    const mid = Number(markId)
    const apply = (item) => {
      if (Number(item.id) !== id) return item
      return {
        ...item,
        errorMarks: (item.errorMarks || []).filter((m) => Number(m.id) !== mid),
      }
    }
    setDocuments((prev) => prev.map(apply))
    setTreeDocuments((prev) => prev.map(apply))
    setFolderDoc((prev) => (prev && Number(prev.id) === id ? apply(prev) : prev))
  }

  const handleCreateErrorMark = async (documentId, comment, fileId = null) => {
    const mark = await knowledgeBaseApi.createErrorMark(userId, documentId, {
      comment,
      fileId,
    })
    upsertLocalErrorMark(documentId, mark)
    toast('Отметка об ошибке сохранена')
    return mark
  }

  const handleUpdateErrorMark = async (documentId, markId, comment) => {
    const mark = await knowledgeBaseApi.updateErrorMark(
      userId,
      documentId,
      markId,
      comment
    )
    upsertLocalErrorMark(documentId, mark)
    toast('Комментарий обновлён')
    return mark
  }

  const handleDeleteErrorMark = async (documentId, markId) => {
    try {
      await knowledgeBaseApi.deleteErrorMark(userId, documentId, markId)
      removeLocalErrorMark(documentId, markId)
      toast('Отметка удалена')
    } catch (err) {
      toast(err.response?.data?.error || 'Не удалось удалить отметку', false)
      throw err
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
    if (payload.isFolder) {
      fd.append('isFolder', '1')
    }
    const list =
      Array.isArray(payload.files) && payload.files.length
        ? payload.files
        : payload.file
          ? [payload.file]
          : []
    if (list.length > 1) {
      list.forEach((f) => fd.append('files', f))
      fd.append(
        'originalFileNames',
        JSON.stringify(list.map((f) => f.name || 'file'))
      )
    } else if (list.length === 1) {
      fd.append('file', list[0])
      if (list[0].name) fd.append('originalFileName', list[0].name)
    }
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
        toast(payload.isFolder ? 'Папка создана' : 'Документ загружен')
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

  const openFolder = async (doc) => {
    if (!userId || !doc) return
    setFolderLoading(true)
    try {
      const full = await knowledgeBaseApi.getDocument(userId, doc.id)
      setFolderDoc(full)
    } catch (err) {
      toast(err.response?.data?.error || 'Не удалось открыть папку', false)
    } finally {
      setFolderLoading(false)
    }
  }

  const handleAddFolderFiles = async (event) => {
    const list = Array.from(event.target.files || [])
    event.target.value = ''
    if (!folderDoc || !list.length) return

    const runAdd = async (replaceSameNames = false) => {
      setFolderLoading(true)
      try {
        const data = await knowledgeBaseApi.addFiles(
          userId,
          folderDoc.id,
          list,
          { replaceSameNames }
        )
        setFolderDoc(data.document || data)
        if (replaceSameNames || data.replacedCount) {
          toast(
            data.replacedCount && data.addedCount
              ? `Обновлено: ${data.replacedCount}, добавлено: ${data.addedCount}`
              : data.replacedCount
                ? 'Файлы заменены новыми версиями'
                : 'Файлы добавлены в папку'
          )
        } else {
          toast('Файлы добавлены в папку')
        }
        await refreshLists()
      } catch (err) {
        const data = err.response?.data
        if (data?.code === 'FOLDER_FILE_NAME_EXISTS') {
          askConfirm({
            title: 'Файл уже есть в папке',
            message: `${data.error} Старая версия сохранится в истории.`,
            btn1: 'Отмена',
            btn2: 'Заменить',
            onConfirm: () => {
              closeConfirm()
              runAdd(true)
            },
          })
        } else {
          toast(data?.error || 'Не удалось добавить файлы', false)
        }
      } finally {
        setFolderLoading(false)
      }
    }

    await runAdd(false)
  }

  const handleDeleteFolderFile = (file) => {
    if (!folderDoc || !file?.id) return
    askConfirm({
      title: 'Удалить файл из папки?',
      message: `Удалить «${file.fileName || 'файл'}» из папки «${folderDoc.title}»?`,
      btn1: 'Отмена',
      btn2: 'Удалить',
      onConfirm: async () => {
        closeConfirm()
        setFolderLoading(true)
        try {
          const updated = await knowledgeBaseApi.deleteFile(
            userId,
            folderDoc.id,
            file.id
          )
          setFolderDoc(updated)
          toast('Файл удалён из папки')
          await refreshLists()
        } catch (err) {
          toast(err.response?.data?.error || 'Ошибка удаления файла', false)
        } finally {
          setFolderLoading(false)
        }
      },
    })
  }

  const handleDownloadFolderFile = async (file) => {
    if (!folderDoc || !file) return
    const url = file.id
      ? knowledgeBaseApi.fileDownloadUrl(userId, folderDoc.id, file.id)
      : knowledgeBaseApi.downloadUrl(userId, folderDoc.id)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('download failed')
      const blob = await response.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = file.fileName || 'file'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      toast('Не удалось скачать файл', false)
    }
  }

  const handlePreviewFolderFile = (file, folder = folderDoc) => {
    if (!folder || !file) return
    const url = file.id
      ? knowledgeBaseApi.fileViewUrl(userId, folder.id, file.id)
      : knowledgeBaseApi.viewUrl(userId, folder.id)
    if (isImage(file.fileType, file.fileName)) {
      setViewingImage({
        fileUrl: url,
        fileName: file.fileName || folder.title,
      })
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleRenameFolderFile = (file) => {
    if (!folderDoc || !file?.id) return
    setRenameFileTarget(file)
    setRenameFileValue(file.fileName || '')
  }

  const submitRenameFolderFile = async () => {
    if (!folderDoc || !renameFileTarget?.id) return
    const next = String(renameFileValue || '').trim()
    if (!next) {
      toast('Укажите имя файла', false)
      return
    }
    setFolderLoading(true)
    try {
      const data = await knowledgeBaseApi.renameFile(
        userId,
        folderDoc.id,
        renameFileTarget.id,
        next
      )
      if (data?.document) setFolderDoc(data.document)
      setRenameFileTarget(null)
      setRenameFileValue('')
      toast('Файл переименован')
      await refreshLists()
    } catch (err) {
      toast(err.response?.data?.error || 'Не удалось переименовать', false)
    } finally {
      setFolderLoading(false)
    }
  }

  const runReplaceFolderFile = async (file, nextFile, confirmDifferentFileName = false) => {
    if (!folderDoc || !file?.id || !nextFile) return
    setFolderLoading(true)
    try {
      const data = await knowledgeBaseApi.replaceFile(
        userId,
        folderDoc.id,
        file.id,
        nextFile,
        { confirmDifferentFileName }
      )
      setFolderDoc(data.document)
      toast(`Файл обновлён (v${data.versionNumber || ''})`.trim())
      await refreshLists()
    } catch (err) {
      const data = err.response?.data
      if (data?.code === 'FILE_NAME_MISMATCH') {
        askConfirm({
          title: 'Другое имя файла',
          message: `${data.error} Было: «${data.currentFileName || '—'}». Стало: «${data.newFileName || '—'}».`,
          btn1: 'Отмена',
          btn2: 'Всё равно заменить',
          onConfirm: () => {
            closeConfirm()
            runReplaceFolderFile(file, nextFile, true)
          },
        })
      } else {
        toast(data?.error || 'Не удалось заменить файл', false)
      }
    } finally {
      setFolderLoading(false)
    }
  }

  const handleReplaceFolderFile = (file, event) => {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next) return
    runReplaceFolderFile(file, next, false)
  }

  const openFileVersions = async (file) => {
    if (!folderDoc || !file?.id) return
    setFileVersionsTarget(file)
    setFileVersionsLoading(true)
    setFileVersionsData(null)
    try {
      const data = await knowledgeBaseApi.listFileVersions(
        userId,
        folderDoc.id,
        file.id
      )
      setFileVersionsData(data)
    } catch (err) {
      toast(err.response?.data?.error || 'Не удалось загрузить версии', false)
      setFileVersionsTarget(null)
    } finally {
      setFileVersionsLoading(false)
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

  useEffect(() => {
    if (!userId || deepLinkHandledRef.current) return
    const params = new URLSearchParams(window.location.search)
    const docId = Number(params.get('documentId') || params.get('id'))
    if (!Number.isFinite(docId) || docId <= 0) return
    deepLinkHandledRef.current = true
    const fileId = Number(params.get('fileId'))
    let cancelled = false
    ;(async () => {
      try {
        const full = await knowledgeBaseApi.getDocument(userId, docId)
        if (cancelled || !full) return
        const isFolder =
          Boolean(full.isFolder) ||
          Number(full.filesCount) > 1 ||
          (Array.isArray(full.files) && full.files.length > 1)
        if (isFolder) {
          setFolderDoc(full)
          if (Number.isFinite(fileId) && fileId > 0) {
            const file = (full.files || []).find((f) => Number(f.id) === fileId)
            if (file) handlePreviewFolderFile(file, full)
          }
        } else {
          handlePreview(full)
        }
      } catch (_) {
        /* ignore broken deep link */
      } finally {
        try {
          const url = new URL(window.location.href)
          url.search = ''
          window.history.replaceState({}, '', `${url.pathname}${url.hash}`)
        } catch (_) {}
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

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
                const isFolder = Boolean(doc.isFolder) || Number(doc.filesCount) > 1
                const fileIcon = isFolder
                  ? { icon: FaFolder, className: 'is-folder' }
                  : getFileIcon(doc.fileType, doc.fileName)
                const FileIcon = fileIcon.icon
                return (
                <li key={doc.id} className={`kb__card ${isFolder ? 'is-folder' : ''}`}>
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
                      {isFolder ? (
                        <span className="kb__badge kb__badge--folder">
                          Папка · {doc.filesCount || 0} файл.
                        </span>
                      ) : null}
                      {!isFolder && doc.versionNumber > 1 ? (
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
                      {!isFolder && doc.fileSize != null ? (
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
                    {!isFolder && doc.fileName ? (
                      <div className="kb__filename">{doc.fileName}</div>
                    ) : null}
                    <KnowledgeErrorMarks
                      marks={doc.errorMarks || []}
                      currentUserId={userId}
                      fileId={isFolder ? undefined : null}
                      busy={loading}
                      onUpdate={(markId, comment) =>
                        handleUpdateErrorMark(doc.id, markId, comment)
                      }
                      onDelete={(markId) =>
                        handleDeleteErrorMark(doc.id, markId)
                      }
                    />
                  </div>
                  <div className="kb__card-actions">
                    {isFolder ? (
                      <button
                        type="button"
                        className="kb-btn kb-btn--ghost"
                        title="Открыть папку"
                        onClick={() => openFolder(doc)}
                      >
                        <FaFolderOpen className="kb-folder-icon" />
                      </button>
                    ) : null}
                    {!isFolder && canPreview(doc) ? (
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
                    {!isFolder ? (
                    <button
                      type="button"
                      className="kb-btn kb-btn--ghost"
                      title="Скачать"
                      onClick={() => handleDownload(doc)}
                    >
                      <FaDownload />
                    </button>
                    ) : null}
                    {!isFolder ? (
                    <button
                      type="button"
                      className="kb-btn kb-btn--ghost"
                      title="История версий"
                      onClick={() => openVersions(doc)}
                    >
                      <FaHistory />
                    </button>
                    ) : null}
                    {!isFolder &&
                    !hasMyErrorMark(doc.errorMarks, userId, null) ? (
                      <KnowledgeErrorMarkAddButton
                        busy={loading}
                        onCreate={(comment) =>
                          handleCreateErrorMark(doc.id, comment, null)
                        }
                      />
                    ) : null}
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

      {createPortal(
        <KnowledgeDocumentForm
          open={formOpen}
          overlayClassName={folderDoc ? 'kb-modal-overlay--nested' : ''}
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
        />,
        document.body
      )}

      {createPortal(
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
              message: `Удалить категорию «${cat.label}»? Можно только если она не используется.`,
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
                  toast(
                    err.response?.data?.error || 'Ошибка удаления категории',
                    false
                  )
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
        />,
        document.body
      )}

      <HelpModalKnowledge open={helpOpen} onClose={() => setHelpOpen(false)} />

      {folderDoc
        ? createPortal(
            <div className="kb-modal-overlay" role="presentation">
              <div className="kb-modal kb-modal--folder" role="dialog" aria-modal="true">
                <div className="kb-modal__header">
                  <h2>
                    <FaFolderOpen
                      className="kb-folder-icon"
                      style={{ marginRight: 8 }}
                    />
                    {folderDoc.title}
                  </h2>
                  <button
                    type="button"
                    className="kb-modal__close"
                    onClick={() => {
                      setFolderDoc(null)
                      setFileVersionsTarget(null)
                      setFileVersionsData(null)
                    }}
                  >
                    ×
                  </button>
                </div>
                {folderDoc.description ? (
                  <p className="kb-modal__hint" style={{ padding: '0 20px' }}>
                    {folderDoc.description}
                  </p>
                ) : null}
                <div className="kb-folder-files">
                  {folderLoading ? (
                    <div className="kb__empty">Загрузка…</div>
                  ) : (folderDoc.files || []).length === 0 ? (
                    <div className="kb__empty">В папке пока нет файлов</div>
                  ) : (
                    <ul>
                      {(folderDoc.files || []).map((file) => {
                        const meta = getFileIcon(file.fileType, file.fileName)
                        const Icon = meta.icon
                        return (
                          <li key={file.id || file.fileUrl}>
                            <div className={`kb__card-icon ${meta.className}`}>
                              <Icon />
                            </div>
                            <div className="kb-folder-files__main">
                              <strong>{file.fileName || 'Файл'}</strong>
                              <span>
                                {[
                                  formatSize(file.fileSize),
                                  file.versionNumber > 1
                                    ? `v${file.versionNumber}`
                                    : null,
                                  formatDate(file.updatedAt || file.createdAt),
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                              {file.id ? (
                                <KnowledgeErrorMarks
                                  marks={folderDoc.errorMarks || []}
                                  currentUserId={userId}
                                  fileId={file.id}
                                  busy={folderLoading}
                                  onUpdate={(markId, comment) =>
                                    handleUpdateErrorMark(
                                      folderDoc.id,
                                      markId,
                                      comment
                                    )
                                  }
                                  onDelete={(markId) =>
                                    handleDeleteErrorMark(folderDoc.id, markId)
                                  }
                                />
                              ) : null}
                            </div>
                            <div className="kb-folder-files__actions">
                              {(isPdf(file.fileType, file.fileName) ||
                                isImage(file.fileType, file.fileName)) && (
                                <button
                                  type="button"
                                  className="kb-btn kb-btn--ghost"
                                  title="Открыть"
                                  onClick={() => handlePreviewFolderFile(file)}
                                >
                                  <FaExternalLinkAlt />
                                </button>
                              )}
                              <button
                                type="button"
                                className="kb-btn kb-btn--ghost"
                                title="Скачать"
                                onClick={() => handleDownloadFolderFile(file)}
                              >
                                <FaDownload />
                              </button>
                              <button
                                type="button"
                                className="kb-btn kb-btn--ghost"
                                title="История версий файла"
                                onClick={() => openFileVersions(file)}
                              >
                                <FaHistory />
                              </button>
                              {file.id &&
                              !hasMyErrorMark(
                                folderDoc.errorMarks,
                                userId,
                                file.id
                              ) ? (
                                <KnowledgeErrorMarkAddButton
                                  fileId={file.id}
                                  busy={folderLoading}
                                  onCreate={(comment, fid) =>
                                    handleCreateErrorMark(
                                      folderDoc.id,
                                      comment,
                                      fid
                                    )
                                  }
                                />
                              ) : null}
                              {folderDoc.canManage && file.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="kb-btn kb-btn--ghost"
                                    title="Переименовать"
                                    onClick={() => handleRenameFolderFile(file)}
                                    disabled={folderLoading}
                                  >
                                    <FaPencilAlt />
                                  </button>
                                  <label
                                    className="kb-btn kb-btn--ghost"
                                    title="Заменить новой версией"
                                  >
                                    <FaEdit />
                                    <input
                                      type="file"
                                      hidden
                                      onChange={(e) =>
                                        handleReplaceFolderFile(file, e)
                                      }
                                      disabled={folderLoading}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className="kb-btn kb-btn--ghost"
                                    title="Удалить из папки"
                                    onClick={() => handleDeleteFolderFile(file)}
                                  >
                                    <FaTrash />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
                {folderDoc.canManage ? (
                  <div className="kb-modal__actions" style={{ padding: 16 }}>
                    <label className="kb-btn kb-btn--primary">
                      Добавить файлы
                      <input
                        type="file"
                        multiple
                        hidden
                        onChange={handleAddFolderFiles}
                        disabled={folderLoading}
                      />
                    </label>
                    <button
                      type="button"
                      className="kb-btn kb-btn--ghost"
                      onClick={() => {
                        setEditing(folderDoc)
                        setFormOpen(true)
                      }}
                    >
                      Свойства папки
                    </button>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}

      {fileVersionsTarget
        ? createPortal(
            <div
              className="kb-modal-overlay kb-modal-overlay--nested"
              role="presentation"
            >
              <div className="kb-modal" role="dialog" aria-modal="true">
                <div className="kb-modal__header">
                  <h2>Версии: {fileVersionsTarget.fileName || 'файл'}</h2>
                  <button
                    type="button"
                    className="kb-modal__close"
                    onClick={() => {
                      setFileVersionsTarget(null)
                      setFileVersionsData(null)
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="kb-folder-files">
                  {fileVersionsLoading ? (
                    <div className="kb__empty">Загрузка…</div>
                  ) : (
                    <>
                      <p
                        className="kb-modal__hint"
                        style={{ padding: '0 4px 10px' }}
                      >
                        Текущая версия: v
                        {fileVersionsData?.currentVersion ||
                          fileVersionsTarget.versionNumber ||
                          1}
                        . Ниже — предыдущие (если были замены).
                      </p>
                      {(fileVersionsData?.versions || []).length === 0 ? (
                        <div className="kb__empty">
                          Пока только текущая версия. Нажмите «заменить» у файла в
                          папке, чтобы сохранить историю.
                        </div>
                      ) : (
                        <ul>
                          {(fileVersionsData?.versions || []).map((v) => (
                            <li key={v.id}>
                              <div className="kb-folder-files__main">
                                <strong>
                                  v{v.versionNumber} · {v.fileName || 'файл'}
                                </strong>
                                <span>
                                  {[
                                    formatSize(v.fileSize),
                                    formatDate(v.createdAt),
                                    v.uploadedByName,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </div>
                              <div className="kb-folder-files__actions">
                                <a
                                  className="kb-btn kb-btn--ghost"
                                  href={knowledgeBaseApi.fileVersionDownloadUrl(
                                    userId,
                                    folderDoc.id,
                                    fileVersionsTarget.id,
                                    v.id
                                  )}
                                  title="Скачать эту версию"
                                >
                                  <FaDownload />
                                </a>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

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

      {versionsDoc
        ? createPortal(
            <div className="kb-modal-overlay" role="presentation">
              <div className="kb-modal" role="dialog" aria-modal="true">
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
                        Текущая версия:{' '}
                        <strong>v{versionsData?.currentVersion || 1}</strong>. В
                        поиске участвует только она. Ниже — предыдущие файлы.
                      </p>
                      {!versionsData?.versions?.length ? (
                        <p>Предыдущих версий пока нет.</p>
                      ) : (
                        <ul className="kb__panel-list">
                          {versionsData.versions.map((v) => (
                            <li key={v.id}>
                              <div>
                                <strong>v{v.versionNumber}</strong> —{' '}
                                {v.fileName || 'файл'}
                                <div className="kb__meta">
                                  {formatDate(v.createdAt)}
                                  {v.uploadedByName
                                    ? ` · ${v.uploadedByName}`
                                    : ''}
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
            </div>,
            document.body
          )
        : null}

      {eventsDoc
        ? createPortal(
            <div className="kb-modal-overlay" role="presentation">
              <div className="kb-modal" role="dialog" aria-modal="true">
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
                            <div className="kb__meta">
                              {formatDate(ev.createdAt)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

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

      {renameFileTarget
        ? createPortal(
            <div
              className="kb-modal-overlay kb-modal-overlay--nested"
              role="presentation"
            >
              <div className="kb-modal" role="dialog" aria-modal="true">
                <div className="kb-modal__header">
                  <h2>Переименовать файл</h2>
                  <button
                    type="button"
                    className="kb-modal__close"
                    onClick={() => {
                      setRenameFileTarget(null)
                      setRenameFileValue('')
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="kb-modal__form" style={{ padding: 16 }}>
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                    value={renameFileValue}
                    onChange={(e) => setRenameFileValue(e.target.value)}
                    autoFocus
                    disabled={folderLoading}
                  />
                  <div className="kb-modal__actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="kb-btn kb-btn--ghost"
                      onClick={() => {
                        setRenameFileTarget(null)
                        setRenameFileValue('')
                      }}
                      disabled={folderLoading}
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      className="kb-btn kb-btn--primary"
                      onClick={submitRenameFolderFile}
                      disabled={folderLoading}
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

export default KnowledgeBasePage
