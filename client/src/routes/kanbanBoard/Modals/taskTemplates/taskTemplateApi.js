import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'

const base = () => `${API_BASE_URL}5000/api/user-task-templates`

export function fetchUserTaskTemplates(userId) {
  return axios.get(base(), { params: { userId } }).then((response) => response.data)
}

export function createUserTaskTemplate(userId, body) {
  return axios.post(base(), { ...body, userId }).then((response) => response.data)
}

export function updateUserTaskTemplate(userId, id, body) {
  return axios.put(`${base()}/${id}`, { ...body, userId }).then((response) => response.data)
}

export function deleteUserTaskTemplate(userId, id) {
  return axios.delete(`${base()}/${id}`, { params: { userId } }).then((response) => response.data)
}
