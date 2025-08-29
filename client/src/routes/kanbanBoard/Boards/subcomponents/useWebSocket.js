import { useEffect, useRef } from 'react'
import io from 'socket.io-client'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import useTasksStore from '../../../../store/useTasksStore'
import useTasksManageStore from '../../../../store/useTasksManageStore'
import useTaskStateTracker from '../../../../store/useTaskStateTracker'
import Toastify from 'toastify-js'
import { sendCustomNotification } from '../../../../utils/browserNotifications'
import { formatDate } from '../../../../utils/useElapsedTime'
import { getStatusLabel } from './taskUtils'

//const socket = io(`${API_BASE_URL}5000`)

const useWebSocket = (userId, stableSetMessages, currentTaskId) => {
  const { fetchTasks } = useTasksStore()
  const { addOrUpdateTask, fetchExtensionRequests, fetchUnreadNotifications } =
    useTaskStateTracker()
  const { fetchTasksManager, fetchCompletedTasks, addUnreadMessage, fetchMessages } =
    useTasksManageStore()
  const electronAPI = window.electronAPI || null

  const socket = useRef(null)

  // Пример отправки уведомления
  const sendNotification = (title, text) => {
    if (electronAPI && typeof electronAPI.sendNotification === 'function') {
      electronAPI.sendNotification(title, text)
    } else {
      console.log('Electron API недоступен')
    }
  }

  useEffect(() => {
    if (!userId) return

    if (!socket.current) {
      socket.current = io(`${API_BASE_URL}5000`, {
        query: {
          userId: userId,
        },
        transports: ['websocket'],
      })

      // Слушаем событие 'newMessage' для получения новых сообщений
      socket.current.on('newMessage', (message) => {
        if (message.sender_id !== userId) {
          if (message.task_author_id === userId || message.assigned_user === userId) {
            //   addMessage(message) // Сохраняем сообщение в Zustand store

            addUnreadMessage(message.task_id)

            if (message.task_author_id === userId) {
              useTaskStateTracker.getState().setAuthorMessage(message.task_id, userId, true) // сохраняем с хранилище
            }
            if (message.assigned_user === userId) {
              useTaskStateTracker.getState().setAssigneeMessage(message.task_id, userId, true) // сохраняем с хранилище
            }

            console.log('Получено новое сообщение:', message)
          }
        }

        if (typeof stableSetMessages === 'function') {
          // console.log('message.task_id', message.task_id)
          //  console.log('currentTaskId', currentTaskId)
          if (message.task_id != currentTaskId) {
            return // Игнорируем сообщение, если оно не относится к текущему чату
          }
          stableSetMessages((prevMessages) => [...prevMessages, message])
        }
      })

      // Событие отправка собщения в глобальную задачу чата
      socket.current.on('newMessageGlobalTaskChat', (globalTaskId, userIds, title, autor) => {
        if (userIds.includes(userId)) {
          fetchMessages(globalTaskId)

          // сохраняем информацию о глобальной задаче
          if (autor !== userId) {
            useTaskStateTracker.getState().setGlobalTaskNotification(globalTaskId, title)
          }
        }
      })

      // Слушаем событие 'taskCreated' для получения новых задач
      socket.current.on('taskCreated', (data) => {
        console.log('Получено событие taskCreated:', data)
        Toastify({
          text: `Вам поступила новая задача!`,
          close: true,
          backgroundColor: 'linear-gradient(to right, #006400, #00FF00)',
        }).showToast()
        if (
          data.createdBy === userId ||
          data.assignedUsers.map(String).includes(String(userId)) ||
          data.approvers.map(String).includes(String(userId)) ||
          data.viewers.map(String).includes(String(userId))
        ) {
          fetchTasks(userId)
          fetchTasksManager(userId)
          sendNotification('Задачи', 'Вам поступила новая задача!')
        }
      })

      // Слушаем событие 'taskApproval' при подтверждении на выполнение задачи
      socket.current.on('taskApproval', () => {
        // fetchTasksManager(userId)
        fetchTasks(userId)
      })

      // Слушаем событие 'updateStatusSubTasks' при установки статуса Проекта Пауза или Продолжить
      socket.current.on('updateStatusSubTasks', async (subTtaskIds, status) => {
        for (const userTasks of subTtaskIds) {
          const { user_id, task_ids } = userTasks

          // Проверяем, есть ли в списке задачи для текущего пользователя
          if (user_id === userId) {
            await fetchTasks(userId)
          }
        }
      })

      // Слушаем событие 'taskAccept' для завершении задачи
      socket.current.on('taskAccept', () => {
        fetchCompletedTasks(userId)
        fetchTasksManager(userId)
        fetchTasks(userId)
      })

      // Слушаем событие 'updateDescriptionTasks' обновление описания задачи
      socket.current.on('updateDescriptionTasks', async (taskId, assignedUserIds, taskTitle) => {
        console.log(userId)
        console.log(assignedUserIds)
        if (assignedUserIds.includes(userId)) {
          console.log(assignedUserIds)
          fetchTasks(assignedUserIds)
          useTaskStateTracker.getState().addDescriptionChangeNotification(taskId, taskTitle)
          sendCustomNotification(`Изменение описания задачи: ${taskTitle}`)
        }
      })

      // Слушаем событие 'taskUpdateTaskStatus'
      socket.current.on('taskUpdateTaskStatus', (data) => {
        const { taskId, status, createdBy, title } = data
        // Обновляем состояние в хранилище
        if (userId === createdBy) {
          console.log('Работает для ', userId)
          addOrUpdateTask({ id: taskId, status, createdBy, title })
        }
      })

      // Слушаем событие 'extendDeadline' для запроса на продления дедлайна createExtensionRequest
      socket.current.on('extendDeadline', async (data) => {
        if (data.created_by === userId) {
          //Вызываем функцию запроса в БД на имеющиеся просьбы о продлении сроков
          fetchExtensionRequests(userId)

          let notificationMessage = `Исполнитель ${data.executor_full_name} просит продлить срок исполнения задачи "${data.task_title}"`

          // Добавляем информацию о датах только если есть новая дата
          if (data.new_proposed_deadline) {
            notificationMessage += ` с ${new Date(
              data.task_deadline
            ).toLocaleString()} до ${formatDate(data.new_proposed_deadline)}`
          }

          // Добавляем причину, если она есть
          if (data.reason) {
            notificationMessage += `. Причина: ${data.reason}`
          }

          sendNotification(`Задачи/Продление срока выполнения.`, notificationMessage)
        }
      })

      // Новый обработчик для уведомлений касательно задач
      socket.current.on('notification', (notification) => {
        // Отказ в увелечении срока исполнения *******************************************************************
        if (notification.type === 'extension_request_rejected' && notification.userId === userId) {
          sendNotification(`Задачи/ОТКАЗ в продлении срока.`, notification.message)

          fetchUnreadNotifications(userId) // добавить уведомление в баннер
        }

        // Одобрено увеличение срока исполнения ******************************************************************
        if (notification.type === 'extension_request_approved' && notification.userId === userId) {
          sendNotification(`Задачи/Одобрено в продлении срока.`, notification.message)
          fetchTasks(userId)
          fetchUnreadNotifications(userId)
        }

        // Изменение срока исполнения задачи **********************************************************************
        if (notification.type === 'task_deadline_updated' && notification.userId === userId) {
          sendNotification(`Задачи/Изменение срока исполнения задачи.`, notification.message)
          fetchTasks(userId)
          fetchUnreadNotifications(userId)
        }

        // Уведомление о просроченной задаче **********************************************************************
        if (
          notification.type === 'taskDeadlineOverdue' &&
          (notification.userId === userId || notification.createdBy === userId)
        ) {
          const title =
            notification.userId === userId
              ? 'Сроки исполнения нарушены!'
              : 'Сроки исполнения созданной задачи нарушены!'

          const message =
            notification.userId === userId
              ? `Задача ${
                  notification.message
                }. Сроки исполнения были нарушены! Срок исполнения был установлен до  ${formatDate(
                  notification.deadline
                )}`
              : `Задача ${
                  notification.message
                }. Сроки исполнения задачи, которую вы создали, нарушены! Срок исполнения был установлен до${formatDate(
                  notification.deadline
                )}`

          sendNotification(`Задачи/${title}`, message)

          fetchUnreadNotifications(userId)
        }

        /*
     // Уведомление о просроченной задаче **********************************************************************
        if (
          notification.type === 'taskDeadlineOverdue' &&
          (notification.userId === userId || notification.createdBy === userId)
        ) {
          // Делаем обработчик асинхронным
          const handleOverdueNotification = async () => {
            try {
              // Проверяем наличие такого же непрочитанного уведомления в БД
              const response = await axios.get(`${API_BASE_URL}5000/api/notifications/check`, {
                params: {
                  userId: userId,
                  taskId: notification.task_id,
                  eventType: 'taskDeadlineOverdue',
                },
              })

              // Отправляем уведомление только если shouldSend === true
              if (response.data.shouldSend) {
                const title =
                  notification.userId === userId
                    ? 'Сроки исполнения нарушены!'
                    : 'Сроки исполнения созданной задачи нарушены!'

                const message =
                  notification.userId === userId
                    ? `Задача ${
                        notification.message
                      }. Сроки исполнения были нарушены! Срок исполнения был установлен до ${formatDate(
                        notification.deadline
                      )}`
                    : `Задача ${
                        notification.message
                      }. Сроки исполнения задачи, которую вы создали, нарушены! Срок исполнения был установлен до ${formatDate(
                        notification.deadline
                      )}`

                sendNotification(`Задачи/${title}`, message)
                fetchUnreadNotifications(userId)
              }
            } catch (error) {
              console.error('Error checking notification:', error)
              // В случае ошибки можно отправить уведомление без проверки
              //  const title =  
              //  const message =  
              //   sendNotification(`Задачи/${title}`, message)
              // fetchUnreadNotifications(userId)
        //    }
        //  }

          // Вызываем асинхронную функцию
       //   handleOverdueNotification()
    //    }

        */

        // Уведомление при смене исполнителя задачи ***********************************************************************************************
        if (notification.type === 'taskAssigneeChanged') {
          // Для старого исполнителя
          if (notification.oldUserId === userId) {
            sendNotification(
              'Задачи/Смена исполнителя',
              `Вы больше не являетесь исполнителем задачи "${notification.title}". Новый исполнитель: ${notification.newUserName}`
            )
            fetchTasks(userId)
          }

          // Для нового исполнителя
          if (notification.newUserId === userId) {
            sendNotification(
              'Задачи/Новая задача',
              `Вы назначены исполнителем задачи "${notification.title}". Предыдущий исполнитель: ${notification.oldUserName}`
            )
            fetchTasks(userId) // Обновляем список задач
          }

          fetchUnreadNotifications(userId)
        }
      })
    }
    // Очистка при размонтировании
    return () => {
      if (socket.current) {
        socket.current.off('taskCreated')
        socket.current.off('taskManager')
        socket.current.off('taskApproval')
        socket.current.off('taskAccept')
        socket.current.off('newMessage')
        socket.current.off('taskUpdateTaskStatus')
        socket.current.off('newMessageGlobalTaskChat')
        socket.current.off('updateStatusSubTasks')
        socket.current.off('updateDescriptionTasks')
        socket.current.off('extendDeadline')
        socket.current.off('notification')
        socket.current.disconnect()
        socket.current = null // Сбрасываем сокет
      }
    }
  }, [
    userId,
    fetchTasks,
    fetchTasksManager,
    socket,
    stableSetMessages,
    fetchCompletedTasks,
    addUnreadMessage,
    addOrUpdateTask,
    fetchMessages,
  ])
}

export default useWebSocket
