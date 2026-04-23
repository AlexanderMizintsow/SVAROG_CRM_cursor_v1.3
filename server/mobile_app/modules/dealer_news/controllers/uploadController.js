const fs = require('fs')
const path = require('path')
const multer = require('multer')
const slugify = require('slugify')
const { checkEditorAccess } = require('./newsAdminController')

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const maxFileSizeBytes = 5 * 1024 * 1024

const rootUploadsDir = path.join(__dirname, '..', '..', '..', '..', '..', 'uploads', 'dealer_news')
if (!fs.existsSync(rootUploadsDir)) {
  fs.mkdirSync(rootUploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, rootUploadsDir)
  },
  filename(req, file, cb) {
    const title = String(req.body.newsTitle || 'news').trim()
    const base = slugify(title, { lower: true, strict: true, locale: 'ru' }) || `news-${Date.now()}`
    const ext = path.extname(file.originalname || '').toLowerCase()
    const safeExt = allowedExtensions.has(ext) ? ext : '.jpg'
    cb(null, `${base}_${Date.now()}${safeExt}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: maxFileSizeBytes },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase()
    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(ext)) {
      return cb(new Error('Допустимы только изображения JPG, PNG и WEBP до 5MB'))
    }
    return cb(null, true)
  },
})

const uploadSingleImage = (pool) => [
  async (req, res, next) => {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) {
      return res.status(access.status).json({ message: access.message })
    }
    req.editorAccess = access
    return next()
  },
  upload.single('image'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не передан' })
    }
    const fileUrl = `/uploads/dealer_news/${req.file.filename}`
    return res.status(201).json({
      file_url: fileUrl,
      file_name: req.file.filename,
      file_size_bytes: req.file.size,
      mime_type: req.file.mimetype,
      warning:
        'Разрешены только бесплатные и лицензируемые иконки/изображения. Бренд-материалы должны быть зарегистрированы в компании.',
    })
  },
]

const handleUploadError = (error, req, res, next) => {
  if (!error) return next()
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Размер изображения не должен превышать 5MB' })
  }
  return res.status(400).json({ message: error.message || 'Ошибка загрузки изображения' })
}

module.exports = {
  uploadSingleImage,
  handleUploadError,
  maxFileSizeBytes,
}
