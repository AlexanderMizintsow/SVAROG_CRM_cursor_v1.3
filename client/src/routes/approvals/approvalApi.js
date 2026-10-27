import axios from 'axios'
import { API_BASE_URL } from '../../../config'

const root = `${API_BASE_URL}5000/api/approvals`

export const approvalApi = {
  inbox: (userId) => axios.get(`${root}/inbox`, { params: { userId } }).then((r) => r.data),
  checkLogs: (userId) => axios.get(`${root}/check-logs`, { params: { userId } }).then((r) => r.data),
  mine: (userId) => axios.get(`${root}/mine`, { params: { userId } }).then((r) => r.data),
  completed: (userId, month) =>
    axios.get(`${root}/completed`, { params: { userId, month } }).then((r) => r.data),
  card: (id, userId) => axios.get(`${root}/cards/${id}`, { params: { userId } }).then((r) => r.data),
  templates: (userId) => axios.get(`${root}/templates`, { params: { userId } }).then((r) => r.data),
  template: (id, userId) =>
    axios.get(`${root}/templates/${id}`, { params: { userId } }).then((r) => r.data),
  saveTemplate: (body) => axios.post(`${root}/templates`, body).then((r) => r.data),
  updateTemplate: (id, body) => axios.put(`${root}/templates/${id}`, body).then((r) => r.data),
  deleteTemplate: (id, userId) =>
    axios.delete(`${root}/templates/${id}`, { data: { userId } }).then((r) => r.data),
  create: (body) => axios.post(`${root}/cards`, body).then((r) => r.data),
  cancel: (id, userId) => axios.post(`${root}/cards/${id}/cancel`, { userId }).then((r) => r.data),
  message: (id, userId, body) =>
    axios.post(`${root}/cards/${id}/messages`, { userId, body }).then((r) => r.data),
  upload: (id, userId, file, extra = {}) => {
    const form = new FormData()
    form.append('userId', String(userId))
    form.append('file', file)
    if (extra.body) form.append('body', extra.body)
    return axios
      .post(`${root}/cards/${id}/files`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data)
  },
  fileUrl: (id, userId) => `${root}/files/${id}?userId=${userId}`,
  decide: (cardId, stepId, userId, decision, comment) =>
    axios
      .post(`${root}/cards/${cardId}/steps/${stepId}/decide`, { userId, decision, comment })
      .then((r) => r.data),
  check: (cardId, stepId, userId, manual, comment) =>
    axios
      .post(`${root}/cards/${cardId}/steps/${stepId}/check`, { userId, manual, comment })
      .then((r) => r.data),
  setAuthorDone: (id, userId, done) =>
    axios.post(`${root}/cards/${id}/author-done`, { userId, done }).then((r) => r.data),
  setAuthorNote: (id, userId, note) =>
    axios.post(`${root}/cards/${id}/author-note`, { userId, note }).then((r) => r.data),
  link: (id, userId, target) =>
    axios.post(`${root}/cards/${id}/links`, { userId, ...target }).then((r) => r.data),
  marks: (userId, taskIds, globalTaskIds) =>
    axios.post(`${root}/marks`, { userId, taskIds, globalTaskIds }).then((r) => r.data),
}

export const ORDER_EVENTS = [
  { id: 'created', code: 'order_exists', params: {}, label: 'Заказ создан' },
  { id: 'agreement', code: 'agreement_no_filled', params: {}, label: 'Появился номер договора 1С' },
]

export const SEARCH_BY = [
  { id: 'orderno', label: 'Наименование заказа' },
  { id: 'agreementno', label: 'Номер договора 1С' },
]
