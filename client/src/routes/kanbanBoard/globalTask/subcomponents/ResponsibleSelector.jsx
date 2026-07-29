import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import { FaTimes, FaUserPlus } from 'react-icons/fa'
import {
  generateRandomBackgroundColorClass,
  generateRandomAvatarColorClass,
  generateInitials,
  responsibleRolesList,
} from '../utils/globalTaskUtils'
import UserStore from '../../../../store/userStore'
import { useActiveAbsences } from '../../../../utils/useActiveAbsences'
import {
  resolveUserSelection,
  getAbsenceLabel,
  showAbsenceMessage,
  getAbsenceChoicesAtSave,
  findAbsenceChoicesFromAssignees,
  getAbsenceEndDate,
  isDeadlineAfterAbsence,
  normalizeDateOnly,
  refreshAbsenceMetaNotes,
  applyAbsenceDecisionsToResponsibles,
  sortUsersByLastName,
} from '../../../../utils/userAbsenceUtils'
import AbsenceAssigneeChoiceModal from '../../../../components/absenceAssigneeChoice/AbsenceAssigneeChoiceModal'
import './ResponsibleSelector.scss'

const formatDateRuLocal = (dateStr) => {
  const normalized = normalizeDateOnly(dateStr)
  if (!normalized) return ''
  const parts = normalized.split('-')
  if (parts.length !== 3) return normalized
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

const ResponsibleSelector = ({
  responsibles: responsiblesBefor,
  onAddResponsible,
  onClose,
  existingResponsibles,
  globalTaskId,
  onRefresh,
  projectDeadline = null,
}) => {
  const [users, setUsers] = useState([])
  const { user } = UserStore()
  const [loading, setLoading] = useState(true)
  const [responsibles, setResponsibles] = useState(existingResponsibles || [])
  const [absenceMeta, setAbsenceMeta] = useState([])
  const [choiceQueue, setChoiceQueue] = useState([])
  const [currentChoice, setCurrentChoice] = useState(null)
  const choiceDecisionsRef = useRef({})
  const { absencesMap } = useActiveAbsences(true)

  const userId = user ? user.id : null

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/users`)
        setUsers(response.data)
      } catch (err) {
        console.error('Ошибка загрузки пользователей:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  useEffect(() => {
    setAbsenceMeta((prev) =>
      refreshAbsenceMetaNotes(prev, projectDeadline, users, absencesMap)
    )
  }, [projectDeadline, users, absencesMap])

  const notesByEffectiveId = (() => {
    const map = {}
    ;(absenceMeta || []).forEach((entry) => {
      map[String(entry.effectiveId)] = entry.note || null
    })
    return map
  })()

  const submitResponsibles = useCallback(
    async (list) => {
      try {
        await axios.post(
          `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/responsibles-new`,
          {
            responsibles: list,
            userId,
          }
        )
        if (onClose) onClose()
        onRefresh(globalTaskId)
      } catch (error) {
        const errMsg =
          error.response?.data?.error || 'Не удалось добавить ответственных. Попробуйте еще раз.'
        console.error('Ошибка при добавлении ответственных:', error)
        alert(errMsg)
      }
    },
    [globalTaskId, userId, onClose, onRefresh]
  )

  const handleAddResponsibles = async () => {
    if (responsibles.length === 0) {
      alert('Пожалуйста, выберите хотя бы одного ответственного.')
      return
    }

    const invalidSkip = (absenceMeta || []).find(
      (entry) =>
        entry.needsSkipSubstitution &&
        entry.absence &&
        !isDeadlineAfterAbsence(projectDeadline, entry.absence)
    )
    if (invalidSkip) {
      const endDay = getAbsenceEndDate(invalidSkip.absence)
      showAbsenceMessage(
        endDay
          ? `Срок проекта должен быть после ${formatDateRuLocal(endDay)}, либо удалите отсутствующего сотрудника без замещающего.`
          : 'Измените срок проекта или удалите отсутствующего сотрудника без замещающего.',
        true
      )
      return
    }

    const choicesFromMeta = getAbsenceChoicesAtSave(
      absenceMeta,
      projectDeadline,
      absencesMap
    )
    const choiceKeys = new Set(
      choicesFromMeta.map((c) => String(c.effectiveId))
    )
    const choices = [...choicesFromMeta]
    findAbsenceChoicesFromAssignees(
      responsibles.map((r) => r.id),
      projectDeadline,
      absencesMap,
      'responsibles'
    ).forEach((entry) => {
      if (!choiceKeys.has(String(entry.effectiveId))) {
        choiceKeys.add(String(entry.effectiveId))
        choices.push(entry)
      }
    })

    if (choices.length > 0) {
      choiceDecisionsRef.current = {}
      setAbsenceMeta((prev) => {
        const next = [...(prev || [])]
        choices.forEach((entry) => {
          const exists = next.some(
            (e) => String(e.effectiveId) === String(entry.effectiveId)
          )
          if (!exists) next.push(entry)
        })
        return refreshAbsenceMetaNotes(next, projectDeadline, users, absencesMap)
      })
      setChoiceQueue(choices)
      setCurrentChoice(choices[0])
      return
    }

    const list = applyAbsenceDecisionsToResponsibles(responsibles, absenceMeta, {}, users)
    await submitResponsibles(list)
  }

  const finishAbsenceChoice = async (decision) => {
    if (!currentChoice) return
    choiceDecisionsRef.current = {
      ...choiceDecisionsRef.current,
      [String(currentChoice.effectiveId)]: decision,
    }
    const rest = choiceQueue.slice(1)
    if (rest.length > 0) {
      setChoiceQueue(rest)
      setCurrentChoice(rest[0])
      return
    }
    setChoiceQueue([])
    setCurrentChoice(null)
    const list = applyAbsenceDecisionsToResponsibles(
      responsibles,
      absenceMeta,
      choiceDecisionsRef.current,
      users
    )
    await submitResponsibles(list)
  }

  const cancelAbsenceChoice = () => {
    setChoiceQueue([])
    setCurrentChoice(null)
    choiceDecisionsRef.current = {}
  }

  const handleResponsibleSelect = (selectedUserId) => {
    const resolution = resolveUserSelection(selectedUserId, absencesMap, users, {
      deadline: projectDeadline || null,
    })

    if (resolution.message) {
      showAbsenceMessage(resolution.message, resolution.blocked)
    }

    if (!resolution.added || resolution.effectiveId == null) return

    const selectedUser = users.find((u) => Number(u.id) === Number(resolution.effectiveId))
    if (
      !selectedUser ||
      responsibles.some((resp) => Number(resp.id) === Number(selectedUser.id)) ||
      responsiblesBefor.some((resp) => Number(resp.id) === Number(selectedUser.id))
    ) {
      if (selectedUser) {
        showAbsenceMessage(
          resolution.substituted
            ? 'Замещающий уже добавлен в проект'
            : 'Участник уже добавлен в проект',
          true
        )
      }
      return
    }

    const newResponsible = {
      id: selectedUser.id,
      first_name: selectedUser.first_name,
      last_name: selectedUser.last_name,
      middle_name: selectedUser.middle_name,
      initials: generateInitials(selectedUser.first_name, selectedUser.last_name),
      avatarColorClass: generateRandomAvatarColorClass(),
      backgroundColorClass: generateRandomBackgroundColorClass(),
      role:
        Array.isArray(responsibleRolesList) && responsibleRolesList.includes('Участник')
          ? 'Участник'
          : (Array.isArray(responsibleRolesList) && responsibleRolesList[0]) || 'Исполнитель',
      requires_approval: false,
    }
    setResponsibles([...responsibles, newResponsible])
    if (onAddResponsible) {
      onAddResponsible(newResponsible)
    }

    const absence = absencesMap[Number(resolution.originalId)]
    setAbsenceMeta((prev) => {
      const next = (prev || []).filter(
        (entry) => String(entry.effectiveId) !== String(resolution.effectiveId)
      )
      if (resolution.substituted || resolution.needsSkipSubstitution || resolution.note) {
        next.push({
          roleKey: 'responsibles',
          effectiveId: String(resolution.effectiveId),
          originalId: String(resolution.originalId),
          substituted: Boolean(resolution.substituted),
          needsSkipSubstitution: Boolean(resolution.needsSkipSubstitution),
          choiceAtSavePossible: Boolean(resolution.choiceAtSavePossible),
          note: resolution.note || null,
          absence: absence || null,
        })
      }
      return next
    })
  }

  const removeResponsible = (id) => {
    setResponsibles(responsibles.filter((resp) => resp.id !== id))
    setAbsenceMeta((prev) =>
      (prev || []).filter((entry) => String(entry.effectiveId) !== String(id))
    )
  }

  const handleResponsibleRoleChange = (respUserId, newRole) => {
    const updated = responsibles.map((resp) =>
      resp.id === respUserId ? { ...resp, role: newRole } : resp
    )
    setResponsibles(updated)
  }

  const handleRequiresApprovalChange = (respId, checked) => {
    const updated = responsibles.map((resp) =>
      resp.id === respId ? { ...resp, requires_approval: !!checked } : resp
    )
    setResponsibles(updated)
  }

  return (
    <div className="global-task-responsibles__modal-overlay">
      <div className="global-task-responsibles__modal-content">
        <div className="create-global-task-form__responsibles-list">
          {responsibles.map((resp) => (
            <div
              key={resp.id}
              className={`create-global-task-form__responsible-item ${resp.backgroundColorClass}`}
            >
              <div
                className={`create-global-task-form__responsible-avatar ${resp.avatarColorClass}`}
                title={`${resp.last_name} ${resp.first_name} ${resp.middle_name || ''}`}
              >
                {resp.initials}
              </div>
              <div className="create-global-task-form__responsible-details">
                <div className="create-global-task-form__responsible-name">
                  {`${resp.last_name || ''} ${(resp.first_name || '')[0] || ''}. ${
                    (resp.middle_name || '')[0] ? (resp.middle_name || '')[0] + '.' : ''
                  }`}
                </div>
                {notesByEffectiveId[String(resp.id)] ? (
                  <div className="create-global-task-form__absence-note">
                    {notesByEffectiveId[String(resp.id)]}
                  </div>
                ) : null}
                <select
                  className="create-global-task-form__responsible-role-select"
                  value={resp.role}
                  onChange={(e) => handleResponsibleRoleChange(resp.id, e.target.value)}
                >
                  {(Array.isArray(responsibleRolesList) ? responsibleRolesList : []).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <label className="create-global-task-form__requires-approval-label">
                  <input
                    type="checkbox"
                    checked={!!resp.requires_approval}
                    onChange={(e) => handleRequiresApprovalChange(resp.id, e.target.checked)}
                    className="create-global-task-form__requires-approval-checkbox"
                  />
                  <span>Требуется согласование</span>
                </label>
              </div>
              <button
                type="button"
                className="create-global-task-form__remove-responsible-button"
                onClick={() => removeResponsible(resp.id)}
              >
                <FaTimes />
              </button>
            </div>
          ))}
        </div>

        <div className="create-global-task-form__add-responsible-section">
          <FaUserPlus className="create-global-task-form__add-responsible-icon" />
          <select
            className="create-global-task-form__select"
            style={{ width: '100%' }}
            onChange={(e) => {
              const parsedId = parseInt(e.target.value, 10)
              if (!isNaN(parsedId)) {
                handleResponsibleSelect(parsedId)
              }
              e.target.value = ''
            }}
            value=""
            disabled={loading}
          >
            <option value="" disabled>
              {loading ? 'Загрузка пользователей...' : 'Выберите ответственного'}
            </option>
            {sortUsersByLastName(
              users.filter(
                (u) =>
                  !responsibles.some((resp) => resp.id === u.id) &&
                  !responsiblesBefor.some((resp) => resp.id === u.id)
              )
            ).map((u) => {
                const absenceLabel = getAbsenceLabel(absencesMap[Number(u.id)])
                return (
                  <option key={u.id} value={u.id}>
                    {`${u.last_name || ''} ${(u.first_name || '')[0] || ''}. ${
                      (u.middle_name || '')[0] ? (u.middle_name || '')[0] + '.' : ''
                    }`}
                    {absenceLabel ? ` — ${absenceLabel}` : ''}
                  </option>
                )
              })}
          </select>
        </div>
        <div className="global-task-responsibles__buttons">
          <button
            className="global-task-responsibles__button global-task-responsibles__cancel-button"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className="global-task-responsibles__button global-task-responsibles__add-button"
            onClick={handleAddResponsibles}
          >
            Добавить
          </button>
        </div>
      </div>
      <AbsenceAssigneeChoiceModal
        open={Boolean(currentChoice)}
        entry={currentChoice}
        users={users}
        deadline={projectDeadline}
        appointmentLabel="участника проекта"
        deadlineCaption="Срок проекта"
        onKeepSubstitute={() => finishAbsenceChoice('substitute')}
        onAssignOriginal={() => finishAbsenceChoice('original')}
        onCancel={cancelAbsenceChoice}
      />
    </div>
  )
}

export default ResponsibleSelector
