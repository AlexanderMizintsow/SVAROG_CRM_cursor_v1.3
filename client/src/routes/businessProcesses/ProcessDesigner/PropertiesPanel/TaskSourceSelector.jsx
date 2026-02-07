import { useMemo } from 'react'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import './PropertiesPanel.scss'

const TaskSourceSelector = ({ settings, onChange }) => {
  const { scheme } = useBusinessProcessStore()
  const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
  const taskNodes = useMemo(
    () => nodesList.filter((n) => n.type === 'create_task' || n.type === 'assign_task'),
    [nodesList]
  )

  const source = settings.taskSource || 'last'

  return (
    <div className="properties-panel__field">
      <label className="properties-panel__label">Задача (источник)</label>
      <select
        className="properties-panel__select"
        value={source}
        onChange={(e) => onChange({ taskSource: e.target.value })}
      >
        <option value="last">Последняя созданная в процессе</option>
        <option value="by_node" disabled={taskNodes.length === 0}>По блоку «Создать задачу» / «Назначить задачу»</option>
        <option value="fixed">Фиксированный ID задачи</option>
      </select>

      {source === 'by_node' && (
        <select
          className="properties-panel__select"
          value={settings.taskSourceNodeId ?? ''}
          onChange={(e) => onChange({ taskSourceNodeId: e.target.value || null })}
          style={{ marginTop: 6 }}
        >
          <option value="">— Выберите блок —</option>
          {taskNodes.map((n) => (
            <option key={n.id} value={n.id}>{n.label || n.id}</option>
          ))}
        </select>
      )}

      {source === 'fixed' && (
        <input
          type="number"
          className="properties-panel__input"
          value={settings.fixedTaskId ?? ''}
          onChange={(e) => onChange({ fixedTaskId: e.target.value ? Number(e.target.value) : null })}
          placeholder="ID задачи (task_id)"
          style={{ marginTop: 6 }}
        />
      )}
    </div>
  )
}

export default TaskSourceSelector
