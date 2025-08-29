import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../../config'

const useCompanyStore = create((set) => ({
  companies: [],
  fetchCompanies: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5003/api/companies`)
      set({ companies: response.data })
    } catch (error) {
      console.error('Ошибка при загрузке данных компаний:', error)
    }
  },
  updateCompany: async (companyId, data) => {
    try {
      await axios.put(
        `${API_BASE_URL}5003/api/companies/general/${companyId}`,
        data
      )
      await useCompanyStore.getState().fetchCompanies()
    } catch (error) {
      console.error('Ошибка при обновлении данных компании:', error)
    }
  },
  updateManager: async (companyId, data) => {
    try {
      await axios.put(
        `${API_BASE_URL}5003/api/companies/manager/${companyId}`,
        data
      )
      await useCompanyStore.getState().fetchCompanies()
    } catch (error) {
      console.error('Ошибка при обновлении данных менеджера:', error)
    }
  },
  updateCompanyDetails: async (companyId, data) => {
    try {
      await axios.put(
        `${API_BASE_URL}5003/api/companies/details/${companyId}`,
        data
      )
      await useCompanyStore.getState().fetchCompanies()
    } catch (error) {
      console.error('Ошибка при обновлении деталей компании:', error)
    }
  },
  updateCompanyCompetitors: async (companyId, competitors) => {
    try {
      await axios.put(
        `${API_BASE_URL}5003/api/companies/competitors/${companyId}`,
        { competitors }
      )
      await useCompanyStore.getState().fetchCompanies()
    } catch (error) {
      console.error('Ошибка при обновлении конкурентов компании:', error)
    }
  },
}))

export default useCompanyStore
