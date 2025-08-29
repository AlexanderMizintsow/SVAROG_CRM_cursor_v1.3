import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../../config'

const useKanbanStore = create((set) => ({
  selectedEmployeeId: null, // тут только id подчиненного чья доска выбрана
  employees: [], // Тут список подчиненных без своего id
  employeeList: [], // Список подчиненных с объектом своих данных

  setSelectedEmployeeId: (id) => set({ selectedEmployeeId: id }),
  setEmployees: (data) => set({ employees: data }),
  fetchEmployees: async (userId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}5000/api/employees/subordinate/${userId}` // Получение списка сотрудников со статусами, подчиненные
      )
      const employeesWithTasks = [
        {
          user_id: userId,
          last_name: '',
          first_name: 'Мои задачи',
          middle_name: '',
          status: 'online',
        },
        ...response.data,
      ]
      set({ employees: response.data, employeeList: employeesWithTasks })
    } catch (error) {
      console.error(
        'Ошибка загрузки данных:',
        error.response?.data || error.message
      )
    }
  },

  // Метод для получения фамилии выбранного сотрудника
  getSelectedEmployeeLastName: () => {
    return (state) => {
      const { selectedEmployeeId, employees } = state // Получаем текущее состояние
      const selectedEmployee = employees.find(
        (employee) => employee.user_id === selectedEmployeeId
      )
      return selectedEmployee ? selectedEmployee.last_name : null // Возвращаем фамилию или null
    }
  },
}))

export default useKanbanStore
