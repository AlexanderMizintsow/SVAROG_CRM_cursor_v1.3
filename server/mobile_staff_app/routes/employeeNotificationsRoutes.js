const express = require('express')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const ctrl = require('../controllers/employeeNotificationsController')

module.exports = (pool) => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.get('/', ctrl.listUnread(pool))
  router.patch('/read-all', ctrl.markAllRead(pool))
  router.patch('/:notificationId/read', ctrl.markRead(pool))
  router.post('/push/register', ctrl.registerPush(pool))

  return router
}
