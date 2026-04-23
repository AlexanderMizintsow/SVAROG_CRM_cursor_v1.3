const express = require('express')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const { registerPushDevice } = require('./pushService')

module.exports = (pool) => {
  const router = express.Router()

  router.post('/register', authenticateAccessToken, async (req, res) => {
    try {
      const token = String(req.body.pushToken || '').trim()
      if (!token) return res.status(400).json({ message: 'pushToken обязателен' })

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
