import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import EmojiPicker from 'emoji-picker-react'
import { FaFolder } from 'react-icons/fa'
import { IoArrowUndoOutline } from 'react-icons/io5'
import { API_BASE_URL } from '../../../../../../config'
import useWebSocket from '../../../Boards/subcomponents/useWebSocket'
import useUserStore from '../../../../../store/userStore'
import ChatFileUploader from './ChatFileUploader'
import ChatFileViewer from './ChatFileViewer'
import ChatFileManager from './ChatFileManager'
import './chatTaskModal.scss'

/** Отпечаток файла: SHA-256 при наличии crypto.subtle, иначе FNV (не-secure context). */
async function fingerprintArrayBuffer(arrayBuffer) {
  const subtle = typeof window !== 'undefined' ? window.crypto?.subtle : undefined
  if (subtle && typeof subtle.digest === 'function') {
    try {
      const hash = await subtle.digest('SHA-256', arrayBuffer)
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    } catch {
      /* ниже fallback */
    }
  }
  const u8 = new Uint8Array(arrayBuffer)
  let h = 2166136261 >>> 0
  for (let i = 0; i < u8.length; i++) {
    h ^= u8[i]
    h = Math.imul(h, 16777619) >>> 0
  }
  return `fnv${(h >>> 0).toString(16).padStart(8, '0')}${u8.length.toString(16).padStart(8, '0')}`
}

