const express = require('express')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const ctrl = require('../controllers/employeeWorkGroupsController')

const employeeWorkGroupsRoutes = (pool) => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.get('/', ctrl.listGroups(pool))
  router.get('/counts', ctrl.getCounts())
  router.get('/votes', ctrl.listVotes())
  router.post('/', ctrl.createGroup(pool))
  router.post('/:groupId/votes', ctrl.saveVotes(pool))
  router.patch('/:groupId', ctrl.updateGroup(pool))
  router.delete('/:groupId', ctrl.deleteGroup(pool))
  router.delete(
    '/:groupId/participants/:participantId',
    ctrl.removeParticipant(pool)
  )

  return router
}

module.exports = employeeWorkGroupsRoutes
