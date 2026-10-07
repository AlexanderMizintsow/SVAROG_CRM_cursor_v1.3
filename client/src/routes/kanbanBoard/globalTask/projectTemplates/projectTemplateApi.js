import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'

const base = () => `${API_BASE_URL}5000/api/user-project-templates`

export function fetchUserProjectTemplates(userId) {
  return axios.get(base(), { params: { userId } }).then((response) => response.data)
}

export function createUserProjectTemplate(userId, body) {
  return axios.post(base(), { ...body, userId }).then((response) => response.data)
}

export function updateUserProjectTemplate(userId, id, body) {
  return axios.put(`${base()}/${id}`, { ...body, userId }).then((response) => response.data)
}

export function deleteUserProjectTemplate(userId, id) {
  return axios.delete(`${base()}/${id}`, { params: { userId } }).then((response) => response.data)
}
