import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import HelpModalMenegerNotificationsCalls from './subcomponents/HelpModalMenegerNotificationsCalls'
import useUserStore from '../../../../store/userStore'
import { MdContactSupport } from 'react-icons/md'
import './notificationManager.scss'

const NotificationManager = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingNotificationId, setEditingNotificationId] = useState(null)
  const [editedDateTime, setEditedDateTime] = useState('')
  const [editedComment, setEditedComment] = useState('')
  const [openHelpModal, setOpenHelpModal] = useState(false)
  const [error, setError] = useState(null)
  const { user } = useUserStore()

  const handleEdit = (notification) => {
    setEditingNotificationId(notification.id)
    setEditedDateTime(notification.date_time)
    setEditedComment(notification.comment)
  }

  useEffect(() => {
    if (isOpen) {
      const fetchNotifications = async () => {
        try {
          const response = await axios.get(
            `${API_BASE_URL}5000/api/reminders/calls/${user.id}`
          )
          setNotifications(response.data)
        } catch (err) {
          setError('Ошибка при загрузке уведомлений')
        } finally {
          setLoading(false)
        }
      }

      fetchNotifications()
    }
  }, [isOpen])

  const handleSave = async () => {
    try {
      const currentNotification = notifications.find(
        (notification) => notification.id === editingNotificationId
      )

      // Преобразуем editedDateTime в формат ISO
      const updatedDateTime = new Date(editedDateTime).toISOString()

      const response = await axios.put(
        `${API_BASE_URL}5000/api/reminders/calls/${editingNotificationId}`,
        {
          date_time: updatedDateTime, // Отправляем дату в формате ISO
          comment: editedComment,
        }
      )

      // Обновляем список уведомлений
      const updatedNotifications = notifications.map((notification) =>
        notification.id === editingNotificationId
          ? {
              ...notification,
              date_time: updatedDateTime, // Сохраняем дату в формате ISO
              comment: editedComment,
            }
          : notification
      )
      setNotifications(updatedNotifications)
      setEditingNotificationId(null)
    } catch (err) {
      console.error('Ошибка при сохранении изменений:', err)
    }
  }

  // Функция для открытия модального окна справки
  const handleOpenHelpModal = () => {
    setOpenHelpModal(true)
  }

  if (!isOpen) return null

  return (
    <div className="notification-manager-overlay">
      <HelpModalMenegerNotificationsCalls
        type={'managerNotifications'}
        open={openHelpModal}
        onClose={() => setOpenHelpModal(false)}
      />
      <div className="notification-manager">
        <div className="notification-manager-header">
          <div style={{ display: 'flex' }}>
            <h3>Менеджер уведомлений </h3>
            <MdContactSupport
              style={{ position: 'relative', marginLeft: '30px', top: '0px' }}
              className="help-icon"
              onClick={handleOpenHelpModal}
              title="Справка"
            />
          </div>

          <button
            className="notification-manager-close-button"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <div className="notification-list">
          {loading ? (
            <p>Загрузка...</p>
          ) : error ? (
            <p>{error}</p>
          ) : notifications.length === 0 ? (
            <p>Нет запланированных уведомлений.</p>
          ) : (
            notifications.map((notification) => (
              <div key={notification.id} className="notification-item">
                <h3>{notification.title}</h3>
                <div style={{ minHeight: '250px' }}>
                  {editingNotificationId === notification.id ? (
                    <div className="edit-form">
                      <div className="form-group">
                        <label>Дата планирования:</label>
                        <input
                          type="datetime-local"
                          value={editedDateTime}
                          onChange={(e) => setEditedDateTime(e.target.value)}
                          className="form-input"
                        />
                      </div>
                      <div className="form-group">
                        <label>Комментарий:</label>
                        <textarea
                          value={editedComment}
                          onChange={(e) => setEditedComment(e.target.value)}
                          className="form-textarea"
                        />
                      </div>
                      <div className="form-buttons">
                        <button onClick={handleSave} className="save-button">
                          Сохранить
                        </button>
                        <button
                          onClick={() => setEditingNotificationId(null)}
                          className="cancel-button"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ color: 'blue' }}>
                        {notification.comment
                          .split('НАПОМИНАНИЕ СОЗДАНО')
                          .map((part, index) => (
                            <React.Fragment key={index}>
                              {index > 0 ? (
                                <>
                                  <br />
                                  <br />
                                  НАПОМИНАНИЕ СОЗДАНО{part}
                                </>
                              ) : (
                                part
                              )}
                            </React.Fragment>
                          ))}
                      </p>
                      <p>
                        <strong>Тип:</strong> Звонок
                      </p>
                      <p>
                        <strong>Дата планирования:</strong>{' '}
                        <span style={{ color: 'blue' }}>
                          {new Date(notification.date_time).toLocaleString()}
                        </span>
                      </p>
                      <p className="notification-manager-date-created">
                        <strong>Создано:</strong>{' '}
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                      <button
                        className="redact-button"
                        onClick={() => handleEdit(notification)}
                      >
                        Редактировать
                      </button>
                    </>
                  )}

                  <hr />
                </div>{' '}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default NotificationManager
