import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../../config'

const usePresenceStore = create((set) => ({
  byId: {},
  setStatus: (userId, status) => {
    if (userId == null || userId === '' || !status) return
    set((state) => ({
      byId: { ...state.byId, [String(userId)]: status },
    }))
  },
  load: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/users/presence`)
      const byId = {}
      for (const row of response.data || []) {
        if (row?.id == null) continue
        byId[String(row.id)] = row.status || 'offline'
      }
      set({ byId })
    } catch (error) {
      console.error(
        'Ошибка загрузки статусов:',
        error.response?.data || error.message
      )
    }
  },
}))

export default usePresenceStore
