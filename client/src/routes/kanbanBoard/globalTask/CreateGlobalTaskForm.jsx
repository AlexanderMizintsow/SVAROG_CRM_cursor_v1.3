import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import { FaPlus, FaTrashAlt, FaUserPlus } from 'react-icons/fa'
import {
  responsibleRolesList,
  generateRandomBackgroundColorClass,
  generateRandomAvatarColorClass,
  generateInitials,
} from './utils/globalTaskUtils'
import { useActiveAbsences } from '../../../utils/useActiveAbsences'
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
} from '../../../utils/userAbsenceUtils'
import AbsenceAssigneeChoiceModal from '../../../components/absenceAssigneeChoice/AbsenceAssigneeChoiceModal'
import KnowledgeLinkPicker from '../../knowledgeBase/KnowledgeLinkPicker'
import useUserStore from '../../../store/userStore'
import Toastify from 'toastify-js'
import ProjectTemplateTools from './projectTemplates/ProjectTemplateTools'
import {
  formToTemplateBody,
  keepKnownResponsibles,
  templatePartsToDeadline,
} from './projectTemplates/projectTemplateFields'
import { updateUserProjectTemplate } from './projectTemplates/projectTemplateApi'
import './styles/CreateGlobalTaskForm.scss'

// Значение для input type="datetime-local": YYYY-MM-DDTHH:mm в локальной зоне
const toDateTimeLocalValue = (deadline) => {
  if (!deadline) return ''
  const d = deadline instanceof Date ? deadline : new Date(deadline)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatDateRuLocal = (dateStr) => {
  const normalized = normalizeDateOnly(dateStr)
  if (!normalized) return ''
  const parts = normalized.split('-')
  if (parts.length !== 3) return normalized
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

const CreateGlobalTaskForm = ({ onSave, onCancel, initialData }) => {
  const { user } = useUserStore()
  const userId = user?.id
  const [users, setUsers] = useState([])
  const [responsibleRoles, setResponsibleRoles] = useState(responsibleRolesList)
  const [attachmentsFiles, setAttachmentsFiles] = useState([])
  const [kbLinkPickerOpen, setKbLinkPickerOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goals: [''],
    deadline: null,
    priority: 'medium',
    additionalInfo: {},
    responsibles: [],
  })

  const [additionalInfoFields, setAdditionalInfoFields] = useState([
    { key: '', value: '' },
  ])

  const [loadingUsers, setLoadingUsers] = useState(true)
  const [initialDataApplied, setInitialDataApplied] = useState(false)
  const [absenceMeta, setAbsenceMeta] = useState([])
  const [choiceQueue, setChoiceQueue] = useState([])
  const [currentChoice, setCurrentChoice] = useState(null)
  const choiceDecisionsRef = useRef({})
  const choiceEntriesRef = useRef([])
  const { absencesMap } = useActiveAbsences(true)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templatesVersion, setTemplatesVersion] = useState(0)
  const editSnapshotRef = useRef(null)

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
        role: r.role || ((Array.isArray(responsibleRolesList) && responsibleRolesList.includes('Участник')) ? 'Участник' : ((Array.isArray(responsibleRolesList) && responsibleRolesList[0]) || 'Исполнитель')),
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

  const handleDeadlineChange = (e) => {
    const value = e.target.value
    if (!value) {
      setFormData({ ...formData, deadline: null })
      return
    }
    const d = new Date(value)
    setFormData({
      ...formData,
      deadline: Number.isNaN(d.getTime()) ? null : d,
    })
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

  const buildResponsibleEntry = (user) => ({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    middle_name: user.middle_name,
    initials: generateInitials(user.first_name, user.last_name),
    avatarColorClass: generateRandomAvatarColorClass(),
    backgroundColorClass: generateRandomBackgroundColorClass(),
    role:
      Array.isArray(responsibleRolesList) && responsibleRolesList.includes('Участник')
        ? 'Участник'
        : (Array.isArray(responsibleRoles) && responsibleRoles[0]) ||
          (responsibleRolesList && responsibleRolesList[0]) ||
          'Исполнитель',
    requires_approval: false,
  })

  const handleResponsibleSelect = (userId) => {
    const resolution = resolveUserSelection(userId, absencesMap, users, {
      deadline: formData.deadline || null,
    })

    if (resolution.message) {
      showAbsenceMessage(resolution.message, resolution.blocked)
    }

    if (!resolution.added || resolution.effectiveId == null) return

    const selectedUser = users.find((user) => Number(user.id) === Number(resolution.effectiveId))
    if (!selectedUser) return

    if (formData.responsibles.find((resp) => Number(resp.id) === Number(selectedUser.id))) {
      showAbsenceMessage(
        resolution.substituted ? 'Замещающий уже добавлен в проект' : 'Участник уже добавлен в проект',
        true
      )
      return
    }

    const newResponsible = buildResponsibleEntry(selectedUser)
    setFormData({
      ...formData,
      responsibles: [...formData.responsibles, newResponsible],
    })

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
    setAbsenceMeta((prev) =>
      (prev || []).filter((entry) => String(entry.effectiveId) !== String(userId))
    )
  }

  useEffect(() => {
    setAbsenceMeta((prev) =>
      refreshAbsenceMetaNotes(prev, formData.deadline, users, absencesMap)
    )
  }, [formData.deadline, users, absencesMap])

  const notesByEffectiveId = (() => {
    const map = {}
    ;(absenceMeta || []).forEach((entry) => {
      map[String(entry.effectiveId)] = entry.note || null
    })
    return map
  })()

  const finalizeSave = useCallback(
    (decisions = {}, metaOverride = null) => {
      const meta = metaOverride || absenceMeta
      const responsibles = applyAbsenceDecisionsToResponsibles(
        formData.responsibles,
        meta,
        decisions,
        users
      )
      onSave({ ...formData, responsibles, attachmentsFiles })
    },
    [formData, absenceMeta, users, attachmentsFiles, onSave]
  )

  const snapshotForm = useCallback(
    () => ({
      formData: {
        ...formData,
        goals: [...(formData.goals || [])],
        responsibles: (formData.responsibles || []).map((item) => ({ ...item })),
        additionalInfo: { ...(formData.additionalInfo || {}) },
      },
      additionalInfoFields: (additionalInfoFields || []).map((field) => ({ ...field })),
    }),
    [formData, additionalInfoFields]
  )

  const writeProjectForm = useCallback((snapshot) => {
    if (!snapshot) return
    setFormData(snapshot.formData)
    setAdditionalInfoFields(
      snapshot.additionalInfoFields?.length
        ? snapshot.additionalInfoFields
        : [{ key: '', value: '' }]
    )
    setInitialDataApplied(true)
  }, [])

  const applyProjectTemplate = useCallback(
    (template, options = {}) => {
      const { kept, dropped } = keepKnownResponsibles(template?.responsibles, users)
      const roleOptions = Array.isArray(responsibleRoles) ? responsibleRoles : responsibleRolesList
      const responsibles = kept
        .map((item) => {
          const user = users.find((entry) => String(entry.id) === String(item.userId))
          if (!user) return null
          const entry = buildResponsibleEntry(user)
          const role = roleOptions.includes(item.role) ? item.role : entry.role
          return {
            ...entry,
            role,
            requires_approval: item.requiresApproval === true,
          }
        })
        .filter(Boolean)
      const goals = Array.isArray(template?.goals) && template.goals.length ? template.goals : ['']
      const additionalInfo =
        template?.additionalInfo && typeof template.additionalInfo === 'object'
          ? template.additionalInfo
          : {}
      const entries = Object.entries(additionalInfo)
      setFormData({
        title: template?.title || '',
        description: template?.description || '',
        goals,
        deadline: templatePartsToDeadline(template?.deadlineOffsetDays, template?.deadlineTime),
        priority: ['low', 'medium', 'high'].includes(template?.priority) ? template.priority : 'medium',
        additionalInfo,
        responsibles,
      })
      setAdditionalInfoFields(
        entries.length
          ? entries.map(([key, value]) => ({ key, value: String(value ?? '') }))
          : [{ key: '', value: '' }]
      )
      setInitialDataApplied(true)
      if (!options.keepEditing) {
        setEditingTemplate(null)
        editSnapshotRef.current = null
      }
      if (dropped > 0) {
        Toastify({
          text: 'Часть сотрудников из шаблона уже недоступна и не подставлена.',
          close: true,
          backgroundColor: 'linear-gradient(to right, #b45309, #f59e0b)',
        }).showToast()
      }
    },
    [users, responsibleRoles]
  )

  const startTemplateEdit = useCallback(
    (template) => {
      editSnapshotRef.current = snapshotForm()
      applyProjectTemplate(template, { keepEditing: true })
      setEditingTemplate({ id: template.id, name: template.name || '' })
    },
    [snapshotForm, applyProjectTemplate]
  )

  const cancelTemplateEdit = useCallback(() => {
    const snapshot = editSnapshotRef.current
    editSnapshotRef.current = null
    setEditingTemplate(null)
    if (snapshot) writeProjectForm(snapshot)
  }, [writeProjectForm])

  const saveEditingTemplate = useCallback(async () => {
    if (!editingTemplate || !userId) return
    const name = String(editingTemplate.name || '').trim()
    if (!name) {
      Toastify({
        text: 'Укажите название шаблона',
        close: true,
        backgroundColor: 'linear-gradient(to right, #8B0000, #ff0000)',
      }).showToast()
      return
    }
    setSavingTemplate(true)
    try {
      await updateUserProjectTemplate(userId, editingTemplate.id, formToTemplateBody(formData, name))
      setEditingTemplate(null)
      editSnapshotRef.current = null
      setTemplatesVersion((version) => version + 1)
      Toastify({
        text: 'Шаблон обновлён',
        close: true,
        backgroundColor: 'linear-gradient(to right, #0f766e, #14b8a6)',
      }).showToast()
    } catch (error) {
      Toastify({
        text: error?.response?.data?.error || 'Не удалось обновить шаблон',
        close: true,
        backgroundColor: 'linear-gradient(to right, #8B0000, #ff0000)',
      }).showToast()
    } finally {
      setSavingTemplate(false)
    }
  }, [editingTemplate, userId, formData])

  const handleSubmit = (e) => {
    e.preventDefault()

    if (editingTemplate) {
      saveEditingTemplate()
      return
    }

    if (!formData.responsibles.length) {
      showAbsenceMessage('Необходимо указать хотя бы одного ответственного', true)
      return
    }

    const invalidSkip = (absenceMeta || []).find(
      (entry) =>
        entry.needsSkipSubstitution &&
        entry.absence &&
        !isDeadlineAfterAbsence(formData.deadline, entry.absence)
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
      formData.deadline,
      absencesMap
    )
    const choiceKeys = new Set(
      choicesFromMeta.map((c) => String(c.effectiveId))
    )
    const choices = [...choicesFromMeta]
    findAbsenceChoicesFromAssignees(
      formData.responsibles.map((r) => r.id),
      formData.deadline,
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
      choiceEntriesRef.current = choices
      setAbsenceMeta((prev) => {
        const next = [...(prev || [])]
        choices.forEach((entry) => {
          const exists = next.some(
            (e) => String(e.effectiveId) === String(entry.effectiveId)
          )
          if (!exists) next.push(entry)
        })
        return refreshAbsenceMetaNotes(next, formData.deadline, users, absencesMap)
      })
      setChoiceQueue(choices)
      setCurrentChoice(choices[0])
      return
    }

    choiceEntriesRef.current = []
    finalizeSave({})
  }

  const finishAbsenceChoice = (decision) => {
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
    const mergedMeta = [...(absenceMeta || [])]
    ;(choiceEntriesRef.current || []).forEach((entry) => {
      const exists = mergedMeta.some(
        (e) => String(e.effectiveId) === String(entry.effectiveId)
      )
      if (!exists) mergedMeta.push(entry)
    })
    choiceEntriesRef.current = []
    finalizeSave(choiceDecisionsRef.current, mergedMeta)
  }

  const cancelAbsenceChoice = () => {
    setChoiceQueue([])
    setCurrentChoice(null)
    choiceDecisionsRef.current = {}
    choiceEntriesRef.current = []
  }

  return (
    <div className="create-global-task-form-overlay">
      <div className="create-global-task-form-shell">
      <ProjectTemplateTools
        userId={userId}
        users={users}
        getFormData={() => formData}
        formToBody={formToTemplateBody}
        onApply={applyProjectTemplate}
        onStartEdit={startTemplateEdit}
        templatesVersion={templatesVersion}
      />
      <div className="create-global-task-form">
        <div className="create-global-task-form__header">
          <h2 className="create-global-task-form__title">Создать проект</h2>
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
        {editingTemplate && (
          <div className="project-template-edit">
            <span className="project-template-edit__label">Редактирование шаблона</span>
            <input
              type="text"
              className="project-template-edit__name"
              value={editingTemplate.name}
              onChange={(e) =>
                setEditingTemplate((prev) => (prev ? { ...prev, name: e.target.value } : prev))
              }
              placeholder="Название шаблона"
            />
            <button type="button" className="project-template-edit__cancel" onClick={cancelTemplateEdit}>
              К созданию проекта
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} noValidate={Boolean(editingTemplate)}>
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
            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                className="create-global-task-form__add-button"
                onClick={() => setKbLinkPickerOpen(true)}
              >
                Ссылка на базу знаний
              </button>
            </div>
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
            <input
              type="datetime-local"
              id="deadline"
              name="deadline"
              className="create-global-task-form__input"
              value={toDateTimeLocalValue(formData.deadline)}
              onChange={handleDeadlineChange}
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
            <label className="create-global-task-form__label">Файлы (необязательно)</label>
            <input
              type="file"
              className="create-global-task-form__input"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length === 0) return
                setAttachmentsFiles((prev) => [...prev, ...files])
                e.target.value = ''
              }}
            />
            {attachmentsFiles.length > 0 && (
              <div className="create-global-task-form__attachments">
                {attachmentsFiles.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} className="create-global-task-form__attachments-item">
                    <span title={f.name}>{f.name}</span>
                    <button
                      type="button"
                      className="create-global-task-form__remove-button"
                      onClick={() =>
                        setAttachmentsFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                      title="Удалить файл"
                    >
                      <FaTrashAlt />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                    {notesByEffectiveId[String(resp.id)] ? (
                      <div className="create-global-task-form__absence-note">
                        {notesByEffectiveId[String(resp.id)]}
                      </div>
                    ) : null}
                    {/* Выбор роли для ответственного */}
                    <select
                      className="create-global-task-form__responsible-role-select"
                      value={resp.role || ''}
                      onChange={(e) =>
                        handleResponsibleRoleChange(resp.id, e.target.value)
                      }
                    >
                      {(Array.isArray(responsibleRoles) ? responsibleRoles : responsibleRolesList || []).map((role) => (
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
                {sortUsersByLastName(
                  users.filter(
                    (user) =>
                      !formData.responsibles.find((resp) => resp.id === user.id)
                  )
                ).map((user) => {
                    const absenceLabel = getAbsenceLabel(absencesMap[Number(user.id)])
                    return (
                      <option key={user.id} value={user.id}>
                        {`${user.last_name || ''} ${(user.first_name || '')[0] || ''}. ${
                          (user.middle_name || '')[0] ? (user.middle_name || '')[0] + '.' : ''
                        }`}
                        {absenceLabel ? ` — ${absenceLabel}` : ''}
                      </option>
                    )
                  })}
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
              disabled={savingTemplate}
            >
              {editingTemplate ? (
                savingTemplate ? 'Сохранение…' : 'Сохранить шаблон'
              ) : (
                <>
                  <FaPlus /> Создать проект
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      </div>

      <KnowledgeLinkPicker
        open={kbLinkPickerOpen}
        userId={userId}
        onClose={() => setKbLinkPickerOpen(false)}
        onPick={(item) => {
          if (!item?.href) return
          const chunk = item.href
          setFormData((prev) => ({
            ...prev,
            description: prev.description
              ? `${prev.description.trim()}\n${chunk}`
              : chunk,
          }))
        }}
      />
      <AbsenceAssigneeChoiceModal
        open={Boolean(currentChoice)}
        entry={currentChoice}
        users={users}
        deadline={formData.deadline}
        appointmentLabel="участника проекта"
        deadlineCaption="Срок проекта"
        onKeepSubstitute={() => finishAbsenceChoice('substitute')}
        onAssignOriginal={() => finishAbsenceChoice('original')}
        onCancel={cancelAbsenceChoice}
      />
    </div>
  )
}

export default CreateGlobalTaskForm
