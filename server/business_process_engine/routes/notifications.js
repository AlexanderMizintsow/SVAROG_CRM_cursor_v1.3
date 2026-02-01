const express = require('express')
const { getNotifications, markRead, getDecisionRequests } = require('../controllers/notificationsController')

function notificationsRoutes(dbPool) {
  const router = express.Router()
  router.get('/decisions', (req, res) => getDecisionRequests(dbPool, req, res))
  router.get('/', (req, res) => getNotifications(dbPool, req, res))
  router.post('/:id/read', (req, res) => markRead(dbPool, req, res))
  return router
}

module.exports = notificationsRoutes

