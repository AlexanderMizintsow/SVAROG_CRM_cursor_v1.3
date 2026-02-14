import { TIMER_TYPES, TIMER_UNITS } from '../../constants/blockTypes'
import './PropertiesPanel.scss'

function toDateTimeLocalValue(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const TimerNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}

  const handleChange = (key, value) => {
    onUpdate({ settings: { ...settings, [key]: value } })
  }

  return (
    <div className="properties-panel__fields">
      <div className="properties-panel__field">
        <label className="properties-panel__label">Тип ожидания</label>
        <select
          className="properties-panel__select"
          value={settings.type ?? 'interval'}
          onChange={(e) => handleChange('type', e.target.value)}
        >
          {TIMER_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {settings.type !== 'until_date' && (
        <>
          <div className="properties-panel__field">
            <label className="properties-panel__label">Значение</label>
            <input
              type="number"
              className="properties-panel__input"
              min={1}
              value={settings.intervalValue ?? 1}
              onChange={(e) => handleChange('intervalValue', e.target.value ? Number(e.target.value) : 1)}
            />
          </div>
          <div className="properties-panel__field">
            <label className="properties-panel__label">Единица</label>
            <select
              className="properties-panel__select"
              value={settings.intervalUnit ?? 'days'}
              onChange={(e) => handleChange('intervalUnit', e.target.value)}
            >
              {TIMER_UNITS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </>
      )}
      {settings.type === 'until_date' && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Дата и время</label>
          <input
            type="datetime-local"
            className="properties-panel__input"
            value={toDateTimeLocalValue(settings.untilDate)}
            onChange={(e) => handleChange('untilDate', e.target.value || null)}
          />
          <p className="properties-panel__hint" style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
            На сервере может использоваться расчёт «до конца рабочего дня» и т.п.
          </p>
        </div>
      )}
    </div>
  )
}

export default TimerNodeProps
