const express = require('express')
const multer = require('multer')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const ctrl = require('../controllers/employeeTasksController')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

const employeeTasksRoutes = () => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.get('/', ctrl.listTasks())
  router.post('/', ctrl.createTask())
  router.get('/users', ctrl.listUsers())
  router.post('/extension-request', ctrl.requestExtension())
  router.get('/extensions/pending', ctrl.listPendingExtensions())
  router.patch('/extensions/:requestId/approve', ctrl.approveExtension())
  router.patch('/extensions/:requestId/reject', ctrl.rejectExtension())
  router.get('/files/:filename', ctrl.proxyFile())
  router.get('/:taskId/hierarchy', ctrl.getHierarchy())
  router.get('/:taskId/has-subtasks', ctrl.getHasSubtasks())
  router.get('/:taskId', ctrl.getTask())
  router.put('/:taskId/status', ctrl.updateStatus())
  router.post('/:taskId/decision', ctrl.decideTask())
  router.get('/:taskId/messages', ctrl.getMessages())
  router.post('/:taskId/messages', ctrl.sendMessage())
  router.put('/:taskId/description', ctrl.updateDescription())
  router.patch('/:taskId/deadline', ctrl.updateDeadline())
  router.put('/:taskId/assignee', ctrl.replaceAssignee())
  router.post(
    '/:taskId/attachments',
    upload.single('files'),
    ctrl.addAttachment()
  )

  return router
}

module.exports = employeeTasksRoutes
