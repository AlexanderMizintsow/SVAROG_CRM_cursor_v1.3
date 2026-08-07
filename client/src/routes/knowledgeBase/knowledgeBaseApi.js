import axios from 'axios'
import { API_BASE_URL } from '../../../config'

const BASE = `${API_BASE_URL}5000/api/knowledge`

const withUser = (userId, params = {}) => ({
  ...params,
  userId,
})

export const knowledgeBaseApi = {
  async getPermissions(userId) {
    const { data } = await axios.get(`${BASE}/permissions`, {
      params: withUser(userId),
    })
    return data
  },

  async listDocuments(userId, filters = {}) {
    const { data } = await axios.get(`${BASE}/documents`, {
      params: withUser(userId, {
        q: filters.q || undefined,
        category: filters.category || undefined,
        departmentId: filters.departmentId || undefined,
        mineOnly: filters.mineOnly ? '1' : undefined,
        favoriteOnly: filters.favoriteOnly ? '1' : undefined,
      }),
    })
    return {
      documents: data?.documents || [],
      favoriteCount:
        data?.favoriteCount != null ? Number(data.favoriteCount) : 0,
      totalCount: data?.totalCount != null ? Number(data.totalCount) : 0,
    }
  },

  async getDocument(userId, id) {
    const { data } = await axios.get(`${BASE}/documents/${id}`, {
      params: withUser(userId),
    })
    return data?.document
  },

  async createDocument(userId, formData) {
    formData.append('userId', String(userId))
    const { data } = await axios.post(`${BASE}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data?.document
  },

  async updateDocument(userId, id, formData) {
    formData.append('userId', String(userId))
    const { data } = await axios.put(`${BASE}/documents/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data?.document
  },

  async deleteDocument(userId, id) {
    const { data } = await axios.delete(`${BASE}/documents/${id}`, {
      params: withUser(userId),
    })
    return data
  },

  downloadUrl(userId, id) {
    return `${BASE}/documents/${id}/download?userId=${encodeURIComponent(userId)}`
  },

  /** Просмотр в браузере (PDF/изображения): Content-Disposition inline */
  viewUrl(userId, id) {
    return `${BASE}/documents/${id}/download?userId=${encodeURIComponent(userId)}&inline=1`
  },

  async reindex(userId) {
    const { data } = await axios.post(`${BASE}/reindex`, { userId })
    return data
  },

  async listVersions(userId, id) {
    const { data } = await axios.get(`${BASE}/documents/${id}/versions`, {
      params: withUser(userId),
    })
    return data
  },

  versionDownloadUrl(userId, docId, versionId) {
    return `${BASE}/documents/${docId}/versions/${versionId}/download?userId=${encodeURIComponent(userId)}`
  },

  async listEvents(userId, id) {
    const { data } = await axios.get(`${BASE}/documents/${id}/events`, {
      params: withUser(userId),
    })
    return data?.events || []
  },

  async addFavorite(userId, id) {
    const { data } = await axios.post(`${BASE}/documents/${id}/favorite`, { userId })
    return data
  },

  async removeFavorite(userId, id) {
    const { data } = await axios.delete(`${BASE}/documents/${id}/favorite`, {
      params: withUser(userId),
    })
    return data
  },

  async listErrorMarks(userId, id) {
    const { data } = await axios.get(`${BASE}/documents/${id}/error-marks`, {
      params: withUser(userId),
    })
    return data?.marks || []
  },

  async createErrorMark(userId, id, payload) {
    const { data } = await axios.post(`${BASE}/documents/${id}/error-marks`, {
      userId,
      comment: payload.comment,
      fileId: payload.fileId != null ? payload.fileId : undefined,
    })
    return data?.mark
  },

  async updateErrorMark(userId, id, markId, comment) {
    const { data } = await axios.put(
      `${BASE}/documents/${id}/error-marks/${markId}`,
      { userId, comment }
    )
    return data?.mark
  },

  async deleteErrorMark(userId, id, markId) {
    const { data } = await axios.delete(
      `${BASE}/documents/${id}/error-marks/${markId}`,
      { params: withUser(userId) }
    )
    return data
  },

  async addFiles(userId, id, fileList, options = {}) {
    const fd = new FormData()
    fd.append('userId', String(userId))
    if (options.replaceSameNames) {
      fd.append('replaceSameNames', '1')
    }
    const list = Array.from(fileList || [])
    list.forEach((f) => fd.append('files', f))
    fd.append(
      'originalFileNames',
      JSON.stringify(list.map((f) => f.name || 'file'))
    )
    const { data } = await axios.post(`${BASE}/documents/${id}/files`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  async deleteFile(userId, id, fileId) {
    const { data } = await axios.delete(
      `${BASE}/documents/${id}/files/${fileId}`,
      { params: withUser(userId) }
    )
    return data?.document
  },

  async replaceFile(userId, id, fileId, file, options = {}) {
    const fd = new FormData()
    fd.append('userId', String(userId))
    fd.append('file', file)
    if (file?.name) fd.append('originalFileName', file.name)
    if (options.confirmDifferentFileName) {
      fd.append('confirmDifferentFileName', '1')
    }
    const { data } = await axios.put(
      `${BASE}/documents/${id}/files/${fileId}`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return data
  },

  async renameFile(userId, id, fileId, fileName) {
    const { data } = await axios.patch(
      `${BASE}/documents/${id}/files/${fileId}`,
      { userId, fileName },
      { headers: { 'Content-Type': 'application/json' } }
    )
    return data
  },

  async listFileVersions(userId, id, fileId) {
    const { data } = await axios.get(
      `${BASE}/documents/${id}/files/${fileId}/versions`,
      { params: withUser(userId) }
    )
    return data
  },

  fileVersionDownloadUrl(userId, id, fileId, versionId) {
    return `${BASE}/documents/${id}/files/${fileId}/versions/${versionId}/download?userId=${encodeURIComponent(userId)}`
  },

  fileDownloadUrl(userId, id, fileId) {
    return `${BASE}/documents/${id}/files/${fileId}/download?userId=${encodeURIComponent(userId)}`
  },

  fileViewUrl(userId, id, fileId) {
    return `${BASE}/documents/${id}/files/${fileId}/download?userId=${encodeURIComponent(userId)}&inline=1`
  },

  async createCategory(userId, label) {
    const { data } = await axios.post(`${BASE}/categories`, { userId, label })
    return data?.category
  },

  async deleteCategory(userId, id) {
    const { data } = await axios.delete(`${BASE}/categories/${encodeURIComponent(id)}`, {
      params: withUser(userId),
    })
    return data
  },

  async createTag(userId, name) {
    const { data } = await axios.post(`${BASE}/tags`, { userId, name })
    return data?.tag
  },

  async deleteTag(userId, id) {
    const { data } = await axios.delete(`${BASE}/tags/${id}`, {
      params: withUser(userId),
    })
    return data
  },
}
