const express = require('express')
const { authenticateAccessToken } = require('../middleware/authenticateAccessToken')
const ctrl = require('../controllers/employeeAnalyticsController')

module.exports = () => {
  const router = express.Router()
  router.use(authenticateAccessToken)

  router.get('/departments', ctrl.getDepartments())
  router.get('/employees', ctrl.getEmployees())
  router.get('/summary', ctrl.getSummary())
  router.get('/detail', ctrl.getDetail())
  router.get('/business-processes', ctrl.listBusinessProcesses())
  router.get('/business-processes/:processId/nodes', ctrl.getBusinessProcessNodes())
  router.get('/bottlenecks/participants', ctrl.getBottleneckParticipants())
  router.get('/bottlenecks/departments', ctrl.getBottleneckDepartments())

  return router
}
