/**
 * API-клиент движка бизнес-процессов (BPE).
 * Базовый URL — BPE_API_BASE_URL. Проверка токена на BPE не используется.
 */
import axios from 'axios'
import { BPE_API_BASE_URL } from '../../config.js'

const bpeClient = axios.create({
  baseURL: `${BPE_API_BASE_URL}/api/bp`,
  headers: { 'Content-Type': 'application/json' },
})

// Определения процессов
export const getProcesses = (params = {}) =>
  bpeClient.get('/processes', { params }).then((res) => res.data)

export const getProcess = (id) =>
  bpeClient.get(`/processes/${id}`).then((res) => res.data)

export const createProcess = (body) =>
  bpeClient.post('/processes', body).then((res) => res.data)

export const updateProcess = (id, body) =>
  bpeClient.put(`/processes/${id}`, body).then((res) => res.data)

export const deleteProcess = (id) =>
  bpeClient.delete(`/processes/${id}`).then((res) => res.data)

// Экземпляры
export const startProcess = (processId, body = {}) =>
  bpeClient.post(`/processes/${processId}/start`, body).then((res) => res.data)

export const getInstances = (params = {}) =>
  bpeClient.get('/instances', { params }).then((res) => res.data)

export const getInstance = (id) =>
  bpeClient.get(`/instances/${id}`).then((res) => res.data)

export const cancelInstance = (id) =>
  bpeClient.post(`/instances/${id}/cancel`).then((res) => res.data)

// Шаблоны задач
export const getTaskTemplates = () =>
  bpeClient.get('/task-templates').then((res) => res.data)

export const createTaskTemplate = (body) =>
  bpeClient.post('/task-templates', body).then((res) => res.data)

export const updateTaskTemplate = (id, body) =>
  bpeClient.put(`/task-templates/${id}`, body).then((res) => res.data)

export const deleteTaskTemplate = (id) =>
  bpeClient.delete(`/task-templates/${id}`).then((res) => res.data)

// Справочники (прокси к register, если BPE проксирует; иначе вызывать register напрямую)
export const getReferencesUsers = () =>
  bpeClient.get('/references/users').then((res) => res.data)

export const getReferencesDepartments = () =>
  bpeClient.get('/references/departments').then((res) => res.data)

export const getReferencesRoles = () =>
  bpeClient.get('/references/roles').then((res) => res.data)

// Аналитика
export const getAnalytics = (processId) =>
  bpeClient.get(`/analytics/process/${processId}`).then((res) => res.data)
