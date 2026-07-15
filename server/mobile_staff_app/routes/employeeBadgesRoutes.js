const express = require('express')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const { getBadges } = require('../controllers/employeeBadgesController')

module.exports = (pool) => {
  const router = express.Router()
  router.use(authenticateAccessToken)
  router.get('/', getBadges(pool))
  return router
}
