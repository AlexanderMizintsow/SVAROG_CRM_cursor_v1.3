import axios from 'axios'
import { API_BASE_URL } from '../../../config'

const BASE = `${API_BASE_URL}5000/api/manager-requests`

const withUser = (userId, params = {}) => ({
  ...params,
  userId,
})

export const managerRequestsApi = {
  async getMyManager(userId) {
    const { data } = await axios.get(`${BASE}/manager`, {
      params: withUser(userId),
    })
    return data?.manager || null
  },

  async listMine(userId) {
    const { data } = await axios.get(`${BASE}/mine`, {
      params: withUser(userId),
    })
    return data?.requests || []
  },

  async listInbox(userId, status = 'all') {
    const { data } = await axios.get(`${BASE}/inbox`, {
      params: withUser(userId, { status }),
    })
    return data?.requests || []
  },

  async getOne(userId, id) {
    const { data } = await axios.get(`${BASE}/${id}`, {
      params: withUser(userId),
    })
    return data?.request
  },

  async create(userId, payload) {
    const { data } = await axios.post(`${BASE}`, {
      userId,
      ...payload,
    })
    return data?.request
  },

  async answer(userId, id, answerText) {
    const { data } = await axios.post(`${BASE}/${id}/answer`, {
      userId,
      answerText,
    })
    return data?.request
  },

  async close(userId, id) {
    const { data } = await axios.post(`${BASE}/${id}/close`, { userId })
    return data?.request
  },

  async markConverted(userId, id, relatedTaskId) {
    const { data } = await axios.post(`${BASE}/${id}/convert`, {
      userId,
      relatedTaskId,
    })
    return data?.request
  },
}

export const MANAGER_REQUEST_DRAFT_KEY = 'svarog_manager_request_task_draft'

export const saveManagerRequestTaskDraft = (draft) => {
  try {
    sessionStorage.setItem(MANAGER_REQUEST_DRAFT_KEY, JSON.stringify(draft))
  } catch (_) {}
}

export const readManagerRequestTaskDraft = () => {
  try {
    const raw = sessionStorage.getItem(MANAGER_REQUEST_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (_) {
    return null
  }
}

export const clearManagerRequestTaskDraft = () => {
  try {
    sessionStorage.removeItem(MANAGER_REQUEST_DRAFT_KEY)
  } catch (_) {}
}
