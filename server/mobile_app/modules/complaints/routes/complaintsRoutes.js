const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { authenticateAccessToken } = require('../../shared/middleware/authenticateAccessToken')
const {
  startDraft,
  getOrderItems,
  addDraftNode,
  uploadDraftAttachment,
  submitDraft,
  createQuickComplaint,
  getList,
  getPendingRatings,
  getTicketDetails,
  saveRating,
  saveRatingComment,
  getDraft,
} = require('../controllers/complaintsController')

const uploadsDir = path.resolve(__dirname, '..', '..', '..', '..', '..', 'uploads', 'mobile-complaints')
fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname}`
    cb(null, safeName)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 10,
  },
})

module.exports = (pool) => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.post('/draft/start', startDraft(pool))
  router.get('/order-items', getOrderItems(pool))
  router.get('/draft/:id', getDraft(pool))
  router.post('/draft/:id/items', addDraftNode(pool))
  router.post('/draft/:id/attachments', upload.single('file'), uploadDraftAttachment(pool))
  router.post('/draft/:id/submit', submitDraft(pool))

  router.post('/quick', upload.array('files', 10), createQuickComplaint(pool))
  router.get('/list', getList(pool))
  router.get('/ticket/:requestNumber', getTicketDetails(pool))

  router.get('/ratings/pending', getPendingRatings(pool))
  router.post('/:requestNumber/rating', saveRating(pool))
  router.post('/:requestNumber/rating-comment', saveRatingComment(pool))

  return router
}
