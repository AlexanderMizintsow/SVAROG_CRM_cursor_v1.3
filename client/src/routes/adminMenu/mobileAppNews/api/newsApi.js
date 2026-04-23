import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'

const NEWS_ADMIN_BASE = `${API_BASE_URL}5011/api/mobile/dealer/news-admin`

const buildAuthHeaders = (user) => ({
  'x-user-id': String(user?.id || ''),
  'x-user-is-admin': user?.role_name === 'Администратор' ? '1' : '0',
})

export const newsApi = {
  async listNews(user, params = {}) {
    const response = await axios.get(`${NEWS_ADMIN_BASE}/news`, {
      params,
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async getNews(user, newsId) {
    const response = await axios.get(`${NEWS_ADMIN_BASE}/news/${newsId}`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async createNews(user, payload) {
    const response = await axios.post(`${NEWS_ADMIN_BASE}/news`, payload, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async updateNews(user, newsId, payload) {
    const response = await axios.put(`${NEWS_ADMIN_BASE}/news/${newsId}`, payload, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async deleteNews(user, newsId) {
    const response = await axios.delete(`${NEWS_ADMIN_BASE}/news/${newsId}`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async uploadImage(user, file, newsTitle) {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('newsTitle', newsTitle || 'news')

    const response = await axios.post(`${NEWS_ADMIN_BASE}/upload-image`, formData, {
      headers: {
        ...buildAuthHeaders(user),
      },
    })
    return response.data
  },

  async getPermissions(user, userId) {
    const response = await axios.get(`${NEWS_ADMIN_BASE}/permissions`, {
      params: { userId },
    })
    return response.data
  },

  async listPermissions(user) {
    const response = await axios.get(`${NEWS_ADMIN_BASE}/permissions/all`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async grantPermission(user, userId) {
    const response = await axios.post(
      `${NEWS_ADMIN_BASE}/permissions`,
      { user_id: userId },
      {
        headers: buildAuthHeaders(user),
      }
    )
    return response.data
  },

  async revokePermission(user, permissionId) {
    const response = await axios.delete(`${NEWS_ADMIN_BASE}/permissions/${permissionId}`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async listChangeLog(user, params = {}) {
    const response = await axios.get(`${NEWS_ADMIN_BASE}/change-log`, {
      headers: buildAuthHeaders(user),
      params,
    })
    return response.data
  },

  async listSendLog(user, params = {}) {
    const response = await axios.get(`${NEWS_ADMIN_BASE}/send-log`, {
      headers: buildAuthHeaders(user),
      params,
    })
    return response.data
  },

  async getTaxonomy(user) {
    const response = await axios.get(`${NEWS_ADMIN_BASE}/taxonomy`, {
      headers: buildAuthHeaders(user),
    })
    return response.data
  },

  async loadUsers() {
    const response = await axios.get(`${API_BASE_URL}5000/api/users`)
    return response.data
  },

  async loadCompanies() {
    const response = await axios.get(`${API_BASE_URL}5003/api/companies/list`)
    return response.data
  },
}
