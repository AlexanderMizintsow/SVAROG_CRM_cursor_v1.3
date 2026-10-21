const express = require('express')
const multer = require('multer')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const ctrl = require('../controllers/employeeApprovalsController')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

module.exports = () => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.get('/inbox', ctrl.inbox())
  router.get('/mine', ctrl.mine())
  router.get('/completed', ctrl.completed())
  router.get('/templates', ctrl.templates())
  router.get('/templates/:id', ctrl.template())
  router.post('/templates', ctrl.createTemplate())
  router.put('/templates/:id', ctrl.updateTemplate())
  router.delete('/templates/:id', ctrl.deleteTemplate())
  router.get('/check-logs', ctrl.checkLogs())
  router.get('/cards/:id', ctrl.card())
  router.post('/cards', ctrl.createCard())
  router.post('/cards/:id/author-done', ctrl.authorDone())
  router.post('/cards/:id/author-note', ctrl.authorNote())
  router.post('/cards/:id/links', ctrl.linkCard())
  router.post('/cards/:id/cancel', ctrl.cancelCard())
  router.post('/cards/:id/messages', ctrl.message())
  router.post('/cards/:id/files', upload.single('file'), ctrl.uploadFile())
  router.get('/files/:id', ctrl.downloadFile())
  router.post('/cards/:cardId/steps/:stepId/decide', ctrl.decide())
  router.post('/cards/:cardId/steps/:stepId/check', ctrl.check())

  return router
}
