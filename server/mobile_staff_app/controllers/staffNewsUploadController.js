const fs = require('fs')
const path = require('path')
const multer = require('multer')
const slugify = require('slugify')
const { checkEditorAccess } = require('./staffNewsAdminController')

const allowedImageMimes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const allowedImageExt = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const allowedPdfMimes = new Set(['application/pdf'])
const allowedPdfExt = new Set(['.pdf'])
const maxFileSizeBytes = 12 * 1024 * 1024

const rootUploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'staff_news')
if (!fs.existsSync(rootUploadsDir)) {
  fs.mkdirSync(rootUploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, rootUploadsDir)
  },
  filename(req, file, cb) {
    const title = String(req.body.newsTitle || 'news').trim()
    const base =
      slugify(title, { lower: true, strict: true, locale: 'ru' }) || `news-${Date.now()}`
    const ext = path.extname(file.originalname || '').toLowerCase()
    let safeExt = '.jpg'
    if (allowedImageExt.has(ext)) safeExt = ext
    if (allowedPdfExt.has(ext)) safeExt = '.pdf'
    cb(null, `${base}_${Date.now()}${safeExt}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: maxFileSizeBytes },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const okImage = allowedImageMimes.has(file.mimetype) && allowedImageExt.has(ext)
    const okPdf = allowedPdfMimes.has(file.mimetype) && allowedPdfExt.has(ext)
    if (!okImage && !okPdf) {
      return cb(new Error('Допустимы JPG/PNG/WEBP и PDF до 12MB'))
    }
    return cb(null, true)
  },
})

const respondUploaded = (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Файл не передан' })
  const isPdf =
    req.file.mimetype === 'application/pdf' ||
    path.extname(req.file.filename).toLowerCase() === '.pdf'
  const fileUrl = `/uploads/staff_news/${req.file.filename}`
  return res.status(201).json({
    file_url: fileUrl,
    file_name: req.file.originalname || req.file.filename,
    file_size_bytes: req.file.size,
    mime_type: req.file.mimetype,
    media_type: isPdf ? 'pdf' : 'image',
  })
}

const uploadSingleImage = (pool) => [
  async (req, res, next) => {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) {
      return res.status(access.status).json({ message: access.message })
    }
    return next()
  },
  upload.single('image'),
  respondUploaded,
]

const uploadAttachment = (pool) => [
  async (req, res, next) => {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) {
      return res.status(access.status).json({ message: access.message })
    }
    return next()
  },
  upload.single('file'),
  respondUploaded,
]

const handleUploadError = (error, req, res, next) => {
  if (!error) return next()
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Размер файла не должен превышать 12MB' })
  }
  return res.status(400).json({ message: error.message || 'Ошибка загрузки' })
}

module.exports = { uploadSingleImage, uploadAttachment, handleUploadError }
