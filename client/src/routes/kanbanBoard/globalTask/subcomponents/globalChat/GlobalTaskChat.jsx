import React, { useState, useRef, useEffect, useCallback } from 'react'
import EmojiPicker from 'emoji-picker-react'
import { FaRegPaperPlane, FaPen, FaTrash } from 'react-icons/fa'
import { FaRegComments } from 'react-icons/fa6'
import UserStore from '../../../../../store/userStore'
import './GlobalTaskChat.scss'
import { MdClose, MdReply } from 'react-icons/md'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../../config'
import useTasksManageStore from '../../../../../store/useTasksManageStore'
import useTaskStateTracker from '../../../../../store/useTaskStateTracker'
import KnowledgeLinkPicker from '../../../../knowledgeBase/KnowledgeLinkPicker'
import { buildKnowledgePlainMarker } from '../../../../knowledgeBase/knowledgeLinkUtils'
import { makeChatKnowledgeRenderer } from '../../../../knowledgeBase/chatKnowledgeText'

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
  const [kbLinkPickerOpen, setKbLinkPickerOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [messagePendingDelete, setMessagePendingDelete] = useState(null)
  const [deletingMessage, setDeletingMessage] = useState(false)
  const messageRefs = useRef({})
  const pendingComposerCaretRef = useRef(null)

  const userId = user ? user.id : null
  const renderKbText = useCallback(makeChatKnowledgeRenderer(userId), [userId])

  useEffect(() => {
    globalTaskIdRef.current = globalTaskId
  }, [globalTaskId])

  const applyChatMessageUpdate = useCallback((updated) => {
    if (!updated?.id) return
    setMessages((prev) =>
      prev.map((msg) => {
        if (Number(msg.id) === Number(updated.id)) {
          return { ...msg, ...updated }
        }
        return msg
      })
    )
    setEditingMessageId((prev) =>
      Number(prev) === Number(updated.id) ? null : prev
    )

    const cacheKey = String(globalTaskIdRef.current ?? '')
    if (!cacheKey) return
    const store = useTasksManageStore.getState()
    const cached = store.messagesGlobalTaskById[cacheKey]
    if (!Array.isArray(cached)) return
    useTasksManageStore.setState({
      messagesGlobalTaskById: {
        ...store.messagesGlobalTaskById,
        [cacheKey]: cached.map((msg) =>
          Number(msg.id) === Number(updated.id) ? { ...msg, ...updated } : msg
        ),
      },
    })
  }, [])

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
    setEditingMessageId(null)
    setEditDraft('')
    setMessagePendingDelete(null)

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
    if (message?.is_deleted) return
    setReplyingTo(message)
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  const cancelReply = () => {
    setReplyingTo(null)
  }

  const startEditMessage = (message) => {
    if (!message || message.is_deleted) return
    if (Number(message.user_id) !== Number(userId)) return
    setEditingMessageId(message.id)
    setEditDraft(message.text || '')
  }

  const cancelEditMessage = () => {
    setEditingMessageId(null)
    setEditDraft('')
  }

  const saveEditMessage = async () => {
    if (!editingMessageId) return
    const nextText = String(editDraft || '').trim()
    if (!nextText) return
    const activeGlobalTaskId = globalTaskIdRef.current
    if (activeGlobalTaskId == null || activeGlobalTaskId === '') return

    setSavingEdit(true)
    try {
      const response = await axios.patch(
        `${API_BASE_URL}5000/api/global-tasks/chat/${activeGlobalTaskId}/${editingMessageId}`,
        {
          text: nextText,
          userId,
        }
      )
      applyChatMessageUpdate(response.data)
      cancelEditMessage()
    } catch (error) {
      console.error('Ошибка при редактировании сообщения проекта:', error)
      alert(error.response?.data?.error || 'Не удалось сохранить изменения')
    } finally {
      setSavingEdit(false)
    }
  }

  const requestDeleteMessage = (message) => {
    if (!message || message.is_deleted) return
    if (Number(message.user_id) !== Number(userId)) return
    setMessagePendingDelete(message)
  }

  const cancelDeleteMessage = () => {
    if (deletingMessage) return
    setMessagePendingDelete(null)
  }

  const confirmDeleteMessage = async () => {
    const message = messagePendingDelete
    if (!message || message.is_deleted) return
    if (Number(message.user_id) !== Number(userId)) return

    const activeGlobalTaskId = globalTaskIdRef.current
    if (activeGlobalTaskId == null || activeGlobalTaskId === '') return

    setDeletingMessage(true)
    try {
      const response = await axios.delete(
        `${API_BASE_URL}5000/api/global-tasks/chat/${activeGlobalTaskId}/${message.id}`,
        {
          data: { userId },
        }
      )
      applyChatMessageUpdate(response.data)
      setMessagePendingDelete(null)
    } catch (error) {
      console.error('Ошибка при удалении сообщения проекта:', error)
      alert(error.response?.data?.error || 'Не удалось удалить сообщение')
    } finally {
      setDeletingMessage(false)
    }
  }

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // После Ctrl/Alt+Enter React обновляет value, но не прокручивает textarea к курсору
  const insertNewlineInComposer = useCallback(() => {
    const el = textareaRef.current
    const value = inputText
    const start =
      el && typeof el.selectionStart === 'number' ? el.selectionStart : value.length
    const end =
      el && typeof el.selectionEnd === 'number' ? el.selectionEnd : start
    const next = `${value.slice(0, start)}\n${value.slice(end)}`
    pendingComposerCaretRef.current = start + 1
    setInputText(next)
  }, [inputText])

  useEffect(() => {
    const caret = pendingComposerCaretRef.current
    if (caret == null) return
    pendingComposerCaretRef.current = null
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(caret, caret)
    ta.scrollTop = ta.scrollHeight
  }, [inputText])

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
    const isDeleted = msg.is_deleted === true
    const isEditing = Number(editingMessageId) === Number(msg.id)
    const repliedToMessage = messages.find((m) => m.id === msg.replied_to_message_id)

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
            <div className="reply-text">
              {repliedToMessage.is_deleted
                ? 'Сообщение удалено'
                : repliedToMessage.text}
            </div>
          </div>
        )}
        {!isCurrentUser && (
          <div className="author-info">
            {msg.first_name} {msg.last_name}
          </div>
        )}
        {isEditing ? (
          <div className="message-edit-box">
            <textarea
              className="message-edit-input"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={3}
            />
            <div className="message-edit-actions">
              <button
                type="button"
                className="message-edit-cancel"
                onClick={cancelEditMessage}
                disabled={savingEdit}
              >
                Отмена
              </button>
              <button
                type="button"
                className="message-edit-save"
                onClick={saveEditMessage}
                disabled={savingEdit || !String(editDraft || '').trim()}
              >
                {savingEdit ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`text-bubble ${isCurrentUser ? 'self' : 'other'} ${
                isDeleted ? 'text-bubble--deleted' : ''
              }`}
            >
              {isDeleted ? 'Сообщение удалено' : renderKbText(msg.text)}
            </div>
            {!isDeleted && msg.edited_at ? (
              <div className="message-edited-label">редактировано</div>
            ) : null}
          </>
        )}
        <div className="message-footer">
          <span className="timestamp">{formatTimestamp(msg.timestamp)}</span>
          {!isDeleted && (
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
          )}
          {isCurrentUser && !isDeleted && (
            <>
              <button
                type="button"
                className="message-edit-btn"
                title="Редактировать"
                aria-label="Редактировать сообщение"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation()
                  startEditMessage(msg)
                }}
              >
                <FaPen aria-hidden />
              </button>
              <button
                type="button"
                className="message-delete-btn"
                title="Удалить"
                aria-label="Удалить сообщение"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation()
                  requestDeleteMessage(msg)
                }}
              >
                <FaTrash aria-hidden />
              </button>
            </>
          )}
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
            const isCurrentUser = userId && Number(msg.user_id) === Number(userId)
            const initials = getInitials(msg.first_name, msg.last_name)
            const colorClass = getColorClassById(msg.user_id)

            return (
              <div
                key={msg.id}
                ref={(el) => (messageRefs.current[msg.id] = el)}
                className={`message ${isCurrentUser ? 'self' : 'other'} ${
                  replyingTo?.id === msg.id ? 'selected-message' : ''
                } ${msg.is_deleted ? 'deleted' : ''}`}
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
                <span className="reply-text">
                  {replyingTo.is_deleted ? 'Сообщение удалено' : replyingTo.text}
                </span>
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
                    if (e.ctrlKey || e.altKey) {
                      e.preventDefault()
                      insertNewlineInComposer()
                    } else if (!e.shiftKey) {
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
              type="button"
              title="Ссылка на базу знаний"
              onClick={() => setKbLinkPickerOpen(true)}
            >
              📚
            </button>
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

        <KnowledgeLinkPicker
          open={kbLinkPickerOpen}
          userId={userId}
          onClose={() => setKbLinkPickerOpen(false)}
          onPick={(item) => {
            const chunk =
              buildKnowledgePlainMarker({
                documentId: item.documentId,
                fileId: item.fileId,
                label: item.label,
              }) || item.href
            if (!chunk) return
            setInputText((prev) => (prev ? `${prev.trim()} ${chunk}` : chunk))
          }}
        />

        {messagePendingDelete ? (
          <div className="chat-confirm-overlay" role="presentation" onClick={cancelDeleteMessage}>
            <div
              className="chat-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="project-chat-delete-confirm-title"
              onClick={(e) => e.stopPropagation()}
            >
              <p id="project-chat-delete-confirm-title" className="chat-confirm-title">
                Удалить это сообщение?
              </p>
              <p className="chat-confirm-text">
                Сообщение останется в чате как удалённое.
              </p>
              <div className="chat-confirm-actions">
                <button
                  type="button"
                  className="chat-confirm-cancel"
                  onClick={cancelDeleteMessage}
                  disabled={deletingMessage}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="chat-confirm-delete"
                  onClick={confirmDeleteMessage}
                  disabled={deletingMessage}
                >
                  {deletingMessage ? 'Удаление…' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default GlobalTaskChat
