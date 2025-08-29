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
      console.error('Ошибка при добавлении ответственных:', error)
      alert('Не удалось добавить ответственных. Попробуйте еще раз.')
    }
  }

  // Обработчик добавления выбранного пользователя
  const handleResponsibleSelect = (userId) => {
    const selectedUser = users.find((user) => user.id === userId)
    if (
      selectedUser &&
      !responsibles.some((resp) => resp.id === selectedUser.id)
    ) {
      const newResponsible = {
        id: selectedUser.id,
        first_name: selectedUser.first_name,
        last_name: selectedUser.last_name,
        middle_name: selectedUser.middle_name,
        initials: generateInitials(
          selectedUser.first_name,
          selectedUser.last_name
        ),
        avatarColorClass: generateRandomAvatarColorClass(),
        backgroundColorClass: generateRandomBackgroundColorClass(),
        role: responsibleRolesList[0],
      }
      setResponsibles([...responsibles, newResponsible])
      if (onAddResponsible) {
        onAddResponsible(newResponsible)
      }
    }
  }

  // Обработчик удаления ответственного
  const removeResponsible = (id) => {
    setResponsibles(responsibles.filter((resp) => resp.id !== id))
  }

  // Обработчик смены роли
  const handleResponsibleRoleChange = (userId, newRole) => {
    const updated = responsibles.map((resp) =>
      resp.id === userId ? { ...resp, role: newRole } : resp
    )
    setResponsibles(updated)
  }

  return (
    <div className="global-task-responsibles__modal-overlay">
      <div className="global-task-responsibles__modal-content">
        {/* Отображение выбранных ответственных */}
        <div className="create-global-task-form__responsibles-list">
          {responsibles.map((resp) => (
            <div
              key={resp.id}
              className={`create-global-task-form__responsible-item ${resp.backgroundColorClass}`}
            >
              <div
                className={`create-global-task-form__responsible-avatar ${resp.avatarColorClass}`}
                title={`${resp.last_name} ${resp.first_name} ${
                  resp.middle_name || ''
                }`}
              >
                {resp.initials}
              </div>
              <div className="create-global-task-form__responsible-details">
                <div className="create-global-task-form__responsible-name">
                  {`${resp.last_name} ${resp.first_name[0]}. ${
                    resp.middle_name ? resp.middle_name[0] + '.' : ''
                  }`}
                </div>
                {/* Роль */}
                <select
                  className="create-global-task-form__responsible-role-select"
                  value={resp.role}
                  onChange={(e) =>
                    handleResponsibleRoleChange(resp.id, e.target.value)
                  }
                >
                  {responsibleRolesList.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              {/* Кнопка удаления */}
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

        {/* Выбор ответственного */}
        <div className="create-global-task-form__add-responsible-section">
          <FaUserPlus className="create-global-task-form__add-responsible-icon" />
          <select
            className="create-global-task-form__select"
            style={{ width: '100%' }}
            onChange={(e) => {
              const userId = parseInt(e.target.value, 10)
              if (!isNaN(userId)) {
                handleResponsibleSelect(userId)
              }
              e.target.value = ''
            }}
            value=""
            disabled={loading}
          >
            <option value="" disabled>
              {loading
                ? 'Загрузка пользователей...'
                : 'Выберите ответственного'}
            </option>
            {users
              .filter(
                (user) =>
                  !responsibles.some((resp) => resp.id === user.id) &&
                  !responsiblesBefor.some((resp) => resp.id === user.id) // Фильтрация по responsiblesBefor
              )
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {`${user.last_name} ${user.first_name[0]}. ${
                    user.middle_name ? user.middle_name[0] + '.' : ''
                  }`}
                </option>
              ))}
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
            onClick={() => {
              handleAddResponsibles()
            }}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResponsibleSelector
