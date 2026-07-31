const express = require('express')
const rateLimit = require('express-rate-limit')
const { login, refresh, logout } = require('../controllers/employeeAuthController')

module.exports = (pool) => {
  const router = express.Router()

  const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, _next, options) => {
      const resetTime = req.rateLimit?.resetTime
      const retryAfterSeconds = resetTime
        ? Math.max(1, Math.ceil((new Date(resetTime).getTime() - Date.now()) / 1000))
        : 300
      const waitLabel =
        retryAfterSeconds < 60
          ? `${retryAfterSeconds} сек.`
          : `${Math.ceil(retryAfterSeconds / 60)} мин.`
      const message = `Слишком много попыток входа. Подождите ${waitLabel} и повторите.`
      res.setHeader('Retry-After', String(retryAfterSeconds))
      res.status(options.statusCode).json({
        message,
        error: message,
        retryAfterSeconds,
        code: 'RATE_LIMIT',
      })
    },
  })

  router.post('/login', loginLimiter, login(pool))
  router.post('/refresh', refresh(pool))
  router.post('/logout', logout(pool))

  return router
}
