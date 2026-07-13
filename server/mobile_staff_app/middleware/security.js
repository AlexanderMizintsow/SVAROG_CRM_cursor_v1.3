const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')

const configureSecurity = (app) => {
  app.use(
    helmet({
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
