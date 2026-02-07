import TaskSourceSelector from './TaskSourceSelector'
import { TASK_STATUSES } from '../../constants/blockTypes'
import './PropertiesPanel.scss'

const TaskUpdateStatusNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const handleChange = (patch) => onUpdate({ settings: { ...settings, ...(patch || {}) } })

  return (
    <div className="properties-panel__fields">
      <TaskSourceSelector settings={settings} onChange={handleChange} />

      <div className="properties-panel__field">
        <label className="properties-panel__label">Новый статус задачи</label>
        <select
          className="properties-panel__select"
          value={settings.status ?? ''}
          onChange={(e) => handleChange({ status: e.target.value })}
        >
          <option value="">— Выберите статус —</option>
          {TASK_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default TaskUpdateStatusNodeProps
