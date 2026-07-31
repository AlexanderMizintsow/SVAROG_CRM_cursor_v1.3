/**
 * База знаний для мобильного приложения сотрудников.
 * Проксирует register /api/knowledge/* с userId из JWT.
 */

const { REGISTER_URL, registerFetch } = require('../services/registerClient')

const qs = (params = {}) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return
    p.set(key, String(value))
  })
  return p.toString()
}

const stripHtmlMessage = (text) =>
  String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400)

const sendRegisterError = (res, error) => {
  const status = error.status || 500
  if (error.data && typeof error.data === 'object' && !Array.isArray(error.data)) {
    return res.status(status).json(error.data)
  }
  return res.status(status).json({
    message: stripHtmlMessage(error.message) || 'Ошибка базы знаний',
  })
}

/** Поля из multipart часто приходят строкой JSON — нормализуем. */
const normalizeField = (value) => {
  if (value == null || value === '') return undefined
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }
  return value
}

/**
 * Отправка multipart в register через нативный FormData/Blob.
 * Пакет `form-data` + fetch даёт «[object FormData]» → Unexpected end of form (500).
 */
const forwardMultipart = async (path, method, fields, filesInput) => {
  const form = new FormData()
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (key === 'originalFileName' || key === 'originalFileNames') return
    if (value == null || value === '') return
    if (typeof value === 'object') {
      form.append(key, JSON.stringify(value))
    } else {
      form.append(key, String(value))
    }
  })

  const files = Array.isArray(filesInput)
    ? filesInput.filter(Boolean)
    : filesInput
      ? [filesInput]
      : []

  const originalNames = []
  files.forEach((file, index) => {
    if (!file?.buffer) return
    const fromFields = fixFilenameEncoding(
      (Array.isArray(fields?.originalFileNames) &&
        fields.originalFileNames[index]) ||
        (index === 0 ? fields?.originalFileName : '') ||
        ''
    )
    const fromFile = fixFilenameEncoding(
      file.originalname || file.filename || ''
    )
    const fixedSafe = (fromFields || fromFile || 'file')
      .replace(/[\\/]/g, '_')
      .slice(0, 500)
    originalNames.push(fixedSafe)
    const extMatch = fixedSafe.match(/(\.[a-zA-Z0-9]{1,12})$/)
    const ext = extMatch ? extMatch[1] : ''
    form.append(
      files.length > 1 ? 'files' : 'file',
      new Blob([file.buffer], {
        type: file.mimetype || 'application/octet-stream',
      }),
      `upload${ext || '.bin'}`
    )
  })
  if (originalNames.length === 1) {
    form.append('originalFileName', originalNames[0])
  }
  if (originalNames.length) {
    form.append('originalFileNames', JSON.stringify(originalNames))
  }

  const response = await fetch(`${REGISTER_URL}${path}`, {
    method,
    body: form,
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!response.ok) {
    const raw =
      (data && (data.error || data.message || data)) ||
      stripHtmlMessage(text) ||
      `Register error ${response.status}`
    const message =
      typeof raw === 'string' ? stripHtmlMessage(raw) : 'Ошибка register API'
    const err = new Error(message || 'Ошибка register API')
    err.status = response.status
    err.data =
      data && typeof data === 'object' ? data : { error: message, message }
    throw err
  }
  return data
}

const buildKnowledgeFields = (req, userId) => ({
  userId,
  title: req.body.title,
  description: req.body.description,
  category: req.body.category,
  ownerDepartmentId: req.body.ownerDepartmentId,
  visibilityMode: req.body.visibilityMode,
  tags: normalizeField(req.body.tags),
  segments: normalizeField(req.body.segments),
  forceDuplicate: req.body.forceDuplicate,
  replaceDocumentId: req.body.replaceDocumentId,
  confirmDifferentFileName:
    req.body.confirmDifferentFileName || req.body.confirmFileNameMismatch,
  isFolder: req.body.isFolder || req.body.is_folder,
  // Кириллическое имя только отдельным полем (не через Content-Disposition)
  originalFileName: req.body.originalFileName || undefined,
  originalFileNames: normalizeField(req.body.originalFileNames),
})

const collectReqFiles = (req) => {
  const list = []
  if (req.file) list.push(req.file)
  if (Array.isArray(req.files)) {
    req.files.forEach((f) => {
      if (f && !list.includes(f)) list.push(f)
    })
  }
  return list.filter((f) => f?.buffer?.length)
}

