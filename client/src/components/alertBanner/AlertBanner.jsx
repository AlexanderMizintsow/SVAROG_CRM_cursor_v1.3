import React, { useEffect, useState } from 'react'
import UserStore from '../../store/userStore'
import useTaskStateTracker from '../../store/useTaskStateTracker'
import { FaEnvelope } from 'react-icons/fa'
import { MdDoneOutline } from 'react-icons/md'
import GlobalTaskChat from '../../routes/kanbanBoard/globalTask/subcomponents/globalChat/GlobalTaskChat'
import { AiOutlineFileDone } from 'react-icons/ai'
import { MdHistoryEdu } from 'react-icons/md'
import { GiConfirmed } from 'react-icons/gi'
import {
  requestNotificationPermission,
  sendCustomNotification,
} from '../../utils/browserNotifications'
import ChatTaskModal from '../../routes/kanbanBoard/Task/subcomponents/chatTaskModal/chatTaskModal'
import { API_BASE_URL } from '../../../config'
import axios from 'axios'
import ConfirmationDialog from '../confirmationDialog/ConfirmationDialog'
import { Tooltip, Typography } from '@mui/material'
import { FcInspection, FcRedo } from 'react-icons/fc'
import useExtensionRequestsNotifications from './subcomponents/ExtensionRequestsNotifications'
import './alertBanner.scss'
import useNotificationsTask from './subcomponents/TaskNotifications'
import ReactDOM from 'react-dom'

