import { memo } from 'react'
import { Handle, Position } from 'react-flow-renderer'
import {
  IoPlayCircle,
  IoStopCircle,
  IoDocumentText,
  IoPeople,
  IoNotifications,
  IoGitBranch,
  IoTime,
} from 'react-icons/io5'
import { BLOCK_TYPES, BLOCK_LABELS } from '../../constants/blockTypes'
import './BlockNode.scss'

const ICONS = {
  [BLOCK_TYPES.START]: IoPlayCircle,
  [BLOCK_TYPES.END]: IoStopCircle,
  [BLOCK_TYPES.CREATE_TASK]: IoDocumentText,
  [BLOCK_TYPES.ASSIGN_TASK]: IoPeople,
  [BLOCK_TYPES.NOTIFICATION]: IoNotifications,
  [BLOCK_TYPES.GATEWAY]: IoGitBranch,
  [BLOCK_TYPES.TIMER]: IoTime,
}

const COLORS = {
  [BLOCK_TYPES.START]: '#22c55e',
  [BLOCK_TYPES.END]: '#94a3b8',
  [BLOCK_TYPES.CREATE_TASK]: '#3b82f6',
  [BLOCK_TYPES.ASSIGN_TASK]: '#8b5cf6',
  [BLOCK_TYPES.NOTIFICATION]: '#f59e0b',
  [BLOCK_TYPES.GATEWAY]: '#e11d48',
  [BLOCK_TYPES.TIMER]: '#0ea5e9',
}

const BlockNode = ({ data, selected }) => {
  const nodeType = data?.nodeType || 'create_task'
  const label = data?.label || BLOCK_LABELS[nodeType] || nodeType
  const Icon = ICONS[nodeType] || IoDocumentText
  const color = COLORS[nodeType] || '#64748b'
  const isStart = nodeType === BLOCK_TYPES.START
  const isEnd = nodeType === BLOCK_TYPES.END

  return (
    <div
      className={`block-node block-node--${nodeType} ${selected ? 'block-node--selected' : ''}`}
      style={{ '--block-color': color }}
    >
      {!isStart && (
        <Handle type="target" position={Position.Left} className="block-node__handle" />
      )}
      <div className="block-node__body">
        <Icon className="block-node__icon" style={{ color }} />
        <span className="block-node__label">{label}</span>
      </div>
      {!isEnd && (
        <Handle type="source" position={Position.Right} className="block-node__handle" />
      )}
    </div>
  )
}

export default memo(BlockNode)
