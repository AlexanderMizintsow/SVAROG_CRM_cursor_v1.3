const express = require('express')
const multer = require('multer')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const ctrl = require('../controllers/employeeKnowledgeController')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

module.exports = (pool) => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.get('/meta', ctrl.getMeta(pool))
  router.get('/documents', ctrl.listDocuments())
  router.post('/documents', upload.single('file'), ctrl.createDocument())
  router.get('/documents/:id', ctrl.getDocument())
  router.put('/documents/:id', upload.single('file'), ctrl.updateDocument())
  router.delete('/documents/:id', ctrl.deleteDocument())
  router.get('/documents/:id/download', ctrl.downloadDocument())
  router.get('/documents/:id/versions', ctrl.listVersions())
  router.get(
    '/documents/:id/versions/:versionId/download',
    ctrl.downloadVersion()
  )
  router.post('/documents/:id/favorite', ctrl.addFavorite())
  router.delete('/documents/:id/favorite', ctrl.removeFavorite())

  return router
}
