const FormData = require('form-data')
const { registerFetch, REGISTER_URL } = require('../services/registerClient')

const userIdOf = (req) => Number(req.user.userId)

const queryOf = (req, extra = {}) => {
  const params = new URLSearchParams()
  Object.entries({ ...req.query, ...extra, userId: userIdOf(req) }).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  const text = params.toString()
  return text ? `?${text}` : ''
}

const send = async (res, path, options) => {
  try {
    const data = await registerFetch(path, options)
    return res.json(data == null ? { ok: true } : data)
  } catch (error) {
    console.error('[mobile_staff_app][approvals]', path, error.message)
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка согласования' })
  }
}

const bodyWithUser = (req) => ({ ...(req.body || {}), userId: userIdOf(req) })

const inbox = () => async (req, res) => send(res, `/api/approvals/inbox${queryOf(req)}`)
const mine = () => async (req, res) => send(res, `/api/approvals/mine${queryOf(req)}`)
const completed = () => async (req, res) => send(res, `/api/approvals/completed${queryOf(req)}`)
const templates = () => async (req, res) => send(res, `/api/approvals/templates${queryOf(req)}`)
const template = () => async (req, res) =>
  send(res, `/api/approvals/templates/${req.params.id}${queryOf(req)}`)
const checkLogs = () => async (req, res) => send(res, `/api/approvals/check-logs${queryOf(req)}`)
const card = () => async (req, res) => send(res, `/api/approvals/cards/${req.params.id}${queryOf(req)}`)

const createTemplate = () => async (req, res) => {
  try {
    const data = await registerFetch('/api/approvals/templates', {
      method: 'POST',
      body: bodyWithUser(req),
    })
    return res.status(201).json(data)
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const updateTemplate = () => async (req, res) =>
  send(res, `/api/approvals/templates/${req.params.id}`, { method: 'PUT', body: bodyWithUser(req) })

const deleteTemplate = () => async (req, res) =>
  send(res, `/api/approvals/templates/${req.params.id}`, {
    method: 'DELETE',
    body: { userId: userIdOf(req) },
  })

const createCard = () => async (req, res) => {
  try {
    const data = await registerFetch('/api/approvals/cards', {
      method: 'POST',
      body: bodyWithUser(req),
    })
    return res.status(201).json(data)
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const authorDone = () => async (req, res) =>
  send(res, `/api/approvals/cards/${req.params.id}/author-done`, { method: 'POST', body: bodyWithUser(req) })

const authorNote = () => async (req, res) =>
  send(res, `/api/approvals/cards/${req.params.id}/author-note`, { method: 'POST', body: bodyWithUser(req) })

const linkCard = () => async (req, res) => {
  try {
    const data = await registerFetch(`/api/approvals/cards/${req.params.id}/links`, {
      method: 'POST',
      body: bodyWithUser(req),
    })
    return res.status(201).json(data)
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const cancelCard = () => async (req, res) =>
  send(res, `/api/approvals/cards/${req.params.id}/cancel`, { method: 'POST', body: bodyWithUser(req) })

const message = () => async (req, res) => {
  try {
    const data = await registerFetch(`/api/approvals/cards/${req.params.id}/messages`, {
      method: 'POST',
      body: bodyWithUser(req),
    })
    return res.status(201).json(data)
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const decide = () => async (req, res) =>
  send(res, `/api/approvals/cards/${req.params.cardId}/steps/${req.params.stepId}/decide`, {
    method: 'POST',
    body: bodyWithUser(req),
  })

const check = () => async (req, res) =>
  send(res, `/api/approvals/cards/${req.params.cardId}/steps/${req.params.stepId}/check`, {
    method: 'POST',
    body: bodyWithUser(req),
  })

const uploadFile = () => async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ message: 'Выберите файл' })
    const form = new FormData()
    form.append('userId', String(userIdOf(req)))
    if (req.body?.body) form.append('body', String(req.body.body))
    form.append('file', file.buffer, {
      filename: file.originalname || 'file',
      contentType: file.mimetype || 'application/octet-stream',
    })
    const response = await fetch(`${REGISTER_URL}/api/approvals/cards/${req.params.id}/files`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    })
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    if (!response.ok) {
      return res.status(response.status).json({ message: data?.message || 'Не удалось принять файл' })
    }
    return res.status(201).json(data)
  } catch (error) {
    console.error('[mobile_staff_app][approvals][file]', error)
    return res.status(500).json({ message: 'Не удалось принять файл' })
  }
}

const downloadFile = () => async (req, res) => {
  try {
    const response = await fetch(
      `${REGISTER_URL}/api/approvals/files/${req.params.id}?userId=${userIdOf(req)}`
    )
    if (!response.ok) {
      const text = await response.text()
      let data = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }
      return res.status(response.status).json({ message: data?.message || 'Файл недоступен' })
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
    const disposition = response.headers.get('content-disposition')
    if (disposition) res.setHeader('Content-Disposition', disposition)
    return res.send(buffer)
  } catch (error) {
    console.error('[mobile_staff_app][approvals][download]', error)
    return res.status(500).json({ message: 'Файл недоступен' })
  }
}

module.exports = {
  inbox,
  mine,
  completed,
  templates,
  template,
  checkLogs,
  card,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createCard,
  authorDone,
  authorNote,
  linkCard,
  cancelCard,
  message,
  decide,
  check,
  uploadFile,
  downloadFile,
}