/** Чинит mojibake UTF-8↔Latin-1 в имени файла. */
const fixFilenameEncoding = (raw) => {
  const name = String(raw || '').trim()
  if (!name) return name
  if (/[\u0400-\u04FF]/.test(name)) return name
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8')
    if (/[\u0400-\u04FF]/.test(decoded)) return decoded
  } catch (_) {}
  return name
}


const proxyBinary = async (req, res, path) => {
  const upstream = await fetch(`${REGISTER_URL}${path}`)
  if (!upstream.ok) {
    const text = await upstream.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    return res.status(upstream.status).json({
      message:
        (data && (data.error || data.message)) || 'Файл не найден',
    })
  }
  const contentType =
    upstream.headers.get('content-type') || 'application/octet-stream'
  const disposition = upstream.headers.get('content-disposition')
  const buffer = Buffer.from(await upstream.arrayBuffer())
  res.setHeader('Content-Type', contentType)
  if (disposition) {
    res.setHeader('Content-Disposition', disposition)
  }
  return res.send(buffer)
}

const getMeta = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const [perms, deps] = await Promise.all([
      registerFetch(`/api/knowledge/permissions?userId=${userId}`),
      pool.query(`SELECT id, name FROM departments ORDER BY name`),
    ])
    let users = []
    try {
      users = await registerFetch('/api/users')
    } catch {
      users = []
    }
    return res.json({
      ...perms,
      departments: (deps.rows || []).map((d) => ({
        id: Number(d.id),
        name: d.name,
      })),
      users: (Array.isArray(users) ? users : []).map((u) => ({
        id: Number(u.id),
        first_name: u.first_name,
        last_name: u.last_name,
        middle_name: u.middle_name,
        department_id: u.department_id,
      })),
    })
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][meta]', error)
    return sendRegisterError(res, error)
  }
}

const listDocuments = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const data = await registerFetch(
      `/api/knowledge/documents?${qs({
        userId,
        q: req.query.q,
        category: req.query.category,
        departmentId: req.query.departmentId,
        mineOnly: req.query.mineOnly,
        favoriteOnly: req.query.favoriteOnly,
      })}`
    )
    return res.json(data)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][list]', error)
    return sendRegisterError(res, error)
  }
}

const getDocument = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const data = await registerFetch(
      `/api/knowledge/documents/${id}?userId=${userId}`
    )
    return res.json(data)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][get]', error)
    return sendRegisterError(res, error)
  }
}

const createDocument = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const files = collectReqFiles(req)
    if (!files.length) {
      return res.status(400).json({
        error: 'Прикрепите хотя бы один файл',
      })
    }
    const fields = buildKnowledgeFields(req, userId)
    const data = await forwardMultipart(
      '/api/knowledge/documents',
      'POST',
      fields,
      files
    )
    return res.status(201).json(data)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][create]', error)
    return sendRegisterError(res, error)
  }
}

const updateDocument = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const fields = buildKnowledgeFields(req, userId)
    const expectFile =
      String(req.body.expectFile || '') === '1' ||
      String(req.body.hasFile || '') === '1'

    if (expectFile && !req.file) {
      return res.status(400).json({
        error: 'Файл не получен сервером. Выберите файл ещё раз и повторите.',
      })
    }

    // Без нового файла — JSON (без multer/multipart), надёжнее для правок метаданных
    if (!req.file) {
      const data = await registerFetch(`/api/knowledge/documents/${id}`, {
        method: 'PUT',
        body: fields,
      })
      return res.json(data)
    }

    if (!req.file.buffer || !req.file.buffer.length) {
      return res.status(400).json({
        error: 'Пустой файл. Выберите другой файл и повторите.',
      })
    }

    console.log(
      '[mobile_staff_app][knowledge][update] forward file',
      req.file.originalname,
      req.file.size,
      req.file.mimetype
    )

    const data = await forwardMultipart(
      `/api/knowledge/documents/${id}`,
      'PUT',
      fields,
      req.file
    )
    return res.json(data)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][update]', error)
    return sendRegisterError(res, error)
  }
}

const deleteDocument = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const data = await registerFetch(
      `/api/knowledge/documents/${id}?userId=${userId}`,
      { method: 'DELETE' }
    )
    return res.json(data || { ok: true })
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][delete]', error)
    return sendRegisterError(res, error)
  }
}

