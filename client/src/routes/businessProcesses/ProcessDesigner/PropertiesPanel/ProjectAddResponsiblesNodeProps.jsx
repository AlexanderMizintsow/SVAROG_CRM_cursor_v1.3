import { useEffect, useMemo, useState } from 'react'
import { getReferencesUsers } from '../../../../api/businessProcessApi'
import ProjectSourceSelector from './ProjectSourceSelector'
import './PropertiesPanel.scss'

const ProjectAddResponsiblesNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const [users, setUsers] = useState([])

  useEffect(() => {
    getReferencesUsers().then((u) => setUsers(Array.isArray(u) ? u : [])).catch(() => setUsers([]))
  }, [])

  const responsibles = useMemo(
    () => (Array.isArray(settings.responsibles) ? settings.responsibles : []),
    [settings.responsibles]
  )

  const handleChange = (patch) => onUpdate({ settings: { ...settings, ...(patch || {}) } })

  const patchResponsible = (idx, patch) => {
    const next = responsibles.map((r, i) => (i === idx ? { ...(r || {}), ...(patch || {}) } : r))
    handleChange({ responsibles: next })
  }
  const addResponsible = () => handleChange({ responsibles: [...responsibles, { id: null, role: 'Исполнитель', requires_approval: false }] })
  const removeResponsible = (idx) => handleChange({ responsibles: responsibles.filter((_, i) => i !== idx) })

  return (
    <div className="properties-panel__fields">
      <ProjectSourceSelector settings={settings} onChange={handleChange} />

      <div className="properties-panel__field">
        <label className="properties-panel__label">Добавить ответственных</label>
        {responsibles.length === 0 ? (
          <p className="properties-panel__hint">Добавьте хотя бы одного ответственного.</p>
        ) : (
          responsibles.map((r, idx) => (
            <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
              <select
                className="properties-panel__select"
                style={{ flex: '1 1 120px' }}
                value={r?.id ?? ''}
                onChange={(e) => patchResponsible(idx, { id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">— Выберите пользователя —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="properties-panel__input"
                style={{ flex: '1 1 100px' }}
                value={r?.role ?? ''}
                onChange={(e) => patchResponsible(idx, { role: e.target.value })}
                placeholder="Роль"
              />
              <label className="properties-panel__checkbox-row" style={{ flex: '0 0 auto', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={!!r?.requires_approval}
                  onChange={(e) => patchResponsible(idx, { requires_approval: e.target.checked })}
                />
                <span>Требуется согласование</span>
              </label>
              <button type="button" className="properties-panel__btn-remove" onClick={() => removeResponsible(idx)} title="Удалить">
                −
              </button>
            </div>
          ))
        )}

        <button type="button" className="properties-panel__btn-add" onClick={addResponsible} style={{ marginTop: 8 }}>
          + Добавить ответственного
        </button>
      </div>
    </div>
  )
}

export default ProjectAddResponsiblesNodeProps

