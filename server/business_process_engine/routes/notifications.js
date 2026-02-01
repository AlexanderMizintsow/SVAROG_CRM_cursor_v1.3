const express = require('express')
const { getNotifications, markRead } = require('../controllers/notificationsController')

function notificationsRoutes(dbPool) {
  const router = express.Router()
  router.get('/', (req, res) => getNotifications(dbPool, req, res))
  router.post('/:id/read', (req, res) => markRead(dbPool, req, res))
  return router
}

module.exports = notificationsRoutes

