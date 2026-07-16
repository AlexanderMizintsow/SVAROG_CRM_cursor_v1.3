const express = require('express')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const feed = require('../controllers/staffNewsFeedController')

const staffNewsFeedRoutes = (pool) => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.get('/', feed.listFeed(pool))
  router.get('/unread-count', feed.unreadCount(pool))
  router.get('/:newsId', feed.getFeedItem(pool))
  router.post('/:newsId/ack', feed.ackNews(pool))
  router.post('/:newsId/react', feed.toggleReaction(pool))
  router.post('/:newsId/comments', feed.postComment(pool))
  router.delete('/:newsId/comments/:commentId', feed.deleteComment(pool))
  router.post('/:newsId/poll/vote', feed.postPollVote(pool))

  return router
}

module.exports = staffNewsFeedRoutes
