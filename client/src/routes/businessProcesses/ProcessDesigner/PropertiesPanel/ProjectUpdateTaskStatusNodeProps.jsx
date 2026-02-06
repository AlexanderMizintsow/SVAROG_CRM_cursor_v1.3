import { useMemo } from 'react'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import './PropertiesPanel.scss'

const ProjectUpdateTaskStatusNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const { scheme } = useBusinessProcessStore()

  const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
  const taskNodes = useMemo(() => nodesList.filter((n) => n.type === 'create_task'), [nodesList])

  const taskSource = settings.taskSource || 'last'
  const handleChange = (patch) => onUpdate({ settings: { ...settings, ...(patch || {}) } })

  return (
    <div className="properties-panel__fields">
      <div className="properties-panel__field">
        <label className="properties-panel__label">Задача (источник)</label>
        <select
          className="properties-panel__select"
          value={taskSource}
          onChange={(e) => handleChange({ taskSource: e.target.value })}
        >
          <option value="last">Последняя созданная задача в процессе</option>
          <option value="by_node" disabled={taskNodes.length === 0}>По блоку «Создать задачу»</option>
          <option value="fixed">Фиксированный ID задачи</option>
        </select>

        {taskSource === 'by_node' && (
          <select
            className="properties-panel__select"
            value={settings.taskNodeId ?? ''}
            onChange={(e) => handleChange({ taskNodeId: e.target.value || null })}
            style={{ marginTop: 6 }}
          >
            <option value="">— Выберите блок —</option>
            {taskNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.label || n.id}</option>
            ))}
          </select>
        )}

        {taskSource === 'fixed' && (
          <input
            type="number"
            className="properties-panel__input"
            value={settings.fixedTaskId ?? ''}
            onChange={(e) => handleChange({ fixedTaskId: e.target.value ? Number(e.target.value) : null })}
            placeholder="ID задачи (task_id)"
            style={{ marginTop: 6 }}
          />
        )}
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Новый статус задачи</label>
        <input
          type="text"
          className="properties-panel__input"
          value={settings.status ?? ''}
          onChange={(e) => handleChange({ status: e.target.value })}
          placeholder="Например: backlog / todo / wait / doing / done / pause"
        />
      </div>
    </div>
  )
}

export default ProjectUpdateTaskStatusNodeProps

