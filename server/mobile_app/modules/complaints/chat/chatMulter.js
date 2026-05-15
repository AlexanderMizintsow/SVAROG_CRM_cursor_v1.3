const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { ALLOWED_IMAGE_MIMES } = require('./complaintChatService')

const chatImagesDir = path.resolve(__dirname, '..', '..', '..', '..', '..', 'uploads', 'mobile-complaint-chat-images')
fs.mkdirSync(chatImagesDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, chatImagesDir),
  filename: (_req, file, cb) => {
    const safeName = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname}`
    cb(null, safeName)
  },
})

const uploadChatImages = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase()
    if (ALLOWED_IMAGE_MIMES.has(mime)) cb(null, true)
    else cb(new Error('Допустимы только изображения (JPEG, PNG, WebP, GIF)'))
  },
})

const uploadChatMiddleware = (req, res, next) => {
  uploadChatImages.array('images', 5)(req, res, (error) => {
    if (!error) return next()
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Изображение слишком большое (макс. 10 МБ).' })
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Не более 5 изображений за раз.' })
      }
      return res.status(400).json({ message: `Ошибка загрузки: ${error.code}` })
    }
    return res.status(400).json({ message: error.message || 'Не удалось обработать вложения' })
  })
}

module.exports = {
  uploadChatMiddleware,
  chatImagesDir,
}
