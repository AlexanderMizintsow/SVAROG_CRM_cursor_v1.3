import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaExclamationTriangle, FaPencilAlt, FaTrash } from 'react-icons/fa'

function ErrorMarkFormModal({
  open,
  title,
  comment,
  onCommentChange,
  formError,
  saving,
  onClose,
  onSave,
}) {
  if (!open) return null
  return createPortal(
    <div
      className="kb-modal-overlay kb-modal-overlay--nested"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="kb-modal kb-error-marks__modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kb-modal__header">
          <h2>{title}</h2>
          <button
            type="button"
            className="kb-modal__close"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>
        <div className="kb-error-marks__form">
          <p className="kb-error-marks__hint">
            Опишите ошибку в документе. Без комментария отметка не сохранится.
            На карточке появится метка «обнаружена ошибка!» с этим текстом при
            наведении.
          </p>
          <label>
            Комментарий <span>*</span>
            <textarea
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Что именно неверно или нужно исправить…"
              disabled={saving}
              autoFocus
            />
          </label>
          {formError ? (
            <div className="kb-error-marks__form-error">{formError}</div>
          ) : null}
          <div className="kb-modal__actions">
            <button
              type="button"
              className="kb-btn kb-btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="button"
              className="kb-btn kb-btn--primary"
              onClick={onSave}
              disabled={saving || !String(comment || '').trim()}
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

/** Светло-оранжевая иконка в ряду действий карточки */
export function KnowledgeErrorMarkAddButton({
  onCreate,
  fileId = null,
  busy = false,
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
    setComment('')
    setFormError('')
  }

  const handleSave = async () => {
    const text = String(comment || '').trim()
    if (!text) {
      setFormError('Комментарий обязателен')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await onCreate(text, fileId)
      closeForm()
    } catch (err) {
      setFormError(err?.response?.data?.error || err?.message || 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="kb-btn kb-btn--ghost kb-error-marks__icon-btn"
        title="Отметить ошибку в документе"
        disabled={busy || saving}
        onClick={() => {
          setComment('')
          setFormError('')
          setFormOpen(true)
        }}
      >
        <FaExclamationTriangle />
      </button>
      <ErrorMarkFormModal
        open={formOpen}
        title="Обнаружена ошибка"
        comment={comment}
        onCommentChange={setComment}
        formError={formError}
        saving={saving}
        onClose={closeForm}
        onSave={handleSave}
      />
    </>
  )
}

/**
 * Список отметок «обнаружена ошибка!» (бейджи + правка/удаление своих).
 */
export default function KnowledgeErrorMarks({
  marks = [],
  currentUserId,
  /** undefined = все отметки документа; null = только документ; number = файл папки */
  fileId,
  onUpdate,
  onDelete,
  busy = false,
}) {
  const scopedMarks = useMemo(() => {
    if (fileId === undefined) return marks || []
    const fid = fileId != null ? Number(fileId) : null
    return (marks || []).filter((m) => {
      const mid = m.fileId != null ? Number(m.fileId) : null
      return mid === fid
    })
  }, [marks, fileId])

  const [editingMark, setEditingMark] = useState(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const closeForm = () => {
    if (saving) return
    setEditingMark(null)
    setComment('')
    setFormError('')
  }

  const openEdit = (mark) => {
    setEditingMark(mark)
    setComment(mark.comment || '')
    setFormError('')
  }

  const handleSave = async () => {
    const text = String(comment || '').trim()
    if (!text) {
      setFormError('Комментарий обязателен')
      return
    }
    if (!editingMark?.id) return
    setSaving(true)
    setFormError('')
    try {
      await onUpdate(editingMark.id, text)
      closeForm()
    } catch (err) {
      setFormError(err?.response?.data?.error || err?.message || 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (mark) => {
    if (!mark?.id || busy || saving) return
    try {
      await onDelete(mark.id)
    } catch (_) {
      /* родитель покажет toast */
    }
  }

  if (!scopedMarks.length) return null

  return (
    <>
      <div className="kb-error-marks">
        <ul className="kb-error-marks__list">
          {scopedMarks.map((mark) => {
            const isMine = Number(mark.createdBy) === Number(currentUserId)
            return (
              <li key={mark.id} className="kb-error-marks__item">
                <span className="kb-error-mark" tabIndex={0}>
                  <FaExclamationTriangle aria-hidden />
                  <span className="kb-error-mark__label">обнаружена ошибка!</span>
                  <span className="kb-error-mark__tooltip" role="tooltip">
                    <strong>{mark.createdByName}</strong>
                    <span>{mark.comment}</span>
                  </span>
                </span>
                {isMine ? (
                  <span className="kb-error-marks__own-actions">
                    <button
                      type="button"
                      className="kb-btn kb-btn--ghost kb-error-marks__mini"
                      title="Изменить комментарий"
                      disabled={busy || saving}
                      onClick={() => openEdit(mark)}
                    >
                      <FaPencilAlt />
                    </button>
                    <button
                      type="button"
                      className="kb-btn kb-btn--ghost kb-error-marks__mini"
                      title="Удалить отметку"
                      disabled={busy || saving}
                      onClick={() => handleDelete(mark)}
                    >
                      <FaTrash />
                    </button>
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>

      <ErrorMarkFormModal
        open={Boolean(editingMark)}
        title="Изменить отметку об ошибке"
        comment={comment}
        onCommentChange={setComment}
        formError={formError}
        saving={saving}
        onClose={closeForm}
        onSave={handleSave}
      />
    </>
  )
}

/** Есть ли уже отметка текущего пользователя на эту цель */
export function hasMyErrorMark(marks, currentUserId, fileId = null) {
  const uid = Number(currentUserId)
  const fid = fileId != null ? Number(fileId) : null
  return (marks || []).some((m) => {
    const mid = m.fileId != null ? Number(m.fileId) : null
    return Number(m.createdBy) === uid && mid === fid
  })
}
