import { useState, useEffect } from 'react'
import { getReferencesUsers, getReferencesRoles } from '../../../../api/businessProcessApi.js'
import { INITIATOR_TYPES } from '../../constants/blockTypes'
import UserCheckboxList from './UserCheckboxList'
import './PropertiesPanel.scss'

const StartNodeProps = ({ node, onUpdate, absencesMap = {} }) => {
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

  const allowAllLaunchers = settings.allowAllLaunchers !== false

  return (
    <div className="properties-panel__fields">
      <div className="properties-panel__field">
        <label className="properties-panel__label">Кто может запускать процесс</label>
        <label className="properties-panel__hint" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={allowAllLaunchers}
            onChange={(e) => {
              const nextAllowAll = e.target.checked
              // Один вызов onUpdate с обоими полями, чтобы избежать перезаписи при батчинге
              onUpdate({
                settings: {
                  ...settings,
                  allowAllLaunchers: nextAllowAll,
                  ...(nextAllowAll ? { allowedLauncherUserIds: [] } : {}),
                },
              })
            }}
          />
          Разрешить запуск всем
        </label>
        {!allowAllLaunchers && (
          <>
            <p className="properties-panel__hint" style={{ marginTop: '0.25rem' }}>
              Если список пуст — запуск будет запрещён всем.
            </p>
            <UserCheckboxList
              users={users}
              selectedIds={settings.allowedLauncherUserIds || []}
              onChange={(ids) => handleChange('allowedLauncherUserIds', ids)}
              absencesMap={absencesMap}
            />
          </>
        )}
      </div>

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
