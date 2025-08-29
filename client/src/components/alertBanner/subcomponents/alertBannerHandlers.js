import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import useTaskStateTracker from '../../../store/useTaskStateTracker'

// Основные обработчики
export const useAlertBannerHandlers = (params) => {
  const {
    currentUserId,
    electronAPI,
    setSelectedGlobalTask,
    setSelectedAuthorTask,
    setSelectedTaskId,
    setMessageType,
    setIsCollapsed,
    setProcessedTaskIds,
    setOpenConfirmationDialog,
    setCurrentTaskId,
    removeTask,
    messageType,
    currentTaskId,
  } = params

  // Переключение состояния свернуто/развернуто
  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev)
  }

  // Обработчик клика по глобальному уведомлению
  const handleGlobalNotificationClick = ({ taskId, title }) => {
    setSelectedGlobalTask({ taskId, title })
  }

  // Обработчик клика по уведомлению от автора
  const handleAuthorNotificationClick = async (taskId) => {
    try {
      const task = await fetchTaskById(taskId)
      setSelectedTaskId(taskId)
      setSelectedAuthorTask(task)
    } catch (error) {
      console.error('Ошибка при получении задачи:', error)
    }
  }

  // Удаление уведомления
  const handleRemoveNotification = (key) => {
    useTaskStateTracker.getState().removeNotification(key)
  }

  // Сброс статуса сообщения (для автора/исполнителя)
  const handleResetMessage = (taskId) => {
    if (messageType === 'authorMessage-') {
      useTaskStateTracker.getState().resetAuthorMessage(taskId, currentUserId)
    }
    if (messageType === 'assigneeMessage-') {
      useTaskStateTracker.getState().resetAssigneeMessage(taskId, currentUserId)
    }
  }

  // Подтверждение выполнения задачи
  const handleConfirmation = (comment) => {
    if (currentTaskId) {
      handleTaskAccept(currentTaskId, currentUserId, false, comment)
      removeTask(currentTaskId)
    }
    setOpenConfirmationDialog(false)
  }

  // Открытие диалога подтверждения
  const handleOpenConfirmationDialog = (taskId) => {
    setCurrentTaskId(taskId)
    setOpenConfirmationDialog(true)
  }

  // Принятие задачи (подтверждение/возврат)
  const handleTaskAccept = async (taskId, isAccepted, comment = '') => {
    try {
      await axios.post(`${API_BASE_URL}5000/api/tasks/${taskId}/decision`, {
        userId: currentUserId,
        isAccepted,
        comment,
      })

      if (electronAPI) {
        electronAPI.send('task-decision', { taskId, isAccepted })
      }

      if (isAccepted) {
        setProcessedTaskIds((prev) => new Set(prev).add(taskId))
      }
    } catch (error) {
      console.error('Ошибка при принятии решения по задаче:', error)
    }
  }

  // Получение задачи по ID
  const fetchTaskById = async (taskId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/tasks/${taskId}`)
      return response.data
    } catch (error) {
      console.error('Ошибка при получении задачи:', error)
      throw error
    }
  }

  return {
    toggleCollapse,
    handleGlobalNotificationClick,
    handleAuthorNotificationClick,
    handleRemoveNotification,
    handleResetMessage,
    handleConfirmation,
    handleOpenConfirmationDialog,
    handleTaskAccept,
    fetchTaskById,
  }
}

// Вспомогательные функции для уведомлений
export const notificationHelpers = {
  sendNotification: (title, text, electronAPI) => {
    if (electronAPI && typeof electronAPI.sendNotification === 'function') {
      electronAPI.sendNotification(title, text)
    } else {
      console.log('Electron API недоступен')
    }
  },
}
