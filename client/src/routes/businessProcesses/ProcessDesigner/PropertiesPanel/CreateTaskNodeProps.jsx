import { useState, useEffect } from 'react'
import {
  getReferencesUsers,
  getReferencesDepartments,
  getReferencesRoles,
  getTaskTemplates,
} from '../../../../api/businessProcessApi.js'
import { ASSIGNEE_SOURCES, CREATE_TASK_MODES } from '../../constants/blockTypes'
import UserCheckboxList from './UserCheckboxList'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import './PropertiesPanel.scss'

// Значение для input type="datetime-local": дата/время в локальной зоне в формате YYYY-MM-DDTHH:mm
function toDateTimeLocalValue(deadline) {
  if (!deadline) return ''
  const d = new Date(deadline)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const CreateTaskNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])
  const [templates, setTemplates] = useState([])
  const { scheme } = useBusinessProcessStore()

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
  const projectNodes = Array.isArray(scheme?.nodes) ? scheme.nodes.filter((n) => n.type === 'create_project') : []
  const taskNodes = Array.isArray(scheme?.nodes) ? scheme.nodes.filter((n) => n.type === 'create_task' && n.id !== node?.id) : []
  const linkToProject = settings.linkToProject === true
  const projectSource = settings.projectSource || 'last'
  const linkToParentTask = settings.linkToParentTask === true
  const parentTaskSource = settings.parentTaskSource || 'last'

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
        <label className="properties-panel__checkbox-row">
          <input
            type="checkbox"
            checked={linkToProject}
            onChange={(e) => handleChange('linkToProject', e.target.checked)}
          />
          <span>Создавать как <b>подзадачу проекта</b> (global_task_id)</span>
        </label>
        {linkToProject && (
          <>
            <select
              className="properties-panel__select"
              value={projectSource}
              onChange={(e) => handleChange('projectSource', e.target.value)}
              style={{ marginTop: 6 }}
            >
              <option value="last">Последний созданный проект в процессе</option>
              <option value="by_node" disabled={projectNodes.length === 0}>По блоку «Создать проект»</option>
              <option value="fixed">Фиксированный ID проекта</option>
            </select>

            {projectSource === 'by_node' && (
              <select
                className="properties-panel__select"
                value={settings.projectNodeId ?? ''}
                onChange={(e) => handleChange('projectNodeId', e.target.value || null)}
                style={{ marginTop: 6 }}
              >
                <option value="">— Выберите блок «Создать проект» —</option>
                {projectNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.label || n.id}</option>
                ))}
              </select>
            )}

            {projectSource === 'fixed' && (
              <input
                type="number"
                className="properties-panel__input"
                value={settings.fixedProjectId ?? ''}
                onChange={(e) => handleChange('fixedProjectId', e.target.value ? Number(e.target.value) : null)}
                placeholder="ID проекта (global_task_id)"
                style={{ marginTop: 6 }}
              />
            )}

            {createMode === 'modal_at_runtime' && (
              <p className="properties-panel__hint" style={{ color: '#b45309' }}>
                В режиме «окно при запуске» подзадача проекта передаётся как параметр. Убедитесь, что окно создания задачи
                умеет принимать <b>global_task_id</b>.
              </p>
            )}
          </>
        )}
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__checkbox-row">
          <input
            type="checkbox"
            checked={linkToParentTask}
            onChange={(e) => handleChange('linkToParentTask', e.target.checked)}
          />
          <span>Создавать как <b>подзадачу задачи из схемы</b> (parent_id)</span>
        </label>
        {linkToParentTask && (
          <>
            <select
              className="properties-panel__select"
              value={parentTaskSource}
              onChange={(e) => handleChange('parentTaskSource', e.target.value)}
              style={{ marginTop: 6 }}
            >
              <option value="last">Последняя созданная задача в процессе</option>
              <option value="by_node" disabled={taskNodes.length === 0}>По блоку «Создать задачу»</option>
              <option value="fixed">Фиксированный ID задачи</option>
            </select>

            {parentTaskSource === 'by_node' && (
              <select
                className="properties-panel__select"
                value={settings.parentTaskNodeId ?? ''}
                onChange={(e) => handleChange('parentTaskNodeId', e.target.value || null)}
                style={{ marginTop: 6 }}
              >
                <option value="">— Выберите блок «Создать задачу» —</option>
                {taskNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.label || n.id}</option>
                ))}
              </select>
            )}

            {parentTaskSource === 'fixed' && (
              <input
                type="number"
                className="properties-panel__input"
                value={settings.fixedParentTaskId ?? ''}
                onChange={(e) => handleChange('fixedParentTaskId', e.target.value ? Number(e.target.value) : null)}
                placeholder="ID родительской задачи (task_id)"
                style={{ marginTop: 6 }}
              />
            )}

            <p className="properties-panel__hint" style={{ marginTop: 6 }}>
              Новая задача будет создана как связанная подзадача выбранной задачи. Режим «окно при запуске» не поддерживается.
            </p>
          </>
        )}
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
        <div className="properties-panel__hint">Подстановка: <b>{'{доп:ключ}'}</b> или <b>{'{{ключ}}'}</b></div>
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
        <div className="properties-panel__hint">Подстановка: <b>{'{доп:ключ}'}</b> или <b>{'{{ключ}}'}</b></div>
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
          <UserCheckboxList
            users={users}
            selectedIds={settings.assigneeUserIds || []}
            onChange={(ids) => handleChange('assigneeUserIds', ids)}
          />
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
        <UserCheckboxList
          users={users}
          selectedIds={settings.approverUserIds || []}
          onChange={(ids) => handleChange('approverUserIds', ids)}
        />
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Наблюдатели (шаблон)</label>
        <UserCheckboxList
          users={users}
          selectedIds={settings.viewerUserIds || []}
          onChange={(ids) => handleChange('viewerUserIds', ids)}
        />
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Режим дедлайна</label>
        <select
          className="properties-panel__select"
          value={
            settings.deadlineMode ??
            (settings.deadline
              ? 'fixed'
              : settings.deadlineOffsetDays != null
                ? 'offset'
                : 'none')
          }
          onChange={(e) => {
            const mode = e.target.value
            const patch = { deadlineMode: mode }
            if (mode === 'none') {
              patch.deadline = null
              patch.deadlineOffsetDays = null
              patch.conditionalDeadline = null
            } else if (mode === 'fixed') {
              patch.deadlineOffsetDays = null
              patch.conditionalDeadline = null
            } else if (mode === 'offset') {
              patch.deadline = null
              patch.conditionalDeadline = null
            } else if (mode === 'conditional') {
              patch.deadline = null
              patch.deadlineOffsetDays = null
              // Инициализируем правило, иначе в схеме не сохранятся значения и движок не поставит дедлайн
              patch.conditionalDeadline = {
                boundary: settings.conditionalDeadline?.boundary ?? '12:00',
                sameDayTime: settings.conditionalDeadline?.sameDayTime ?? '18:00',
                nextDayTime: settings.conditionalDeadline?.nextDayTime ?? '16:00',
              }
            }
            onUpdate({ settings: { ...settings, ...patch } })
          }}
        >
          <option value="none">Без дедлайна</option>
          <option value="fixed">Конкретная дата и время</option>
          <option value="offset">Смещение в днях</option>
          <option value="conditional">По условию (граница времени)</option>
        </select>
        {(settings.deadlineMode ?? (settings.deadline ? 'fixed' : settings.deadlineOffsetDays != null ? 'offset' : 'none')) === 'fixed' && (
          <>
            <input
              type="datetime-local"
              className="properties-panel__input"
              value={toDateTimeLocalValue(settings.deadline)}
              onChange={(e) => handleChange('deadline', e.target.value || null)}
              style={{ marginTop: 6 }}
            />
            <p className="properties-panel__hint" style={{ marginTop: 4, fontSize: '0.8rem' }}>
              Укажите и дату, и время — в карточке задачи отобразится выбранное значение.
            </p>
          </>
        )}
        {(settings.deadlineMode ?? (settings.deadline ? 'fixed' : settings.deadlineOffsetDays != null ? 'offset' : 'none')) === 'offset' && (
          <input
            type="number"
            className="properties-panel__input"
            value={settings.deadlineOffsetDays ?? ''}
            onChange={(e) => handleChange('deadlineOffsetDays', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="Дней от текущей даты"
            min={0}
            style={{ marginTop: 6 }}
          />
        )}
        {(settings.deadlineMode ?? '') === 'conditional' && (
          <div style={{ marginTop: 8 }}>
            <p className="properties-panel__hint">Если момент обработки ≤ границы — дедлайн сегодня в «Время сегодня»; иначе — завтра в «Время след. дня».</p>
            <label className="properties-panel__label" style={{ marginTop: 6 }}>Граница времени (ЧЧ:ММ)</label>
            <input
              type="text"
              className="properties-panel__input"
              value={settings.conditionalDeadline?.boundary ?? '12:00'}
              onChange={(e) => handleChange('conditionalDeadline', { ...settings.conditionalDeadline, boundary: e.target.value || '12:00' })}
              placeholder="12:00"
            />
            <label className="properties-panel__label" style={{ marginTop: 6 }}>Время сегодня (ЧЧ:ММ)</label>
            <input
              type="text"
              className="properties-panel__input"
              value={settings.conditionalDeadline?.sameDayTime ?? '18:00'}
              onChange={(e) => handleChange('conditionalDeadline', { ...settings.conditionalDeadline, sameDayTime: e.target.value || '18:00' })}
              placeholder="18:00"
            />
            <label className="properties-panel__label" style={{ marginTop: 6 }}>Время след. дня (ЧЧ:ММ)</label>
            <input
              type="text"
              className="properties-panel__input"
              value={settings.conditionalDeadline?.nextDayTime ?? '16:00'}
              onChange={(e) => handleChange('conditionalDeadline', { ...settings.conditionalDeadline, nextDayTime: e.target.value || '16:00' })}
              placeholder="16:00"
            />
          </div>
        )}
      </div>

      <p className="properties-panel__hint" style={{ marginTop: '0.5rem' }}>
        Задача из этого блока отслеживается по выполнению, срокам и статусу — условия можно задать в блоке «Развилка».
      </p>
    </div>
  )
}

export default CreateTaskNodeProps
