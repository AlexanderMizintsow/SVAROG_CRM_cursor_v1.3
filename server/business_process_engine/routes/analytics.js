const express = require('express')
const { getProcessAnalytics } = require('../controllers/analyticsController')

function analyticsRoutes(dbPool) {
  const router = express.Router()
  router.get('/process/:processId', (req, res) => getProcessAnalytics(dbPool, req, res))
  return router
}

module.exports = analyticsRoutes
