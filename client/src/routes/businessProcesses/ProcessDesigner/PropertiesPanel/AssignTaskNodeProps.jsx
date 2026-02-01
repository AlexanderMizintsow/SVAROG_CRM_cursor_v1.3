import { useState, useEffect } from 'react'
import {
  getReferencesUsers,
  getReferencesDepartments,
  getReferencesRoles,
} from '../../../../api/businessProcessApi.js'
import { ASSIGNEE_SOURCES } from '../../constants/blockTypes'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import './PropertiesPanel.scss'

const AssignTaskNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const { scheme } = useBusinessProcessStore()
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])

  const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
  const taskSourceNodes = nodesList.filter(
    (n) => n.type === 'create_task' || n.type === 'assign_task'
  )

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

  const handleChange = (key, value) => {
    onUpdate({ settings: { ...settings, [key]: value } })
  }

  return (
    <div className="properties-panel__fields">
      <p className="properties-panel__hint" style={{ marginBottom: '0.5rem' }}>
        Блок «Назначить задачу» считается устаревшим. В большинстве сценариев достаточно настроить исполнителей прямо в блоке «Создать задачу».
      </p>
      <div className="properties-panel__field">
        <label className="properties-panel__label">Задача из блока</label>
        <select
          className="properties-panel__select"
          value={settings.sourceNodeId ?? ''}
          onChange={(e) => handleChange('sourceNodeId', e.target.value || null)}
        >
          <option value="">— Выберите блок —</option>
          {taskSourceNodes.map((n) => (
            <option key={n.id} value={n.id}>{n.label || n.type}</option>
          ))}
        </select>
      </div>
      <div className="properties-panel__field">
        <label className="properties-panel__label">Кому назначить</label>
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
          <label className="properties-panel__label">Пользователи</label>
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
    </div>
  )
}

export default AssignTaskNodeProps
