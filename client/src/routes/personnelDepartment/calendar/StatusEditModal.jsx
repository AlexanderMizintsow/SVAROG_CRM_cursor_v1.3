import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import { toast } from 'react-toastify'
import { normalizeDateOnly } from '../../../utils/userAbsenceUtils'

const toInputDate = (value) => normalizeDateOnly(value)

const formatFio = (last, first, middle) =>
  [last, first, middle].filter(Boolean).join(' ').trim()

const StatusEditModal = ({ absence, users, actorUserId, onClose, onSaved }) => {
  const isPeriodInitially =
    absence.specific_dates?.length > 0
      ? false
      : absence.end_date != null && absence.end_date !== ''

  const [isPeriodMode, setIsPeriodMode] = useState(isPeriodInitially)
  const [statusType, setStatusType] = useState(absence.status || 'отпуск')
  const [startDate, setStartDate] = useState(toInputDate(absence.start_date))
  const [endDate, setEndDate] = useState(toInputDate(absence.end_date))
  const [specificDates, setSpecificDates] = useState(
    (absence.specific_dates || []).map(toInputDate).filter(Boolean)
  )
  const [currentSpecificDate, setCurrentSpecificDate] = useState('')
  const [substituteUser, setSubstituteUser] = useState(
    absence.substitute_user_id ? String(absence.substitute_user_id) : ''
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const employeeName = formatFio(absence.last_name, absence.first_name, absence.middle_name)

  const availableSubstitutes = users.filter(
    (u) => String(u.id) !== String(absence.user_id)
  )

  const handleModeChange = (period) => {
    setIsPeriodMode(period)
    if (period) {
      setSpecificDates([])
    } else {
      setStartDate('')
      setEndDate('')
    }
  }

  const addSpecificDate = () => {
    if (currentSpecificDate && !specificDates.includes(currentSpecificDate)) {
      setSpecificDates([...specificDates, currentSpecificDate].sort())
      setCurrentSpecificDate('')
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (isPeriodMode && (!startDate || !endDate)) {
      toast.error('Укажите дату начала и окончания периода')
      return
    }
    if (!isPeriodMode && specificDates.length === 0) {
      toast.error('Добавьте хотя бы одну конкретную дату')
      return
    }

    setSaving(true)
    try {
      await axios.put(`${API_BASE_URL}5000/api/user-statuses/${absence.id}`, {
        actor_user_id: actorUserId,
        status: statusType,
        start_date: isPeriodMode ? startDate : null,
        end_date: isPeriodMode ? endDate : null,
        specific_dates: isPeriodMode ? [] : specificDates,
        substitute_user_id: substituteUser || null,
      })
      toast.success('Статус обновлён')
      onSaved()
      onClose()
    } catch (err) {
      const msg = err.response?.data?.error || 'Не удалось сохранить изменения'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Отменить статус «${statusType}» для ${employeeName}?`)) return

    setDeleting(true)
    try {
      await axios.delete(`${API_BASE_URL}5000/api/user-statuses/${absence.id}`, {
        data: { actor_user_id: actorUserId },
      })
      toast.success('Статус отменён')
      onSaved()
      onClose()
    } catch (err) {
      const msg = err.response?.data?.error || 'Не удалось отменить статус'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="status-edit-modal__overlay" onClick={onClose}>
      <div
        className="status-edit-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="status-edit-title"
      >
        <div className="status-edit-modal__header">
          <h3 id="status-edit-title">Изменение статуса</h3>
          <button type="button" className="status-edit-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <p className="status-edit-modal__employee">{employeeName}</p>

        <form onSubmit={handleSave} className="status-edit-modal__form">
          <label htmlFor="edit-status">Тип статуса</label>
          <select
            id="edit-status"
            value={statusType}
            onChange={(e) => setStatusType(e.target.value)}
          >
            <option value="отпуск">Отпуск</option>
            <option value="командировка">Командировка</option>
            <option value="болезнь">Болезнь</option>
            <option value="на обучении">На обучении</option>
          </select>

          <label htmlFor="edit-substitute">Замещающий</label>
          <select
            id="edit-substitute"
            value={substituteUser}
            onChange={(e) => setSubstituteUser(e.target.value)}
          >
            <option value="">Не назначен</option>
            {availableSubstitutes.map((user) => (
              <option key={user.id} value={user.id}>
                {formatFio(user.last_name, user.first_name, user.middle_name)}
              </option>
            ))}
          </select>

          <div className="status-edit-modal__mode">
            <label>
              <input
                type="radio"
                checked={isPeriodMode}
                onChange={() => handleModeChange(true)}
              />
              Период
            </label>
            <label>
              <input
                type="radio"
                checked={!isPeriodMode}
                onChange={() => handleModeChange(false)}
              />
              Конкретные даты
            </label>
          </div>

          {isPeriodMode ? (
            <div className="status-edit-modal__dates-row">
              <div>
                <label htmlFor="edit-start">Начало</label>
                <input
                  id="edit-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="edit-end">Окончание</label>
                <input
                  id="edit-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : (
            <>
              <div className="status-edit-modal__add-date">
                <input
                  type="date"
                  value={currentSpecificDate}
                  onChange={(e) => setCurrentSpecificDate(e.target.value)}
                />
                <button type="button" onClick={addSpecificDate}>
                  Добавить
                </button>
              </div>
              <ul className="status-edit-modal__dates-list">
                {specificDates.map((date) => (
                  <li key={date}>
                    {date}
                    <button
                      type="button"
                      onClick={() => setSpecificDates(specificDates.filter((d) => d !== date))}
                    >
                      Удалить
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="status-edit-modal__actions">
            <button
              type="button"
              className="status-edit-modal__btn status-edit-modal__btn--danger"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? 'Отмена…' : 'Отменить статус'}
            </button>
            <div className="status-edit-modal__actions-right">
              <button
                type="button"
                className="status-edit-modal__btn status-edit-modal__btn--secondary"
                onClick={onClose}
                disabled={saving || deleting}
              >
                Закрыть
              </button>
              <button
                type="submit"
                className="status-edit-modal__btn status-edit-modal__btn--primary"
                disabled={saving || deleting}
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StatusEditModal
