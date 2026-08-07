import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import './SendProjectMailModal.scss'

function appendSignature(bodyText, signature) {
  if (!signature || (!signature.text && !signature.imageDataUrl)) return bodyText
  const parts = [bodyText]
  if (signature.imageDataUrl) parts.push('-- (рисунок)')
  if (signature.text) parts.push(signature.text)
  return parts.join('\n\n')
}

function appendSignatureHtml(bodyText, signature) {
  if (!signature || (!signature.text && !signature.imageDataUrl)) return null
  const bodyHtml = bodyText.replace(/\n/g, '<br>')
  const sigParts = []
  if (signature.imageDataUrl) {
    sigParts.push(`<img src="${signature.imageDataUrl}" alt="" style="max-width:200px;display:block;margin:0 0 0.25em 0;" />`)
  }
  if (signature.text) {
    sigParts.push(signature.text.replace(/\n/g, '<br>'))
  }
  const sigHtml = sigParts.join('<br>')
  return bodyHtml + '<br><br>' + sigHtml
}

const CATEGORY_SUPPLIERS = 'suppliers'
const CATEGORY_EMPLOYEES = 'employees'
const CATEGORY_DEALERS = 'dealers'

function sortRecipientsByName(list) {
  return [...(list || [])].sort((a, b) => {
    const nameCmp = String(a.name || '').localeCompare(String(b.name || ''), 'ru', {
      sensitivity: 'base',
      numeric: true,
    })
    if (nameCmp !== 0) return nameCmp
    return String(a.email || '').localeCompare(String(b.email || ''), 'ru', {
      sensitivity: 'base',
    })
  })
}

// Восстановление имени файла из mojibake (UTF-8, ошибочно прочитанный как Latin-1)
function decodeUtf8FileName(name) {
  if (!name || typeof name !== 'string') return name
  if (/[\u0400-\u04FF]/.test(name)) return name
  try {
    const bytes = [...name].map((c) => c.charCodeAt(0) & 0xff)
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
  } catch {
    /* ignore decode error */
  }
  return name
}

function buildBody(task, includeAdditionalInfo = false) {
  const parts = []
  if (task.description) parts.push(task.description)
  if (includeAdditionalInfo && task.additional_info && Object.keys(task.additional_info).length > 0) {
    parts.push(
      'Доп. информация:\n' +
        Object.entries(task.additional_info)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
    )
  }
  return parts.join('\n\n') || 'Нет описания.'
}

