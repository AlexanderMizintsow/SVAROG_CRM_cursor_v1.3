const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')

/** Окно блокировки: 5 минут (после исчерпания лимита ждать не дольше). */
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
/**
 * Общий лимит API для ~50 сотрудников.
 * 5000 запросов за окно 5 мин — с запасом на активную работу
 * (списки, бейджи, переключатели). Раньше было 200 / 15 мин — слишком жёстко.
 */
const RATE_LIMIT_MAX = 5000

const formatWaitRu = (seconds) => {
  const sec = Math.max(1, Math.ceil(Number(seconds) || 0))
  if (sec < 60) {
    return `${sec} сек.`
  }
  const min = Math.ceil(sec / 60)
  return `${min} мин.`
}

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
      windowMs: RATE_LIMIT_WINDOW_MS,
      max: RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        const path = req.path || ''
        return (
          path.startsWith('/api/mobile/employee/knowledge') &&
          req.method !== 'POST' &&
          req.method !== 'PUT'
        )
      },
      handler: (req, res, _next, options) => {
        const resetTime = req.rateLimit?.resetTime
        const retryAfterSeconds = resetTime
          ? Math.max(1, Math.ceil((new Date(resetTime).getTime() - Date.now()) / 1000))
          : Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
        const waitLabel = formatWaitRu(retryAfterSeconds)
        const message = `Слишком много запросов. Подождите ${waitLabel} и попробуйте снова.`

        res.setHeader('Retry-After', String(retryAfterSeconds))
        res.status(options.statusCode).json({
          message,
          error: message,
          retryAfterSeconds,
          code: 'RATE_LIMIT',
        })
      },
    })
  )
}

module.exports = {
  configureSecurity,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
}
