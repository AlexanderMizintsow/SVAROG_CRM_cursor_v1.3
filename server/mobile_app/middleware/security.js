const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')

const configureSecurity = (app) => {
  app.use(
    helmet({
      // Для CRM (localhost:5173) нужно читать превью изображений из mobile_app (localhost:5011).
      // Иначе браузер блокирует ответы как NotSameOrigin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  )
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
    })
  )
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: 'Слишком много запросов, попробуйте позже.',
    })
  )
}

module.exports = {
  configureSecurity,
}
