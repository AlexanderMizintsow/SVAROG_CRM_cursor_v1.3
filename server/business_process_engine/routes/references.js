const express = require('express')
const { getUsers, getDepartments, getRoles } = require('../controllers/referencesController')

function referencesRoutes() {
  const router = express.Router()
  router.get('/users', getUsers)
  router.get('/departments', getDepartments)
  router.get('/roles', getRoles)
  return router
}

module.exports = referencesRoutes
