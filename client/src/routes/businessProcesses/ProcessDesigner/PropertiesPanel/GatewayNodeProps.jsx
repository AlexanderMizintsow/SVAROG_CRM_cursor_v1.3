import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import { GATEWAY_CONDITIONS } from '../../constants/blockTypes'
import './PropertiesPanel.scss'

const GatewayNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const { scheme } = useBusinessProcessStore()

  const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
  const edgesList = Array.isArray(scheme?.edges) ? scheme.edges : []
  const taskSourceNodes = nodesList.filter(
    (n) => n.type === 'create_task' || n.type === 'assign_task'
  )

  const outgoingEdges = edgesList.filter((e) => e.source === node.id)

  const handleChange = (key, value) => {
    onUpdate({ settings: { ...settings, [key]: value } })
  }

  const handleEdgeCondition = (edgeId, condition) => {
    const edges = (settings.edges || []).filter((e) => e.edgeId !== edgeId)
    if (condition) {
      edges.push({ edgeId, condition })
    }
    onUpdate({ settings: { ...settings, edges } })
  }

  const getEdgeCondition = (edgeId) => {
    const found = (settings.edges || []).find((e) => e.edgeId === edgeId)
    return found?.condition ?? ''
  }

  return (
    <div className="properties-panel__fields">
      <div className="properties-panel__field">
        <label className="properties-panel__label">Задача для проверки условия</label>
        <select
          className="properties-panel__select"
          value={settings.taskSourceNodeId ?? ''}
          onChange={(e) => handleChange('taskSourceNodeId', e.target.value || null)}
        >
          <option value="">— Последняя созданная в процессе —</option>
          {taskSourceNodes.map((n) => (
            <option key={n.id} value={n.id}>{n.label || n.type}</option>
          ))}
        </select>
      </div>
      {outgoingEdges.length > 0 && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Условия по исходящим стрелкам</label>
          <p className="properties-panel__hint" style={{ marginBottom: '0.5rem' }}>
            Для каждой стрелки выберите условие перехода.
          </p>
          {outgoingEdges.map((edge) => {
            const targetNode = nodesList.find((n) => n.id === edge.target)
            const targetLabel = targetNode?.label || edge.target
            return (
              <div key={edge.id} className="properties-panel__field" style={{ marginTop: '0.5rem' }}>
                <span className="properties-panel__label">→ {targetLabel}</span>
                <select
                  className="properties-panel__select"
                  value={getEdgeCondition(edge.id)}
                  onChange={(e) => handleEdgeCondition(edge.id, e.target.value || null)}
                >
                  <option value="">— Не задано —</option>
                  {GATEWAY_CONDITIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}
      {outgoingEdges.length === 0 && (
        <p className="properties-panel__hint">
          Соедините развилку со следующими блоками стрелками, затем настройте условия для каждой стрелки.
        </p>
      )}
    </div>
  )
}

export default GatewayNodeProps
