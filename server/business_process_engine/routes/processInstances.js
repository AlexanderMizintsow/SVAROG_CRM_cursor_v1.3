const express = require('express')
const {
  getInstances,
  getInstancesOverview,
  getInstanceById,
  cancelInstance,
  deleteInstance,
  completeTaskCreation,
  respondDecision,
} = require('../controllers/processInstancesController')
const { startProcess } = require('../controllers/processInstancesController')

function processInstancesRoutes(dbPool) {
  const router = express.Router()
  router.get('/overview', (req, res) => getInstancesOverview(dbPool, req, res))
  router.get('/', (req, res) => getInstances(dbPool, req, res))
  router.get('/:id', (req, res) => getInstanceById(dbPool, req, res))
  router.post('/:id/cancel', (req, res) => cancelInstance(dbPool, req, res))
  router.delete('/:id', (req, res) => deleteInstance(dbPool, req, res))
  router.post('/:id/complete-task-creation', (req, res) => completeTaskCreation(dbPool, req, res))
  router.post('/:id/respond-decision', (req, res) => respondDecision(dbPool, req, res))
  return router
}

module.exports = processInstancesRoutes
