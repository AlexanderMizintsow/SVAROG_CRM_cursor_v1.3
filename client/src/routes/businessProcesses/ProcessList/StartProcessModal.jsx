import { useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import './StartProcessModal.scss'

const StartProcessModal = ({
  process,
  currentUserId,
  onClose,
  onConfirm,
}) => {
  const [initiatorId, setInitiatorId] = useState(currentUserId || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm(initiatorId ? Number(initiatorId) : currentUserId)
  }

  return (
    <div className="start-process-modal-overlay" onClick={onClose}>
      <div
        className="start-process-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="start-process-modal__header">
          <h3 className="start-process-modal__title">Запуск процесса</h3>
          <button
            type="button"
            className="start-process-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>
        <p className="start-process-modal__process-name">{process?.name}</p>
        <form onSubmit={handleSubmit} className="start-process-modal__form">
          <label className="start-process-modal__label">
            Инициатор (ID пользователя, необязательно — по умолчанию вы)
            <input
              type="number"
              className="start-process-modal__input"
              value={initiatorId}
              onChange={(e) => setInitiatorId(e.target.value)}
              placeholder={String(currentUserId || '')}
              min={1}
            />
          </label>
          <div className="start-process-modal__actions">
            <button type="button" className="start-process-modal__btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="start-process-modal__btn-confirm">
              Запустить
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StartProcessModal
