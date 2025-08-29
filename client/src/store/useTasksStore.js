import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../../config'

const useTasksStore = create((set) => ({
  tasks: [],
  isLoading: false,
  fetchTasks: async (userId) => {
    try {
      set({ isLoading: true })
      const response = await axios.get(
        `${API_BASE_URL}5000/api/tasks/user/${userId}?filter=my_tasks&is_completed=false`
      )

      const data = await response.data
      set({ tasks: data, isLoading: false })
    } catch (error) {
      console.error('Ошибка при загрузке задач:', error)
    }
  },
  addTask: (newTask) =>
    set((state) => ({
      tasks: [...state.tasks, newTask],
    })),
  // Метод для обновления вложений конкретной задачи
  updateTaskAttachments: (taskId, newAttachments) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId || task.task_id === taskId
          ? { ...task, attachments: newAttachments }
          : task
      ),
    })),
}))

export default useTasksStore