const downloadDocument = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const inline = String(req.query.inline || '') === '1'
    const path = `/api/knowledge/documents/${id}/download?${qs({
      userId,
      inline: inline ? '1' : undefined,
    })}`
    return proxyBinary(req, res, path)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][download]', error)
    return sendRegisterError(res, error)
  }
}

const listVersions = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const data = await registerFetch(
      `/api/knowledge/documents/${id}/versions?userId=${userId}`
    )
    return res.json(data)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][versions]', error)
    return sendRegisterError(res, error)
  }
}

const downloadVersion = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const versionId = Number(req.params.versionId)
    const path = `/api/knowledge/documents/${id}/versions/${versionId}/download?userId=${userId}`
    return proxyBinary(req, res, path)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][versionDownload]', error)
    return sendRegisterError(res, error)
  }
}

const addFavorite = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const data = await registerFetch(`/api/knowledge/documents/${id}/favorite`, {
      method: 'POST',
      body: { userId },
    })
    return res.json(data || { ok: true })
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][favAdd]', error)
    return sendRegisterError(res, error)
  }
}

const removeFavorite = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const data = await registerFetch(
      `/api/knowledge/documents/${id}/favorite?userId=${userId}`,
      { method: 'DELETE' }
    )
    return res.json(data || { ok: true })
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][favRemove]', error)
    return sendRegisterError(res, error)
  }
}

const addDocumentFile = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const files = collectReqFiles(req)
    if (!files.length) {
      return res.status(400).json({ error: 'Прикрепите файл' })
    }
    const fields = {
      userId,
      originalFileName: req.body.originalFileName,
      replaceSameNames: req.body.replaceSameNames,
    }
    const data = await forwardMultipart(
      `/api/knowledge/documents/${id}/files`,
      'POST',
      fields,
      files
    )
    return res.status(201).json(data)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][addFile]', error)
    return sendRegisterError(res, error)
  }
}

const replaceDocumentFile = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    const files = collectReqFiles(req)
    if (!files.length) {
      return res.status(400).json({ error: 'Прикрепите новый файл' })
    }
    const fields = {
      userId,
      originalFileName: req.body.originalFileName,
      confirmDifferentFileName: req.body.confirmDifferentFileName,
    }
    const data = await forwardMultipart(
      `/api/knowledge/documents/${id}/files/${fileId}`,
      'PUT',
      fields,
      files
    )
    return res.json(data)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][replaceFile]', error)
    return sendRegisterError(res, error)
  }
}

const renameDocumentFile = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    const fileName = req.body?.fileName || req.body?.file_name
    const data = await registerFetch(
      `/api/knowledge/documents/${id}/files/${fileId}`,
      {
        method: 'PATCH',
        body: { userId, fileName },
      }
    )
    return res.json(data)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][renameFile]', error)
    return sendRegisterError(res, error)
  }
}

const listFileVersions = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    const data = await registerFetch(
      `/api/knowledge/documents/${id}/files/${fileId}/versions?userId=${userId}`
    )
    return res.json(data)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][fileVersions]', error)
    return sendRegisterError(res, error)
  }
}

const downloadFileVersion = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    const versionId = Number(req.params.versionId)
    const path = `/api/knowledge/documents/${id}/files/${fileId}/versions/${versionId}/download?userId=${userId}`
    return proxyBinary(req, res, path)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][fileVersionDownload]', error)
    return sendRegisterError(res, error)
  }
}

const deleteDocumentFile = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    const data = await registerFetch(
      `/api/knowledge/documents/${id}/files/${fileId}?userId=${userId}`,
      { method: 'DELETE' }
    )
    return res.json(data || { ok: true })
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][deleteFile]', error)
    return sendRegisterError(res, error)
  }
}

const downloadDocumentFile = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    const inline = String(req.query.inline || '') === '1'
    const path = `/api/knowledge/documents/${id}/files/${fileId}/download?${qs({
      userId,
      inline: inline ? '1' : undefined,
    })}`
    return proxyBinary(req, res, path)
  } catch (error) {
    console.error('[mobile_staff_app][knowledge][downloadFile]', error)
    return sendRegisterError(res, error)
  }
}

module.exports = {
  getMeta,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  downloadDocument,
  addDocumentFile,
  deleteDocumentFile,
  downloadDocumentFile,
  replaceDocumentFile,
  renameDocumentFile,
  listFileVersions,
  downloadFileVersion,
  listVersions,
  downloadVersion,
  addFavorite,
  removeFavorite,
}
