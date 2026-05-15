const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { authenticateAccessToken } = require('../../shared/middleware/authenticateAccessToken')
const {
  startDraft,
  getOrderItems,
  addDraftNode,
  removeLastDraftNode,
  clearDraftNodes,
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
const {
  getThreadByDraftDealer,
  getMessagesDealer,
  postMessageDealer,
} = require('../chat/complaintChatController')
const { uploadChatMiddleware } = require('../chat/chatMulter')

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

const uploadDraftAttachmentSingle = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) return next()
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Файл слишком большой. Максимум 15 МБ на вложение.' })
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Превышен лимит вложений.' })
      }
      return res.status(400).json({ message: `Ошибка загрузки вложения: ${error.code}` })
    }
    return res.status(400).json({ message: 'Не удалось обработать вложение.' })
  })
}

module.exports = (pool) => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.post('/draft/start', startDraft(pool))
  router.get('/order-items', getOrderItems(pool))
  router.get('/draft/:id', getDraft(pool))
  router.post('/draft/:id/items', addDraftNode(pool))
  router.post('/draft/:id/remove-last', removeLastDraftNode(pool))
  router.post('/draft/:id/clear', clearDraftNodes(pool))
  router.post('/draft/:id/attachments', uploadDraftAttachmentSingle, uploadDraftAttachment(pool))
  router.post('/draft/:id/submit', submitDraft(pool))

  router.post('/quick', upload.array('files', 10), createQuickComplaint(pool))
  router.get('/list', getList(pool))
  router.get('/chat/thread/by-draft/:draftId', getThreadByDraftDealer(pool))
  router.get('/chat/thread/:threadId/messages', getMessagesDealer(pool))
  router.post('/chat/thread/:threadId/messages', uploadChatMiddleware, postMessageDealer(pool))
  router.get('/ticket/:requestNumber', getTicketDetails(pool))

  router.get('/ratings/pending', getPendingRatings(pool))
  router.post('/:requestNumber/rating', saveRating(pool))
  router.post('/:requestNumber/rating-comment', saveRatingComment(pool))

  return router
}
