const express = require('express')
const { taskUpdated } = require('../controllers/webhooksController')

function webhooksRoutes(dbPool) {
  const router = express.Router()
  router.post('/task-updated', (req, res) => taskUpdated(dbPool, req, res))
  return router
}

module.exports = webhooksRoutes
