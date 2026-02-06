import ProjectSourceSelector from './ProjectSourceSelector'
import './PropertiesPanel.scss'

const ProjectUpdateStatusNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const handleChange = (patch) => onUpdate({ settings: { ...settings, ...(patch || {}) } })

  return (
    <div className="properties-panel__fields">
      <ProjectSourceSelector settings={settings} onChange={handleChange} />

      <div className="properties-panel__field">
        <label className="properties-panel__label">Новый статус проекта</label>
        <input
          type="text"
          className="properties-panel__input"
          value={settings.status ?? ''}
          onChange={(e) => handleChange({ status: e.target.value })}
          placeholder="Например: Пауза / Продолжить / Завершено / Провал"
        />
        <p className="properties-panel__hint">Статусы — те же, что используются в вашем менеджере проектов.</p>
      </div>
    </div>
  )
}

export default ProjectUpdateStatusNodeProps

