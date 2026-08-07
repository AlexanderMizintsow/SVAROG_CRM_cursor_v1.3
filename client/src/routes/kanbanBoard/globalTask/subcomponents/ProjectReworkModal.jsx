import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import './ProjectReworkModal.scss'

function ProjectReworkModal({
  open,
  onClose,
  taskId,
  userId,
  participants = [],
  onCreated,
}) {
  const [comment, setComment] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const options = useMemo(() => {
    const map = new Map()
    ;(participants || []).forEach((p) => {
      if (p?.id == null) return
      const id = String(p.id)
      if (map.has(id)) return
      map.set(id, {
        id: Number(p.id),
        name: p.name || `Участник #${p.id}`,
      })
    })
    return Array.from(map.values()).sort((a, b) =>
      String(a.name).localeCompare(String(b.name), 'ru', { sensitivity: 'base' })
    )
  }, [participants])

  const handleClose = () => {
    if (saving) return
    setComment('')
    setAssigneeUserId('')
    setError('')
    onClose()
  }

  const handleSave = async () => {
    const text = String(comment || '').trim()
    if (!text) {
      setError('Комментарий обязателен')
      return
    }
    if (!assigneeUserId) {
      setError('Выберите участника')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}5000/api/global-tasks/${taskId}/reworks`,
        {
          userId,
          comment: text,
          assigneeUserId: Number(assigneeUserId),
        }
      )
      setComment('')
      setAssigneeUserId('')
      setError('')
      onClose()
      onCreated?.(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось создать доработку')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="project-rework-modal-overlay" role="presentation">
      <div
        className="project-rework-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="project-rework-modal__header">
          <h3>Доработка проекта</h3>
          <button
            type="button"
            className="project-rework-modal__close"
            onClick={handleClose}
            disabled={saving}
          >
            ×
          </button>
        </div>
        <div className="project-rework-modal__body">
          <p className="project-rework-modal__hint">
            Укажите, что нужно доработать, и участника. После сохранения процент
            проекта пересчитается.
          </p>
          <label>
            Комментарий <span>*</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="Что необходимо доработать…"
              disabled={saving}
              autoFocus
            />
          </label>
          <label>
            Участник <span>*</span>
            <select
              value={assigneeUserId}
              onChange={(e) => setAssigneeUserId(e.target.value)}
              disabled={saving || options.length === 0}
            >
              <option value="">Выберите участника</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {options.length === 0 ? (
            <p className="project-rework-modal__hint">
              В проекте нет участников для назначения.
            </p>
          ) : null}
          {error ? <div className="project-rework-modal__error">{error}</div> : null}
          <div className="project-rework-modal__actions">
            <button
              type="button"
              className="project-rework-modal__btn-cancel"
              onClick={handleClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="button"
              className="project-rework-modal__btn-save"
              onClick={handleSave}
              disabled={
                saving ||
                !String(comment || '').trim() ||
                !assigneeUserId
              }
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ProjectReworkModal
