import { useState, useEffect } from 'react'
import {
  getReferencesUsers,
  getReferencesDepartments,
  getReferencesRoles,
} from '../../../../api/businessProcessApi.js'
import { RECIPIENT_SOURCES, PRIORITY_OPTIONS } from '../../constants/blockTypes'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import './PropertiesPanel.scss'

const NotificationNodeProps = ({ node, onUpdate }) => {
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

  const handleChannelsChange = (channel, checked) => {
    const channels = { ...(settings.channels || { inApp: true, telegram: false }), [channel]: checked }
    onUpdate({ settings: { ...settings, channels } })
  }

  return (
    <div className="properties-panel__fields">
      <div className="properties-panel__field">
        <label className="properties-panel__label">Получатели</label>
        <select
          className="properties-panel__select"
          value={settings.recipientSource ?? 'users'}
          onChange={(e) => handleChange('recipientSource', e.target.value)}
        >
          {RECIPIENT_SOURCES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {settings.recipientSource === 'users' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Пользователи</label>
          <select
            className="properties-panel__select"
            multiple
            value={settings.userIds || []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (o) => Number(o.value))
              handleChange('userIds', selected)
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
      {settings.recipientSource === 'department' && (
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
      {settings.recipientSource === 'role' && (
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
      {settings.recipientSource === 'task_assignee' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Исполнитель задачи из блока</label>
          <select
            className="properties-panel__select"
            value={settings.taskSourceNodeId ?? ''}
            onChange={(e) => handleChange('taskSourceNodeId', e.target.value || null)}
          >
            <option value="">— Выберите блок —</option>
            {taskSourceNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.label || n.type}</option>
            ))}
          </select>
        </div>
      )}
      <div className="properties-panel__field">
        <label className="properties-panel__label">Каналы</label>
        <div className="properties-panel__checkbox-row">
          <input
            type="checkbox"
            id="notif-inapp"
            checked={settings.channels?.inApp !== false}
            onChange={(e) => handleChannelsChange('inApp', e.target.checked)}
          />
          <label htmlFor="notif-inapp">В приложении</label>
        </div>
        <div className="properties-panel__checkbox-row">
          <input
            type="checkbox"
            id="notif-telegram"
            checked={!!settings.channels?.telegram}
            onChange={(e) => handleChannelsChange('telegram', e.target.checked)}
          />
          <label htmlFor="notif-telegram">Telegram</label>
        </div>
      </div>
      <div className="properties-panel__field">
        <label className="properties-panel__label">Текст сообщения</label>
        <textarea
          className="properties-panel__textarea"
          value={settings.messageText ?? ''}
          onChange={(e) => handleChange('messageText', e.target.value)}
          placeholder="Подстановки: {инициатор}, {название_задачи}, {дедлайн}, {статус}"
          rows={4}
        />
      </div>
      <div className="properties-panel__field">
        <label className="properties-panel__label">Приоритет</label>
        <select
          className="properties-panel__select"
          value={settings.priority ?? 'normal'}
          onChange={(e) => handleChange('priority', e.target.value)}
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default NotificationNodeProps