const ChatTaskModal = ({
  task,
  onClose,
  isOpen,
  currentUser,
  transformStyle = 'translate(-50%, -50%)',
}) => {
  const { user } = useUserStore()
  const messagesContainerRef = useRef(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [participants, setParticipants] = useState([])
  const [isClosing, setIsClosing] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [showFileManager, setShowFileManager] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessingPaste, setIsProcessingPaste] = useState(false)

  const userId = user ? user.id : null

  // Функция для прокрутки к сообщению
  const scrollToMessage = useCallback((messageId) => {
    const messageElement = document.getElementById(`msg-${messageId}`)
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      messageElement.style.backgroundColor = 'rgba(99, 102, 241, 0.1)'
      setTimeout(() => {
        messageElement.style.backgroundColor = ''
      }, 2000)
    }
  }, [])

  const markMessagesAsRead = useCallback(async () => {
    if (!isOpen) return null
    const unreadMessageIds = messages
      .filter((message) => !message.read_status && message.sender_id !== currentUser)
      .map((message) => message.id)

    if (unreadMessageIds.length > 0) {
      try {
        await axios.post(
          `${API_BASE_URL}5000/api/tasks/${task.id || task.task_id}/mark-messages-as-read`,
          {
            messageIds: unreadMessageIds,
            userId: currentUser,
          }
        )

        setMessages((prevMessages) =>
          prevMessages.map((message) =>
            unreadMessageIds.includes(message.id) ? { ...message, read_status: true } : message
          )
        )
      } catch (error) {
        console.error('Ошибка при обновлении статуса прочтения:', error)
      }
    }
  }, [messages, task.id, task.task_id, currentUser, userId])

  useEffect(() => {
    if (isOpen) {
      markMessagesAsRead()
    }
  }, [isOpen, markMessagesAsRead])

  // Функция для загрузки файлов для сообщения
  const loadFilesForMessage = useCallback(
    async (message) => {
      if (!message || !message.id) return

      if (
        message.text.includes('Отправлено') &&
        (message.text.includes('файл') || message.text.includes('изображений'))
      ) {
        try {
          const chatFilesResponse = await axios.get(
            `${API_BASE_URL}5000/api/chat-files/${task.id || task.task_id}`
          )

          const allFiles = chatFilesResponse.data.files || []
          const msgId = Number(message.id)
          const relevantFiles = allFiles.filter(
            (file) => Number(file.message_id) === msgId
          )

          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === message.id
                ? {
                    ...msg,
                    files: relevantFiles.map((file) => ({
                      name: file.original_name,
                      size: file.file_size || 0,
                      type: file.file_type,
                      is_image: file.is_image,
                      fileUrl: `${API_BASE_URL}5000/api/task${file.file_path}`,
                      original_name: file.original_name,
                    })),
                  }
                : msg
            )
          )
        } catch (error) {
          console.error('Ошибка при загрузке вложений для WebSocket:', error)
        }
      }
    },
    [task.id, task.task_id]
  )

  const stableSetMessages = useCallback(
    async (newMessages) => {
      console.log('🚀 stableSetMessages вызвана с:', newMessages)
      console.log('👤 Текущий пользователь ID:', userId)

      setMessages((prevMessages) => {
        if (typeof newMessages === 'function') {
          const result = newMessages(prevMessages)

          // Если это функция, загружаем файлы для новых сообщений
          setTimeout(() => {
            if (Array.isArray(result)) {
              result.forEach(async (message) => {
                if (message && message.id) {
                  console.log('🔄 Загружаем файлы для сообщения из функции:', message.id)
                  loadFilesForMessage(message)
                }
              })
            } else if (result && result.id) {
              console.log('🔄 Загружаем файлы для сообщения из функции:', result.id)
              loadFilesForMessage(result)
            }
          }, 100)

          return result
        }

        // Проверяем, не является ли это нашим собственным сообщением
        const isOwnMessage = Array.isArray(newMessages)
          ? newMessages.some((msg) => msg.sender_id === userId)
          : newMessages.sender_id === userId

        console.log('🔍 Проверяем собственные сообщения:')
        console.log('   - isOwnMessage:', isOwnMessage)
        console.log('   - newMessages:', newMessages)
        console.log('   - userId:', userId)

        if (isOwnMessage) {
          console.log('❌ Это собственное сообщение, не добавляем')
          return prevMessages // Не добавляем собственные сообщения
        }

        // Проверяем, нет ли уже таких сообщений
        const messagesToAdd = Array.isArray(newMessages) ? newMessages : [newMessages]
        const newUniqueMessages = messagesToAdd.filter(
          (newMsg) => !prevMessages.some((existingMsg) => existingMsg.id === newMsg.id)
        )

        if (newUniqueMessages.length === 0) {
          return prevMessages // Все сообщения уже есть
        }

        // Добавляем новые сообщения с пустыми файлами
        const messagesWithEmptyFiles = newUniqueMessages.map((msg) => ({
          ...msg,
          files: [],
        }))

        // Дополнительная проверка на уникальность ID
        const uniqueMessages = messagesWithEmptyFiles.filter(
          (msg, index, arr) => arr.findIndex((m) => m.id === msg.id) === index
        )

        return [...prevMessages, ...uniqueMessages]
      })

      // Асинхронно загружаем файлы для новых сообщений
      if (typeof newMessages !== 'function') {
        const messagesToProcess = Array.isArray(newMessages) ? newMessages : [newMessages]
        console.log('🔄 Обрабатываем новые сообщения для загрузки файлов:', messagesToProcess)

        messagesToProcess.forEach(async (message) => {
          if (message && message.id) {
            console.log('🔄 Загружаем файлы для сообщения напрямую:', message.id)
            loadFilesForMessage(message)
          }
        })
      }
    },
    [userId, task.id, task.task_id]
  )

  useWebSocket(userId, stableSetMessages, task.id || task.task_id)

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  const fetchMessages = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}5000/api/tasks/${task.id || task.task_id}/messages-chat-task`,
        {
          params: {
            userId: userId,
          },
        }
      )

      const messagesWithReadStatus = response.data.map((message) => ({
        ...message,
        read: message.read_status,
        taskId: task.id || task.task_id,
        replied_message: message.replied_message
          ? {
              id: message.replied_message.id,
              text: message.replied_message.text,
              sender_id: message.replied_message.sender_id,
              sender_name: message.replied_message.sender_name,
            }
          : null,
        // Пока оставляем пустой массив файлов, они будут загружены отдельно
        files: [],
      }))

      // Загружаем файлы для сообщений, которые содержат информацию о файлах
      const messagesWithFiles = await Promise.all(
        messagesWithReadStatus.map(async (message) => {
          // Проверяем, содержит ли сообщение информацию о файлах
          if (
            message.text.includes('Отправлено') &&
            (message.text.includes('файл') || message.text.includes('изображений'))
          ) {
            try {
              // Загружаем файлы для этой задачи из таблицы chat_files
              const chatFilesResponse = await axios.get(
                `${API_BASE_URL}5000/api/chat-files/${task.id || task.task_id}`
              )

              const msgId = Number(message.id)
              const relevantFiles =
                (chatFilesResponse.data.files || []).filter(
                  (file) => Number(file.message_id) === msgId
                )

              return {
                ...message,
                files: relevantFiles.map((file) => ({
                  name: file.original_name,
                  size: file.file_size || 0,
                  type: file.file_type,
                  is_image: file.is_image,
                  fileUrl: `${API_BASE_URL}5000/api/task${file.file_path}`,
                  original_name: file.original_name,
                })),
              }
            } catch (error) {
              console.error('Ошибка при загрузке вложений:', error)
              return message
            }
          }
          return message
        })
      )

      setMessages(messagesWithFiles)
    } catch (error) {
      console.error('Ошибка при загрузке сообщений:', error)
    }
  }, [task.id, task.task_id, userId])

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false)
      fetchMessages()
    }
  }, [isOpen, fetchMessages])

  useEffect(() => {
    if (messages.length > 0) {
      markMessagesAsRead()
    }
  }, [messages, markMessagesAsRead])

  useEffect(() => {
    if (messages.length > 0) {
      const uniqueParticipants = messages.reduce((acc, message) => {
        if (!acc.some((p) => p.id === message.senderId)) {
          acc.push({
            author: message.task_author_id,
            nameImplementer: message.sender_name,
            nameAuthor: message.author_name,
          })
        }
        return acc
      }, [])

      setParticipants(uniqueParticipants)
    }
  }, [messages])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 300)
  }

  // Функции для работы с файлами
  const handleSendFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) return

      setIsUploading(true)
      try {
        const formData = new FormData()
        files.forEach((file, index) => {
          formData.append('files', file)
        })
        formData.append('taskId', task.id || task.task_id)
        formData.append('senderId', userId)
        formData.append('senderName', user?.name || 'Пользователь')

        const response = await axios.post(`${API_BASE_URL}5000/api/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        // Создаем сообщение чата с информацией о файлах
        const chatMessageData = {
          senderId: userId,
          text: `Отправлено ${files.length} файл(ов): ${files.map((f) => f.name).join(', ')}`,
          taskAuthorId: task.created_by,
          title: task.title,
        }

        // Отправляем сообщение в чат
        const chatResponse = await axios.post(
          `${API_BASE_URL}5000/api/tasks/${task.id || task.task_id}/messages-chat-task`,
          chatMessageData
        )

        // Сохраняем файлы в таблицу chat_files с привязкой к сообщению
        for (let i = 0; i < files.length; i++) {
          try {
            await axios.post(`${API_BASE_URL}5000/api/chat-files/add`, {
              message_id: chatResponse.data.id,
              task_id: task.id || task.task_id,
              original_name: files[i].name,
              server_filename: response.data.fileUrls[i].split('/').pop(),
              file_path: response.data.fileUrls[i],
              file_size: files[i].size,
              file_type: files[i].type,
              is_image: files[i].type.startsWith('image/'),
              sender_id: userId,
              sender_name:
                user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : 'Пользователь',
            })
          } catch (dbError) {
            console.error('Ошибка при сохранении файла в БД:', dbError)
          }
        }

        // Добавляем сообщение с файлами в локальное состояние
        const fileMessage = {
          ...chatResponse.data,
          files: files.map((file, index) => ({
            name: file.name,
            size: file.size,
            type: file.type,
            is_image: file.type.startsWith('image/'),
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
            fileUrl: `${API_BASE_URL}5000/api/task${response.data.fileUrls[index]}`,
            file_url: response.data.fileUrls[index],
          })),
        }

        // Проверяем, нет ли уже такого сообщения
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === fileMessage.id)
          if (exists) {
            return prev // Сообщение уже есть
          }
          return [...prev, fileMessage]
        })
      } catch (error) {
        console.error('Ошибка при отправке файлов:', error)
        alert('Ошибка при отправке файлов: ' + (error.response?.data?.error || error.message))
      } finally {
        setIsUploading(false)
      }
    },
    [task.id, task.task_id, userId, task.created_by, user?.first_name, user?.last_name]
  )

  const handleSendImages = useCallback(
    async (images) => {
      if (!images || images.length === 0) return

      // Проверяем, не отправлялись ли уже эти изображения
      const imageHashes = await Promise.all(
        images.map(async (image) => {
          const arrayBuffer = await image.arrayBuffer()
          return fingerprintArrayBuffer(arrayBuffer)
        })
      )

      // Проверяем, нет ли уже таких изображений в последних сообщениях
      const recentMessages = messages.slice(-5) // Проверяем последние 5 сообщений
      const hasDuplicate = recentMessages.some((message) => {
        if (message.files && message.files.length > 0) {
          return message.files.some((file) => {
            // Проверяем по имени файла (если это скриншот)
            if (file.name && file.name.startsWith('screenshot-')) {
              return imageHashes.some((hash) => file.name.includes(hash.substring(0, 8)))
            }
            return false
          })
        }
        return false
      })

      if (hasDuplicate) {
        console.warn('Предотвращена отправка дублирующегося изображения')
        return
      }

      setIsUploading(true)
      try {
        const formData = new FormData()
        images.forEach((image, index) => {
          formData.append('files', image)
        })
        formData.append('taskId', task.id || task.task_id)
        formData.append('senderId', userId)
        formData.append('senderName', user?.name || 'Пользователь')

        const response = await axios.post(`${API_BASE_URL}5000/api/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        // Создаем сообщение чата с информацией об изображениях
        const chatImageData = {
          senderId: userId,
          text: `Отправлено ${images.length} изображений: ${images
            .map((img) => img.name)
            .join(', ')}`,
          taskAuthorId: task.created_by,
          title: task.title,
        }

        // Отправляем сообщение в чат
        const chatResponse = await axios.post(
          `${API_BASE_URL}5000/api/tasks/${task.id || task.task_id}/messages-chat-task`,
          chatImageData
        )

        // Сохраняем изображения в таблицу chat_files с привязкой к сообщению
        for (let i = 0; i < images.length; i++) {
          try {
            await axios.post(`${API_BASE_URL}5000/api/chat-files/add`, {
              message_id: chatResponse.data.id,
              task_id: task.id || task.task_id,
              original_name: images[i].name,
              server_filename: response.data.fileUrls[i].split('/').pop(),
              file_path: response.data.fileUrls[i],
              file_size: images[i].size,
              file_type: images[i].type,
              is_image: true,
              sender_id: userId,
              sender_name:
                user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : 'Пользователь',
            })
          } catch (dbError) {
            console.error('Ошибка при сохранении изображения в БД:', dbError)
          }
        }

        // Добавляем сообщение с изображениями в локальное состояние
        const imageMessage = {
          ...chatResponse.data,
          files: images.map((image, index) => ({
            name: image.name,
            size: image.size,
            type: image.type,
            is_image: true,
            preview: URL.createObjectURL(image),
            fileUrl: `${API_BASE_URL}5000/api/task${response.data.fileUrls[index]}`,
            file_url: response.data.fileUrls[index],
          })),
        }

        // Проверяем, нет ли уже такого сообщения
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === imageMessage.id)
          if (exists) {
            return prev // Сообщение уже есть
          }
          return [...prev, imageMessage]
        })
      } catch (error) {
        console.error('Ошибка при отправке изображений:', error)
        alert('Ошибка при отправке изображений: ' + (error.response?.data?.error || error.message))
      } finally {
        setIsUploading(false)
      }
    },
    [task.id, task.task_id, userId, task.created_by, user?.first_name, user?.last_name, messages]
  )

  const handleSendMessage = useCallback(async () => {
    const hasMessage = newMessage.trim()
    if (!hasMessage) return

    // Предотвращаем дублирование
    const isDuplicate = messages.some(
      (msg) =>
        msg.text === newMessage &&
        msg.replied_message?.id === replyingTo?.id &&
        new Date(msg.timestamp).getTime() > Date.now() - 5000
    )

    if (isDuplicate) {
      console.warn('Предотвращена отправка дублирующегося сообщения')
      return
    }

    setIsUploading(true)

    try {
      const tempId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`

      // Создаем временное сообщение для отображения
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          sender_id: userId,
          text: newMessage,
          replied_message: replyingTo
            ? {
                id: replyingTo.id,
                sender_id: replyingTo.sender_id,
                text: replyingTo.text,
                sender_name: replyingTo.sender_name,
              }
            : null,
          timestamp: new Date().toISOString(),
          read_status: true,
          sender_name:
            user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}`
              : 'Пользователь',
          task_author_id: task.created_by,
          isTemp: true,
        },
      ])

      setNewMessage('')
      setReplyingTo(null)

      const response = await axios.post(
        `${API_BASE_URL}5000/api/tasks/${task.id || task.task_id}/messages-chat-task`,
        {
          senderId: userId,
          text: newMessage,
          taskAuthorId: task.created_by,
          title: task.title,
          repliedToMessageId: replyingTo?.id,
        }
      )

      setMessages((prev) => {
        // Удаляем временное сообщение и добавляем реальное
        const filtered = prev.filter((msg) => msg.id !== tempId)
        const exists = filtered.some((msg) => msg.id === response.data.id)
        if (exists) {
          return filtered // Сообщение уже есть
        }
        return [...filtered, { ...response.data, id: response.data.id }]
      })
    } catch (error) {
      console.error('Ошибка при отправке:', error)
      // Если была ошибка при отправке, удаляем временное сообщение
      setMessages((prev) => prev.filter((msg) => !msg.isTemp))
    } finally {
      setIsUploading(false)
    }
  }, [newMessage, task, userId, replyingTo, user?.first_name, user?.last_name, messages])

  // Функция для обработки вставки изображений из буфера обмена
  const handlePaste = useCallback(
    async (event) => {
      if (isProcessingPaste) {
        return
      }
      setIsProcessingPaste(true)

      const items = event.clipboardData?.items
      if (!items) {
        setIsProcessingPaste(false)
        return
      }

      const imageFiles = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            // Создаем уникальное имя для скриншота
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const screenshotName = `screenshot-${timestamp}.png`

            // Создаем новый File объект с правильным именем
            const renamedFile = new File([file], screenshotName, { type: file.type })
            imageFiles.push(renamedFile)
          }
        }
      }

      if (imageFiles.length > 0) {
        event.preventDefault()
        try {
          await handleSendImages(imageFiles)
        } catch (e) {
          console.error('Ошибка при вставке изображения:', e)
        }
      }
      setIsProcessingPaste(false)
    },
    [handleSendImages, isProcessingPaste]
  )

  const onEmojiClick = (emoji) => {
    setNewMessage((prev) => prev + emoji.emoji)
    setShowEmojiPicker(false)
  }

  const handleReplyToMessage = (message) => {
    setReplyingTo(message)
    setTimeout(() => {
      const input = document.querySelector('.chat-input textarea')
      if (input) {
        input.focus()
      }
    }, 100)
  }

  const cancelReply = () => {
    setReplyingTo(null)
  }

  if (!isOpen && !isClosing) return null

  return (
    <>
      <div
        className={`modal-overlay ${isOpen && !isClosing ? 'open' : ''}`}
        onClick={handleClose}
      />
      <div
        className={`chat-modal ${isOpen && !isClosing ? 'open' : ''}`}
        style={{
          transform: isOpen ? `${transformStyle} scale(1)` : `${transformStyle} scale(0.9)`,
        }}
      >
        <div className="chat-header">
          <div className="header-content">
            <h3>Чат задачи по теме: &quot;{task.title}&quot;</h3>
            <div className="header-tips">
              <span className="paste-tip">Ctrl+V для скриншота</span>
              <button
                className="file-manager-btn"
                onClick={() => setShowFileManager(true)}
                title="Менеджер файлов"
              >
                <FaFolder />
              </button>
            </div>
          </div>
          <button className="close-button" onClick={handleClose}>
            x
          </button>
        </div>

        {/* Блок ответа на сообщение */}
        {replyingTo && (
          <div className="reply-preview">
            <div className="reply-info">
              <span>Ответ на сообщение:</span>
              <button className="cancel-reply" onClick={cancelReply}>
                ×
              </button>
            </div>
            <div className="reply-content" onClick={() => scrollToMessage(replyingTo.id)}>
              {replyingTo.sender_id === currentUser ? (
                <span className="you-label">Вы:</span>
              ) : (
                <span className="sender-label">{replyingTo.sender_name || 'Отправитель'}:</span>
              )}
              {replyingTo.text}
            </div>
          </div>
        )}

        {/* Список сообщений */}
        <div className="chat-messages" ref={messagesContainerRef}>
          {messages.map((message) => (
            <div
              key={message.id}
              id={`msg-${message.id}`}
              className={`message ${message.sender_id === currentUser ? 'sent' : 'received'} ${
                message.read_status ? 'read' : 'unread'
              }`}
            >
              {/* Блок ответа на сообщение */}
              {message.replied_message && (
                <div
                  className="message-reply"
                  onClick={(e) => {
                    e.stopPropagation()
                    scrollToMessage(message.replied_message.id)
                  }}
                >
                  <div className="reply-line"></div>
                  <div className="reply-content">
                    {message.replied_message.sender_id === currentUser ? (
                      <span className="you-label">Вы:</span>
                    ) : (
                      <span className="sender-label">
                        {message.replied_message.sender_name || 'Отправитель'}:
                      </span>
                    )}
                    {message.replied_message.text}
                  </div>
                </div>
              )}

              {/* Отправитель и время */}
              <div className="message-header">
                <span className="sender-name">
                  {message.sender_id === currentUser ? 'Вы' : message.sender_name || 'Отправитель'}
                </span>
                <div className="message-header-actions">
                  <span className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <button
                    type="button"
                    className="message-reply-btn"
                    title="Ответить"
                    aria-label="Ответить на сообщение"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleReplyToMessage(message)
                    }}
                  >
                    <IoArrowUndoOutline aria-hidden />
                  </button>
                </div>
              </div>

              {/* Текст сообщения */}
              <div className="message-text">{message.text}</div>

              {/* Файлы в сообщении */}
              {message.files && message.files.length > 0 && (
                <div className="message-files">
                  <ChatFileViewer
                    files={message.files}
                    messageId={message.id}
                    taskId={task.id || task.task_id}
                  />
                </div>
              )}

              {/* Статус прочтения */}
              <div className="message-status">
                {message.read_status ? (
                  <span className="read-status">✓✓</span>
                ) : (
                  <span className="unread-status">✓</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Поле ввода сообщения */}
        <div className="chat-input">
          <div className="input-row">
            {/* Кнопки файлов слева */}
            <ChatFileUploader
              onSendFiles={handleSendFiles}
              onSendImages={handleSendImages}
              isUploading={isUploading}
            />

            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.ctrlKey) {
                    e.preventDefault()
                    setNewMessage((prev) => prev + '\n')
                    return
                  } else if (e.shiftKey) {
                    return
                  } else {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }
              }}
              onPaste={handlePaste}
              placeholder="Напишите сообщение..."
              rows={2}
              style={{ resize: 'none', whiteSpace: 'pre-wrap' }}
            />
            <div className="input-buttons">
              <button onClick={() => setShowEmojiPicker((prev) => !prev)}>😊</button>
              <button onClick={handleSendMessage} disabled={isUploading}>
                {isUploading ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>

        {/* Эмодзи пикер */}
        {showEmojiPicker && (
          <div className="emoji-picker-container-task">
            <EmojiPicker onEmojiClick={onEmojiClick} />
          </div>
        )}

        {/* Участники чата */}
        <div className="chat-participants">
          <h4>Участники:</h4>
          <div className="participants-list">
            {participants.length > 0 ? (
              participants.map((participant) => (
                <div className="participant" key={participant.author}>
                  <div>{participant.nameImplementer} (Исполнитель)</div>
                  <div>{participant.nameAuthor} (Автор)</div>
                </div>
              ))
            ) : (
              <div className="no-participants">Нет участников</div>
            )}
          </div>
        </div>
      </div>

      {/* Менеджер файлов */}
      <ChatFileManager
        isOpen={showFileManager}
        onClose={() => setShowFileManager(false)}
        taskId={task.id || task.task_id}
        currentUserId={currentUser}
        messages={messages}
      />
    </>
  )
}

export default ChatTaskModal
