const axios = require('axios')
const config = require('../config')

const registerClient = axios.create({
  baseURL: config.registerApiUrl,
  timeout: 10000,
})

async function getUsers(req, res) {
  try {
    const response = await registerClient.get('/api/users')
    res.json(response.data)
  } catch (err) {
    console.error('getUsers proxy:', err.message)
    res.status(err.response?.status || 500).json(
      err.response?.data || { error: 'Не удалось получить список пользователей' }
    )
  }
}

async function getDepartments(req, res) {
  try {
    const response = await registerClient.get('/api/departments')
    res.json(response.data)
  } catch (err) {
    console.error('getDepartments proxy:', err.message)
    res.status(err.response?.status || 500).json(
      err.response?.data || { error: 'Не удалось получить список отделов' }
    )
  }
}

async function getRoles(req, res) {
  try {
    const response = await registerClient.get('/api/roles')
    res.json(response.data)
  } catch (err) {
    console.error('getRoles proxy:', err.message)
    res.status(err.response?.status || 500).json(
      err.response?.data || { error: 'Не удалось получить список ролей' }
    )
  }
}

module.exports = {
  getUsers,
  getDepartments,
  getRoles,
}
