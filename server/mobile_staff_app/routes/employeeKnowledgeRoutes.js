const express = require('express')
const multer = require('multer')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const ctrl = require('../controllers/employeeKnowledgeController')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

/** PUT/POST с файлом: принимаем file или files[0] */
const uploadKnowledgeFile = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) return next(err)
    if (!req.file) {
      const list = Array.isArray(req.files) ? req.files : []
      const found =
        list.find((f) => f.fieldname === 'file') ||
        list.find((f) => f.fieldname === 'files') ||
        list[0]
      if (found) req.file = found
    }
    return next()
  })
}

module.exports = (pool) => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.get('/meta', ctrl.getMeta(pool))
  router.get('/documents', ctrl.listDocuments())
  router.post('/documents', uploadKnowledgeFile, ctrl.createDocument())
  router.get('/documents/:id', ctrl.getDocument())
  router.put('/documents/:id', uploadKnowledgeFile, ctrl.updateDocument())
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
