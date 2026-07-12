import React, { useState, useRef, useEffect, useCallback } from 'react'
import EmojiPicker from 'emoji-picker-react'
import { FaRegPaperPlane } from 'react-icons/fa'
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
  const textareaRef = useRef(null)
  const globalTaskIdRef = useRef(globalTaskId)
  const fetchMessages = useTasksManageStore((state) => state.fetchMessages)
  const cachedMessages = useTasksManageStore(
    (state) => state.messagesGlobalTaskById[String(globalTaskId ?? '')]
  )
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const messageRefs = useRef({})

  const userId = user ? user.id : null

  useEffect(() => {
    globalTaskIdRef.current = globalTaskId
  }, [globalTaskId])

  const loadMessages = useCallback(async () => {
    if (globalTaskId == null || globalTaskId === '') return
    const data = await fetchMessages(globalTaskId)
    if (String(globalTaskIdRef.current) !== String(globalTaskId)) return
    setMessages(Array.isArray(data) ? data : [])
  }, [fetchMessages, globalTaskId])

  useEffect(() => {
    setInputText('')
    setReplyingTo(null)
    setShowEmojiPicker(false)

    const cacheKey = String(globalTaskId ?? '')
    const cached = useTasksManageStore.getState().messagesGlobalTaskById[cacheKey]
    setMessages(Array.isArray(cached) ? cached : [])

    loadMessages()
  }, [globalTaskId, loadMessages])

  useEffect(() => {
    if (cachedMessages == null) return
    setMessages(cachedMessages)
  }, [cachedMessages])

  useEffect(() => {
    if (globalTaskId) {
      useTaskStateTracker.getState().clearProjectChatUnread(globalTaskId)
      useTaskStateTracker.getState().removeGlobalTaskNotification(globalTaskId)
    }
  }, [globalTaskId])

  const scrollToMessage = (messageId) => {
    if (messageRefs.current[messageId]) {
      messageRefs.current[messageId].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })

      const messageElement = messageRefs.current[messageId]
      messageElement.classList.add('highlighted-message')
      setTimeout(() => {
        messageElement.classList.remove('highlighted-message')
      }, 2000)
    }
  }

  const handleReplyToMessage = (message) => {
    setReplyingTo(message)
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  const cancelReply = () => {
    setReplyingTo(null)
  }

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    const trimmedText = inputText.trim()
    const activeGlobalTaskId = globalTaskIdRef.current
    if (trimmedText === '' || activeGlobalTaskId == null || activeGlobalTaskId === '') return

    const newMessage = {
      globalTaskId: activeGlobalTaskId,
      userId: userId,
      text: trimmedText,
      title,
      repliedToMessageId: replyingTo ? replyingTo.id : null,
    }

    await axios.post(`${API_BASE_URL}5000/api/global-tasks/chat`, newMessage)

    if (String(globalTaskIdRef.current) === String(activeGlobalTaskId)) {
      await fetchMessages(activeGlobalTaskId)
      setInputText('')
      setReplyingTo(null)
    }
  }

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
    const index = id % avatarColors.length
    return avatarColors[index]
  }

  const handleCloseChat = () => {
    useTaskStateTracker.getState().removeGlobalTaskNotification(globalTaskId)
    onClick()
  }

  const handleOpenProject = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!globalTaskId) return

    useTaskStateTracker.getState().setTaskDecisionNavigate({
      type: 'project',
      globalTaskId,
    })
    window.dispatchEvent(new CustomEvent('task-decision-navigate'))
    handleCloseChat()
  }

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker)
  }

  const onEmojiClick = (emoji) => {
    setInputText((prev) => prev + emoji.emoji)
    setShowEmojiPicker(false)
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
        <div className={`text-bubble ${isCurrentUser ? 'self' : 'other'}`}>{msg.text}</div>
        <div className="message-footer">
          <span className="timestamp">{formatTimestamp(msg.timestamp)}</span>
          <button
            type="button"
            className="message-reply-btn"
            title="Ответить"
            aria-label="Ответить на сообщение"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation()
              handleReplyToMessage(msg)
            }}
          >
            <MdReply aria-hidden />
          </button>
        </div>
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
        <div className="header">
          <div className="title-section">
            <div className="avatar-box bg-indigo-500">
              <FaRegComments style={{ fontSize: '24px' }} />
            </div>
            <div>
              <h2 className="title-chat">Проектный чат</h2>
              <p className="subtitle">
                Обсуждение проекта:{' '}
                <button
                  type="button"
                  className="subtitle__project-link"
                  onClick={handleOpenProject}
                  title="Открыть проект"
                >
                  {title}
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className="messages" ref={messagesEndRef}>
          {messages.map((msg) => {
            const isCurrentUser = userId && msg.user_id === userId
            const initials = getInitials(msg.first_name, msg.last_name)
            const colorClass = getColorClassById(msg.user_id)

            return (
              <div
                key={msg.id}
                ref={(el) => (messageRefs.current[msg.id] = el)}
                className={`message ${isCurrentUser ? 'self' : 'other'} ${
                  replyingTo?.id === msg.id ? 'selected-message' : ''
                }`}
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

        <div className="input-area">
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
            <div className="input-wrapper">
              <textarea
                ref={textareaRef}
                placeholder="Напишите сообщение..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.ctrlKey) {
                      e.preventDefault()
                      setInputText((prev) => prev + '\n')
                    } else if (!e.ctrlKey && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }
                }}
                rows={2}
                style={{ resize: 'none', whiteSpace: 'pre-wrap' }}
              />

              {showEmojiPicker && (
                <div className="emoji-picker-container">
                  <EmojiPicker onEmojiClick={onEmojiClick} />
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
