import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import useUserStore from '../../../store/userStore'
import { FaLightbulb, FaTimes } from 'react-icons/fa'
import Toastify from 'toastify-js'
import './IdeasModal.scss'

/** URL вложения идеи (файлы лежат в uploads, отдаются через API задач). */
const getAppIdeaFileUrl = (filePath) => {
  if (!filePath) return null
  const normalized = String(filePath).replace(/\\/g, '/')
  const filename = normalized.split('/').filter(Boolean).pop()
  if (!filename) return null
  return `${API_BASE_URL}5000/api/task/uploads/${encodeURIComponent(filename)}`
}

const IdeasModal = ({ onClose }) => {
  const { user } = useUserStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const isAdmin = user?.role_name === 'Администратор'

  useEffect(() => {
    if (!user?.id) return
    axios
      .get(`${API_BASE_URL}5000/api/app-ideas?userId=${user.id}`)
      .then((res) => setData(res.data))
      .catch(() => setData(isAdmin ? { admin: true, grouped: [] } : { admin: false, ideas: [] }))
      .finally(() => setLoading(false))
  }, [user?.id, isAdmin])

  const refresh = () => {
    if (!user?.id) return
    setLoading(true)
    axios
      .get(`${API_BASE_URL}5000/api/app-ideas?userId=${user.id}`)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false))
  }

  if (loading) {
    return (
      <div className="ideas-modal-overlay" onClick={onClose}>
        <div className="ideas-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ideas-modal__loading">Загрузка...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="ideas-modal-overlay" onClick={onClose}>
      <div className="ideas-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ideas-modal__header">
          <h2 className="ideas-modal__title">
            <FaLightbulb className="ideas-modal__title-icon" />
            Идеи и предложения
          </h2>
          <button type="button" className="ideas-modal__close" onClick={onClose} title="Закрыть">
            <FaTimes />
          </button>
        </div>
        <div className="ideas-modal__body">
          {isAdmin ? (
            <AdminIdeasPanel grouped={data?.grouped || []} onRefresh={refresh} />
          ) : (
            <UserIdeasView
              userId={user?.id}
              ideas={data?.ideas || []}
              onRefresh={refresh}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function UserIdeasView({ userId, ideas, onRefresh, onClose }) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const t = (title || '').trim()
    if (!t) {
      Toastify({ text: 'Укажите наименование обращения', close: true, style: { background: '#e74c3c' } }).showToast()
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('userId', userId)
      formData.append('title', t)
      formData.append('message', (message || '').trim())
      if (file) formData.append('file', file)
      await axios.post(`${API_BASE_URL}5000/api/app-ideas`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      Toastify({ text: 'Предложение отправлено', close: true, style: { background: 'linear-gradient(to right, #00b09b, #96c93d)' } }).showToast()
      setTitle('')
      setMessage('')
      setFile(null)
      onRefresh()
    } catch (err) {
      Toastify({ text: err.response?.data?.error || 'Ошибка отправки', close: true, style: { background: '#e74c3c' } }).showToast()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ideas-modal__user-view">
      <form className="ideas-form" onSubmit={handleSubmit}>
        <label className="ideas-form__label">
          Наименование обращения <span className="ideas-form__required">*</span>
        </label>
        <input
          type="text"
          className="ideas-form__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Краткое название"
          maxLength={500}
        />
        <label className="ideas-form__label">Текст предложения</label>
        <textarea
          className="ideas-form__textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Опишите идею или пожелание по улучшению приложения"
          rows={4}
        />
        <label className="ideas-form__label">Файл (необязательно)</label>
        <input
          type="file"
          className="ideas-form__file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
        />
        <div className="ideas-form__actions">
          <button type="submit" className="ideas-form__submit" disabled={submitting}>
            {submitting ? 'Отправка...' : 'Отправить'}
          </button>
          <button type="button" className="ideas-form__cancel" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </form>

      <div className="ideas-modal__my-list">
        <h3 className="ideas-modal__my-list-title">Мои предложения</h3>
        {ideas.length === 0 ? (
          <p className="ideas-modal__empty">Пока нет отправленных предложений.</p>
        ) : (
          <ul className="ideas-modal__list">
            {ideas.map((idea) => {
              const ideaFileUrl = getAppIdeaFileUrl(idea.file_path)
              return (
              <li key={idea.id} className={`ideas-modal__list-item ${idea.is_applied ? 'ideas-modal__list-item--applied' : ''}`}>
                <div className="ideas-modal__item-title">{idea.title}</div>
                <div className="ideas-modal__item-message">{idea.message || '—'}</div>
                {ideaFileUrl && (
                  <a
                    href={ideaFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ideas-modal__item-file"
                  >
                    {idea.file_name || 'Файл'}
                  </a>
                )}
                <div className="ideas-modal__item-meta">
                  {new Date(idea.created_at).toLocaleString('ru-RU')}
                  {idea.is_applied && (
                    <span className="ideas-modal__item-applied">
                      Применено{idea.admin_comment ? ` · ${idea.admin_comment}` : ''}
                    </span>
                  )}
                </div>
              </li>
            )})}
          </ul>
        )}
      </div>
    </div>
  )
}

function AdminIdeasPanel({ grouped, onRefresh }) {
  return (
    <div className="ideas-admin">
      {grouped.length === 0 ? (
        <p className="ideas-admin__empty">Нет предложений от пользователей.</p>
      ) : (
        grouped.map((group) => (
          <div key={group.user_id} className="ideas-admin__group">
            <h3 className="ideas-admin__group-fio">{group.user_fio}</h3>
            <ul className="ideas-admin__list">
              {group.ideas.map((idea) => (
                <AdminIdeaItem key={idea.id} idea={idea} onRefresh={onRefresh} />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}

function AdminIdeaItem({ idea, onRefresh }) {
  const [comment, setComment] = useState(idea.admin_comment || '')
  const [applied, setApplied] = useState(!!idea.is_applied)
  const [saving, setSaving] = useState(false)
  const ideaFileUrl = getAppIdeaFileUrl(idea.file_path)

  const handleApply = async () => {
    setSaving(true)
    try {
      await axios.patch(`${API_BASE_URL}5000/api/app-ideas/${idea.id}`, {
        is_applied: applied,
        admin_comment: comment.trim() || null,
      })
      onRefresh()
    } catch (err) {
      Toastify({ text: err.response?.data?.error || 'Ошибка сохранения', close: true, style: { background: '#e74c3c' } }).showToast()
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className={`ideas-admin__item ${idea.is_applied ? 'ideas-admin__item--applied' : ''}`}>
      <div className="ideas-admin__item-head">
        <label className="ideas-admin__item-check">
          <input
            type="checkbox"
            checked={applied}
            onChange={(e) => setApplied(e.target.checked)}
            disabled={!!idea.is_applied}
          />
          <span>Применено в приложении</span>
        </label>
      </div>
      <div className="ideas-admin__item-title">{idea.title}</div>
      <div className="ideas-admin__item-message">{idea.message || '—'}</div>
      {ideaFileUrl && (
        <a
          href={ideaFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ideas-admin__item-file"
        >
          {idea.file_name || 'Файл'}
        </a>
      )}
      <div className="ideas-admin__item-comment">
        <label>Комментарий администратора</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Комментарий пользователю"
          rows={2}
          disabled={!!idea.is_applied}
        />
      </div>
      <div className="ideas-admin__item-meta">
        {new Date(idea.created_at).toLocaleString('ru-RU')}
        {idea.is_applied && idea.applied_at && (
          <span> · Применено: {new Date(idea.applied_at).toLocaleString('ru-RU')}</span>
        )}
      </div>
      {!idea.is_applied && (
        <button type="button" className="ideas-admin__item-btn" onClick={handleApply} disabled={saving}>
          {saving ? 'Сохранение...' : 'Подтвердить'}
        </button>
      )}
    </li>
  )
}

export default IdeasModal
