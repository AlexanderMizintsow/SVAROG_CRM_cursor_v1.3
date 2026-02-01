import { useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  IoPlayCircle,
  IoStopCircle,
  IoDocumentText,
  IoNotifications,
  IoGitBranch,
  IoGitMergeOutline,
  IoTime,
  IoCheckmarkDoneCircle,
} from 'react-icons/io5'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore.js'
import { BLOCK_TYPES, BLOCK_LABELS } from '../../constants/blockTypes.js'
import './Palette.scss'

const PALETTE_ITEMS = [
  { type: BLOCK_TYPES.START, icon: IoPlayCircle, color: '#22c55e' },
  { type: BLOCK_TYPES.END, icon: IoStopCircle, color: '#94a3b8' },
  { type: BLOCK_TYPES.CREATE_TASK, icon: IoDocumentText, color: '#3b82f6' },
  { type: BLOCK_TYPES.NOTIFICATION, icon: IoNotifications, color: '#f59e0b' },
  { type: BLOCK_TYPES.DECISION, icon: IoCheckmarkDoneCircle, color: '#8b5cf6' },
  { type: BLOCK_TYPES.GATEWAY, icon: IoGitBranch, color: '#e11d48' },
  { type: BLOCK_TYPES.GATEWAY_JOIN, icon: IoGitMergeOutline, color: '#c026d3' },
  { type: BLOCK_TYPES.TIMER, icon: IoTime, color: '#0ea5e9' },
]

const Palette = () => {
  const { scheme, addNodeToScheme } = useBusinessProcessStore()

  const getNextPosition = useCallback(() => {
    const nodes = Array.isArray(scheme?.nodes) ? scheme.nodes : []
    if (nodes.length === 0) return { x: 100, y: 100 }
    const last = nodes[nodes.length - 1]
    const pos = last.position || { x: 100, y: 100 }
    return { x: pos.x + 80, y: pos.y }
  }, [scheme?.nodes])

  const handleAddBlock = useCallback(
    (type) => {
      const pos = getNextPosition()
      const node = {
        id: uuidv4(),
        type,
        position: pos,
        label: BLOCK_LABELS[type] || type,
        settings: getDefaultSettings(type),
      }
      addNodeToScheme(node)
    },
    [getNextPosition, addNodeToScheme]
  )

  return (
    <div className="palette">
      <h3 className="palette__title">Блоки</h3>
      <p className="palette__hint">Нажмите, чтобы добавить на схему</p>
      <ul className="palette__list">
        {PALETTE_ITEMS.map((item) => (
          <li key={item.type} className="palette__item">
            <button
              type="button"
              className="palette__btn"
              onClick={() => handleAddBlock(item.type)}
              title={BLOCK_LABELS[item.type]}
            >
              <item.icon className="palette__icon" style={{ color: item.color }} />
              <span className="palette__label">{BLOCK_LABELS[item.type]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function getDefaultSettings(type) {
  switch (type) {
    case BLOCK_TYPES.START:
      return { initiatorType: 'current_user', allowAllLaunchers: true, allowedLauncherUserIds: [] }
    case BLOCK_TYPES.END:
      return { outcome: 'SUCCESS', comment: '' }
    case BLOCK_TYPES.CREATE_TASK:
      return {
        createMode: 'prepared',
        templateId: null,
        title: '',
        description: '',
        priority: 'низкий',
        initialStatus: 'backlog',
        authorSource: 'initiator',
        assigneeSource: 'users',
        assigneeUserIds: [],
        approverUserIds: [],
        viewerUserIds: [],
        deadlineOffsetDays: null,
      }
    case BLOCK_TYPES.NOTIFICATION:
      return {
        recipientSource: 'users',
        userIds: [],
        channels: { inApp: true, telegram: false },
        messageText: '',
        priority: 'normal',
      }
    case BLOCK_TYPES.DECISION:
      return {
        recipientSource: 'users',
        userIds: [],
        messageText: '',
        buttons: [{ id: 'approve', label: 'Принять' }, { id: 'reject', label: 'Отклонить' }],
      }
    case BLOCK_TYPES.GATEWAY:
      return {
        sourceType: 'auto',
        waitMode: 'event',
        outgoingCount: 3,
        taskSourceNodeId: null,
        edges: [],
      }
    case BLOCK_TYPES.GATEWAY_JOIN:
      return {
        outgoingCount: 3,
        edges: [],
      }
    case BLOCK_TYPES.TIMER:
      return {
        type: 'interval',
        intervalValue: 1,
        intervalUnit: 'days',
        untilDate: null,
      }
    default:
      return {}
  }
}

export default Palette

