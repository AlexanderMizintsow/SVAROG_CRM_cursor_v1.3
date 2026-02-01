import { END_OUTCOMES, BLOCK_LABELS } from '../../constants/blockTypes'
import './PropertiesPanel.scss'

const EndNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const outcome = settings.outcome ?? 'SUCCESS'
  const comment = settings.comment ?? ''

  const handleChange = (key, value) => {
    const next = { ...settings, [key]: value }
    onUpdate({
      settings: next,
      label: next.outcome === 'SUCCESS' ? 'УСПЕХ' : next.outcome === 'FAILURE' ? 'НЕУДАЧА' : BLOCK_LABELS.end,
    })
  }

  return (
    <div className="properties-panel__fields">
      <div className="properties-panel__field">
        <label className="properties-panel__label">Результат (для аналитики)</label>
        <select
          className="properties-panel__select"
          value={outcome}
          onChange={(e) => handleChange('outcome', e.target.value)}
        >
          {END_OUTCOMES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="properties-panel__field">
        <label className="properties-panel__label">Комментарий</label>
        <textarea
          className="properties-panel__input properties-panel__textarea"
          value={comment}
          onChange={(e) => handleChange('comment', e.target.value)}
          placeholder="Дополнительный текст для аналитики (причина неудачи и т.п.)"
          rows={3}
        />
      </div>
    </div>
  )
}

export default EndNodeProps
