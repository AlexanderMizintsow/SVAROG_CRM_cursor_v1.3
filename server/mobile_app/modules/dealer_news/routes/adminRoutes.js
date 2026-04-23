const express = require('express')
const {
  listNewsAdmin,
  getNewsAdmin,
  createNews,
  updateNews,
  removeNews,
  listChangeLog,
  listSendLog,
  getTaxonomy,
} = require('../controllers/newsAdminController')
const {
  getPermissions,
  listPermissions,
  grantPermission,
  revokePermission,
} = require('../controllers/permissionsController')
const { uploadSingleImage, handleUploadError } = require('../controllers/uploadController')

module.exports = (pool) => {
  const router = express.Router()

  router.get('/news', listNewsAdmin(pool))
  router.get('/news/:newsId', getNewsAdmin(pool))
  router.post('/news', createNews(pool))
  router.put('/news/:newsId', updateNews(pool))
  router.delete('/news/:newsId', removeNews(pool))

  router.get('/change-log', listChangeLog(pool))
  router.get('/send-log', listSendLog(pool))
  router.get('/taxonomy', getTaxonomy(pool))

  router.get('/permissions', getPermissions(pool))
  router.get('/permissions/all', listPermissions(pool))
  router.post('/permissions', grantPermission(pool))
  router.delete('/permissions/:permissionId', revokePermission(pool))

  router.post('/upload-image', ...uploadSingleImage(pool))
  router.use(handleUploadError)

  return router
}
