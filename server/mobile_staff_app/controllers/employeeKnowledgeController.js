/**
 * База знаний для мобильного приложения сотрудников.
 * Проксирует register /api/knowledge/* с userId из JWT.
 */

const FormData = require('form-data')
const { REGISTER_URL, registerFetch } = require('../services/registerClient')

const qs = (params = {}) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return
    p.set(key, String(value))
  })
  return p.toString()
}

const sendRegisterError = (res, error) => {
  const status = error.status || 500
  if (error.data && typeof error.data === 'object') {
    return res.status(status).json(error.data)
  }
  return res.status(status).json({
    message: error.message || 'Ошибка базы знаний',
  })
}

const forwardMultipart = async (path, method, fields, file) => {
  const form = new FormData()
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value == null || value === '') return
    if (typeof value === 'object') {
      form.append(key, JSON.stringify(value))
    } else {
      form.append(key, String(value))
    }
  })
  if (file) {
    form.append('file', file.buffer, {
      filename: file.originalname || file.filename || 'file',
      contentType: file.mimetype || 'application/octet-stream',
    })
  }

  const response = await fetch(`${REGISTER_URL}${path}`, {
    method,
    body: form,
    headers: form.getHeaders(),
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!response.ok) {
    const message =
      (data && (data.error || data.message || data)) ||
      `Register error ${response.status}`
    const err = new Error(
      typeof message === 'string' ? message : 'Ошибка register API'
    )
    err.status = response.status
    err.data = data
    throw err
  }
  return data
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
    const fields = {
      userId,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      ownerDepartmentId: req.body.ownerDepartmentId,
      visibilityMode: req.body.visibilityMode,
      tags: req.body.tags,
      segments: req.body.segments,
      forceDuplicate: req.body.forceDuplicate,
      replaceDocumentId: req.body.replaceDocumentId,
    }
    const data = await forwardMultipart(
      '/api/knowledge/documents',
      'POST',
      fields,
      req.file
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
    const fields = {
      userId,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      ownerDepartmentId: req.body.ownerDepartmentId,
      visibilityMode: req.body.visibilityMode,
      tags: req.body.tags,
      segments: req.body.segments,
      forceDuplicate: req.body.forceDuplicate,
      confirmFileNameMismatch: req.body.confirmFileNameMismatch,
    }
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

module.exports = {
  getMeta,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  downloadDocument,
  listVersions,
  downloadVersion,
  addFavorite,
  removeFavorite,
}
