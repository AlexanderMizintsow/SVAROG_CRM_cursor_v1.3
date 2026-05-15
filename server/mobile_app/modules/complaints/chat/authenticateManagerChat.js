const authenticateManagerChat = (req, res, next) => {
  const expected = String(process.env.COMPLAINT_MANAGER_CHAT_SECRET || '').trim()
  if (!expected) {
    return res.status(503).json({ message: 'Чат для менеджеров не настроен на сервере.' })
  }
  const provided = String(req.headers['x-complaint-chat-secret'] || '').trim()
  if (provided !== expected) {
    return res.status(401).json({ message: 'Нет доступа' })
  }
  const managerUserId = Number(req.headers['x-manager-user-id'])
  if (!Number.isFinite(managerUserId) || managerUserId <= 0) {
    return res.status(400).json({ message: 'Некорректный идентификатор менеджера' })
  }
  req.managerUserId = managerUserId
  return next()
}

module.exports = {
  authenticateManagerChat,
}
