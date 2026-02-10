import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import DatePicker from 'react-datepicker'
import { ru } from 'date-fns/locale'
import { FaPlus, FaTrashAlt, FaUserPlus } from 'react-icons/fa'
import {
  responsibleRolesList,
  generateRandomBackgroundColorClass,
  generateRandomAvatarColorClass,
  generateInitials,
} from './utils/globalTaskUtils'
import 'react-datepicker/dist/react-datepicker.css'
import './styles/CreateGlobalTaskForm.scss'

const CreateGlobalTaskForm = ({ onSave, onCancel, initialData }) => {
  const [users, setUsers] = useState([])
  const [responsibleRoles, setResponsibleRoles] = useState(responsibleRolesList)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goals: [''],
    deadline: null,
    priority: 'medium',
    additionalInfo: {},
    responsibles: [], // Массив для выбранных ответственных
  })

  const [additionalInfoFields, setAdditionalInfoFields] = useState([
    { key: '', value: '' },
  ])

  const [loadingUsers, setLoadingUsers] = useState(true)
  const [initialDataApplied, setInitialDataApplied] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/users`)
        setUsers(response.data)
        setLoadingUsers(false)
      } catch (error) {
        console.error('Ошибка при получении пользователей:', error)
        setLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [])

  useEffect(() => {
    if (!initialData || initialDataApplied || !Object.keys(initialData).length) return
    const d = initialData
    const goals = Array.isArray(d.goals) && d.goals.length ? d.goals : ['']
    const additionalInfo = d.additionalInfo && typeof d.additionalInfo === 'object' && !Array.isArray(d.additionalInfo)
      ? d.additionalInfo
      : {}
    const entries = Object.entries(additionalInfo)
    const fields = entries.length
      ? entries.map(([k, v]) => ({ key: k, value: String(v ?? '') }))
      : [{ key: '', value: '' }]
    setFormData({
      title: d.title || '',
      description: d.description || '',
      goals,
      deadline: d.deadline ? (d.deadline instanceof Date ? d.deadline : new Date(d.deadline)) : null,
      priority: d.priority || 'medium',
      additionalInfo,
      responsibles: Array.isArray(d.responsibles) ? d.responsibles : [],
    })
    setAdditionalInfoFields(fields)
    setInitialDataApplied(true)
  }, [initialData, initialDataApplied])

  useEffect(() => {
    if (loadingUsers || !users.length || !initialDataApplied || !formData.responsibles.length) return
    const needEnrich = formData.responsibles.some((r) => r.id != null && (r.first_name == null || r.last_name == null))
    if (!needEnrich) return
    const enriched = formData.responsibles.map((r) => {
      const u = users.find((us) => us.id === r.id)
      if (!u) return r
      return {
        ...u,
        role: r.role || responsibleRolesList[0],
        requires_approval: r.requires_approval === true,
        initials: generateInitials(u.first_name, u.last_name),
        avatarColorClass: generateRandomAvatarColorClass(),
        backgroundColorClass: generateRandomBackgroundColorClass(),
      }
    })
    setFormData((prev) => ({ ...prev, responsibles: enriched }))
  }, [loadingUsers, users, initialDataApplied, formData.responsibles.length])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleDateChange = (date) => {
    setFormData({ ...formData, deadline: date })
  }

  const handleGoalChange = (index, value) => {
    const newGoals = [...formData.goals]
    newGoals[index] = value
    setFormData({ ...formData, goals: newGoals })
  }

  const addGoalField = () => {
    setFormData({ ...formData, goals: [...formData.goals, ''] })
  }

  const removeGoalField = (index) => {
    const newGoals = formData.goals.filter((_, i) => i !== index)
    setFormData({ ...formData, goals: newGoals })
  }

  const handleAdditionalInfoChange = (index, field, value) => {
    const newFields = [...additionalInfoFields]
    newFields[index][field] = value
    setAdditionalInfoFields(newFields)

    const updatedAdditionalInfo = newFields.reduce((acc, item) => {
      if (item.key.trim() !== '') {
        acc[item.key.trim()] = item.value
      }
      return acc
    }, {})
    setFormData({ ...formData, additionalInfo: updatedAdditionalInfo })
  }

  const addAdditionalInfoField = () => {
    setAdditionalInfoFields([...additionalInfoFields, { key: '', value: '' }])
  }

  const removeAdditionalInfoField = (index) => {
    const newFields = additionalInfoFields.filter((_, i) => i !== index)
    setAdditionalInfoFields(newFields)

    const updatedAdditionalInfo = newFields.reduce((acc, item) => {
      if (item.key.trim() !== '') {
        acc[item.key.trim()] = item.value
      }
      return acc
    }, {})
    setFormData({ ...formData, additionalInfo: updatedAdditionalInfo })
  }

  // Обновленная функция выбора ответственного
  const handleResponsibleSelect = (userId) => {
    const selectedUser = users.find((user) => user.id === userId)

    if (selectedUser) {
      if (!formData.responsibles.find((resp) => resp.id === selectedUser.id)) {
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
          role: responsibleRoles[0],
          requires_approval: false,
        }
        setFormData({
          ...formData,
          responsibles: [...formData.responsibles, newResponsible],
        })
      }
    }
  }

  const handleResponsibleRoleChange = (userId, newRole) => {
    const updatedResponsibles = formData.responsibles.map((resp) =>
      resp.id === userId ? { ...resp, role: newRole } : resp
    )
    setFormData({ ...formData, responsibles: updatedResponsibles })
  }

  const handleRequiresApprovalChange = (userId, value) => {
    const updatedResponsibles = formData.responsibles.map((resp) =>
      resp.id === userId ? { ...resp, requires_approval: !!value } : resp
    )
    setFormData({ ...formData, responsibles: updatedResponsibles })
  }

  const removeResponsible = (userId) => {
    const newResponsibles = formData.responsibles.filter(
      (resp) => resp.id !== userId
    )
    setFormData({ ...formData, responsibles: newResponsibles })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Отправляемые данные:', formData)
    onSave(formData)
  }

  return (
    <div className="create-global-task-form-overlay">
      <div className="create-global-task-form">
        <div className="create-global-task-form__header">
          <h2 className="create-global-task-form__title">Создать проект</h2>
          {/* Если есть кнопка закрытия в шапке, добавьте ее здесь */}
          {
            <button
              type="button"
              className="create-global-task-form__close-button"
              onClick={onCancel}
            >
              &times;
            </button>
          }
        </div>
        <form onSubmit={handleSubmit}>
          <div className="create-global-task-form__section">
            <label htmlFor="title" className="create-global-task-form__label">
              Заголовок <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              className="create-global-task-form__input"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="create-global-task-form__section">
            <label
              htmlFor="description"
              className="create-global-task-form__label"
            >
              Описание <span className="required">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              className="create-global-task-form__textarea"
              value={formData.description}
              onChange={handleChange}
              required
            ></textarea>
          </div>

          <div className="create-global-task-form__section">
            <label className="create-global-task-form__label">Цели</label>
            {formData.goals.map((goal, index) => (
              <div key={index} className="create-global-task-form__goal-field">
                <input
                  type="text"
                  className="create-global-task-form__input create-global-task-form__goal-input"
                  value={goal}
                  onChange={(e) => handleGoalChange(index, e.target.value)}
                  placeholder={`Цель ${index + 1}`}
                />
                {formData.goals.length > 1 && (
                  <button
                    type="button"
                    className="create-global-task-form__remove-button"
                    onClick={() => removeGoalField(index)}
                  >
                    <FaTrashAlt />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="create-global-task-form__add-button"
              onClick={addGoalField}
            >
              <FaPlus /> Добавить цель
            </button>
          </div>

          <div className="create-global-task-form__section">
            <label
              htmlFor="deadline"
              className="create-global-task-form__label"
            >
              Срок выполнения (дата и время)
            </label>
            <DatePicker
              id="deadline"
              selected={formData.deadline}
              onChange={handleDateChange}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="dd.MM.yyyy HH:mm"
              className="create-global-task-form__input"
              placeholderText="Выберите дату и время"
              isClearable
              locale={ru}
            />
          </div>

          <div className="create-global-task-form__section">
            <label
              htmlFor="priority"
              className="create-global-task-form__label"
            >
              Приоритет
            </label>
            <select
              id="priority"
              name="priority"
              className="create-global-task-form__select"
              value={formData.priority}
              onChange={handleChange}
            >
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
            </select>
          </div>

          <div className="create-global-task-form__section">
            <label className="create-global-task-form__label">
              Дополнительная информация
            </label>
            {additionalInfoFields.map((field, index) => (
              <div
                key={index}
                className="create-global-task-form__additional-info-field"
              >
                <input
                  type="text"
                  className="create-global-task-form__input create-global-task-form__additional-info-key"
                  value={field.key}
                  onChange={(e) =>
                    handleAdditionalInfoChange(index, 'key', e.target.value)
                  }
                  placeholder="Ключ (пример: № договора)"
                />
                <input
                  type="text"
                  className="create-global-task-form__input create-global-task-form__additional-info-value"
                  value={field.value}
                  onChange={(e) =>
                    handleAdditionalInfoChange(index, 'value', e.target.value)
                  }
                  placeholder="Значение"
                />
                {additionalInfoFields.length > 1 && (
                  <button
                    type="button"
                    className="create-global-task-form__remove-button"
                    onClick={() => removeAdditionalInfoField(index)}
                  >
                    <FaTrashAlt />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="create-global-task-form__add-button"
              onClick={addAdditionalInfoField}
            >
              <FaPlus /> Добавить поле
            </button>
          </div>

          {/* Ответственные - ОБНОВЛЕНО ДЛЯ ФОНА ЭЛЕМЕНТА */}
          <div className="create-global-task-form__section">
            <label className="create-global-task-form__label">
              Ответственные <span className="required">*</span>
            </label>
            <div className="create-global-task-form__responsibles-list">
              {formData.responsibles.map((resp, idx) => {
                const lastName = resp.last_name || ''
                const firstInitial = (resp.first_name || '')[0]
                const middleInitial = (resp.middle_name || '')[0]
                const nameDisplay = [lastName, firstInitial ? firstInitial + '.' : '', middleInitial ? middleInitial + '.' : '']
                  .filter(Boolean)
                  .join(' ') || `Участник ${resp.id != null ? resp.id : idx + 1}`
                return (
                <div
                  key={resp.id != null ? resp.id : idx}
                  className={`create-global-task-form__responsible-item ${resp.backgroundColorClass || ''}`}
                >
                  <div
                    className={`create-global-task-form__responsible-avatar ${resp.avatarColorClass || ''}`}
                    title={[resp.last_name, resp.first_name, resp.middle_name].filter(Boolean).join(' ') || nameDisplay}
                  >
                    {resp.initials != null ? resp.initials : (firstInitial || '') + (lastName[0] || '') || '?'}
                  </div>
                  <div className="create-global-task-form__responsible-details">
                    <div className="create-global-task-form__responsible-name">
                      {nameDisplay}
                    </div>
                    {/* Выбор роли для ответственного */}
                    <select
                      className="create-global-task-form__responsible-role-select"
                      value={resp.role || ''}
                      onChange={(e) =>
                        handleResponsibleRoleChange(resp.id, e.target.value)
                      }
                    >
                      {responsibleRoles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <label className="create-global-task-form__requires-approval-label">
                      <input
                        type="checkbox"
                        checked={!!resp.requires_approval}
                        onChange={(e) =>
                          handleRequiresApprovalChange(resp.id, e.target.checked)
                        }
                      />
                      <span>Требуется согласование</span>
                    </label>
                  </div>

                    <button
                    type="button"
                    className="create-global-task-form__remove-responsible-button"
                    onClick={() => removeResponsible(resp.id)}
                  >
                    <FaTrashAlt />
                  </button>
                </div>
                )
              })}
            </div>
            {/* Выбор ответственного */}
            <div className="create-global-task-form__add-responsible-section">
              <FaUserPlus className="create-global-task-form__add-responsible-icon" />
              <select
                className="create-global-task-form__select"
                onChange={(e) => {
                  const userId = parseInt(e.target.value, 10)
                  if (!isNaN(userId)) {
                    handleResponsibleSelect(userId)
                  }
                  e.target.value = ''
                }}
                value=""
                disabled={loadingUsers}
              >
                <option value="" disabled>
                  {loadingUsers
                    ? 'Загрузка пользователей...'
                    : 'Выберите ответственного'}
                </option>
                {users
                  .filter(
                    (user) =>
                      !formData.responsibles.find((resp) => resp.id === user.id)
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
          </div>

          {/* Кнопки действий */}
          <div className="create-global-task-form__actions">
            <button
              type="button"
              className="create-global-task-form__button create-global-task-form__button--cancel"
              onClick={onCancel}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="create-global-task-form__button create-global-task-form__button--save"
            >
              <FaPlus /> Создать проект
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateGlobalTaskForm
