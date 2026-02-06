import { useMemo } from 'react'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import { BLOCK_TYPES, BLOCK_LABELS } from '../../constants/blockTypes'
import StartNodeProps from './StartNodeProps'
import EndNodeProps from './EndNodeProps'
import CreateTaskNodeProps from './CreateTaskNodeProps'
import AssignTaskNodeProps from './AssignTaskNodeProps'
import NotificationNodeProps from './NotificationNodeProps'
import DecisionNodeProps from './DecisionNodeProps'
import GatewayNodeProps from './GatewayNodeProps'
import GatewayJoinNodeProps from './GatewayJoinNodeProps'
import SplitterNodeProps from './SplitterNodeProps'
import TimerNodeProps from './TimerNodeProps'
import LaneNodeProps from './LaneNodeProps'
import AdditionalInfoNodeProps from './AdditionalInfoNodeProps'
import './PropertiesPanel.scss'

const NODE_PROPS_MAP = {
  [BLOCK_TYPES.START]: StartNodeProps,
  [BLOCK_TYPES.END]: EndNodeProps,
  [BLOCK_TYPES.LANE]: LaneNodeProps,
  [BLOCK_TYPES.ADDITIONAL_INFO]: AdditionalInfoNodeProps,
  [BLOCK_TYPES.CREATE_TASK]: CreateTaskNodeProps,
  [BLOCK_TYPES.ASSIGN_TASK]: AssignTaskNodeProps,
  [BLOCK_TYPES.NOTIFICATION]: NotificationNodeProps,
  [BLOCK_TYPES.DECISION]: DecisionNodeProps,
  [BLOCK_TYPES.GATEWAY]: GatewayNodeProps,
  [BLOCK_TYPES.GATEWAY_JOIN]: GatewayJoinNodeProps,
  [BLOCK_TYPES.SPLITTER]: SplitterNodeProps,
  [BLOCK_TYPES.TIMER]: TimerNodeProps,
}

const PropertiesPanel = () => {
  const { scheme, selectedNodeId, updateNodeInScheme } = useBusinessProcessStore()

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
    return nodesList.find((n) => n.id === selectedNodeId) || null
  }, [scheme?.nodes, selectedNodeId])

  if (!selectedNode) {
    return (
      <div className="properties-panel properties-panel--empty">
        <p>Выберите блок на схеме для настройки</p>
      </div>
    )
  }

  const NodePropsComponent = NODE_PROPS_MAP[selectedNode.type]

  return (
    <div className="properties-panel">
      <h3 className="properties-panel__title">{BLOCK_LABELS[selectedNode.type] || selectedNode.type}</h3>

      <div className="properties-panel__fields">
        <div className="properties-panel__field">
          <label className="properties-panel__label">Название блока на схеме</label>
          <input
            type="text"
            className="properties-panel__input"
            value={selectedNode.label ?? ''}
            onChange={(e) => updateNodeInScheme(selectedNode.id, { label: e.target.value })}
            placeholder={BLOCK_LABELS[selectedNode.type]}
          />
        </div>
      </div>

      {NodePropsComponent ? (
        <NodePropsComponent
          node={selectedNode}
          onUpdate={(updates) => updateNodeInScheme(selectedNode.id, updates)}
        />
      ) : (
        <p className="properties-panel__hint">Настройки для этого типа блока пока не реализованы.</p>
      )}
    </div>
  )
}

export default PropertiesPanel
