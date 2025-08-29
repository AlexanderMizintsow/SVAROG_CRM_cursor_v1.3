// api.js
import axios from 'axios'
import { API_BASE_URL } from '../../../config'

export const fetchProcessRatingsStats = async (endpoint) => {
  try {
    const response = await axios.get(`${API_BASE_URL}5004/api/${endpoint}`)
    return response.data
  } catch (error) {
    console.error('Error fetching ratings stats:', error)
    throw error
  }
}
