const express = require('express')
const {
  getTaskTemplates,
  getTaskTemplateById,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
} = require('../controllers/taskTemplatesController')

function taskTemplatesRoutes(dbPool) {
  const router = express.Router()
  router.get('/', (req, res) => getTaskTemplates(dbPool, req, res))
  router.get('/:id', (req, res) => getTaskTemplateById(dbPool, req, res))
  router.post('/', (req, res) => createTaskTemplate(dbPool, req, res))
  router.put('/:id', (req, res) => updateTaskTemplate(dbPool, req, res))
  router.delete('/:id', (req, res) => deleteTaskTemplate(dbPool, req, res))
  return router
}

module.exports = taskTemplatesRoutes
