import axios from 'axios'
import { API_BASE_URL } from '../config'

export const fetchUserPermissions = async (userId, componentName) => {
  try {
    const response = await axios.get(`${API_BASE_URL}5000/api/permissions`, {
      params: {
        userId,
        component: componentName,
      },
    })

    return response.data
  } catch (error) {
    throw new Error('Failed to fetch permissions: ' + error.message)
  }
}
