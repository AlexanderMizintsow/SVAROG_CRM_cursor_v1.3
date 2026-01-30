import { useMemo } from 'react'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import { BLOCK_TYPES } from '../../constants/blockTypes'
import StartNodeProps from './StartNodeProps'
import EndNodeProps from './EndNodeProps'
import CreateTaskNodeProps from './CreateTaskNodeProps'
import AssignTaskNodeProps from './AssignTaskNodeProps'
import NotificationNodeProps from './NotificationNodeProps'
import GatewayNodeProps from './GatewayNodeProps'
import TimerNodeProps from './TimerNodeProps'
import './PropertiesPanel.scss'

const NODE_PROPS_MAP = {
  [BLOCK_TYPES.START]: StartNodeProps,
  [BLOCK_TYPES.END]: EndNodeProps,
  [BLOCK_TYPES.CREATE_TASK]: CreateTaskNodeProps,
  [BLOCK_TYPES.ASSIGN_TASK]: AssignTaskNodeProps,
  [BLOCK_TYPES.NOTIFICATION]: NotificationNodeProps,
  [BLOCK_TYPES.GATEWAY]: GatewayNodeProps,
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
  if (!NodePropsComponent) {
    return (
      <div className="properties-panel">
        <h3 className="properties-panel__title">{selectedNode.label}</h3>
        <p className="properties-panel__hint">Настройки для этого типа блока пока не реализованы.</p>
      </div>
    )
  }

  return (
    <div className="properties-panel">
      <h3 className="properties-panel__title">{selectedNode.label}</h3>
      <NodePropsComponent
        node={selectedNode}
        onUpdate={(updates) => updateNodeInScheme(selectedNode.id, updates)}
      />
    </div>
  )
}

export default PropertiesPanel
