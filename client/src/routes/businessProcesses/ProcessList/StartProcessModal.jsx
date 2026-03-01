import { useMemo, useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import './StartProcessModal.scss'

function normalizeKey(raw) {
  return String(raw || '').trim().replace(/\s+/g, '_').replace(/[^\wа-яА-Я0-9_]/g, '')
}

const StartProcessModal = ({
  process,
  currentUserId,
  onClose,
  onConfirm,
}) => {
  const [initiatorId, setInitiatorId] = useState(currentUserId || '')
  const [paramValues, setParamValues] = useState({})

  const requestAtStartKeys = useMemo(() => {
    const scheme = process?.scheme
    if (!scheme || !Array.isArray(scheme.nodes)) return []
    const keys = []
    for (const n of scheme.nodes) {
      if (n.type !== 'additional_info') continue
      const fields = Array.isArray(n.settings?.fields) ? n.settings.fields : []
      for (const f of fields) {
        if (f?.requestAtStart) {
          const k = normalizeKey(f.key)
          if (k) keys.push({ key: k, label: (f.key || k).trim() })
        }
      }
    }
    return keys
  }, [process?.scheme])

  const allParamsFilled = useMemo(() => {
    return requestAtStartKeys.every(({ key }) => {
      const v = paramValues[key]
      return v != null && String(v).trim() !== ''
    })
  }, [requestAtStartKeys, paramValues])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (requestAtStartKeys.length > 0 && !allParamsFilled) return
    const initialAdditionalInfo = {}
    for (const { key } of requestAtStartKeys) {
      const v = paramValues[key]
      initialAdditionalInfo[key] = v != null ? String(v).trim() : ''
    }
    onConfirm(initiatorId ? Number(initiatorId) : currentUserId, initialAdditionalInfo)
  }

  const setParam = (key, value) => {
    setParamValues((prev) => ({ ...prev, [key]: value }))
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
          {requestAtStartKeys.length > 0 && (
            <div className="start-process-modal__params">
              <p className="start-process-modal__params-hint">
                Заполните параметры (обязательно для запуска):
              </p>
              {requestAtStartKeys.map(({ key, label }) => (
                <label key={key} className="start-process-modal__label">
                  {label}
                  <input
                    type="text"
                    className="start-process-modal__input"
                    value={paramValues[key] ?? ''}
                    onChange={(e) => setParam(key, e.target.value)}
                    placeholder={`Введите значение для ${label}`}
                    required
                  />
                </label>
              ))}
            </div>
          )}
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
            <button
              type="submit"
              className="start-process-modal__btn-confirm"
              disabled={requestAtStartKeys.length > 0 && !allParamsFilled}
            >
              Запустить
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StartProcessModal
