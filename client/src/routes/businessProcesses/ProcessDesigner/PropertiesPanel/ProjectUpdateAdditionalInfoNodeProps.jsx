import { useMemo } from 'react'
import ProjectSourceSelector from './ProjectSourceSelector'
import './PropertiesPanel.scss'

const emptyRow = () => ({ key: '', value: '' })

const ProjectUpdateAdditionalInfoNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const rows = useMemo(() => (Array.isArray(settings.additionalInfo) ? settings.additionalInfo : []), [settings.additionalInfo])

  const handleChange = (patch) => onUpdate({ settings: { ...settings, ...(patch || {}) } })

  const patchRow = (idx, patch) => {
    const next = rows.map((r, i) => (i === idx ? { ...(r || emptyRow()), ...(patch || {}) } : r))
    handleChange({ additionalInfo: next })
  }
  const addRow = () => handleChange({ additionalInfo: [...rows, emptyRow()] })
  const removeRow = (idx) => handleChange({ additionalInfo: rows.filter((_, i) => i !== idx) })

  return (
    <div className="properties-panel__fields">
      <ProjectSourceSelector settings={settings} onChange={handleChange} />

      <div className="properties-panel__field">
        <label className="properties-panel__label">Доп. информация (key → value)</label>
        {rows.length === 0 ? (
          <p className="properties-panel__hint">Добавьте поля для записи на проект (additional_info).</p>
        ) : (
          rows.map((r, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
              <input
                type="text"
                className="properties-panel__input"
                style={{ flex: '1 1 0' }}
                value={r?.key ?? ''}
                onChange={(e) => patchRow(idx, { key: e.target.value })}
                placeholder="key"
              />
              <input
                type="text"
                className="properties-panel__input"
                style={{ flex: '1 1 0' }}
                value={r?.value ?? ''}
                onChange={(e) => patchRow(idx, { value: e.target.value })}
                placeholder="value"
              />
              <button type="button" className="properties-panel__btn-remove" onClick={() => removeRow(idx)} title="Удалить">
                −
              </button>
            </div>
          ))
        )}
        <button type="button" className="properties-panel__btn-add" onClick={addRow} style={{ marginTop: 8 }}>
          + Добавить поле
        </button>
      </div>
    </div>
  )
}

export default ProjectUpdateAdditionalInfoNodeProps

