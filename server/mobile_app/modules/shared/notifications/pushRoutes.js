const express = require('express')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const { registerPushDevice } = require('./pushService')

module.exports = (pool) => {
  const router = express.Router()

  router.post('/register', (req, _res, next) => {
    const authHeader = String(req.headers.authorization || '')
    console.log('[mobile_app][push][register] pre-auth request', {
      hasAuthHeader: authHeader.startsWith('Bearer '),
      authPrefix: authHeader.slice(0, 24),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 80),
      ip: req.headers['x-forwarded-for'] || req.ip || null,
    })
    next()
  })

  router.post('/register', authenticateAccessToken, async (req, res) => {
    try {
      const token = String(req.body.pushToken || '').trim()
      if (!token) return res.status(400).json({ message: 'pushToken обязателен' })

      console.log('[mobile_app][push][register] incoming request', {
        companyId: req.user?.companyId || null,
        companyName: req.user?.companyName || null,
        platform: String(req.body.platform || 'android').trim(),
        appVersion: String(req.body.appVersion || '').trim(),
        tokenPrefix: token.slice(0, 24),
      })

      await registerPushDevice(pool, {
        companyId: req.user.companyId,
        companyName: req.user.companyName,
        token,
        platform: String(req.body.platform || 'android').trim(),
        appVersion: String(req.body.appVersion || '').trim(),
      })
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('[mobile_app][push][register] error', error)
      return res.status(500).json({ message: 'Ошибка регистрации push устройства' })
    }
  })

  return router
}
