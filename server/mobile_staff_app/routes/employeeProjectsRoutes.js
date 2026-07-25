const express = require('express')
const multer = require('multer')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const ctrl = require('../controllers/employeeProjectsController')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

const employeeProjectsRoutes = () => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.get('/', ctrl.listProjects())
  router.post('/', ctrl.createProject())
  router.get('/:projectId', ctrl.getProject())
  router.put('/:projectId/status', ctrl.updateStatus())
  router.put('/:projectId/description', ctrl.updateDescription())
  router.put('/:projectId/goals', ctrl.updateGoals())
  router.put('/:projectId/additional-info', ctrl.updateAdditionalInfo())
  router.post('/:projectId/responsibles', ctrl.addResponsibles())
  router.delete('/:projectId/responsibles/:userId', ctrl.removeResponsible())
  router.post('/:projectId/approval', ctrl.setApproval())
  router.get('/:projectId/messages', ctrl.getMessages())
  router.post('/:projectId/messages', ctrl.sendMessage())
  router.patch('/:projectId/messages/:messageId', ctrl.updateMessage())
  router.delete('/:projectId/messages/:messageId', ctrl.deleteMessage())
  router.get('/:projectId/history', ctrl.getHistory())
  router.get('/:projectId/subtasks', ctrl.getSubtasks())
  router.post(
    '/:projectId/attachments',
    upload.single('files'),
    ctrl.addAttachment()
  )

  return router
}

module.exports = employeeProjectsRoutes
