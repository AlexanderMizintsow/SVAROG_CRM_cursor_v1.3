const express = require('express')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const ctrl = require('../controllers/employeeAbsencesController')

module.exports = () => {
  const router = express.Router()
  router.use(authenticateAccessToken)
  router.get('/active', ctrl.getActive())
  router.get('/upcoming', ctrl.getUpcoming())
  return router
}
