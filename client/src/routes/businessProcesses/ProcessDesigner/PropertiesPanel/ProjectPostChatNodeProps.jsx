import ProjectSourceSelector from './ProjectSourceSelector'
import './PropertiesPanel.scss'

const ProjectPostChatNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const handleChange = (patch) => onUpdate({ settings: { ...settings, ...(patch || {}) } })

  return (
    <div className="properties-panel__fields">
      <ProjectSourceSelector settings={settings} onChange={handleChange} />

      <div className="properties-panel__field">
        <label className="properties-panel__label">Текст сообщения</label>
        <textarea
          className="properties-panel__input properties-panel__textarea"
          rows={4}
          value={settings.text ?? ''}
          onChange={(e) => handleChange({ text: e.target.value })}
          placeholder="Сообщение в чат проекта"
        />
        <div className="properties-panel__hint">Поддерживается подстановка: <b>{'{доп:ключ}'}</b></div>
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Заголовок уведомления (опционально)</label>
        <input
          type="text"
          className="properties-panel__input"
          value={settings.title ?? ''}
          onChange={(e) => handleChange({ title: e.target.value })}
          placeholder="Если используется в ваших уведомлениях"
        />
      </div>
    </div>
  )
}

export default ProjectPostChatNodeProps

