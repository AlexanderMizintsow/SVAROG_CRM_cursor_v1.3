import { useMemo } from 'react'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import { useActiveAbsences } from '../../../../utils/useActiveAbsences'
import { BLOCK_TYPES, BLOCK_LABELS } from '../../constants/blockTypes'
import { IoCopyOutline, IoClipboardOutline } from 'react-icons/io5'
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
import CreateProjectNodeProps from './CreateProjectNodeProps'
import ProjectUpdateStatusNodeProps from './ProjectUpdateStatusNodeProps'
import ProjectAddCommentNodeProps from './ProjectAddCommentNodeProps'
import ProjectPostChatNodeProps from './ProjectPostChatNodeProps'
import ProjectAddResponsiblesNodeProps from './ProjectAddResponsiblesNodeProps'
import ProjectUpdateGoalsNodeProps from './ProjectUpdateGoalsNodeProps'
import ProjectUpdateAdditionalInfoNodeProps from './ProjectUpdateAdditionalInfoNodeProps'
import ProjectAddAttachmentNodeProps from './ProjectAddAttachmentNodeProps'
import ProjectUpdateTaskStatusNodeProps from './ProjectUpdateTaskStatusNodeProps'
import TaskUpdateStatusNodeProps from './TaskUpdateStatusNodeProps'
import TaskAddCommentNodeProps from './TaskAddCommentNodeProps'
import TaskAddAttachmentNodeProps from './TaskAddAttachmentNodeProps'
import './PropertiesPanel.scss'

const NODE_PROPS_MAP = {
  [BLOCK_TYPES.START]: StartNodeProps,
  [BLOCK_TYPES.END]: EndNodeProps,
  [BLOCK_TYPES.LANE]: LaneNodeProps,
  [BLOCK_TYPES.ADDITIONAL_INFO]: AdditionalInfoNodeProps,
  [BLOCK_TYPES.CREATE_PROJECT]: CreateProjectNodeProps,
  [BLOCK_TYPES.PROJECT_UPDATE_STATUS]: ProjectUpdateStatusNodeProps,
  [BLOCK_TYPES.PROJECT_ADD_COMMENT]: ProjectAddCommentNodeProps,
  [BLOCK_TYPES.PROJECT_POST_CHAT]: ProjectPostChatNodeProps,
  [BLOCK_TYPES.PROJECT_ADD_RESPONSIBLES]: ProjectAddResponsiblesNodeProps,
  [BLOCK_TYPES.PROJECT_UPDATE_GOALS]: ProjectUpdateGoalsNodeProps,
  [BLOCK_TYPES.PROJECT_UPDATE_ADDITIONAL_INFO]: ProjectUpdateAdditionalInfoNodeProps,
  [BLOCK_TYPES.PROJECT_ADD_ATTACHMENT]: ProjectAddAttachmentNodeProps,
  [BLOCK_TYPES.PROJECT_UPDATE_TASK_STATUS]: ProjectUpdateTaskStatusNodeProps,
  [BLOCK_TYPES.CREATE_TASK]: CreateTaskNodeProps,
  [BLOCK_TYPES.ASSIGN_TASK]: AssignTaskNodeProps,
  [BLOCK_TYPES.TASK_UPDATE_STATUS]: TaskUpdateStatusNodeProps,
  [BLOCK_TYPES.TASK_ADD_COMMENT]: TaskAddCommentNodeProps,
  [BLOCK_TYPES.TASK_ADD_ATTACHMENT]: TaskAddAttachmentNodeProps,
  [BLOCK_TYPES.NOTIFICATION]: NotificationNodeProps,
  [BLOCK_TYPES.DECISION]: DecisionNodeProps,
  [BLOCK_TYPES.GATEWAY]: GatewayNodeProps,
  [BLOCK_TYPES.GATEWAY_JOIN]: GatewayJoinNodeProps,
  [BLOCK_TYPES.SPLITTER]: SplitterNodeProps,
  [BLOCK_TYPES.TIMER]: TimerNodeProps,
}

const PropertiesPanel = () => {
  const {
    scheme,
    selectedNodeId,
    copiedNodeData,
    updateNodeInScheme,
    copySelectedNode,
    pasteNode,
  } = useBusinessProcessStore()

  const { absencesMap } = useActiveAbsences(true)

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
    return nodesList.find((n) => n.id === selectedNodeId) || null
  }, [scheme?.nodes, selectedNodeId])

  const canCopy = selectedNode && selectedNode.type !== BLOCK_TYPES.START
  const canPaste = !!copiedNodeData

  if (!selectedNode) {
    return (
      <div className="properties-panel properties-panel--empty">
        <p>Выберите блок на схеме для настройки</p>
        {canPaste && (
          <div className="properties-panel__copy-paste">
            <button
              type="button"
              className="properties-panel__btn-copy-paste"
              onClick={pasteNode}
              title="Вставить скопированный блок (Ctrl+V)"
            >
              <IoClipboardOutline />
              Вставить блок
            </button>
          </div>
        )}
      </div>
    )
  }

  const NodePropsComponent = NODE_PROPS_MAP[selectedNode.type]

  return (
    <div className="properties-panel">
      <h3 className="properties-panel__title">{BLOCK_LABELS[selectedNode.type] || selectedNode.type}</h3>

      <div className="properties-panel__copy-paste properties-panel__copy-paste--row">
        <button
          type="button"
          className="properties-panel__btn-copy-paste"
          onClick={copySelectedNode}
          disabled={!canCopy}
          title={canCopy ? 'Копировать блок (Ctrl+C)' : 'Блок «Старт» копировать нельзя'}
        >
          <IoCopyOutline />
          Копировать
        </button>
        <button
          type="button"
          className="properties-panel__btn-copy-paste"
          onClick={pasteNode}
          disabled={!canPaste}
          title={canPaste ? 'Вставить скопированный блок (Ctrl+V)' : 'Сначала скопируйте блок'}
        >
          <IoClipboardOutline />
          Вставить
        </button>
      </div>

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
          absencesMap={absencesMap}
        />
      ) : (
        <p className="properties-panel__hint">Настройки для этого типа блока пока не реализованы.</p>
      )}
    </div>
  )
}

export default PropertiesPanel
