import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'

const BASE = `${API_BASE_URL}5011/api/mobile/employee/news-admin`

const buildAuthHeaders = (user) => ({
  'x-user-id': String(user?.id || ''),
  'x-user-is-admin': user?.role_name === 'Администратор' ? '1' : '0',
  'x-user-role': encodeURIComponent(user?.role_name || ''),
})

export const staffNewsApi = {
  async listNews(user, params = {}) {
    const response = await axios.get(`${BASE}/news`, {
      params,
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async getNews(user, newsId) {
    const response = await axios.get(`${BASE}/news/${newsId}`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async createNews(user, payload) {
    const response = await axios.post(`${BASE}/news`, payload, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async updateNews(user, newsId, payload) {
    const response = await axios.put(`${BASE}/news/${newsId}`, payload, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async deleteNews(user, newsId) {
    const response = await axios.delete(`${BASE}/news/${newsId}`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async uploadImage(user, file, newsTitle) {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('newsTitle', newsTitle || 'news')
    const response = await axios.post(`${BASE}/upload-image`, formData, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async getTaxonomy(user) {
    const response = await axios.get(`${BASE}/taxonomy`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async uploadAttachment(user, file, newsTitle) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('newsTitle', newsTitle || 'news')
    const response = await axios.post(`${BASE}/upload-attachment`, formData, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async estimateAudience(user, segments) {
    const response = await axios.post(
      `${BASE}/estimate-audience`,
      { segments },
      { headers: buildAuthHeaders(user) }
    )
    return response.data
  },

  async getAckReport(user, newsId) {
    const response = await axios.get(`${BASE}/news/${newsId}/ack-report`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async getEngagementReport(user, newsId) {
    const response = await axios.get(`${BASE}/news/${newsId}/engagement`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async deleteComment(user, commentId) {
    const response = await axios.delete(`${BASE}/comments/${commentId}`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async listChangeLog(user) {
    const response = await axios.get(`${BASE}/change-log`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async getPermissions(user) {
    const response = await axios.get(`${BASE}/permissions`, {
      params: { userId: user?.id },
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async listPermissions(user) {
    const response = await axios.get(`${BASE}/permissions/all`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async grantPermission(user, userId) {
    const response = await axios.post(
      `${BASE}/permissions`,
      { user_id: userId },
      { headers: buildAuthHeaders(user) }
    )
    return response.data
  },

  async revokePermission(user, permissionId) {
    const response = await axios.delete(`${BASE}/permissions/${permissionId}`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async loadUsers() {
    const response = await axios.get(`${API_BASE_URL}5000/api/users`)
    return response.data
  },
}

export const staffNewsMediaUrl = (pathOrUrl) => {
  if (!pathOrUrl) return ''
  if (String(pathOrUrl).startsWith('http')) return pathOrUrl
  return `${API_BASE_URL}5011${pathOrUrl}`
}
