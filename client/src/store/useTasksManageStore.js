import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../../config'
import useTaskStateTracker from './useTaskStateTracker'
const useTasksManageStore = create((set, get) => ({
  tasksManager: [],
  completedTasks: [], // Новое состояние для завершенных задач
  unreadMessages: new Set(),
  messagesGlobalTask: [],
  isLoading: false,

  // Метод для загрузки активных задач
  fetchTasksManager: async (userId) => {
    try {
      set({ isLoading: true })
      const response = await axios.get(
        `${API_BASE_URL}5000/api/tasks/user/${userId}?filter=tasks_manager&is_completed=false`
      )
      const data = await response.data
      set({ tasksManager: data, isLoading: false })

      // Обрабатываем согласования
      data.forEach((task) => {
        const approvals = task.approver_user_ids || []
        approvals.forEach((approval) => {
          useTaskStateTracker
            .getState()
            .setApproval(task.task_id, approval.approver_id, approval.is_approved)
        })
      })
    } catch (error) {
      console.error('Ошибка при загрузке задач:', error)
    }
  },

  // Метод для загрузки завершенных задач
  fetchCompletedTasks: async (userId) => {
    try {
      set({ isLoading: true })
      const response = await axios.get(
        `${API_BASE_URL}5000/api/tasks/user/${userId}?filter=completed_tasks`
      )

      const data = await response.data
      set({ completedTasks: data, isLoading: false })
    } catch (error) {
      console.error('Ошибка при загрузке завершенных задач:', error)
    }
  },

  // Метод для добавления новой задачи в tasksManager
  addTaskManager: (newTask) =>
    set((state) => ({
      tasksManager: [...state.tasksManager, newTask],
    })),

  // Метод для обновления вложений конкретной задачи
  updateTaskAttachments: (taskId, newAttachments) =>
    set((state) => ({
      tasksManager: state.tasksManager.map((task) =>
        task.id === taskId || task.task_id === taskId
          ? { ...task, attachments: newAttachments }
          : task
      ),
    })),

  // Метод для добавления ID задачи с непрочитанным сообщением
  addUnreadMessage: (taskId) =>
    set((state) => {
      const updatedUnreadMessages = new Set(state.unreadMessages)
      updatedUnreadMessages.add(taskId)

      return { unreadMessages: updatedUnreadMessages }
    }),

  // Метод для сброса непрочитанных сообщений для задачи
  resetUnreadMessages: (taskId) =>
    set((state) => {
      const updatedUnreadMessages = new Set(state.unreadMessages)
      updatedUnreadMessages.delete(taskId)
      return { unreadMessages: updatedUnreadMessages }
    }),

  setUnreadMessages: (messages) => set({ unreadMessages: new Set(messages) }),

  // Новый метод для загрузки сообщений глобальной задачи
  fetchMessages: async (globalTaskId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/global-tasks/chat/${globalTaskId}`)
      set({ messagesGlobalTask: response.data })
      return response.data // Верните данные, чтобы использовать их в компоненте
    } catch (error) {
      console.error('Ошибка при загрузке сообщений:', error)
    }
  },
}))

export default useTasksManageStore
