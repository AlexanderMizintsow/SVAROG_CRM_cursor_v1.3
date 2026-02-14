const express = require('express')
const { taskUpdated, projectUpdated } = require('../controllers/webhooksController')

function webhooksRoutes(dbPool) {
  const router = express.Router()
  router.post('/task-updated', (req, res) => taskUpdated(dbPool, req, res))
  router.post('/project-updated', (req, res) => projectUpdated(dbPool, req, res))
  return router
}

module.exports = webhooksRoutes
