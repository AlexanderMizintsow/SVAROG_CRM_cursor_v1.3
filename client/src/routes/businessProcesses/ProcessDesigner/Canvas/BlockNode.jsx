import { memo, useMemo } from 'react'
import { Handle, Position } from 'react-flow-renderer'
import {
  IoPlayCircle,
  IoStopCircle,
  IoDocumentText,
  IoPeople,
  IoNotifications,
  IoGitBranch,
  IoGitMergeOutline, 
  IoTime,
  IoCheckmarkDoneCircle,
  IoInformationCircleOutline,
  IoFolderOpenOutline,
  IoChatbubbleEllipsesOutline,
  IoChatboxEllipsesOutline,
  IoPeopleCircleOutline,
  IoListOutline,
  IoAttachOutline,
  IoSwapVerticalOutline,
} from 'react-icons/io5'
import { LuSplit } from "react-icons/lu";
import { BLOCK_TYPES, BLOCK_LABELS } from '../../constants/blockTypes'
import './BlockNode.scss'

const ICONS = {
  [BLOCK_TYPES.START]: IoPlayCircle,
  [BLOCK_TYPES.END]: IoStopCircle,
  [BLOCK_TYPES.ADDITIONAL_INFO]: IoInformationCircleOutline,
  [BLOCK_TYPES.CREATE_PROJECT]: IoFolderOpenOutline,
  [BLOCK_TYPES.PROJECT_UPDATE_STATUS]: IoSwapVerticalOutline,
  [BLOCK_TYPES.PROJECT_ADD_COMMENT]: IoChatbubbleEllipsesOutline,
  [BLOCK_TYPES.PROJECT_POST_CHAT]: IoChatboxEllipsesOutline,
  [BLOCK_TYPES.PROJECT_ADD_RESPONSIBLES]: IoPeopleCircleOutline,
  [BLOCK_TYPES.PROJECT_UPDATE_GOALS]: IoListOutline,
  [BLOCK_TYPES.PROJECT_UPDATE_ADDITIONAL_INFO]: IoInformationCircleOutline,
  [BLOCK_TYPES.PROJECT_ADD_ATTACHMENT]: IoAttachOutline,
  [BLOCK_TYPES.PROJECT_UPDATE_TASK_STATUS]: IoSwapVerticalOutline,
  [BLOCK_TYPES.CREATE_TASK]: IoDocumentText,
  [BLOCK_TYPES.ASSIGN_TASK]: IoPeople,
  [BLOCK_TYPES.TASK_UPDATE_STATUS]: IoSwapVerticalOutline,
  [BLOCK_TYPES.TASK_ADD_COMMENT]: IoChatbubbleEllipsesOutline,
  [BLOCK_TYPES.TASK_ADD_ATTACHMENT]: IoAttachOutline,
  [BLOCK_TYPES.NOTIFICATION]: IoNotifications,
  [BLOCK_TYPES.DECISION]: IoCheckmarkDoneCircle,
  [BLOCK_TYPES.GATEWAY]: IoGitBranch,
  [BLOCK_TYPES.GATEWAY_JOIN]: IoGitMergeOutline,
  [BLOCK_TYPES.SPLITTER]: LuSplit,
  [BLOCK_TYPES.TIMER]: IoTime,
}

const COLORS = {
  [BLOCK_TYPES.START]: '#22c55e',
  [BLOCK_TYPES.END]: '#94a3b8',
  [BLOCK_TYPES.ADDITIONAL_INFO]: '#0f766e',
  [BLOCK_TYPES.CREATE_PROJECT]: '#0ea5e9',
  [BLOCK_TYPES.PROJECT_UPDATE_STATUS]: '#0284c7',
  [BLOCK_TYPES.PROJECT_ADD_COMMENT]: '#0284c7',
  [BLOCK_TYPES.PROJECT_POST_CHAT]: '#0284c7',
  [BLOCK_TYPES.PROJECT_ADD_RESPONSIBLES]: '#0284c7',
  [BLOCK_TYPES.PROJECT_UPDATE_GOALS]: '#0284c7',
  [BLOCK_TYPES.PROJECT_UPDATE_ADDITIONAL_INFO]: '#0284c7',
  [BLOCK_TYPES.PROJECT_ADD_ATTACHMENT]: '#0284c7',
  [BLOCK_TYPES.PROJECT_UPDATE_TASK_STATUS]: '#8b5cf6',
  [BLOCK_TYPES.CREATE_TASK]: '#3b82f6',
  [BLOCK_TYPES.ASSIGN_TASK]: '#8b5cf6',
  [BLOCK_TYPES.TASK_UPDATE_STATUS]: '#2563eb',
  [BLOCK_TYPES.TASK_ADD_COMMENT]: '#2563eb',
  [BLOCK_TYPES.TASK_ADD_ATTACHMENT]: '#2563eb',
  [BLOCK_TYPES.NOTIFICATION]: '#f59e0b',
  [BLOCK_TYPES.DECISION]: '#8b5cf6',
  [BLOCK_TYPES.GATEWAY]: '#e11d48',
  [BLOCK_TYPES.GATEWAY_JOIN]: '#c026d3',
  [BLOCK_TYPES.SPLITTER]: '#dc2626',
  [BLOCK_TYPES.TIMER]: '#0ea5e9',
}

function clampInt(v, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.round(n)))
}

const BlockNode = ({ data, selected }) => {
  const nodeType = data?.nodeType || BLOCK_TYPES.CREATE_TASK
  const label = data?.label || BLOCK_LABELS[nodeType] || nodeType
  const settings = data?.settings || {}
  const Icon = ICONS[nodeType] || IoDocumentText
  const color = COLORS[nodeType] || '#64748b'

  const isStart = nodeType === BLOCK_TYPES.START
  const isEnd = nodeType === BLOCK_TYPES.END
  const isGateway = nodeType === BLOCK_TYPES.GATEWAY
  const isGatewayJoin = nodeType === BLOCK_TYPES.GATEWAY_JOIN
  const isSplitter = nodeType === BLOCK_TYPES.SPLITTER

  const gatewayOutgoingCount = useMemo(() => {
    if (!isGateway && !isGatewayJoin && !isSplitter) return 0
    return clampInt(settings.outgoingCount ?? (isSplitter ? 2 : 3), 1, 10)
  }, [isGateway, isGatewayJoin, isSplitter, settings.outgoingCount])

  return (
    <div
      className={`block-node block-node--${nodeType} ${selected ? 'block-node--selected' : ''}`}
      style={{ '--block-color': color }}
    >
      {!isStart && (
        <Handle type="target" position={Position.Top} className="block-node__handle" />
      )}

      <div className="block-node__body">
        <Icon className="block-node__icon" style={{ color }} />
        <span className="block-node__label">{label}</span>
      </div>

      {!isEnd && !isGateway && !isGatewayJoin && !isSplitter && (
        <Handle type="source" position={Position.Bottom} className="block-node__handle" />
      )}

      {!isEnd && (isGateway || isGatewayJoin || isSplitter) && (
        <div className="block-node__gateway-sources">
          {Array.from({ length: gatewayOutgoingCount }).map((_, idx) => {
            const offset = (idx - (gatewayOutgoingCount - 1) / 2) * 16
            return (
              <Handle
                key={idx + 1}
                id={`out-${idx + 1}`}
                type="source"
                position={Position.Bottom}
                className="block-node__handle block-node__handle--gateway"
                style={{ left: `${offset}px` }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default memo(BlockNode)
