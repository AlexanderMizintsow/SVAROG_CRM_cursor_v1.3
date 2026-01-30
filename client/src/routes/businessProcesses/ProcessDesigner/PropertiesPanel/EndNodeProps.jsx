import { BLOCK_LABELS } from '../../constants/blockTypes'

const EndNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const label = settings.label ?? ''

  const handleChange = (value) => {
    onUpdate({ settings: { ...settings, label: value }, label: value || BLOCK_LABELS.end })
  }

  return (
    <div className="properties-panel__fields">
      <div className="properties-panel__field">
        <label className="properties-panel__label">Подпись (для аналитики)</label>
        <input
          type="text"
          className="properties-panel__input"
          value={label}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Например: Успех, Просрочка"
        />
      </div>
    </div>
  )
}

export default EndNodeProps
