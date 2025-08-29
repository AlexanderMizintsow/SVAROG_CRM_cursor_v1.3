import React, { useState, useRef, useEffect } from 'react'
import { GoPaperclip } from 'react-icons/go'
import EmojiPicker from 'emoji-picker-react'
import { FaRegPaperPlane } from 'react-icons/fa'
import { FiMessageCircle } from 'react-icons/fi'
import { FaRegComments } from 'react-icons/fa6'
import UserStore from '../../../../../store/userStore'
import './GlobalTaskChat.scss'
import { MdClose, MdReply } from 'react-icons/md'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../../config'
import useTasksManageStore from '../../../../../store/useTasksManageStore'
import useTaskStateTracker from '../../../../../store/useTaskStateTracker'

const GlobalTaskChat = ({
  onClick,
  globalTaskId,
  title,
  offsetX = 0,
  offsetY = 0,
}) => {
  const { user } = UserStore()
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef(null)
  const { fetchMessages, messagesGlobalTask } = useTasksManageStore()
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const messageRefs = useRef({})

  const userId = user ? user.id : null

  // Функция для прокрутки к сообщению
  const scrollToMessage = (messageId) => {
    if (messageRefs.current[messageId]) {
      messageRefs.current[messageId].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })

      // Временное выделение сообщения
      const messageElement = messageRefs.current[messageId]
      messageElement.classList.add('highlighted-message')
      setTimeout(() => {
        messageElement.classList.remove('highlighted-message')
      }, 2000)
    }
  }

  // Функция для обработки клика на сообщение
  const handleMessageClick = (message, e) => {
    // Проверяем, существует ли событие
    if (!e) {
      setReplyingTo(message)
      return
    }

    // Если клик был на ссылке в сообщении, не устанавливаем его как отвечаемое
    const replyPreview = e.target.closest('.reply-preview')
    if (replyPreview) {
      e.preventDefault()
      e.stopPropagation()
      if (message.replied_to_message_id) {
        scrollToMessage(message.replied_to_message_id)
      }
      return
    }

    setReplyingTo(message)
  }

  // Функция для отмены ответа
  const cancelReply = () => {
    setReplyingTo(null)
  }

  const loadMessages = async () => {
    const data = await fetchMessages(globalTaskId)
    setMessages(data)
  }

  useEffect(() => {
    setMessages(messagesGlobalTask)
  }, [messagesGlobalTask])

  useEffect(() => {
    loadMessages()
  }, [globalTaskId])

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Отправка сообщения
  const handleSendMessage = async () => {
    const trimmedText = inputText.trim()
    if (trimmedText === '') return

    const newMessage = {
      globalTaskId: globalTaskId,
      userId: userId,
      text: trimmedText,
      title,
      repliedToMessageId: replyingTo ? replyingTo.id : null, // Добавляем ID сообщения, на которое отвечаем
    }

    await axios.post(`${API_BASE_URL}5000/api/global-tasks/chat`, newMessage)

    loadMessages()
    setInputText('')
    setReplyingTo(null) // Сбрасываем ответ после отправки
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage()
    }
  }

  // Создаём функцию для форматирования даты
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
    return date.toLocaleString(undefined, options)
  }

  const avatarColors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-green-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-pink-500',
  ]
  const getInitials = (firstName, lastName) => {
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : ''
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : ''
    return firstInitial + lastInitial
  }

  const getColorClassById = (id) => {
    const index = id % avatarColors.length // делим на длину массива цветов
    return avatarColors[index]
  }

  const handleCloseChat = () => {
    useTaskStateTracker.getState().removeGlobalTaskNotification(globalTaskId) // Удаление уведомления
    onClick() // Вызов функции закрытия чата
  }

  const toggleEmojiPicker = () => {
    // Добавлено
    setShowEmojiPicker(!showEmojiPicker)
  }

  const onEmojiClick = (emoji) => {
    // Добавлено
    setInputText(inputText + emoji.emoji) // Добавляем эмодзи в текст
    setShowEmojiPicker(false) // Закрываем выбор эмодзи после выбора
  }

  const renderMessageContent = (msg, isCurrentUser) => {
    const repliedToMessage = messages.find(
      (m) => m.id === msg.replied_to_message_id
    )

    return (
      <div className="message-content">
        {msg.replied_to_message_id && repliedToMessage && (
          <div
            className="reply-preview"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              scrollToMessage(msg.replied_to_message_id)
            }}
          >
            <div className="reply-author">
              <MdReply className="reply-icon" />
              {repliedToMessage.first_name} {repliedToMessage.last_name}
            </div>
            <div className="reply-text">{repliedToMessage.text}</div>
          </div>
        )}
        {!isCurrentUser && (
          <div className="author-info">
            {msg.first_name} {msg.last_name}
          </div>
        )}
        <div className={`text-bubble ${isCurrentUser ? 'self' : 'other'}`}>
          {msg.text}
        </div>
        <div className="timestamp">{formatTimestamp(msg.timestamp)}</div>
      </div>
    )
  }

  return (
    <div
      className="chat-wrapper"
      style={{
        transform: `translate(calc(-50% + ${offsetX}px), calc(-45% + ${offsetY}px))`,
      }}
    >
      <div className="chat-container">
        <button className="close-button" onClick={handleCloseChat}>
          <MdClose />
        </button>
        {/* Заголовок */}
        <div className="header">
          <div className="title-section">
            <div className="avatar-box bg-indigo-500">
              <FaRegComments style={{ fontSize: '24px' }} />
            </div>
            <div>
              <h2 className="title-chat">Проектный чат</h2>
              <p className="subtitle">Обсуждение проекта: {title}</p>
            </div>
          </div>
        </div>

        {/* Область сообщений */}
        <div className="messages" ref={messagesEndRef}>
          {messages.map((msg) => {
            const authorName = `${msg.first_name} ${msg.last_name}`

            const isCurrentUser = userId && msg.user_id === userId

            // Инициализация
            const initials = getInitials(msg.first_name, msg.last_name)
            const colorClass = getColorClassById(msg.user_id)

            return (
              <div
                key={msg.id}
                ref={(el) => (messageRefs.current[msg.id] = el)}
                className={`message ${isCurrentUser ? 'self' : 'other'} ${
                  replyingTo?.id === msg.id ? 'selected-message' : ''
                }`}
                onClick={(e) => handleMessageClick(msg, e)}
              >
                <div
                  className={`message-inner ${
                    isCurrentUser ? 'self' : 'other'
                  }`}
                >
                  {!isCurrentUser && (
                    <div className={`avatar ${colorClass} avatar-circle`}>
                      {initials}
                    </div>
                  )}
                  {renderMessageContent(msg, isCurrentUser)}
                </div>
              </div>
            )
          })}
        </div>

        {/* Ввод сообщения */}
        <div className="input-area">
          {/* Блок ответа (если есть сообщение, на которое отвечаем) */}
          {replyingTo && (
            <div className="reply-container">
              <div className="reply-info">
                <span>Ответ на сообщение {replyingTo.first_name}:</span>
                <span className="reply-text">{replyingTo.text}</span>
              </div>
              <button className="cancel-reply" onClick={cancelReply}>
                <MdClose />
              </button>
            </div>
          )}
          <div className="input-container">
            {/*<button className="icon-button attach-btn">
              <GoPaperclip style={{ fontSize: '24px' }} />
            </button>*/}
            <div className="input-wrapper">
              <textarea
                placeholder="Напишите сообщение..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.ctrlKey) {
                      // Ctrl + Shift + Enter — добавляем новую строку
                      e.preventDefault()
                      setInputText((prev) => prev + '\n')
                    } else if (!e.ctrlKey && !e.shiftKey) {
                      // Просто Enter — отправляем сообщение
                      e.preventDefault()
                      handleSendMessage()
                    }
                    // Shift + Enter — по умолчанию добавляется новая строка в textarea
                  }
                }}
                rows={2}
                style={{ resize: 'none', whiteSpace: 'pre-line' }}
              />

              {showEmojiPicker && ( // Изменено
                <div className="emoji-picker-container">
                  <EmojiPicker onEmojiClick={onEmojiClick} />{' '}
                </div>
              )}
            </div>
            <button
              className="icon-button emoji-btn"
              onClick={toggleEmojiPicker}
            >
              <i className="far fa-smile" style={{ fontSize: '24px' }}></i>
            </button>
            <button className="send-btn" onClick={handleSendMessage}>
              <FaRegPaperPlane style={{ fontSize: '21px' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GlobalTaskChat
