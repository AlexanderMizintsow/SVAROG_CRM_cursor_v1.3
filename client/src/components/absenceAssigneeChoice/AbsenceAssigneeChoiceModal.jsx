import './AbsenceAssigneeChoiceModal.scss'
import {
  daysAvailableAfterReturn,
  formatAbsencePeriod,
  formatUserFullName,
  getAbsenceEndDate,
  normalizeDateOnly,
} from '../../utils/userAbsenceUtils'

const formatDateRu = (dateStr) => {
  const normalized = normalizeDateOnly(dateStr)
  if (!normalized) return ''
  const parts = normalized.split('-')
  if (parts.length !== 3) return normalized
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

const defaultAppointmentLabel = (roleKey) => {
  if (roleKey === 'approvers') return 'утверждающего'
  if (roleKey === 'viewers') return 'наблюдателя'
  if (roleKey === 'responsibles') return 'участника проекта'
  return 'исполнителя'
}

const AbsenceAssigneeChoiceModal = ({
  open,
  entry,
  users = [],
  deadline,
  appointmentLabel,
  deadlineCaption = 'Срок задачи',
  onKeepSubstitute,
  onAssignOriginal,
  onCancel,
}) => {
  if (!open || !entry) return null

  const original = users.find((u) => String(u.id) === String(entry.originalId))
  const substitute = users.find((u) => String(u.id) === String(entry.effectiveId))
  const originalName = formatUserFullName(original) || `ID ${entry.originalId}`
  const substituteName = formatUserFullName(substitute) || `ID ${entry.effectiveId}`
  const endDay = getAbsenceEndDate(entry.absence)
  const endLabel = endDay ? formatDateRu(endDay) : '—'
  const days = daysAvailableAfterReturn(deadline, entry.absence)
  const deadlineLabel = formatDateRu(deadline) || 'не указан'
  const period = formatAbsencePeriod(entry.absence)
  const statusLabel = entry.absence?.status || 'отсутствует'
  const roleLabel = appointmentLabel || defaultAppointmentLabel(entry.roleKey)

  return (
    <div className="absenceChoiceOverlay" onClick={onCancel} role="presentation">
      <div
        className="absenceChoiceModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="absence-choice-title"
      >
        <h3 id="absence-choice-title">Назначение {roleLabel}</h3>
        <p>
          <strong>{originalName}</strong> — {statusLabel} ({period}), выход{' '}
          <strong>{endLabel}</strong>.
        </p>
        <p>
          {deadlineCaption}: <strong>{deadlineLabel}</strong>
          {days != null ? (
            <>
              {' '}
              — после выхода на выполнение остаётся <strong>{days} дн.</strong>
            </>
          ) : null}
          .
        </p>
        <p>
          Сейчас в поле указан замещающий: <strong>{substituteName}</strong>.
        </p>
        <p>Кого назначить?</p>
        <div className="absenceChoiceActions">
          <button type="button" className="absenceChoicePrimary" onClick={onKeepSubstitute}>
            Оставить {substituteName}
          </button>
          <button type="button" className="absenceChoiceSecondary" onClick={onAssignOriginal}>
            Назначить {originalName}
          </button>
          <button type="button" className="absenceChoiceCancel" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export default AbsenceAssigneeChoiceModal
