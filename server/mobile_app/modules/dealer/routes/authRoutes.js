const express = require('express')
const rateLimit = require('express-rate-limit')
const { login, refresh, logout } = require('../../../controllers/authController')

module.exports = (pool) => {
  const router = express.Router()

  const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    message: 'Слишком много попыток входа. Повторите позже.',
  })

  router.post('/login', loginLimiter, login(pool))
  router.post('/refresh', refresh(pool))
  router.post('/logout', logout(pool))

  return router
}
