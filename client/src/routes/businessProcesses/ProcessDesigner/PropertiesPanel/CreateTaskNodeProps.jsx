import { useState, useEffect } from 'react'
import {
  getReferencesUsers,
  getReferencesDepartments,
  getReferencesRoles,
  getTaskTemplates,
} from '../../../../api/businessProcessApi.js'
import { ASSIGNEE_SOURCES, CREATE_TASK_MODES } from '../../constants/blockTypes'
import './PropertiesPanel.scss'

const CreateTaskNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const [u, d, r] = await Promise.all([
          getReferencesUsers().catch(() => []),
          getReferencesDepartments().catch(() => []),
          getReferencesRoles().catch(() => []),
        ])
        setUsers(Array.isArray(u) ? u : [])
        setDepartments(Array.isArray(d) ? d : [])
        setRoles(Array.isArray(r) ? r : [])
      } catch (e) {
        console.error(e)
      }
    }
    load()
  }, [])

  useEffect(() => {
    getTaskTemplates()
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
  }, [])

  const handleChange = (key, value) => {
    onUpdate({ settings: { ...settings, [key]: value } })
  }

  const handleMultiChange = (key, value) => {
    const arr = settings[key] || []
    const next = Array.isArray(value) ? value : (arr.includes(value) ? arr.filter((id) => id !== value) : [...arr, value])
    onUpdate({ settings: { ...settings, [key]: next } })
  }

  const priorityOptions = [
    { value: 'низкий', label: 'Низкий' },
    { value: 'средний', label: 'Средний' },
    { value: 'высокий', label: 'Высокий' },
  ]

  const createMode = settings.createMode ?? 'prepared'

  return (
    <div className="properties-panel__fields">
      <div className="properties-panel__field">
        <label className="properties-panel__label">Режим создания задачи</label>
        <select
          className="properties-panel__select"
          value={createMode}
          onChange={(e) => handleChange('createMode', e.target.value)}
        >
          {CREATE_TASK_MODES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="properties-panel__hint">
          {createMode === 'prepared'
            ? 'Задача создаётся сразу при прохождении процесса по данным шаблона ниже.'
            : 'При запуске процесса пользователю откроется окно создания задачи (как в Менеджере задач) с подставленными данными шаблона.'}
        </p>
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Шаблон задачи (BPE)</label>
        <select
          className="properties-panel__select"
          value={settings.templateId ?? ''}
          onChange={(e) => handleChange('templateId', e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Без шаблона —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <p className="properties-panel__hint">Базовые значения названия, приоритета, дедлайна (если заданы в шаблоне)</p>
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Название задачи (шаблон)</label>
        <input
          type="text"
          className="properties-panel__input"
          value={settings.title ?? ''}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="Подставится при создании задачи"
        />
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Описание (шаблон, HTML)</label>
        <textarea
          className="properties-panel__input properties-panel__textarea"
          value={settings.description ?? ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Текст/HTML как в Менеджере задач"
          rows={3}
        />
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Приоритет</label>
        <select
          className="properties-panel__select"
          value={settings.priority ?? 'низкий'}
          onChange={(e) => handleChange('priority', e.target.value)}
        >
          {priorityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Автор задачи</label>
        <select
          className="properties-panel__select"
          value={settings.authorSource ?? 'initiator'}
          onChange={(e) => handleChange('authorSource', e.target.value)}
        >
          <option value="initiator">Инициатор процесса</option>
          <option value="fixed">Конкретный пользователь</option>
        </select>
      </div>
      {settings.authorSource === 'fixed' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Пользователь (автор)</label>
          <select
            className="properties-panel__select"
            value={settings.authorUserId ?? ''}
            onChange={(e) => handleChange('authorUserId', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Выберите —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="properties-panel__field">
        <label className="properties-panel__label">Исполнители</label>
        <select
          className="properties-panel__select"
          value={settings.assigneeSource ?? 'users'}
          onChange={(e) => handleChange('assigneeSource', e.target.value)}
        >
          {ASSIGNEE_SOURCES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {settings.assigneeSource === 'users' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Пользователи (исполнители)</label>
          <select
            className="properties-panel__select"
            multiple
            value={settings.assigneeUserIds || []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (o) => Number(o.value))
              handleChange('assigneeUserIds', selected)
            }}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}
              </option>
            ))}
          </select>
          <small className="properties-panel__hint">Ctrl+клик для нескольких</small>
        </div>
      )}
      {settings.assigneeSource === 'department' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Отдел</label>
          <select
            className="properties-panel__select"
            value={settings.departmentId ?? ''}
            onChange={(e) => handleChange('departmentId', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Выберите —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}
      {settings.assigneeSource === 'role' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Роль</label>
          <select
            className="properties-panel__select"
            value={settings.roleId ?? ''}
            onChange={(e) => handleChange('roleId', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Выберите —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="properties-panel__field">
        <label className="properties-panel__label">Утверждающие (шаблон)</label>
        <select
          className="properties-panel__select"
          multiple
          value={settings.approverUserIds || []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, (o) => Number(o.value))
            handleChange('approverUserIds', selected)
          }}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}
            </option>
          ))}
        </select>
        <small className="properties-panel__hint">Ctrl+клик для нескольких</small>
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Наблюдатели (шаблон)</label>
        <select
          className="properties-panel__select"
          multiple
          value={settings.viewerUserIds || []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, (o) => Number(o.value))
            handleChange('viewerUserIds', selected)
          }}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}
            </option>
          ))}
        </select>
        <small className="properties-panel__hint">Ctrl+клик для нескольких</small>
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Дедлайн (смещение в днях)</label>
        <input
          type="number"
          className="properties-panel__input"
          value={settings.deadlineOffsetDays ?? ''}
          onChange={(e) => handleChange('deadlineOffsetDays', e.target.value === '' ? null : Number(e.target.value))}
          placeholder="Пусто — без дедлайна"
          min={0}
        />
      </div>

      <p className="properties-panel__hint" style={{ marginTop: '0.5rem' }}>
        Задача из этого блока отслеживается по выполнению, срокам и статусу — условия можно задать в блоке «Развилка».
      </p>
    </div>
  )
}

export default CreateTaskNodeProps
