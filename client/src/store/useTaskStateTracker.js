/*
const newMessages = useTaskStateTracker((state) => state.newMessages);
  const currentUserId = userId; // Идентификатор текущего пользовател 
  что бы сбросить 
  useTaskStateTracker.getState().resetAuthorMessage(message.task_id, userId);
useTaskStateTracker.getState().resetAssigneeMessage(message.task_id, userId);
*/

import { create } from 'zustand'
import axios from 'axios'
import { API_BASE_URL } from '../../config'
// Ключ для хранения в localStorage
const STORAGE_KEY = 'taskMessagesState'

// Функция для загрузки состояния из localStorage
const loadState = () => {
  const json = localStorage.getItem(STORAGE_KEY)
  if (json) {
    try {
      return JSON.parse(json)
    } catch (e) {
      console.error('Ошибка парсинга localStorage', e)
    }
  }
  return {
    authorMessages: {},
    assigneeMessages: {},
    tasks: {},
    globalNotifications: {},
    notifications: {},
  } // Дефолтное значение
}

// Функция для сохранения состояния в localStorage
const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const useTaskStateTracker = create((set, get) => {
  const initialState = loadState()

  return {
    authorMessages: initialState.authorMessages,
    assigneeMessages: initialState.assigneeMessages || {},
    approvals: {},
    tasks: initialState.tasks,
    globalNotifications: initialState.globalNotifications || {},
    notifications: initialState.notifications || {},
    notificationsTask: {},
    extensionRequests: {},

    setNotificationsTask: (notifications) => set({ notificationsTask: notifications }),

    fetchUnreadNotifications: async (userId) => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/notifications/unread/${userId}`)
        const notifications = response.data
        const normalized = notifications.reduce((acc, n) => {
          acc[n.id] = {
            id: n.id,
            userId: n.user_id,
            taskId: n.task_id,
            message: n.message || n.text,
            type: n.event_type,
            createdAt: n.created_at,
            taskTitle: n.task_title,
          }
          return acc
        }, {})
        set({ notificationsTask: normalized }) // обновляем notificationsTask, а не notifications
      } catch (error) {
        console.error('Error fetching unread notifications', error)
      }
    },
    removeNotificationTask: (notificationId) =>
      set((state) => {
        const newNotifications = { ...state.notificationsTask }
        delete newNotifications[notificationId]
        return { notificationsTask: newNotifications }
      }),

    // Сообщение для глобальной задачи ******************************************************************************
    // Метод для сохранения информации о глобальной задаче
    setGlobalTaskNotification: (globalTaskId, title) => {
      set((state) => {
        const newGlobalNotifications = {
          ...state.globalNotifications,
          [globalTaskId]: { title },
        }
        const newState = {
          ...state,
          globalNotifications: newGlobalNotifications,
        }
        saveState(newState)
        return newState
      })
    },
    // Метод для удаления информации по глобальной задаче
    removeGlobalTaskNotification: (globalTaskId) => {
      set((state) => {
        const { [globalTaskId]: _, ...remaining } = state.globalNotifications
        const newState = {
          ...state,
          globalNotifications: remaining,
        }
        saveState(newState)
        return newState
      })
    },

    // Автор задачи *************************************************************************************************
    setAuthorMessage: (taskId, userId, value) => {
      set((state) => {
        const newState = {
          ...state,
          authorMessages: {
            ...state.authorMessages,
            [taskId]: {
              ...state.authorMessages[taskId],
              [userId]: value,
            },
          },
        }
        saveState(newState) // Сохраняем новое состояние
        return newState
      })
    },

    resetAuthorMessage: (taskId, userId) => {
      set((state) => {
        const newState = {
          ...state,
          authorMessages: {
            ...state.authorMessages,
            [taskId]: {
              ...state.authorMessages[taskId],
              [userId]: false,
            },
          },
        }
        saveState(newState) // Сохраняем новое состояние
        return newState
      })
    },

    // Исполнитель *************************************************************************************************
    setAssigneeMessage: (taskId, userId, value) => {
      set((state) => {
        const newState = {
          ...state,
          assigneeMessages: {
            ...state.assigneeMessages,
            [taskId]: {
              ...state.assigneeMessages[taskId],
              [userId]: value,
            },
          },
        }
        saveState(newState) // Сохраняем новое состояние
        return newState
      })
    },

    resetAssigneeMessage: (taskId, userId) => {
      set((state) => {
        const newState = {
          ...state,
          assigneeMessages: {
            ...state.assigneeMessages,
            [taskId]: {
              ...state.assigneeMessages[taskId],
              [userId]: false,
            },
          },
        }
        saveState(newState) // Сохраняем новое состояние
        return newState
      })
    },

    // Подтверждение задачи на выполнение
    // Функция для установки согласования
    setApproval: (taskId, approverId, isApproved) => {
      set((state) => {
        const newState = {
          ...state,
          approvals: {
            ...state.approvals,
            [taskId]: {
              ...state.approvals[taskId],
              [approverId]: isApproved,
            },
          },
        }
        //     saveState(newState) // Сохраняем новое состояние
        return newState
      })
    },

    // Функция для сброса согласования
    resetApproval: (taskId, approverId) => {
      set((state) => {
        const newState = {
          ...state,
          approvals: {
            ...state.approvals,
            [taskId]: {
              ...state.approvals[taskId],
              [approverId]: false,
            },
          },
        }
        //  saveState(newState) // Сохраняем новое состояние
        return newState
      })
    },

    // При событии когда нужно принять действи по выполненной задаче ************************************************************************
    // Метод для добавления или обновления задачи
    addOrUpdateTask: (task) => {
      set((state) => {
        const newState = {
          ...state,
          tasks: {
            ...state.tasks,
            [task.id]: {
              ...state.tasks[task.id], // Сохраняем существующие поля задачи
              ...task, // Обновляем или добавляем новые поля, включая createdBy
            },
          },
        }
        saveState(newState) // Сохраняем новое состояние
        return newState
      })
    },

    // Метод для удаления задачи
    removeTask: (taskId) => {
      set((state) => {
        const { [taskId]: removedTask, ...remainingTasks } = state.tasks

        // Создаем новое состояние
        const newState = {
          ...state,
          tasks: remainingTasks,
        }

        saveState(newState)

        return newState
      })
    },

    addDescriptionChangeNotification: (taskId, taskTitle) => {
      set((state) => {
        const newNotifications = {
          ...state.notifications,
          [`description-change-${taskId}`]: {
            title: taskTitle,
            taskId,
          },
        }
        const newState = {
          ...state,
          notifications: newNotifications,
        }
        saveState(newState) // Save the new state
        return newState
      })
    },

    removeNotification: (key) => {
      set((state) => {
        const { [key]: _, ...remainingNotifications } = state.notifications
        const newState = {
          ...state,
          notifications: remainingNotifications,
        }
        saveState(newState) // Save the new state
        return newState
      })
    },

    // Методы хранения запросов о продлении сроков задачи *************************************************************

    //*** */

    // Метод для установки запросов на продление
    setExtensionRequests: (requests) => {
      set({ extensionRequests: requests })
    },
    // Метод для загрузки запросов с сервера
    fetchExtensionRequests: async (userId) => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}5000/api/tasks/extension-requests/pending/${userId}`
        )
        get().setExtensionRequests(
          response.data.reduce((acc, request) => {
            acc[request.id] = request
            return acc
          }, {})
        )
        return response.data
      } catch (error) {
        console.error('Ошибка при загрузке запросов:', error)
        return []
      }
    },
  }
})

export default useTaskStateTracker
