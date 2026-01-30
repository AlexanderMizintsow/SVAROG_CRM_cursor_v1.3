const express = require('express')
const {
  getProcesses,
  getProcessById,
  createProcess,
  updateProcess,
  deleteProcess,
} = require('../controllers/processDefinitionsController')
const { startProcess } = require('../controllers/processInstancesController')

function processDefinitionsRoutes(dbPool) {
  const router = express.Router()
  router.get('/', (req, res) => getProcesses(dbPool, req, res))
  router.get('/:id', (req, res) => getProcessById(dbPool, req, res))
  router.post('/', (req, res) => createProcess(dbPool, req, res))
  router.post('/:id/start', (req, res) => startProcess(dbPool, req, res))
  router.put('/:id', (req, res) => updateProcess(dbPool, req, res))
  router.delete('/:id', (req, res) => deleteProcess(dbPool, req, res))
  return router
}

module.exports = processDefinitionsRoutes
