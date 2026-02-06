/**
 * Свойства блока «Разделитель».
 * Разветвляет выполнение на несколько параллельных веток без условий.
 */
import { useMemo } from 'react'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import './PropertiesPanel.scss'

function clampInt(v, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.round(n)))
}

const SplitterNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const { scheme } = useBusinessProcessStore()

  const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
  const edgesList = Array.isArray(scheme?.edges) ? scheme.edges : []

  const outgoingEdges = edgesList.filter((e) => e.source === node.id)

  const usedOutgoingIndexMax = useMemo(() => {
    let max = 0
    for (const e of outgoingEdges) {
      const sh = e.sourceHandle
      if (typeof sh !== 'string') continue
      const m = sh.match(/^out-(\d+)$/)
      if (!m) continue
      const idx = Number(m[1])
      if (Number.isFinite(idx) && idx > max) max = idx
    }
    return max
  }, [outgoingEdges])

  const outgoingCount = useMemo(() => {
    const raw = Number(settings.outgoingCount ?? 2)
    const safe = Number.isFinite(raw) ? Math.round(raw) : 2
    return Math.max(1, Math.min(10, safe))
  }, [settings.outgoingCount])

  const handleOutgoingCount = (value) => {
    const raw = Number(value)
    const clamped = clampInt(raw, 1, 10)
    const withUsedGuard = Math.max(clamped, usedOutgoingIndexMax || 1)
    onUpdate({ settings: { ...settings, outgoingCount: withUsedGuard } })
  }

  return (
    <div className="properties-panel__fields">
      <p className="properties-panel__hint" style={{ marginBottom: '0.5rem' }}>
        Блок разветвляет выполнение на несколько параллельных веток. Все исходящие ветки запускаются одновременно.
      </p>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Количество исходящих веток</label>
        <input
          type="number"
          className="properties-panel__input"
          min={1}
          max={10}
          value={outgoingCount}
          onChange={(e) => handleOutgoingCount(e.target.value)}
        />
        {usedOutgoingIndexMax > outgoingCount && (
          <p className="properties-panel__hint">
            Нельзя уменьшить меньше {usedOutgoingIndexMax}: уже есть стрелка с выходом out-{usedOutgoingIndexMax}.
          </p>
        )}
      </div>
    </div>
  )
}

export default SplitterNodeProps
