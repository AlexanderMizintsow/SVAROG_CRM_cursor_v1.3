import { useMemo } from 'react'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import './PropertiesPanel.scss'

const ProjectSourceSelector = ({ settings, onChange }) => {
  const { scheme } = useBusinessProcessStore()
  const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
  const projectNodes = useMemo(() => nodesList.filter((n) => n.type === 'create_project'), [nodesList])

  const source = settings.projectSource || 'last'

  return (
    <div className="properties-panel__field">
      <label className="properties-panel__label">Проект (источник)</label>
      <select
        className="properties-panel__select"
        value={source}
        onChange={(e) => onChange({ projectSource: e.target.value })}
      >
        <option value="last">Последний созданный в процессе</option>
        <option value="by_node" disabled={projectNodes.length === 0}>По блоку «Создать проект»</option>
        <option value="fixed">Фиксированный ID проекта</option>
      </select>

      {source === 'by_node' && (
        <select
          className="properties-panel__select"
          value={settings.projectNodeId ?? ''}
          onChange={(e) => onChange({ projectNodeId: e.target.value || null })}
          style={{ marginTop: 6 }}
        >
          <option value="">— Выберите блок —</option>
          {projectNodes.map((n) => (
            <option key={n.id} value={n.id}>{n.label || n.id}</option>
          ))}
        </select>
      )}

      {source === 'fixed' && (
        <input
          type="number"
          className="properties-panel__input"
          value={settings.fixedProjectId ?? ''}
          onChange={(e) => onChange({ fixedProjectId: e.target.value ? Number(e.target.value) : null })}
          placeholder="ID проекта (global_task_id)"
          style={{ marginTop: 6 }}
        />
      )}
    </div>
  )
}

export default ProjectSourceSelector

