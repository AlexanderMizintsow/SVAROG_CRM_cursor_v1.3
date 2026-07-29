// components/alertBanner/subcomponents/TaskNotifications.js Тут все из таблици notifications
import React from 'react'
import { FaClock, FaEnvelope, FaLightbulb, FaBookOpen, FaFileAlt } from 'react-icons/fa'
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
      removeNotificationTask(notificationId)
    } catch (error) {
      console.error('Ошибка при обновлении статуса уведомления:', error)
    }
  }

  React.useEffect(() => {
    if (currentUserId) {
      fetchUnreadNotifications(currentUserId)
    }
  }, [currentUserId, fetchUnreadNotifications])

  if (notificationsTask && Object.keys(notificationsTask).length > 0) {
    Object.entries(notificationsTask).forEach(([id, notification]) => {
      if (!notification) return
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
        task_created: {
          icon: <FaEnvelope />,
          className: 'extension-notification-new-task',
          statusText: 'Новая задача',
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
        task_cancelled_by_project: {
          icon: <FaEnvelope color="#ff7043" />,
          className: 'extension-notification-cancelled-task',
          statusText: 'Задача отменена — требуется подтверждение',
          showDetails: true,
          confirmLabel: 'Ок',
          requiresAck: true,
        },
        idea_applied: {
          icon: <FaLightbulb color="#27ae60" />,
          className: 'extension-notification-idea-applied',
          statusText: 'Идея применена в приложении',
          showDetails: true,
        },
        knowledge_document_new: {
          icon: <FaBookOpen color="#0f766e" />,
          className: 'extension-notification-knowledge',
          statusText: 'База знаний — новый документ',
          showDetails: true,
          confirmLabel: 'Ок',
          iconClass: 'icon-knowledge',
        },
        knowledge_document_updated: {
          icon: <FaFileAlt color="#0f766e" />,
          className: 'extension-notification-knowledge',
          statusText: 'База знаний — обновление документа',
          showDetails: true,
          confirmLabel: 'Ок',
          iconClass: 'icon-knowledge',
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
                  {config.confirmLabel || 'Принять'}
                </button>
              )}
            </div>
          </div>
        ),
        icon: config.icon,
        iconClass: config.iconClass || '',
        type: notification.type,
        notificationId: id,
        createdAt: notification.createdAt,
        taskTitle: notification.taskTitle,
        taskId: notification.taskId,
        userId: notification.userId,
        eventType: notification.eventType,
        isRead: notification.isRead,
        requiresAck: Boolean(config.requiresAck),
      })
    })
  }

  const handleTaskNotificationClick = (taskId) => {
    //   логика обработки клика по уведомлению
  }

  return {
    notifications,
    handleTaskNotificationClick,
    handleMarkAsRead,
  }
}

export default useTaskNotifications