const AlertBanner = () => {
  // ==================== Инициализация состояний и хуков ====================
  const { user } = UserStore()
  const currentUserId = user ? user.id : null
  const electronAPI = window.electronAPI || null

  // ==================== Состояния компонента ====================
  const [selectedGlobalTask, setSelectedGlobalTask] = useState(null)
  const [selectedAuthorTask, setSelectedAuthorTask] = useState(null)
  const [processedTaskIds, setProcessedTaskIds] = useState(new Set())
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [messageType, setMessageType] = useState(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [prevNotificationsCount, setPrevNotificationsCount] = useState(0)
  const [openConfirmationDialog, setOpenConfirmationDialog] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState(null)
  const notifications = []

  // ==================== Получение данных из store ====================
  const removeTask = useTaskStateTracker((state) => state.removeTask)
  const notificationsTask = useTaskStateTracker((state) => state.notificationsTask)
  const extensionRequests = useTaskStateTracker((state) => state.extensionRequests)
  const fetchExtensionRequests = useTaskStateTracker((state) => state.fetchExtensionRequests)
  const assigneeMessages = useTaskStateTracker((state) => state.assigneeMessages)
  const authorMessages = useTaskStateTracker((state) => state.authorMessages)
  const approvals = useTaskStateTracker((state) => state.approvals)
  const tasks = useTaskStateTracker((state) => state.tasks)
  const globalNotifications = useTaskStateTracker((state) => state.globalNotifications)
  const descriptionChangeNotifications = useTaskStateTracker((state) => state.notifications)

  // ==================== Вспомогательные хуки ====================
  const { notifications: taskNotifications, handleTaskNotificationClick } = useNotificationsTask({
    notificationsTask,
    currentUserId,
    fetchUnreadNotifications: useTaskStateTracker((state) => state.fetchUnreadNotifications),
  })

  const {
    notifications: extensionNotifications,
    rejectDialog,
    approveDialog,
  } = useExtensionRequestsNotifications({
    extensionRequests,
    currentUserId,
    onUpdate: () => fetchExtensionRequests(currentUserId),
  })

  // ==================== Эффекты ====================

  useEffect(() => {
    if (currentUserId) {
      fetchExtensionRequests(currentUserId)
    }
  }, [currentUserId, fetchExtensionRequests])

  // Пример отправки уведомления
  const sendNotification = (title, text) => {
    if (electronAPI && typeof electronAPI.sendNotification === 'function') {
      electronAPI.sendNotification(title, text)
    } else {
      console.log('Electron API недоступен')
    }
  }

  // Проверка наличия новых сообщений для исполнителя ***********************************************************

  const hasNewAssigneeMessage =
    currentUserId !== null &&
    Object.values(assigneeMessages).some((messagesByTask) => messagesByTask[currentUserId] === true)

  // Генерируем содержимое уведомлений для исполнителя
  if (hasNewAssigneeMessage) {
    Object.entries(assigneeMessages).forEach(([taskId, messages]) => {
      if (messages[currentUserId]) {
        notifications.push({
          key: `assigneeMessage-${taskId}`,
          text: `Новое сообщение в задачах от Автора для задачи `,
          icon: <FaEnvelope style={{ fontSize: '16px' }} />,
          taskId: taskId,
        })
      }
    })
  }

  // Отправка уведомления при наличии новых сообщений
  useEffect(() => {
    if (hasNewAssigneeMessage) {
      sendNotification('Задачи/Сообщение', 'Новое сообщение в задачах от Автора')
    }
  }, [hasNewAssigneeMessage])

  //*********************************************************************************** */
  // Проверка наличия новых сообщений для автора ***********************************************************
  const hasNewAuthorMessages =
    currentUserId !== null &&
    Object.values(authorMessages).some((messagesByTask) => messagesByTask[currentUserId] === true)

  if (hasNewAuthorMessages) {
    Object.entries(authorMessages).forEach(([taskId, messages]) => {
      if (messages[currentUserId]) {
        notifications.push({
          key: `authorMessage-${taskId}`,
          text: `Новое сообщение в задачах от Исполнителя задачи`,
          icon: <FaEnvelope style={{ cursor: 'pointer', fontSize: '16px' }} />,
          taskId: taskId,
        })
      }
    })
  }
  // Использование функции в AlertBanner

  // Проверка наличия новых согласований ***********************************************************
  const hasPendingApproval =
    currentUserId !== null &&
    Object.values(approvals).some((approverData) => approverData[currentUserId] === false)

  if (hasPendingApproval) {
    notifications.push({
      key: 'approval',
      text: 'Есть задачи, требующие вашего согласования',
      icon: <AiOutlineFileDone style={{ fontSize: '16px' }} />,
    })
  }

  // Уведомление о необходимости принятия задачи или отклонения
  const taskCount = Object.keys(tasks).length

  const hasTasks = taskCount > 0

  //  ********************************************************************************

  if (hasTasks) {
    Object.keys(tasks).forEach((taskId) => {
      const task = tasks[taskId]

      notifications.push({
        key: `task-decision-${taskId}`,
        text: (
          <div>
            <span>Исполнитель завершил задачу. Примите решение по задаче: {task.title}</span>
            {task.status === 'done' && (
              <span style={{ marginLeft: '10px' }}>
                <Tooltip
                  title={<Typography fontSize="0.9rem">Подтвердить выполнение задачи</Typography>}
                  placement="top"
                  arrow
                >
                  <span>
                    <FcInspection
                      style={{ cursor: 'pointer', marginRight: '5px', fontSize: '16px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTaskAccept(taskId, currentUserId, true)
                        removeTask(taskId)
                      }}
                    />
                  </span>
                </Tooltip>
                <Tooltip
                  title={<Typography fontSize="0.9rem">Вернуть на доработку</Typography>}
                  placement="top"
                  arrow
                >
                  <span>
                    <FcRedo
                      style={{ cursor: 'pointer', fontSize: '16px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenConfirmationDialog(taskId)
                      }}
                    />
                  </span>
                </Tooltip>
              </span>
            )}
          </div>
        ),
        icon: <MdDoneOutline style={{ color: '#00FF00', fontSize: '16px' }} />,
        taskId: taskId,
      })
    })
  }

  // Проверка наличия глобальных уведомлений
  const hasGlobalNotifications = Object.keys(globalNotifications).length > 0

  // Отобразить уведомление, если есть
  Object.entries(globalNotifications).forEach(([taskId, { title }]) => {
    notifications.push({
      key: `global-${taskId}`,
      text: `Сообщение по проекту: ${title}`,
      icon: <FaEnvelope style={{ fontSize: '16px' }} />,
      taskId,
      title,
    })
  })

  // Отобразить уведомления, если есть
  Object.entries(descriptionChangeNotifications).forEach(([key, { title, taskId }]) => {
    notifications.push({
      key,
      text: `Изменение описания задачи: ${title}`,
      icon: <MdHistoryEdu style={{ fontSize: '16px', color: 'orange' }} />,
      taskId,
    })
  })

  const allNotifications = [...notifications, ...taskNotifications, ...extensionNotifications]

  useEffect(() => {
    const totalNotifications = allNotifications.length
    if (totalNotifications > prevNotificationsCount) {
      setIsCollapsed(false)
    }
    setPrevNotificationsCount(totalNotifications)
  }, [allNotifications])

  // ******************************************************************* Браузерные уведомления *****************************************

  useEffect(() => {
    if (hasNewAuthorMessages) {
      sendNotification('Задача', `Новое сообщение в задачах от Исполнителя задачи`)
    }
  }, [hasNewAuthorMessages])

  // useEffect для отправки уведомлений о глобальных задачах
  useEffect(() => {
    if (hasGlobalNotifications) {
      Object.entries(globalNotifications).forEach(([taskId, { title }]) => {
        sendNotification('Проект', `Сообщение по проекту ${title}`)
      })
    }
  }, [globalNotifications])

  useEffect(() => {
    if (hasTasks) {
      Object.keys(tasks).forEach((taskId) => {
        if (!processedTaskIds.has(taskId)) {
          sendNotification(
            'Задача',
            `Исполнитель завершил задачу, примите решение по задаче: ${tasks[taskId].title}`
          )
          processedTaskIds.add(taskId)
        }
      })
      setProcessedTaskIds(new Set(processedTaskIds))
    }
  }, [tasks])

  // Добавляем новый useEffect для отправки уведомления о согласованиях
  useEffect(() => {
    if (hasPendingApproval) {
      sendNotification('Задача', 'Есть задачи, требующие Вашего согласования')
    }
  }, [hasPendingApproval])

  // ==================== Обработчики событий ==================== ==================== ==================== ==================== ====================

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
  const handleResetMessage = (taskId, userId) => {
    if (messageType === 'authorMessage-') {
      useTaskStateTracker.getState().resetAuthorMessage(taskId, userId)
    }
    if (messageType === 'assigneeMessage-') {
      useTaskStateTracker.getState().resetAssigneeMessage(taskId, userId)
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
  const handleTaskAccept = async (taskId, userId, isDone, comment = null) => {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}5000/api/task/accept/${taskId}/${userId}/${isDone}`,
        { comment }
      )

      if (electronAPI) {
        electronAPI.send('task-decision', { taskId, isDone })
      }

      if (isDone) {
        setProcessedTaskIds((prev) => new Set(prev).add(taskId))
      }

      return response.data
    } catch (error) {
      console.error('Ошибка при принятии решения:', {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      })
      throw error
    }
  }

  // Получение задачи по ID
  const fetchTaskById = async (taskId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/tasks/${taskId}`)
      return response.data
    } catch (error) {
      console.error('Ошибка при получении задачи:', error)
      throw error
    }
  }

  return (
    <div
      className={`alert-banner ${allNotifications.length > 0 ? 'show' : ''} ${
        isCollapsed ? '' : 'collapse-btn-banner-show'
      }`}
    >
      <div className="banner-header">
        {allNotifications.length > 0 && (
          <>
            {isCollapsed && allNotifications.length > 0 && (
              <span className="collapse-title">Уведомления ({allNotifications.length})</span>
            )}
            <button onClick={toggleCollapse} className="collapse-btn">
              {isCollapsed ? 'Развернуть' : 'Свернуть'}
            </button>
          </>
        )}
      </div>
      <div className="alert-banner-scrollable">
        {!isCollapsed &&
        (notifications.length > 0 ||
          extensionNotifications.length > 0 ||
          taskNotifications.length > 0) ? (
          <div className="notifications-container">
            {[...allNotifications].map(({ key, text, icon, taskId, title }) => (
              <div
                className="alert-banner-content"
                key={key}
                style={{
                  cursor: key.startsWith('global-') ? 'pointer' : undefined,
                }}
                onClick={() => {
                  if (key.startsWith('global-')) {
                    handleGlobalNotificationClick({ taskId, title })
                  } else if (key.startsWith('authorMessage-')) {
                    handleAuthorNotificationClick(taskId)
                    setMessageType('authorMessage-')
                  } else if (key.startsWith('assigneeMessage-')) {
                    handleAuthorNotificationClick(taskId)
                    setMessageType('assigneeMessage-')
                  } else if (key.startsWith('task-notification-')) {
                    handleTaskNotificationClick(taskId)
                  } else if (key.startsWith('task-decision-')) {
                    // Обработка клика по уведомлению о решении по задаче
                  }
                }}
              >
                <div className="notification-content">
                  <span
                    className={`alert-banner-icon ${key.startsWith('global-') ? 'global' : ''} ${
                      key.startsWith('assigneeMessage-') || key.startsWith('authorMessage-')
                        ? 'icon-yellow'
                        : ''
                    }`}
                  >
                    {icon}
                  </span>
                  <div className="notification-text-wrapper">
                    {typeof text === 'string' ? (
                      <span className="notification-text">{text}</span>
                    ) : (
                      <div className="notification-text">{text}</div>
                    )}
                  </div>
                </div>
                {key.startsWith('description-change-') && (
                  <GiConfirmed
                    className="alert-banner-button"
                    onClick={() => handleRemoveNotification(key)}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <span> </span>
        )}
      </div>
      {/* Кнопка для разворачивания, если свернуто */}
      {isCollapsed && allNotifications.length > 0 && (
        <div className="collapsed-indicator" onClick={toggleCollapse}>
          Показать уведомления
        </div>
      )}
      {/* глобальный таск, открыть чат */}
      {selectedGlobalTask &&
        ReactDOM.createPortal(
          <GlobalTaskChat
            globalTaskId={selectedGlobalTask.taskId}
            title={selectedGlobalTask.title}
            onClick={() => setSelectedGlobalTask(null)}
          />,
          document.body
        )}
      {selectedAuthorTask &&
        ReactDOM.createPortal(
          <ChatTaskModal
            task={selectedAuthorTask}
            onClose={() => {
              setSelectedAuthorTask(null)
              handleResetMessage(selectedTaskId, currentUserId)
              setSelectedTaskId(null)
            }}
            isOpen={!!selectedAuthorTask}
            currentUser={currentUserId}
          />,
          document.body
        )}
      <ConfirmationDialog
        open={openConfirmationDialog}
        onClose={() => setOpenConfirmationDialog(false)}
        onConfirm={handleConfirmation}
        title="Вернуть задачу на доработку"
        message="Введите комментарий для возвращения задачи на доработку:"
        btn1="Отмена"
        btn2="Подтвердить"
        comment={true}
      />
      {rejectDialog}
      {approveDialog}
    </div>
  )
}

export default AlertBanner
//1
