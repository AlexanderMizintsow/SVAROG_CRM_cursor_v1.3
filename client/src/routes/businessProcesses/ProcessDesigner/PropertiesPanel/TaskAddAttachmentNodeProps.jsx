import TaskSourceSelector from './TaskSourceSelector'
import './PropertiesPanel.scss'

const TaskAddAttachmentNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const handleChange = (patch) => onUpdate({ settings: { ...settings, ...(patch || {}) } })

  return (
    <div className="properties-panel__fields">
      <TaskSourceSelector settings={settings} onChange={handleChange} />

      <p className="properties-panel__hint">
        Блок добавляет вложение в задачу по <b>готовой ссылке</b>. Загрузку файла (получение URL) выполняйте вашей логикой CRM.
      </p>

      <div className="properties-panel__field">
        <label className="properties-panel__label">file_url</label>
        <input
          type="text"
          className="properties-panel__input"
          value={settings.file_url ?? ''}
          onChange={(e) => handleChange({ file_url: e.target.value })}
          placeholder="https://.../file.ext"
        />
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">file_type</label>
        <input
          type="text"
          className="properties-panel__input"
          value={settings.file_type ?? ''}
          onChange={(e) => handleChange({ file_type: e.target.value })}
          placeholder="например: image/png"
        />
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">name_file</label>
        <input
          type="text"
          className="properties-panel__input"
          value={settings.name_file ?? ''}
          onChange={(e) => handleChange({ name_file: e.target.value })}
          placeholder="Имя файла для отображения"
        />
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">comment_file (опционально)</label>
        <input
          type="text"
          className="properties-panel__input"
          value={settings.comment_file ?? ''}
          onChange={(e) => handleChange({ comment_file: e.target.value })}
          placeholder="Комментарий к файлу"
        />
      </div>
    </div>
  )
}

export default TaskAddAttachmentNodeProps
