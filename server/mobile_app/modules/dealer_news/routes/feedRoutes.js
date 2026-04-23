const express = require('express')
const { authenticateAccessToken } = require('../../shared/middleware/authenticateAccessToken')
const { listFeed, getFeedItem } = require('../controllers/newsFeedController')

module.exports = (pool) => {
  const router = express.Router()

  router.get('/', authenticateAccessToken, listFeed(pool))
  router.get('/:newsId', authenticateAccessToken, getFeedItem(pool))

  return router
}
