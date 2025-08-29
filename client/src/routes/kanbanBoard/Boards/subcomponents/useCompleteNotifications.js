import axios from 'axios'
import Toastify from 'toastify-js'
import { API_BASE_URL } from '../../../../../config'

const useCompleteNotifications = (columns, setColumns, setReminders, userId) => {
  const handleCompleteTask = async (taskId) => {
    if (!columns.notifications?.items) {
      console.error('Колонка уведомлений пуста или не существует')
      return
    }
    const taskToComplete = columns.notifications.items.find((task) => task.id === taskId)

    if (!taskToComplete) {
      console.error('Задача не найдена')
      return
    }

    const reminderData = {
      id: taskId,
      is_completed: true,
      completed_at: new Date().toISOString(),
    }

    try {
      // Сначала завершаем уведомление
      const response = await axios.patch(`${API_BASE_URL}5004/api/reminders/complete`, reminderData)

      if (response.status === 200) {
        // Сохраняем информацию о завершенном уведомлении в историю
        await saveCompletedNotificationToHistory(taskToComplete, userId)

        // Обновляем UI
        setColumns((prevColumns) => {
          const newNotifications = prevColumns.notifications.items.filter(
            (task) => task.id !== taskId
          )
          return {
            ...prevColumns,
            notifications: {
              ...prevColumns.notifications,
              items: newNotifications,
            },
          }
        })

        // Обновляем список напоминаний
        const fetchReminders = async () => {
          try {
            const response = await axios.get(`${API_BASE_URL}5004/api/reminders?userId=${userId}`)
            setReminders(response.data)
          } catch (error) {
            console.error('Ошибка при получении напоминаний:', error)
          }
        }
        fetchReminders()

        Toastify({
          text: `Уведомление ${taskToComplete.id} завершено: "${taskToComplete.title}"`,
          duration: 5000,
          close: true,
          backgroundColor: 'linear-gradient(to right, #007BFF, #0056b3)',
        }).showToast()
      }
    } catch (error) {
      console.error('Ошибка при завершении задачи', error)
    }
  }

  // Функция для сохранения завершенного уведомления в историю
  const saveCompletedNotificationToHistory = async (task, completedByUserId) => {
    try {
      console.log('Сохраняем уведомление в историю:', task)

      // Извлекаем название дилера из заголовка
      const dealerName = extractDealerName(task.title)
      console.log('Извлеченное название дилера:', dealerName)

      // Получаем отправленные сообщения для этого уведомления
      const sentMessagesResponse = await axios.get(
        `${API_BASE_URL}5000/api/messages-notification-dealer?reminders_id=${task.id}`
      )
      const sentMessages = sentMessagesResponse.data || []
      console.log('Полученные отправленные сообщения:', sentMessages)

      // Данные для сохранения в историю
      const historyData = {
        original_reminder_id: task.id,
        dealer_name: dealerName,
        request_description: task.description || task.comment || 'Описание отсутствует',
        priority: task.priority || 'normal',
        created_at: task.createdAt || task.created_at,
        completed_at: new Date().toISOString(),
        completed_by_user_id: completedByUserId,
        original_reminder_data: {
          title: task.title,
          description: task.description,
          priority: task.priority,
          tags: task.tags,
          links: task.links,
          deadline: task.deadline,
          createdAt: task.createdAt,
        },
      }

      // Сохраняем основную информацию о завершенном уведомлении
      const historyResponse = await axios.post(
        `${API_BASE_URL}5004/api/completed-notifications`,
        historyData
      )

      if (historyResponse.status === 201 && sentMessages.length > 0) {
        const completedNotificationId = historyResponse.data.id
        console.log('ID сохраненного уведомления в истории:', completedNotificationId)

        // Собираем все уникальные файлы из всех сообщений
        const allFiles = new Set()
        const uniqueMessages = []
        const seenMessages = new Set() // Для отслеживания уже добавленных сообщений
        const messageGroups = new Map() // Группируем сообщения по времени (с точностью до минуты)

        for (const message of sentMessages) {
          console.log('Обрабатываем сообщение:', message)

          // Создаем ключ времени с точностью до минуты для группировки
          const timeKey = new Date(message.sent_at).toISOString().substring(0, 16) // YYYY-MM-DDTHH:MM

          // Создаем уникальный ключ для сообщения (текст + файлы)
          const messageKey = `${message.sent_text || ''}_${(message.sent_files || []).join(',')}`

          // Проверяем, есть ли уже сообщение с таким же текстом и файлами в этой временной группе
          if (messageGroups.has(timeKey)) {
            const existingMessages = messageGroups.get(timeKey)
            const isDuplicate = existingMessages.some((existing) => {
              const existingKey = `${existing.sent_text || ''}_${(existing.sent_files || []).join(
                ','
              )}`
              return existingKey === messageKey
            })

            if (isDuplicate) {
              console.log('Пропускаем дублирующееся сообщение в той же временной группе:', message)
              continue
            }
          }

          // Добавляем сообщение в группу
          if (!messageGroups.has(timeKey)) {
            messageGroups.set(timeKey, [])
          }
          messageGroups.get(timeKey).push(message)

          // Создаем копию сообщения для обработки
          const processedMessage = { ...message }

          // Обрабатываем файлы сообщения
          if (message.sent_files && message.sent_files.length > 0) {
            const uniqueFiles = []

            for (const file of message.sent_files) {
              // Извлекаем оригинальное имя файла (убираем временную метку)
              const originalFileName = extractOriginalFileName(file)

              // Если файл с таким оригинальным именем еще не добавлен
              if (!allFiles.has(originalFileName)) {
                allFiles.add(originalFileName)
                uniqueFiles.push(file) // Сохраняем полное имя файла с временной меткой
              }
            }

            processedMessage.sent_files = uniqueFiles
          }

          // Добавляем обработанное сообщение только если в нем есть текст или файлы
          if (
            processedMessage.sent_text ||
            (processedMessage.sent_files && processedMessage.sent_files.length > 0)
          ) {
            uniqueMessages.push(processedMessage)
          }
        }

        console.log('Уникальные сообщения для сохранения:', uniqueMessages)
        console.log('Группировка сообщений по времени:', Object.fromEntries(messageGroups))
        console.log('Всего уникальных файлов:', allFiles.size)
        console.log('Список уникальных файлов:', Array.from(allFiles))

        // Сохраняем обработанные сообщения
        for (const message of uniqueMessages) {
          const messageData = {
            completed_notification_id: completedNotificationId,
            sent_text: message.sent_text,
            sent_files: message.sent_files || [],
            sent_at: message.sent_at,
          }

          console.log('Сохраняем сообщение в историю:', messageData)
          await axios.post(`${API_BASE_URL}5004/api/completed-notifications-messages`, messageData)
        }
      }
    } catch (error) {
      console.error('Ошибка при сохранении в историю:', error)
    }
  }

  // Функция для извлечения названия дилера из заголовка
  const extractDealerName = (title) => {
    // Используем ту же логику, что и в компоненте Boards
    const match = title.match(/\*(.*?)\*/)
    return match ? match[1] : 'Без группы'
  }

  // Функция для извлечения оригинального имени файла (убирает временную метку)
  const extractOriginalFileName = (filename) => {
    // Убираем временную метку в начале файла (например, "1755765158740-")
    const match = filename.match(/^\d+-(.+)$/)
    if (match) {
      return match[1]
    }
    return filename
  }

  return { handleCompleteTask }
}

export default useCompleteNotifications
