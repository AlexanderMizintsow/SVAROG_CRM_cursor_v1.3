const express = require('express')
const admin = require('../controllers/staffNewsAdminController')
const uploadCtrl = require('../controllers/staffNewsUploadController')

const staffNewsAdminRoutes = (pool) => {
  const router = express.Router()

  router.get('/news', admin.listNewsAdmin(pool))
  router.get('/news/:newsId/ack-report', admin.getAckReport(pool))
  router.get('/news/:newsId/engagement', admin.getEngagementReport(pool))
  router.delete('/comments/:commentId', admin.deleteCommentAdmin(pool))
  router.get('/news/:newsId', admin.getNewsAdmin(pool))
  router.post('/news', admin.createNews(pool))
  router.put('/news/:newsId', admin.updateNews(pool))
  router.delete('/news/:newsId', admin.deleteNews(pool))
  router.get('/taxonomy', admin.getTaxonomy(pool))
  router.post('/estimate-audience', admin.estimateAudience(pool))
  router.get('/change-log', admin.listChangeLog(pool))
  router.get('/permissions', admin.getMyPermission(pool))
  router.get('/permissions/all', admin.listPermissions(pool))
  router.post('/permissions', admin.grantPermission(pool))
  router.delete('/permissions/:id', admin.revokePermission(pool))
  router.post(
    '/upload-image',
    ...uploadCtrl.uploadSingleImage(pool),
    uploadCtrl.handleUploadError
  )
  router.post(
    '/upload-attachment',
    ...uploadCtrl.uploadAttachment(pool),
    uploadCtrl.handleUploadError
  )

  return router
}

module.exports = staffNewsAdminRoutes
