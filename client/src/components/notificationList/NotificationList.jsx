import './notificationList.scss'
import { useState, useEffect } from 'react'
import { BsTelephonePlus, BsClock } from 'react-icons/bs'
import { FaCommentMedical } from 'react-icons/fa'
import { MdOutlineRecycling } from 'react-icons/md'
import { BiSolidMessageRoundedEdit } from 'react-icons/bi'
import axios from 'axios'
import Toastify from 'toastify-js'
import CommentModal from './CommentModal'
import ConfirmationDialog from '../confirmationDialog/ConfirmationDialog'
import SearchBar from '../../components/searchBar/SearchBar' // Импортируем компонент поиска
import ScheduleCallModal from '../scheduleCallModal/ScheduleCallModal'
import { API_BASE_URL } from '../../../config'
import useUserStore from '../../store/userStore'

const NotificationList = ({ title, notifications, statusTitle, onAddPhoneClick, userInfo }) => {
  const { user } = useUserStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [comments, setComments] = useState({})
  const [activeNotificationId, setActiveNotificationId] = useState(null)
  const [isModalOpen, setModalOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [employees, setEmployees] = useState({})
  const [processedByUsers, setProcessedByUsers] = useState({})
  const [commentsExist, setCommentsExist] = useState({})
  const [isScheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [activeNotificationData, setActiveNotificationData] = useState(null)

  const userId = user?.id
  const position = user?.position

  const handleScheduleModalOpen = (notification) => {
    setActiveNotificationId(notification.id)
    setScheduleModalOpen(true)
    setActiveNotificationData(notification) // Новый состояние для хранения данных уведомления
  }

  const fetchEmployees = async (dealerId) => {
    if (!dealerId) return []
    try {
      const response = await axios.get(`${API_BASE_URL}5004/api/dealer-employees`, {
        params: { dealer_id: dealerId },
      })
      return response.data
    } catch (error) {
      console.error('Ошибка при получении сотрудников:', error)
      return []
    }
  }

  const fetchComments = async (callId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}5004/api/call-comments/${callId}`)
      return response.data // Возврат комментариев
    } catch (error) {
      console.error('Ошибка при получении комментариев:', error)
      return []
    }
  }

  const checkCommentExistence = async (callId) => {
    const comments = await fetchComments(callId) // Получаем комментарии
    return comments.length > 0 // Проверяем, существуют ли комментарии
  }

  useEffect(() => {
    const getEmployeesForNotifications = async () => {
      const empPromises = notifications.map(async (notification) => {
        const empData = await fetchEmployees(notification.dealerId)
        return { dealerId: notification.dealerId, employees: empData }
      })

      const empResults = await Promise.all(empPromises)
      const empMap = empResults.reduce((acc, { dealerId, employees }) => {
        acc[dealerId] = employees
        return acc
      }, {})

      setEmployees(empMap)
    }

    const checkCommentsForNotifications = async () => {
      const commentPromises = notifications.map(async (notification) => {
        const exists = await checkCommentExistence(notification.id)
        return { callId: notification.id, exists }
      })

      const commentResults = await Promise.all(commentPromises)
      const commentsMap = commentResults.reduce((acc, { callId, exists }) => {
        acc[callId] = exists
        return acc
      }, {})

      setCommentsExist(commentsMap)
    }

    if (notifications.length > 0) {
      getEmployeesForNotifications()
      checkCommentsForNotifications()
    }
  }, [notifications, comments])

  const fetchProcessedByUser = async (callId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}5004/api/call-processor/${callId}`)
      return response.data
    } catch (error) {
      console.error('Ошибка при получении обработчика звонка:', error)
      return null
    }
  }

  useEffect(() => {
    const getProcessedByUsers = async () => {
      const processedUsersPromises = notifications.map(async (notification) => {
        if (notification.status === 'processed') {
          const userData = await fetchProcessedByUser(notification.id)
          if (userData) {
            return { callId: notification.id, user: userData }
          }
        }
        return null
      })

      const processedUsersResults = await Promise.all(processedUsersPromises)
      const usersMap = processedUsersResults.reduce((acc, item) => {
        if (item) {
          acc[item.callId] = item.user
        }
        return acc
      }, {})

      setProcessedByUsers(usersMap)
    }

    if (notifications.length > 0) {
      getProcessedByUsers()
    }
  }, [notifications])

  const handleCommentSubmit = async (callId) => {
    const userData = JSON.parse(localStorage.getItem('userData'))
    const comment = comments[callId] || ''
    const notification = notifications.find((n) => n.id === callId)
    const dealerId = notification?.dealerId

    if (!comment.trim() || !userData || !dealerId) return

    try {
      if (commentsExist[callId]) {
        // Логика редактирования
        await axios.patch(`${API_BASE_URL}5004/api/call-comments`, {
          call_id: callId,
          comment,
        })
        Toastify({
          text: 'Комментарий успешно отредактирован!',
          close: true,
          style: {
            background: 'linear-gradient(to right, #007BFF, #0056b3)',
          },
        }).showToast()
      } else {
        // Логика создания нового комментария
        await axios.post(`${API_BASE_URL}5004/api/call-comments`, {
          dealer_id: dealerId,
          user_id: userData.id,
          comment,
          call_id: callId,
        })
        Toastify({
          text: 'Комментарий успешно добавлен!',
          close: true,
          style: {
            background: 'linear-gradient(to right, #007BFF, #0056b3)',
          },
        }).showToast()
      }

      setComments((prev) => ({ ...prev, [callId]: '' }))
      setModalOpen(false)
    } catch (error) {
      Toastify({
        text: 'Ошибка при добавлении/редактировании комментария!',
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #ff0000, #ffcccc)',
        },
      }).showToast()
    }
  }

  const handleCommentChange = (dealerId, value) => {
    setComments((prev) => ({ ...prev, [dealerId]: value }))
  }

  const handleEditComment = async (callId) => {
    const commentsData = await fetchComments(callId)
    const existingComment = commentsData.length > 0 ? commentsData[0].comment : ''
    setComments((prev) => ({
      ...prev,
      [callId]: existingComment,
    }))
    setActiveNotificationId(callId)
    setModalOpen(true)
  }

  const handleStatusChange = (notification) => {
    setSelectedNotification(notification)
    setDialogOpen(true)
  }

  const handleConfirmStatusChange = async () => {
    const notification = selectedNotification
    const userData = JSON.parse(localStorage.getItem('userData'))

    try {
      const response = await axios.patch(`${API_BASE_URL}5004/api/calls/${notification.id}`, {
        status: 'processed',
      })

      if (response.status === 200) {
        await axios.post(`${API_BASE_URL}5004/api/call-processing-logs`, {
          call_id: notification.id,
          user_id: userData.id,
        })

        Toastify({
          text: 'Статус успешно изменен на "Отработанный"',
          close: true,
          backgroundColor: 'linear-gradient(to right, #007BFF, #0056b3)',
        }).showToast()
      }
    } catch (error) {
      Toastify({
        text: 'Ошибка при изменении статуса!',
        close: true,
        backgroundColor: 'linear-gradient(to right, #ff0000, #ffcccc)',
      }).showToast()
    } finally {
      setDialogOpen(false)
      setSelectedNotification(null)
    }
  }

  const handleBatchProcessCalls = async () => {
    const missedCallIds = notifications
      .filter((notification) => notification.status === 'missed')
      .map((notification) => notification.id)

    if (missedCallIds.length === 0) {
      Toastify({
        text: 'Нет пропущенных звонков для обработки!',
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #ff0000, #ffcccc)',
        },
      }).showToast()
      return
    }

    try {
      const response = await axios.patch(`${API_BASE_URL}5004/api/calls/batch-process`, {
        callIds: missedCallIds,
      })

      if (response.status === 200) {
        Toastify({
          text: 'Статус всех пропущенных звонков успешно изменен на "Отработанный"',
          close: true,
          style: {
            background: 'linear-gradient(to right, #007BFF, #0056b3)',
          },
        }).showToast()
        // Обновите состояние, если требуется
      }
    } catch (error) {
      Toastify({
        text: 'Ошибка при изменении статуса пропущенных звонков!',
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #ff0000, #ffcccc)',
        },
      }).showToast()
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setSelectedNotification(null)
  }

  const filterNotifications = (notifications) => {
    if (!searchTerm) return notifications // Если текст поиска пустой, возвращаем все уведомления

    return notifications.filter((notification) => {
      const searchString = searchTerm.toLowerCase()
      const id = String(notification.id).toLowerCase()
      return (
        String(notification.callerNumber).toLowerCase().includes(searchString) ||
        (notification.callerName && notification.callerName.toLowerCase().includes(searchString)) ||
        (notification.receiverNumber &&
          notification.receiverNumber.toLowerCase().includes(searchString)) ||
        (notification.receiverName &&
          notification.receiverName.toLowerCase().includes(searchString)) ||
        id.includes(searchString)
      )
    })
  }

  const hasMissedCalls = notifications.some((n) => n.status === 'missed')

  return (
    <div className="notification-list">
      <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      <h5>{title}</h5>
      {/* Кнопка появляется только если есть пропущенные звонки и в разделе пропущенных */}
      {hasMissedCalls &&
        statusTitle === 'Пропущенный' &&
        (position === 'НОК' ||
          (userInfo && userInfo.isDepartmentHead && userInfo.canViewAllCalls)) && (
          <button
            onClick={handleBatchProcessCalls}
            className="batch-process-button"
            title="Отправить все пропущенные звонки в обработанные"
          >
            <MdOutlineRecycling className="batch-process-icon" />
            Обработать все
          </button>
        )}
      {notifications.length === 0 ? (
        <p className="empty-message">Нет новых уведомлений</p>
      ) : (
        <div className="notification-cards">
          {filterNotifications(notifications).map((notification) => (
            <div key={notification.id} className="notification-card">
              <p className="notification-text">
                {statusTitle} звонок от: {notification.callerNumber} -{' '}
                {!notification.callerName || notification.callerName.trim() === '' ? (
                  <span style={{ color: 'red' }}>
                    Владелец не определен.{' '}
                    <BsTelephonePlus
                      className="icon"
                      title="Добавить номер телефона"
                      onClick={() => onAddPhoneClick(notification)}
                    />
                  </span>
                ) : (
                  <>
                    {notification.callerName}
                    {commentsExist[notification.id] ? (
                      <BiSolidMessageRoundedEdit
                        className="icon-controle"
                        style={{ color: 'green', fontSize: '21px' }}
                        title="Открыть комментарий"
                        onClick={() => handleEditComment(notification.id)} // Используем новую функцию
                      />
                    ) : (
                      <FaCommentMedical
                        className="icon-controle"
                        title="Создать комментарий"
                        onClick={() => {
                          setActiveNotificationId(notification.id)
                          setModalOpen(true)
                        }}
                      />
                    )}
                  </>
                )}
              </p>
              <p className="notification-receiver">
                Получатель: {notification.receiverNumber} ({notification.receiverName})
              </p>{' '}
              <span className="notification-time">
                Дата:{' '}
                {new Date(notification.dateTime).toLocaleString('ru-RU', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
                {/* Отображение сотрудников для каждого дилера */}
                {employees[notification.dealerId] && employees[notification.dealerId].length > 0 ? (
                  <p className="notification-time">
                    Закрепленные сотрудники:{' '}
                    {employees[notification.dealerId]
                      .map((emp) => {
                        const firstInitial = emp.first_name.charAt(0).toUpperCase()
                        const middleInitial = emp.middle_name
                          ? `${emp.middle_name.charAt(0).toUpperCase()}. `
                          : ''
                        const lastName = emp.last_name
                        const employeeId = emp.employee_id
                        console.log(emp.employee_id)
                        return `${firstInitial}.${middleInitial}${lastName} (ID: ${employeeId})`
                      })
                      .join(', ')}
                  </p>
                ) : (
                  <p className="notification-time">Сотрудники не найдены</p>
                )}
                {/* Отображение данных обработчика звонка */}
                {notification.status === 'processed' && processedByUsers[notification.id] && (
                  <div>
                    <p className="notification-time">
                      Обработал:{' '}
                      {(() => {
                        const firstInitial = processedByUsers[notification.id].first_name
                          .charAt(0)
                          .toUpperCase()
                        const middleInitial = processedByUsers[notification.id].middle_name
                          ? `${processedByUsers[notification.id].middle_name
                              .charAt(0)
                              .toUpperCase()}. `
                          : ''
                        const lastName = processedByUsers[notification.id].last_name
                        return `${firstInitial}.${middleInitial}${lastName}`
                      })()}
                    </p>
                    {/* Отображение времени обработки */}
                    <p className="notification-time">
                      Время обработки:{' '}
                      <span className="notification-time" style={{ fontWeight: '900' }}>
                        {new Date(processedByUsers[notification.id].created_at).toLocaleString(
                          'ru-RU',
                          {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }
                        )}
                      </span>
                    </p>
                  </div>
                )}
                ID: {notification.id}
              </span>
              <span className="notification-status">
                Статус: {notification.status === 'accepted' && 'Принятые'}
                {notification.status === 'missed' && 'Пропущенный'}
                {notification.status === 'processed' && 'Отработанный'}
                {notification.status !== 'accepted' &&
                  notification.status !== 'missed' &&
                  notification.status !== 'processed' &&
                  'Неизвестный статус'}{' '}
                {notification.status === 'missed' && (
                  <MdOutlineRecycling
                    className="icon-controle"
                    title="Отправить в обработанные звонки"
                    onClick={() => handleStatusChange(notification)}
                  />
                )}
                <BsClock
                  className="icon-controle"
                  title="Назначить время для перезвона"
                  onClick={() => handleScheduleModalOpen(notification)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      <CommentModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCommentSubmit}
        dealerId={activeNotificationId}
        currentComment={comments[activeNotificationId] || ''}
        onCommentChange={handleCommentChange}
      />
      {isScheduleModalOpen && (
        <ScheduleCallModal
          isOpen={isScheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          notificationId={activeNotificationId}
          typeReminders={'call'}
          notificationData={activeNotificationData} // Передаем данные уведомления
        />
      )}

      {/* Использование компонента ConfirmationDialog */}
      <ConfirmationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleConfirmStatusChange}
        title="Подтверждение"
        message="Вы уверены, что хотите отправить звонок в Обработанные звонки?"
        btn1="Отмена"
        btn2="Да"
      />
    </div>
  )
}

export default NotificationList
//2
