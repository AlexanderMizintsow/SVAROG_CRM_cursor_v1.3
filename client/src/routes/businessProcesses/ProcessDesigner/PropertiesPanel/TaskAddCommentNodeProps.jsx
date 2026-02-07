import TaskSourceSelector from './TaskSourceSelector'
import './PropertiesPanel.scss'

const TaskAddCommentNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const handleChange = (patch) => onUpdate({ settings: { ...settings, ...(patch || {}) } })

  return (
    <div className="properties-panel__fields">
      <TaskSourceSelector settings={settings} onChange={handleChange} />

      <div className="properties-panel__field">
        <label className="properties-panel__label">Комментарий</label>
        <textarea
          className="properties-panel__input properties-panel__textarea"
          rows={4}
          value={settings.comment ?? ''}
          onChange={(e) => handleChange({ comment: e.target.value })}
          placeholder="Текст комментария"
        />
        <div className="properties-panel__hint">Поддерживается подстановка: <b>{'{доп:ключ}'}</b></div>
      </div>
    </div>
  )
}

export default TaskAddCommentNodeProps
