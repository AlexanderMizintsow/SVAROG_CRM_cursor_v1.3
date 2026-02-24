import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import './ReplyToThreadModal.scss'

function decodeUtf8FileName(name) {
  if (!name || typeof name !== 'string') return name
  if (/[\u0400-\u04FF]/.test(name)) return name
  try {
    const bytes = [...name].map((c) => c.charCodeAt(0) & 0xff)
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
  } catch (_) {}
  return name
}

export default function ReplyToThreadModal({
  open,
  onClose,
  globalTaskId,
  solutionId,
  toEmail,
  inReplyToMessageId,
  projectTitle,
  userId,
  onSent,
}) {
  const [body, setBody] = useState('')
  const [customFiles, setCustomFiles] = useState([])
  const [projectAttachments, setProjectAttachments] = useState([])
  const [selectedAttachmentIndices, setSelectedAttachmentIndices] = useState(new Set())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    if (!open) return
    setBody('')
    setCustomFiles([])
    setSelectedAttachmentIndices(new Set())
    setError('')
    setTo(toEmail || '')
  }, [open, toEmail])

  useEffect(() => {
    if (!open || !globalTaskId) return
    let cancelled = false
    axios
      .get(`${API_BASE_URL}5000/api/tasks/${globalTaskId}/attachments`)
      .then((res) => {
        if (!cancelled && res.data?.attachments) {
          setProjectAttachments(Array.isArray(res.data.attachments) ? res.data.attachments : [])
        }
      })
      .catch(() => { if (!cancelled) setProjectAttachments([]) })
    return () => { cancelled = true }
  }, [open, globalTaskId])

  const addCustomFiles = (e) => {
    const files = e.target.files
    if (!files?.length) return
    setCustomFiles((prev) => [...prev, ...Array.from(files)])
  }
  const removeCustomFile = (i) => setCustomFiles((prev) => prev.filter((_, j) => j !== i))
  const toggleProjectAttachment = (i) => {
    setSelectedAttachmentIndices((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const handleSend = async () => {
    const toAddr = (to || '').trim()
    if (!toAddr) {
      setError('Укажите адрес получателя (Кому).')
      return
    }
    if (!body.trim()) {
      setError('Введите текст письма.')
      return
    }
    if (!userId) {
      setError('Не указан пользователь.')
      return
    }
    setSending(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('userId', userId)
      formData.append('to', toAddr)
      formData.append('subject', projectTitle ? `Re: ${projectTitle}` : 'Ответ')
      formData.append('body', body.trim())
      formData.append('globalTaskId', globalTaskId)
      formData.append('finalSolutionId', solutionId)
      if (inReplyToMessageId) formData.append('inReplyTo', inReplyToMessageId)

      const selected = projectAttachments.filter((_, i) => selectedAttachmentIndices.has(i))
      for (let i = 0; i < selected.length; i++) {
        const att = selected[i]
        const fileUrl = `${API_BASE_URL}5000/api/task${att.file_url}`
        const response = await fetch(fileUrl)
        const blob = await response.blob()
        const name = decodeUtf8FileName(att.name_file) || att.name_file || `file-${i}`
        const file = new File([blob], name, { type: blob.type || 'application/octet-stream' })
        formData.append('attachments', file)
      }
      customFiles.forEach((f) => formData.append('attachments', f))

      const res = await axios.post(`${API_BASE_URL}5001/send-email`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const messageId = res.data?.messageId
      if (messageId) {
        await axios.post(
          `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/final-solutions/${solutionId}/thread-message`,
          { userId, body: body.trim(), message_id: messageId }
        )
      }
      onSent?.()
      onClose()
    } catch (err) {
      console.error(err)
      setError(err.response?.data || err.message || 'Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="reply-to-thread-overlay" onClick={onClose}>
      <div className="reply-to-thread-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reply-to-thread-modal__header">
          <h3>Ответить на письмо</h3>
          <button type="button" className="reply-to-thread-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="reply-to-thread-modal__body">
          <div className="reply-to-thread-modal__field">
            <label>Кому:</label>
            <input
              type="text"
              className="reply-to-thread-modal__input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div className="reply-to-thread-modal__field">
            <label>Текст ответа:</label>
            <textarea
              className="reply-to-thread-modal__textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Введите сообщение..."
            />
          </div>
          <div className="reply-to-thread-modal__attachments">
            <label>Документы проекта (отметьте для прикрепления):</label>
            {projectAttachments.length === 0 ? (
              <p className="reply-to-thread-modal__hint">Нет документов по проекту.</p>
            ) : (
              <ul className="reply-to-thread-modal__list">
                {projectAttachments.map((att, i) => (
                  <li key={i}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedAttachmentIndices.has(i)}
                        onChange={() => toggleProjectAttachment(i)}
                      />
                      {att.name_file || att.file_url || `Файл ${i + 1}`}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="reply-to-thread-modal__custom">
            <label>Свои файлы:</label>
            <input type="file" multiple onChange={addCustomFiles} className="reply-to-thread-modal__file-input" />
            {customFiles.length > 0 && (
              <ul className="reply-to-thread-modal__list">
                {customFiles.map((f, i) => (
                  <li key={i}>
                    <span>{f.name}</span>
                    <button type="button" className="reply-to-thread-modal__remove-file" onClick={() => removeCustomFile(i)}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && <div className="reply-to-thread-modal__error">{error}</div>}
          <div className="reply-to-thread-modal__actions">
            <button type="button" className="reply-to-thread-modal__btn-cancel" onClick={onClose}>Отмена</button>
            <button type="button" className="reply-to-thread-modal__btn-send" onClick={handleSend} disabled={sending}>
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
