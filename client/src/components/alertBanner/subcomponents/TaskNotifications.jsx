// components/alertBanner/subcomponents/TaskNotifications.js Тут все из таблици notifications
import React from 'react'
import { FaClock, FaEnvelope } from 'react-icons/fa'
import useTaskStateTracker from '../../../store/useTaskStateTracker'
import { FcLeave } from 'react-icons/fc'
import { FcPlanner } from 'react-icons/fc'
import { API_BASE_URL } from '../../../../config'
import axios from 'axios'
import './TaskNotifications.scss'

const useTaskNotifications = ({ currentUserId }) => {
  const notificationsTask = useTaskStateTracker((state) => state.notificationsTask)
  const fetchUnreadNotifications = useTaskStateTracker((state) => state.fetchUnreadNotifications)
  const removeNotificationTask = useTaskStateTracker((state) => state.removeNotificationTask)

  const notifications = []

  const handleMarkAsRead = async (notificationId) => {
    try {
      await axios.patch(`${API_BASE_URL}5000/api/notifications/${notificationId}/read`)
      // Удаляем уведомление из локального хранилища
      removeNotificationTask(notificationId)
    } catch (error) {
      console.error('Ошибка при обновлении статуса уведомления:', error)
    }
  }

  React.useEffect(() => {
    if (currentUserId) {
      console.log('fetchUnreadNotifications вызван')
      fetchUnreadNotifications(currentUserId)
    }
  }, [currentUserId, fetchUnreadNotifications])

  if (notificationsTask && Object.keys(notificationsTask).length > 0) {
    Object.entries(notificationsTask).forEach(([id, notification]) => {
      if (!notification) return
      //   console.log('notificationsTask обновлён', JSON.stringify(notificationsTask))
      // console.log(999)
      const notificationConfig = {
        extension_request_rejected: {
          icon: <FcLeave />,
          className: 'extension-notification-rejected',
          statusText: 'Отклонено',
          showDetails: true,
        },
        extension_request_approved: {
          icon: <FcPlanner />,
          className: 'extension-notification-approved',
          statusText: 'Одобрено',
          showDetails: true,
        },
        taskDeadlineOverdue: {
          icon: <FaClock color="#ff5e5e" />,
          className: 'extension-notification-overdue',
          statusText: 'Нарушены сроки выполнения задачи!',
          showDetails: true,
        },
        task_deadline_updated: {
          icon: <FaClock color="#FFEE00" />,
          className: 'extension-notification-updated-deadline',
          statusText: 'Срок исполнения задачи был изменен!',
          showDetails: true,
        },
        default: {
          icon: <FaEnvelope />,
          className: '',
          statusText: '',
          showDetails: false,
        },
      }

      const config = notificationConfig[notification.type] || notificationConfig.default

      notifications.push({
        key: `task-notification-${id}`,
        text: (
          <div className={`extension-notification ${config.className}`}>
            <div className="extension-notification-border" />

            <div className="extension-notification-header">
              {config.statusText && (
                <span className="extension-notification-status">{config.statusText}</span>
              )}
            </div>

            <div className="extension-notification-content">
              {notification.taskTitle && (
                <div className="extension-notification-title">{notification.taskTitle}</div>
              )}

              <div className="extension-notification-message">{notification.message}</div>

              {!notification.isRead && (
                <button
                  className="extension-notification-confirm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMarkAsRead(id)
                  }}
                >
                  Принять
                </button>
              )}
            </div>
          </div>
        ),
        icon: config.icon,
        type: notification.type,
        notificationId: id,
        createdAt: notification.createdAt,
        taskTitle: notification.taskTitle,
        userId: notification.userId,
        eventType: notification.eventType,
        isRead: notification.isRead,
      })
    })
  }

  const handleTaskNotificationClick = (taskId) => {
    //   логика обработки клика по уведомлению
  }

  return {
    notifications,
    handleTaskNotificationClick,
  }
}

export default useTaskNotifications
