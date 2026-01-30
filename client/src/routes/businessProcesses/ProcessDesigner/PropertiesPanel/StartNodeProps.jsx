import { useState, useEffect } from 'react'
import { getReferencesUsers, getReferencesRoles } from '../../../../api/businessProcessApi.js'
import { INITIATOR_TYPES } from '../../constants/blockTypes'
import './PropertiesPanel.scss'

const StartNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const [u, r] = await Promise.all([
          getReferencesUsers().catch(() => []),
          getReferencesRoles().catch(() => []),
        ])
        setUsers(Array.isArray(u) ? u : [])
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
      <div className="properties-panel__field">
        <label className="properties-panel__label">Инициатор процесса</label>
        <select
          className="properties-panel__select"
          value={settings.initiatorType || 'current_user'}
          onChange={(e) => handleChange('initiatorType', e.target.value)}
        >
          {INITIATOR_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {settings.initiatorType === 'fixed_user' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Пользователь</label>
          <select
            className="properties-panel__select"
            value={settings.fixedUserId ?? ''}
            onChange={(e) => handleChange('fixedUserId', e.target.value ? Number(e.target.value) : null)}
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
      {settings.initiatorType === 'by_role' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Роль</label>
          <select
            className="properties-panel__select"
            value={settings.roleId ?? ''}
            onChange={(e) => handleChange('roleId', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Выберите —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

export default StartNodeProps
