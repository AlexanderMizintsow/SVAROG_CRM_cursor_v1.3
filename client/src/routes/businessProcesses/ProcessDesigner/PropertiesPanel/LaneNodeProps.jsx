import { useMemo } from 'react'
import './PropertiesPanel.scss'

const toInt = (v, fallback) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.round(n)
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

const LaneNodeProps = ({ node, onUpdate }) => {
  const width = useMemo(() => {
    const w = toInt(node?.settings?.width ?? 420, 420)
    return clamp(w, 200, 4000)
  }, [node?.settings?.width])

  const height = useMemo(() => {
    const h = toInt(node?.settings?.height ?? 220, 220)
    return clamp(h, 120, 4000)
  }, [node?.settings?.height])

  return (
    <div className="properties-panel__fields">
      <div className="properties-panel__field">
        <label className="properties-panel__label">Ширина (внутренняя)</label>
        <input
          type="number"
          className="properties-panel__input"
          value={width}
          min={200}
          max={4000}
          onChange={(e) => onUpdate({ settings: { ...(node.settings || {}), width: clamp(toInt(e.target.value, width), 200, 4000) } })}
        />
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Высота</label>
        <input
          type="number"
          className="properties-panel__input"
          value={height}
          min={120}
          max={4000}
          onChange={(e) => onUpdate({ settings: { ...(node.settings || {}), height: clamp(toInt(e.target.value, height), 120, 4000) } })}
        />
      </div>

      <p className="properties-panel__hint" style={{ marginTop: 8 }}>
        Дорожка — это визуальная группировка. Её можно растягивать мышью за угол справа-снизу.
      </p>
    </div>
  )
}

export default LaneNodeProps

