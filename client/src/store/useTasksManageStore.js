import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../../config'
import { getLocalMonthDateRangeYyyyMmDd } from '../routes/kanbanBoard/Boards/subcomponents/taskUtils'
import useTaskStateTracker from './useTaskStateTracker'

const defaultCompletedTasksRange = getLocalMonthDateRangeYyyyMmDd()

const useTasksManageStore = create((set, get) => ({
  tasksManager: [],
  completedTasks: [], // Новое состояние для завершенных задач
  /** Диапазон дат последней загрузки завершённых (для refetch по WebSocket и т.п.) */
  lastCompletedTasksRange: defaultCompletedTasksRange,
  unreadMessages: new Set(),
  /** Кэш сообщений проектного чата по globalTaskId */
  messagesGlobalTaskById: {},
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

  // Метод для загрузки завершенных задач (опционально по дате создания — см. created_from / created_to на сервере)
  fetchCompletedTasks: async (userId, opts = {}) => {
    if (!userId) return
    try {
      set({ isLoading: true })
      const prev = get().lastCompletedTasksRange
      const createdFrom = opts.createdFrom ?? prev?.from
      const createdTo = opts.createdTo ?? prev?.to
      let url = `${API_BASE_URL}5000/api/tasks/user/${userId}?filter=completed_tasks`
      if (createdFrom && createdTo) {
        url += `&created_from=${encodeURIComponent(createdFrom)}&created_to=${encodeURIComponent(createdTo)}`
      }
      const response = await axios.get(url)
      const data = await response.data
      set({
        completedTasks: data,
        isLoading: false,
        ...(createdFrom && createdTo
          ? { lastCompletedTasksRange: { from: createdFrom, to: createdTo } }
          : {}),
      })
    } catch (error) {
      console.error('Ошибка при загрузке завершенных задач:', error)
      set({ isLoading: false })
    }
  },

  // Метод для добавления новой задачи в tasksManager
  addTaskManager: (newTask) =>
    set((state) => ({
      tasksManager: [...state.tasksManager, newTask],
    })),

  // Метод для обновления вложений конкретной задачи
  // taskId может быть number или string (id из column item)
  updateTaskAttachments: (taskId, newAttachments) =>
    set((state) => {
      const tid = Number(taskId)
      return {
        tasksManager: state.tasksManager.map((task) =>
          (task.id != null && (task.id === taskId || task.id === tid)) ||
          (task.task_id != null && (task.task_id === taskId || task.task_id === tid))
            ? { ...task, attachments: newAttachments }
            : task
        ),
      }
    }),

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

  // Загрузка сообщений глобальной задачи (кэш по id проекта, без перезаписи других чатов)
  fetchMessages: async (globalTaskId) => {
    if (globalTaskId == null || globalTaskId === '') return []

    const cacheKey = String(globalTaskId)
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/global-tasks/chat/${globalTaskId}`)
      const data = response.data
      set((state) => ({
        messagesGlobalTaskById: {
          ...state.messagesGlobalTaskById,
          [cacheKey]: data,
        },
      }))
      return data
    } catch (error) {
      console.error('Ошибка при загрузке сообщений:', error)
      return []
    }
  },
}))

export default useTasksManageStore
