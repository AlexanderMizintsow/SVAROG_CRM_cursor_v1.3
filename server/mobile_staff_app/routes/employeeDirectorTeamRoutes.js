const express = require('express')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const { getTeamSummary } = require('../controllers/employeeDirectorTeamController')
const {
  getDigestSettings,
  setDigestSettings,
} = require('../controllers/employeeDirectorDigestController')

module.exports = (pool) => {
  const router = express.Router()
  router.use(authenticateAccessToken)
  router.get('/team', getTeamSummary(pool))
  router.get('/digest', getDigestSettings(pool))
  router.put('/digest', setDigestSettings(pool))
  return router
}
