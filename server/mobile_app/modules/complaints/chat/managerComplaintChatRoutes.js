const express = require('express')
const { authenticateManagerChat } = require('./authenticateManagerChat')
const {
  getThreadByReminderManager,
  getMessagesManager,
  postMessageManager,
  rejectReminderManager,
  convertTaskStub,
} = require('./complaintChatController')
const { uploadChatMiddleware } = require('./chatMulter')

module.exports = (pool) => {
  const router = express.Router()
  router.use(authenticateManagerChat)

  router.get('/reminder/:reminderId/thread', getThreadByReminderManager(pool))
  router.get('/thread/:threadId/messages', getMessagesManager(pool))
  router.post('/thread/:threadId/messages', uploadChatMiddleware, postMessageManager(pool))
  router.post('/reminder/:reminderId/reject', rejectReminderManager(pool))
  router.post('/reminder/:reminderId/convert-task', convertTaskStub(pool))

  return router
}
