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

async function updateTaskStatus(taskId, status) {
  const response = await client.put(`/api/tasks/${taskId}/status`, { status })
  return response.data
}

async function addTaskComment(taskId, userId, comment) {
  const response = await client.post(`/api/tasks/${taskId}/comments`, { user_id: userId, comment })
  return response.data
}

async function replaceTaskAssignee(taskId, oldUserId, newUserId) {
  const response = await client.put(`/api/tasks/${taskId}/replace-assignee`, {
    task_id: taskId,
    old_user_id: oldUserId,
    new_user_id: newUserId,
  })
  return response.data
}

async function addTaskAttachment(payload) {
  // payload: { task_id, file_url, file_type, uploaded_by, comment_file?, name_file, tableType: 'local' | 'global' }
  const response = await client.post('/api/tasks/attachment/add', payload)
  return response.data
}

// ===== Проекты (global_tasks) =====
async function createGlobalTask(payload) {
  // { title, description, goals, deadline, priority, additionalInfo, responsibles, created_by }
  const response = await client.post('/api/create/global-tasks', payload)
  return response.data
}

async function getGlobalTaskById(taskId) {
  const response = await client.get(`/api/global-tasks/${taskId}`)
  return response.data
}

async function updateGlobalTaskStatus(taskId, status, userId) {
  const response = await client.put(`/api/update/global-tasks/${taskId}/status`, { status, userId })
  return response.data
}

async function updateGlobalTask(taskId, patch) {
  const response = await client.put(`/api/update/global-tasks/${taskId}`, patch)
  return response.data
}

async function addGlobalTaskComment(taskId, userId, comment) {
  const response = await client.post(`/api/global-tasks/${taskId}/comments`, { user_id: userId, comment })
  return response.data
}

async function addGlobalTaskResponsibles(taskId, responsibles, userId) {
  const response = await client.post(`/api/global-tasks/${taskId}/responsibles-new`, { responsibles, userId })
  return response.data
}

async function updateGlobalTaskGoals(taskId, goals, userId) {
  const response = await client.put(`/api/tasks/${taskId}/update-goals`, { goals, userId })
  return response.data
}

async function updateGlobalTaskAdditionalInfo(taskId, additionalInfo, userId) {
  const response = await client.put(`/api/tasks/${taskId}/update-additional-info`, { additionalInfo, userId })
  return response.data
}

async function sendGlobalTaskChatMessage(payload) {
  // { globalTaskId, userId, text, title?, repliedToMessageId? }
  const response = await client.post('/api/global-tasks/chat', payload)
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
  updateTaskStatus,
  addTaskComment,
  replaceTaskAssignee,
  addTaskAttachment,
  createGlobalTask,
  getGlobalTaskById,
  updateGlobalTaskStatus,
  updateGlobalTask,
  addGlobalTaskComment,
  addGlobalTaskResponsibles,
  updateGlobalTaskGoals,
  updateGlobalTaskAdditionalInfo,
  sendGlobalTaskChatMessage,
  addTaskAssignment,
  addTaskApproval,
  addTaskVisibility,
  getTask,
  getUsers,
  getDepartments,
  getRoles,
}
