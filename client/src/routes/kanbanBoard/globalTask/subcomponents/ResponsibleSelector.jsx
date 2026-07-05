import { useState, useEffect } from 'react'
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
} from '../../../../utils/userAbsenceUtils'
import './ResponsibleSelector.scss'

const ResponsibleSelector = ({
  responsibles: responsiblesBefor,
  onAddResponsible,
  onClose,
  existingResponsibles,
  globalTaskId,
  onRefresh,
}) => {
  const [users, setUsers] = useState([])
  const { user } = UserStore()
  const [loading, setLoading] = useState(true)
  const [responsibles, setResponsibles] = useState(existingResponsibles || [])
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

  const handleAddResponsibles = async () => {
    if (responsibles.length === 0) {
      alert('Пожалуйста, выберите хотя бы одного ответственного.')
      return
    }

    try {
      await axios.post(
        `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/responsibles-new`,
        {
          responsibles,
          userId,
        }
      )
      if (onClose) onClose()
      onRefresh(globalTaskId)
    } catch (error) {
      const errMsg = error.response?.data?.error || 'Не удалось добавить ответственных. Попробуйте еще раз.'
      console.error('Ошибка при добавлении ответственных:', error)
      alert(errMsg)
    }
  }

  const handleResponsibleSelect = (selectedUserId) => {
    const resolution = resolveUserSelection(selectedUserId, absencesMap, users)

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
  }

  const removeResponsible = (id) => {
    setResponsibles(responsibles.filter((resp) => resp.id !== id))
  }

  const handleResponsibleRoleChange = (userId, newRole) => {
    const updated = responsibles.map((resp) =>
      resp.id === userId ? { ...resp, role: newRole } : resp
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
            {users
              .filter(
                (u) =>
                  !responsibles.some((resp) => resp.id === u.id) &&
                  !responsiblesBefor.some((resp) => resp.id === u.id)
              )
              .map((u) => {
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
    </div>
  )
}

export default ResponsibleSelector
