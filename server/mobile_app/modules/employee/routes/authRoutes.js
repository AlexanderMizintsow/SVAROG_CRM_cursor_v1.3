const express = require('express')

module.exports = () => {
  const router = express.Router()

  router.post('/login', (req, res) => {
    return res.status(501).json({
      message: 'Вход для сотрудников пока не реализован',
      code: 'EMPLOYEE_LOGIN_NOT_IMPLEMENTED',
    })
  })

  router.post('/refresh', (req, res) => {
    return res.status(501).json({
      message: 'Обновление сессии сотрудников пока не реализовано',
      code: 'EMPLOYEE_REFRESH_NOT_IMPLEMENTED',
    })
  })

  router.post('/logout', (req, res) => {
    return res.status(501).json({
      message: 'Выход для сотрудников пока не реализован',
      code: 'EMPLOYEE_LOGOUT_NOT_IMPLEMENTED',
    })
  })

  return router
}
