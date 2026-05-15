const chatService = require('./complaintChatService')
const { enqueueAndSendCompanyPush } = require('../../shared/notifications/pushService')
const { getCompanyById } = require('../services/complaintsRepository')
const { broadcastComplaintChat, broadcastComplaintChatThread } = require('./complaintChatWs')

const toError = (res, error) => {
  const raw = String(error?.message || 'error')
  let status = 500
  let message = 'Не удалось выполнить операцию'
  if (/forbidden|access denied|not found|required|allowed only/i.test(raw)) {
    status = /forbidden|access denied/i.test(raw) ? 403 : 400
    message = raw
  }
  return res.status(status).json({ message })
}

const getThreadByDraftDealer = (pool) => async (req, res) => {
  try {
    const draftId = Number(req.params.draftId)
    const companyId = req.user.companyId
    const meta = await chatService.threadMetaForDealer(pool, companyId, draftId)
    if (!meta) return res.status(404).json({ message: 'Чат для этого обращения не найден' })
    return res.json({ thread: meta })
  } catch (error) {
    return toError(res, error)
  }
}

const getMessagesDealer = (pool) => async (req, res) => {
  try {
    const threadId = Number(req.params.threadId)
    const companyId = req.user.companyId
    const thread = await chatService.getThreadRow(pool, threadId)
    if (!thread || Number(thread.company_id) !== Number(companyId)) {
      return res.status(403).json({ message: 'Нет доступа' })
    }
    const afterId = Number(req.query.afterId || 0)
    const messages = await chatService.listMessages(pool, threadId, { afterId })
    return res.json({ messages })
  } catch (error) {
    return toError(res, error)
  }
}

const postMessageDealer = (pool) => async (req, res) => {
  try {
    const threadId = Number(req.params.threadId)
    const companyId = req.user.companyId
    const thread = await chatService.getThreadRow(pool, threadId)
    if (!thread || Number(thread.company_id) !== Number(companyId)) {
      return res.status(403).json({ message: 'Нет доступа' })
    }
    const body = String(req.body?.body || req.body?.text || '')
    const files = req.files || []
    const message = await chatService.createMessage(pool, {
      threadId,
      authorRole: 'dealer',
      companyId,
      managerUserId: null,
      body,
      files,
    })
    broadcastComplaintChat(threadId, message)
    return res.status(201).json({ message })
  } catch (error) {
    return toError(res, error)
  }
}

const getThreadByReminderManager = (pool) => async (req, res) => {
  try {
    const reminderId = Number(req.params.reminderId)
    const managerUserId = req.managerUserId
    const meta = await chatService.threadMetaForManager(pool, reminderId, managerUserId)
    if (!meta) return res.status(404).json({ message: 'Чат не найден' })
    return res.json({ thread: meta })
  } catch (error) {
    return toError(res, error)
  }
}

const getMessagesManager = (pool) => async (req, res) => {
  try {
    const threadId = Number(req.params.threadId)
    const managerUserId = req.managerUserId
    const thread = await chatService.getThreadRow(pool, threadId)
    if (!thread || Number(thread.manager_user_id) !== Number(managerUserId)) {
      return res.status(403).json({ message: 'Нет доступа' })
    }
    const afterId = Number(req.query.afterId || 0)
    const messages = await chatService.listMessages(pool, threadId, { afterId })
    return res.json({ messages })
  } catch (error) {
    return toError(res, error)
  }
}

const postMessageManager = (pool) => async (req, res) => {
  try {
    const threadId = Number(req.params.threadId)
    const managerUserId = req.managerUserId
    const thread = await chatService.getThreadRow(pool, threadId)
    if (!thread || Number(thread.manager_user_id) !== Number(managerUserId)) {
      return res.status(403).json({ message: 'Нет доступа' })
    }
    const body = String(req.body?.body || req.body?.text || '')
    const files = req.files || []
    const message = await chatService.createMessage(pool, {
      threadId,
      authorRole: 'manager',
      companyId: null,
      managerUserId,
      body,
      files,
    })
    broadcastComplaintChat(threadId, message)

    const company = await getCompanyById(pool, thread.company_id)
    const preview = message.body ? message.body.slice(0, 120) : 'Новое сообщение'
    await enqueueAndSendCompanyPush(pool, {
      companyId: thread.company_id,
      companyName: company?.name_companies || '',
      title: 'Сообщение по рекламации',
      body: preview,
      payload: {
        type: 'complaint_chat_message',
        threadId,
        draftId: thread.draft_id,
      },
    })

    return res.status(201).json({ message })
  } catch (error) {
    return toError(res, error)
  }
}

const rejectReminderManager = (pool) => async (req, res) => {
  try {
    const reminderId = Number(req.params.reminderId)
    const managerUserId = req.managerUserId
    const reason = String(req.body?.reason || '').trim()
    const result = await chatService.rejectThreadByReminder(pool, {
      reminderId,
      managerUserId,
      reason,
    })
    broadcastComplaintChatThread(result.threadId, 'complaint_chat_rejected', {
      reason,
      draftId: result.draftId,
    })
    return res.json({ ok: true, ...result })
  } catch (error) {
    return toError(res, error)
  }
}

const convertTaskStub = (_pool) => async (_req, res) => {
  return res.status(501).json({ message: 'Перевод в задачу будет реализован позже' })
}

module.exports = {
  getThreadByDraftDealer,
  getMessagesDealer,
  postMessageDealer,
  getThreadByReminderManager,
  getMessagesManager,
  postMessageManager,
  rejectReminderManager,
  convertTaskStub,
}
