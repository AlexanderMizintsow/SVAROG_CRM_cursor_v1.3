const axios = require('axios')
const config = require('../../config')

const client = axios.create({
  baseURL: config.registerApiUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

async function createTask(payload) {
  const response = await client.post('/api/tasks/create', payload)
  return response.data
}

async function addTaskAssignment(taskId, userId) {
  await client.post('/api/tasks/assignment/add', { task_id: taskId, user_id: userId })
}

async function addTaskApproval(taskId, approverId) {
  await client.post('/api/tasks/approval/add', { task_id: taskId, approver_id: approverId })
}

async function addTaskVisibility(taskId, userId) {
  await client.post('/api/tasks/visibility/add', { task_id: taskId, user_id: userId })
}

async function getTask(taskId) {
  const response = await client.get(`/api/tasks/${taskId}`)
  return response.data
}

async function getUsers() {
  const response = await client.get('/api/users')
  return response.data
}

async function getDepartments() {
  const response = await client.get('/api/departments')
  return response.data
}

async function getRoles() {
  const response = await client.get('/api/roles')
  return response.data
}

module.exports = {
  createTask,
  addTaskAssignment,
  addTaskApproval,
  addTaskVisibility,
  getTask,
  getUsers,
  getDepartments,
  getRoles,
}
