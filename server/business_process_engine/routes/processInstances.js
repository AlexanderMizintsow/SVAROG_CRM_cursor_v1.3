const express = require('express')
const {
  getInstances,
  getInstanceById,
  cancelInstance,
} = require('../controllers/processInstancesController')
const { startProcess } = require('../controllers/processInstancesController')

function processInstancesRoutes(dbPool) {
  const router = express.Router()
  router.get('/', (req, res) => getInstances(dbPool, req, res))
  router.get('/:id', (req, res) => getInstanceById(dbPool, req, res))
  router.post('/:id/cancel', (req, res) => cancelInstance(dbPool, req, res))
  return router
}

module.exports = processInstancesRoutes
