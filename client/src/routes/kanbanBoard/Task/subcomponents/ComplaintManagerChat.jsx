import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { COMPLAINT_MANAGER_CHAT_SECRET, MOBILE_APP_BASE_URL } from '../../../../../config'
import './ComplaintManagerChat.scss'

const managerChatHeaders = (managerUserId) => ({
  'X-Complaint-Chat-Secret': COMPLAINT_MANAGER_CHAT_SECRET,
  'X-Manager-User-Id': String(managerUserId),
})

const buildWsUrl = () => {
  try {
    const u = new URL(MOBILE_APP_BASE_URL)
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${u.host}/ws/complaint-chat`
  } catch {
    return 'ws://localhost:5011/ws/complaint-chat'
  }
}

const toAbsoluteMediaUrl = (path) => {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const base = String(MOBILE_APP_BASE_URL || '').replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

const ComplaintManagerChat = ({ reminderId, managerUserId, isActiveManager }) => {
  const [thread, setThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)
  const wsRef = useRef(null)
  const listRef = useRef(null)

  const base = String(MOBILE_APP_BASE_URL || '').replace(/\/$/, '')
  const secretOk = Boolean(String(COMPLAINT_MANAGER_CHAT_SECRET || '').trim())
  const canCompose =
    isActiveManager &&
    secretOk &&
    thread &&
    !thread.rejectedAt &&
    thread.canWrite !== false

  const loadThreadAndMessages = useCallback(async () => {
    if (!reminderId || !managerUserId || !secretOk) {
      setLoading(false)
      return
    }
    setError('')
    setLoading(true)
    try {
      const tRes = await axios.get(`${base}/api/mobile/complaints/manager-chat/reminder/${reminderId}/thread`, {
        headers: managerChatHeaders(managerUserId),
      })
      const t = tRes.data?.thread
      if (!t?.threadId) {
        setThread(null)
        setMessages([])
        setError('Чат по этой рекламации ещё не создан (ожидается отправка мастера с приложения).')
        return
      }
      setThread(t)
      const mRes = await axios.get(
        `${base}/api/mobile/complaints/manager-chat/thread/${t.threadId}/messages?afterId=0`,
        { headers: managerChatHeaders(managerUserId) }
      )
      setMessages(Array.isArray(mRes.data?.messages) ? mRes.data.messages : [])
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Не удалось загрузить чат'
      setError(msg)
      setThread(null)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [base, managerUserId, reminderId, secretOk])

  useEffect(() => {
    void loadThreadAndMessages()
  }, [loadThreadAndMessages])

  useEffect(() => {
    if (!thread?.threadId || !secretOk || !managerUserId || !reminderId) return undefined

    const ws = new WebSocket(buildWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'auth_manager',
          secret: COMPLAINT_MANAGER_CHAT_SECRET,
          managerUserId,
          reminderId,
        })
      )
    }

    ws.onmessage = (ev) => {
      let data
      try {
        data = JSON.parse(ev.data)
      } catch {
        return
      }
      if (data.type === 'auth_ok') return
      if (data.type === 'complaint_chat_message' && Number(data.threadId) === Number(thread.threadId)) {
        const payload = data.payload
        if (payload?.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.id)) return prev
            return [...prev, payload]
          })
        }
      }
      if (data.type === 'complaint_chat_rejected' && Number(data.threadId) === Number(thread.threadId)) {
        setThread((prev) =>
          prev
            ? {
                ...prev,
                rejectedAt: new Date().toISOString(),
                rejectionReason: data.payload?.reason || prev.rejectionReason,
                canWrite: false,
              }
            : prev
        )
      }
    }

    return () => {
      try {
        ws.close()
      } catch {
        /* noop */
      }
      wsRef.current = null
    }
  }, [thread?.threadId, managerUserId, reminderId, secretOk])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

  const handleSend = async () => {
    if (!thread?.threadId || !canCompose || sending) return
    const trimmed = text.trim()
    if (!trimmed && !files.length) return
    setSending(true)
    setError('')
    try {
      const form = new FormData()
      if (trimmed) form.append('body', trimmed)
      files.forEach((f) => form.append('images', f))
      await axios.post(
        `${base}/api/mobile/complaints/manager-chat/thread/${thread.threadId}/messages`,
        form,
        {
          headers: {
            ...managerChatHeaders(managerUserId),
          },
        }
      )
      setText('')
      setFiles([])
      await loadThreadAndMessages()
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Не удалось отправить'
      setError(msg)
    } finally {
      setSending(false)
    }
  }

  const handleReject = async () => {
    const reason = rejectReason.trim()
    if (!reason || rejectBusy) return
    setRejectBusy(true)
    setError('')
    try {
      await axios.post(
        `${base}/api/mobile/complaints/manager-chat/reminder/${reminderId}/reject`,
        { reason },
        { headers: { ...managerChatHeaders(managerUserId), 'Content-Type': 'application/json' } }
      )
      setRejectOpen(false)
      setRejectReason('')
      await loadThreadAndMessages()
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Не удалось отклонить'
      setError(msg)
    } finally {
      setRejectBusy(false)
    }
  }

  const handleConvertStub = async () => {
    setError('')
    try {
      await axios.post(
        `${base}/api/mobile/complaints/manager-chat/reminder/${reminderId}/convert-task`,
        {},
        { headers: { ...managerChatHeaders(managerUserId), 'Content-Type': 'application/json' } }
      )
    } catch (e) {
      const status = e?.response?.status
      if (status === 501) {
        setError('Перевод в задачу пока не реализован.')
        return
      }
      const msg = e?.response?.data?.message || e?.message || 'Запрос не выполнен'
      setError(msg)
    }
  }

  if (!isActiveManager) {
    return null
  }

  if (!secretOk) {
    return (
      <div className="complaint-manager-chat complaint-manager-chat--hint">
        Чат по рекламации: задайте в сборке CRM переменную <code>VITE_COMPLAINT_MANAGER_CHAT_SECRET</code> (как в
        mobile_app <code>COMPLAINT_MANAGER_CHAT_SECRET</code>).
      </div>
    )
  }

  if (loading) {
    return <div className="complaint-manager-chat complaint-manager-chat--hint">Загрузка чата…</div>
  }

  return (
    <div className="complaint-manager-chat">
      <div className="complaint-manager-chat__title">Чат по рекламации (mobile)</div>
      {error ? <div className="complaint-manager-chat__error">{error}</div> : null}

      {thread?.rejectedAt ? (
        <div className="complaint-manager-chat__banner">
          Отклонено
          {thread.rejectionReason ? `: ${thread.rejectionReason}` : ''}. Чат только для чтения.
        </div>
      ) : null}

      {!thread?.openedAt && thread && !thread.rejectedAt ? (
        <div className="complaint-manager-chat__hint">
          Отправьте первое сообщение — после этого дилер сможет отвечать.
        </div>
      ) : null}

      <div className="complaint-manager-chat__messages" ref={listRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`complaint-manager-chat__msg complaint-manager-chat__msg--${m.authorRole || 'unknown'}`}
          >
            <div className="complaint-manager-chat__msg-role">
              {m.authorRole === 'manager' ? 'Менеджер' : 'Дилер'}
            </div>
            {m.body ? <div className="complaint-manager-chat__msg-body">{m.body}</div> : null}
            {Array.isArray(m.images) && m.images.length > 0 ? (
              <div className="complaint-manager-chat__msg-images">
                {m.images.map((img) => (
                  <a
                    key={img.id}
                    href={toAbsoluteMediaUrl(img.fileUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="complaint-manager-chat__img-link"
                  >
                    <img src={toAbsoluteMediaUrl(img.fileUrl)} alt="" className="complaint-manager-chat__thumb" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {canCompose ? (
        <div className="complaint-manager-chat__composer">
          <textarea
            className="complaint-manager-chat__input"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Текст сообщения…"
          />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="complaint-manager-chat__file"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length > 0 ? (
            <div className="complaint-manager-chat__files-note">{files.map((f) => f.name).join(', ')}</div>
          ) : null}
          <button type="button" className="complaint-manager-chat__btn" disabled={sending} onClick={handleSend}>
            {sending ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      ) : null}

      {isActiveManager && thread && !thread.rejectedAt ? (
        <div className="complaint-manager-chat__actions">
          <button type="button" className="complaint-manager-chat__btn-secondary" onClick={() => setRejectOpen(true)}>
            Отклонить обращение…
          </button>
          <button type="button" className="complaint-manager-chat__btn-secondary" onClick={handleConvertStub}>
            Перевести в задачу
          </button>
        </div>
      ) : null}

      {rejectOpen ? (
        <div className="complaint-manager-chat__modal-backdrop" role="presentation" onClick={() => !rejectBusy && setRejectOpen(false)}>
          <div
            className="complaint-manager-chat__modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="complaint-manager-chat__modal-title">Отклонить обращение</div>
            <p className="complaint-manager-chat__modal-text">
              Укажите причину — напоминание будет завершено, дилер увидит статус «Отклонено», чат станет только для
              чтения.
            </p>
            <textarea
              className="complaint-manager-chat__input"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Причина отклонения (обязательно)"
            />
            <div className="complaint-manager-chat__modal-buttons">
              <button type="button" className="complaint-manager-chat__btn-secondary" disabled={rejectBusy} onClick={() => setRejectOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="complaint-manager-chat__btn danger"
                disabled={rejectBusy || !rejectReason.trim()}
                onClick={handleReject}
              >
                {rejectBusy ? '…' : 'Отклонить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ComplaintManagerChat
