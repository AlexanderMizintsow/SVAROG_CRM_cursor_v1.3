const express = require('express')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const ctrl = require('../controllers/employeeManagerRequestsController')

module.exports = (pool) => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.get('/manager', ctrl.getMyManager(pool))
  router.get('/mine', ctrl.listMine(pool))
  router.get('/inbox', ctrl.listInbox(pool))
  router.get('/:id', ctrl.getOne(pool))
  router.post('/', ctrl.createRequest(pool))
  router.post('/:id/answer', ctrl.answerRequest(pool))
  router.post('/:id/close', ctrl.closeRequest(pool))
  router.post('/:id/convert', ctrl.markConverted(pool))

  return router
}