function SendProjectMailModal({ open, onClose, task, attachments: attachmentsProp, userId, onRefresh }) {
  const [category, setCategory] = useState(CATEGORY_SUPPLIERS)
  const [recipients, setRecipients] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectedAttachmentIndices, setSelectedAttachmentIndices] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [attachmentsFetched, setAttachmentsFetched] = useState([])
  const [includeAdditionalInfo, setIncludeAdditionalInfo] = useState(false)
  const [bodyText, setBodyText] = useState('')
  const [customFiles, setCustomFiles] = useState([])
  const [signature, setSignature] = useState(null)

  const attachmentList =
    open && task?.id && attachmentsFetched.length > 0
      ? attachmentsFetched
      : (Array.isArray(attachmentsProp) ? attachmentsProp : [])

  useEffect(() => {
    if (!open) return
    setError('')
    setRecipients([])
    setSelectedIds(new Set())
    setSelectedAttachmentIndices(new Set())
    setCategory(CATEGORY_SUPPLIERS)
    setAttachmentsFetched([])
    setCustomFiles([])
    setBodyText('')
  }, [open])

  useEffect(() => {
    if (open && task) {
      const initial = buildBody(task, includeAdditionalInfo)
      setBodyText(initial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- task?.id intentionally used to avoid reset on task ref change
  }, [open, task?.id, includeAdditionalInfo])

  useEffect(() => {
    if (open && userId) {
      axios
        .get(`${API_BASE_URL}5000/api/users/${userId}/email-signature`)
        .then((res) => setSignature(res.data || null))
        .catch(() => setSignature(null))
    } else {
      setSignature(null)
    }
  }, [open, userId])

  useEffect(() => {
    if (!open || !task?.id) return
    let cancelled = false
    axios
      .get(`${API_BASE_URL}5000/api/tasks/${task.id}/attachments`)
      .then((res) => {
        if (!cancelled && res.data?.attachments) {
          setAttachmentsFetched(Array.isArray(res.data.attachments) ? res.data.attachments : [])
        }
      })
      .catch(() => {
        if (!cancelled) setAttachmentsFetched([])
      })
    return () => { cancelled = true }
  }, [open, task?.id])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSelectedIds(new Set())
    const load = async () => {
      try {
        if (category === CATEGORY_SUPPLIERS) {
          const res = await axios.get(`${API_BASE_URL}5003/api/suppliers`)
          const list = Array.isArray(res.data) ? res.data : []
          setRecipients(
            sortRecipientsByName(
              list.flatMap((s) => {
                const emails = Array.isArray(s.emails) ? s.emails : []
                return emails
                  .filter((e) => String(e).trim())
                  .map((email) => ({
                    id: `s-${s.id}-${email}`,
                    name: s.name,
                    email,
                    category: CATEGORY_SUPPLIERS,
                  }))
              })
            )
          )
        } else if (category === CATEGORY_EMPLOYEES) {
          const res = await axios.get(`${API_BASE_URL}5000/api/users`)
          const list = Array.isArray(res.data) ? res.data : []
          setRecipients(
            sortRecipientsByName(
              list
                .filter((u) => u.email)
                .map((u) => ({
                  id: `u-${u.id}`,
                  name: `${u.last_name || ''} ${u.first_name || ''}`.trim() || u.username,
                  email: u.email,
                  category: CATEGORY_EMPLOYEES,
                }))
            )
          )
        } else {
          const res = await axios.get(`${API_BASE_URL}5003/api/companies`)
          const list = Array.isArray(res.data) ? res.data : []
          setRecipients(
            sortRecipientsByName(
              list
                .filter((c) => c.email)
                .flatMap((c) => {
                  const name = c.company_name || c.name_companies || c.name || ''
                  const emails =
                    typeof c.email === 'string'
                      ? c.email.split(',').map((e) => e.trim()).filter(Boolean)
                      : []
                  const cid = c.company_id != null ? c.company_id : c.id
                  return emails.map((email, i) => ({
                    id: `c-${cid}-${i}-${email}`,
                    name,
                    email,
                    category: CATEGORY_DEALERS,
                  }))
                })
            )
          )
        }
      } catch (err) {
        console.error(err)
        setError('Не удалось загрузить список получателей')
        setRecipients([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, category])

  const toggleRecipient = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAttachment = (index) => {
    setSelectedAttachmentIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const selectedRecipients = recipients.filter((r) => selectedIds.has(r.id))
  const toEmails = [...new Set(selectedRecipients.map((r) => r.email))].filter(Boolean)
  const baseBody = (bodyText !== undefined && bodyText !== '') ? bodyText : (task ? buildBody(task, includeAdditionalInfo) : '')
  const body = appendSignature(baseBody, signature)
  const bodyHtml = appendSignatureHtml(baseBody, signature) ?? (baseBody.replace(/\n/g, '<br>'))
  const subject = task?.title ? task.title : 'Письмо'

  const addCustomFiles = (e) => {
    const files = e.target.files
    if (!files?.length) return
    setCustomFiles((prev) => [...prev, ...Array.from(files)])
  }
  const removeCustomFile = (index) => {
    setCustomFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSend = async () => {
    if (!userId || !task) return
    if (toEmails.length === 0) {
      setError('Выберите хотя бы одного получателя.')
      return
    }
    setSending(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('userId', userId)
      formData.append('to', toEmails.join(', '))
      formData.append('subject', subject)
      formData.append('body', body)
      formData.append('bodyHtml', bodyHtml)
      if (task?.id) formData.append('globalTaskId', task.id)

      const selectedAttachments = attachmentList.filter((_, i) => selectedAttachmentIndices.has(i))
      for (let i = 0; i < selectedAttachments.length; i++) {
        const att = selectedAttachments[i]
        const fileUrl = `${API_BASE_URL}5000/api/task${att.file_url}`
        const response = await fetch(fileUrl)
        const blob = await response.blob()
        const rawName = att.name_file || `file-${i}`
        const fileName = decodeUtf8FileName(rawName) || rawName
        const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' })
        formData.append('attachments', file)
      }
      for (let i = 0; i < customFiles.length; i++) {
        formData.append('attachments', customFiles[i])
      }

      const res = await axios.post(`${API_BASE_URL}5001/send-email`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const messageId = res.data?.messageId
      if (messageId && task?.id) {
        try {
          await axios.post(
            `${API_BASE_URL}5000/api/global-tasks/${task.id}/first-sent-email`,
            { userId, body: body.trim(), message_id: messageId }
          )
          onRefresh?.(task.id)
        } catch (err) {
          console.error('Ошибка сохранения первого письма в переписку:', err)
        }
      }
      onClose()
    } catch (err) {
      console.error(err)
      setError(err.response?.data || err.message || 'Ошибка отправки письма')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="send-project-mail-overlay">
      <div className="send-project-mail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="send-project-mail-modal__header">
          <h3>Отправить описание проекта на почту</h3>
          <button type="button" className="send-project-mail-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="send-project-mail-modal__body">
          <div className="send-project-mail-modal__category">
            <label>Категория получателей:</label>
            <div className="send-project-mail-modal__radios">
              <label>
                <input
                  type="radio"
                  name="category"
                  checked={category === CATEGORY_SUPPLIERS}
                  onChange={() => setCategory(CATEGORY_SUPPLIERS)}
                />
                Поставщики
              </label>
              <label>
                <input
                  type="radio"
                  name="category"
                  checked={category === CATEGORY_EMPLOYEES}
                  onChange={() => setCategory(CATEGORY_EMPLOYEES)}
                />
                Сотрудники
              </label>
              <label>
                <input
                  type="radio"
                  name="category"
                  checked={category === CATEGORY_DEALERS}
                  onChange={() => setCategory(CATEGORY_DEALERS)}
                />
                Дилеры
              </label>
            </div>
          </div>

          <div className="send-project-mail-modal__recipients">
            <label>Получатели (отмеченные будут в поле «Кому»):</label>
            {loading ? (
              <p>Загрузка...</p>
            ) : (
              <ul className="send-project-mail-modal__list">
                {recipients.map((r) => (
                  <li key={r.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleRecipient(r.id)}
                      />
                      <span>{r.name}</span> — <span className="email">{r.email}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {!loading && recipients.length === 0 && !error && <p>Нет получателей в выбранной категории.</p>}
          </div>

          <div className="send-project-mail-modal__body-edit">
            <label>Текст письма (можно отредактировать):{signature && (signature.text || signature.imageDataUrl) && <span className="send-project-mail-modal__signature-hint"> Подпись будет добавлена в конец.</span>}</label>
            <textarea
              className="send-project-mail-modal__textarea"
              value={baseBody}
              onChange={(e) => setBodyText(e.target.value)}
              rows={8}
              placeholder="Описание и доп. информация"
            />
          </div>

          <div className="send-project-mail-modal__attachments">
            <label>Вложения проекта (отметьте, что приложить к письму):</label>
            {attachmentList.length === 0 ? (
              <p>Нет сохранённых документов по проекту.</p>
            ) : (
              <ul className="send-project-mail-modal__list">
                {attachmentList.map((att, index) => (
                  <li key={index}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedAttachmentIndices.has(index)}
                        onChange={() => toggleAttachment(index)}
                      />
                      {att.name_file || att.file_url || `Файл ${index + 1}`}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="send-project-mail-modal__custom-files">
            <label>Свои файлы (дополнительно к документам проекта):</label>
            <input
              type="file"
              multiple
              onChange={addCustomFiles}
              className="send-project-mail-modal__file-input"
            />
            {customFiles.length > 0 && (
              <ul className="send-project-mail-modal__list">
                {customFiles.map((f, index) => (
                  <li key={index}>
                    <span>{f.name}</span>
                    <button type="button" className="send-project-mail-modal__remove-file" onClick={() => removeCustomFile(index)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="send-project-mail-modal__options">
            <label>
              <input
                type="checkbox"
                checked={includeAdditionalInfo}
                onChange={(e) => setIncludeAdditionalInfo(e.target.checked)}
              />
              Включать дополнительную информацию в письмо
            </label>
          </div>

          <div className="send-project-mail-modal__preview">
            <strong>В письме:</strong> тема «{subject}», тело — описание проекта{includeAdditionalInfo ? ', доп. информация' : ''}. Письмо отправится с вашего рабочего email.
          </div>

          {error && <div className="send-project-mail-modal__error">{error}</div>}

          <div className="send-project-mail-modal__actions">
            <button type="button" className="send-project-mail-modal__btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button
              type="button"
              className="send-project-mail-modal__btn-send"
              onClick={handleSend}
              disabled={sending || toEmails.length === 0}
            >
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SendProjectMailModal
