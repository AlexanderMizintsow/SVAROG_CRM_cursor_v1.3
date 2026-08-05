import { useCallback, useEffect, useRef, useState } from 'react'
import { managerRequestsApi } from './managerRequestsApi'

const formatDate = (value) => {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * Чат уточнений по обращению (автор ↔ директор).
 */
const ManagerRequestChat = ({ userId, requestId, canWrite, onError }) => {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const load = useCallback(async () => {
    if (!userId || !requestId) return
    setLoading(true)
    try {
      const list = await managerRequestsApi.listMessages(userId, requestId)
      setMessages(list)
    } catch (err) {
      if (onError) onError(err?.response?.data?.error || 'Не удалось загрузить чат')
    } finally {
      setLoading(false)
    }
  }, [userId, requestId, onError])

  useEffect(() => {
    load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!text.trim() || !canWrite || sending) return
    setSending(true)
    try {
      const created = await managerRequestsApi.postMessage(userId, requestId, text.trim())
      setMessages((prev) => [...prev, created])
      setText('')
    } catch (err) {
      if (onError) onError(err?.response?.data?.error || 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mgr-req__chat">
      <div className="mgr-req__label">Чат уточнений</div>
      <div className="mgr-req__chat-list">
        {loading && messages.length === 0 ? (
          <div className="mgr-req__empty">Загрузка чата…</div>
        ) : null}
        {!loading && messages.length === 0 ? (
          <div className="mgr-req__empty">Пока нет сообщений — можно уточнить детали</div>
        ) : null}
        {messages.map((msg) => {
          const mine = Number(msg.authorId) === Number(userId)
          return (
            <div
              key={msg.id}
              className={`mgr-req__chat-bubble ${mine ? 'is-mine' : 'is-theirs'}`}
            >
              <div className="mgr-req__chat-meta">
                {msg.authorName || (mine ? 'Вы' : 'Собеседник')}
                {msg.createdAt ? ` · ${formatDate(msg.createdAt)}` : ''}
              </div>
              <div className="mgr-req__chat-body">{msg.body}</div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      {canWrite ? (
        <form className="mgr-req__chat-form" onSubmit={handleSend}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Уточняющий вопрос или комментарий…"
          />
          <button
            type="submit"
            className="mgr-req__btn mgr-req__btn--primary"
            disabled={sending || !text.trim()}
          >
            {sending ? 'Отправка…' : 'Отправить'}
          </button>
        </form>
      ) : (
        <p className="mgr-req__muted">Чат закрыт — обращение завершено</p>
      )}
    </div>
  )
}

export default ManagerRequestChat
