import { useCallback, useMemo, useState } from 'react'
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
  IoLayersOutline,
  IoInformationCircleOutline,
  IoFolderOpenOutline,
  IoAttachOutline,
  IoChatboxEllipsesOutline,
  IoChatbubbleEllipsesOutline,
  IoPeopleCircleOutline,
  IoListOutline,
  IoSwapVerticalOutline,
} from 'react-icons/io5'
import { LuSplit } from "react-icons/lu";
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore.js'
import { BLOCK_TYPES, BLOCK_LABELS } from '../../constants/blockTypes.js'
import './Palette.scss'

const PALETTE_GROUPS = [
  {
    groupLabel: 'Основные',
    items: [
      { type: BLOCK_TYPES.START, icon: IoPlayCircle, color: '#22c55e' },
      { type: BLOCK_TYPES.END, icon: IoStopCircle, color: '#94a3b8' },
      { type: BLOCK_TYPES.LANE, icon: IoLayersOutline, color: '#64748b' },
      { type: BLOCK_TYPES.ADDITIONAL_INFO, icon: IoInformationCircleOutline, color: '#0f766e' },
    ],
  },
  {
    groupLabel: 'Проект',
    expandable: true,
    items: [
      { type: BLOCK_TYPES.CREATE_PROJECT, icon: IoFolderOpenOutline, color: '#0ea5e9' },
      { type: BLOCK_TYPES.PROJECT_UPDATE_STATUS, icon: IoSwapVerticalOutline, color: '#0284c7' },
      { type: BLOCK_TYPES.PROJECT_ADD_RESPONSIBLES, icon: IoPeopleCircleOutline, color: '#0284c7' },
      { type: BLOCK_TYPES.PROJECT_ADD_COMMENT, icon: IoChatbubbleEllipsesOutline, color: '#0284c7' },
      { type: BLOCK_TYPES.PROJECT_POST_CHAT, icon: IoChatboxEllipsesOutline, color: '#0284c7' },
      { type: BLOCK_TYPES.PROJECT_UPDATE_GOALS, icon: IoListOutline, color: '#0284c7' },
      { type: BLOCK_TYPES.PROJECT_UPDATE_ADDITIONAL_INFO, icon: IoInformationCircleOutline, color: '#0284c7' },
      { type: BLOCK_TYPES.PROJECT_ADD_ATTACHMENT, icon: IoAttachOutline, color: '#0284c7' },
      { type: BLOCK_TYPES.PROJECT_UPDATE_TASK_STATUS, icon: IoSwapVerticalOutline, color: '#8b5cf6' },
    ],
  },
  {
    groupLabel: 'Задача',
    expandable: true,
    items: [
      { type: BLOCK_TYPES.CREATE_TASK, icon: IoDocumentText, color: '#3b82f6' },
      { type: BLOCK_TYPES.ASSIGN_TASK, icon: IoPeopleCircleOutline, color: '#3b82f6' },
      { type: BLOCK_TYPES.TASK_UPDATE_STATUS, icon: IoSwapVerticalOutline, color: '#2563eb' },
      { type: BLOCK_TYPES.TASK_ADD_COMMENT, icon: IoChatbubbleEllipsesOutline, color: '#2563eb' },
      { type: BLOCK_TYPES.TASK_ADD_ATTACHMENT, icon: IoAttachOutline, color: '#2563eb' },
    ],
  },
  {
    groupLabel: 'Логика и уведомления',
    items: [
      { type: BLOCK_TYPES.NOTIFICATION, icon: IoNotifications, color: '#f59e0b' },
      { type: BLOCK_TYPES.DECISION, icon: IoCheckmarkDoneCircle, color: '#8b5cf6' },
      { type: BLOCK_TYPES.GATEWAY, icon: IoGitBranch, color: '#e11d48' },
      { type: BLOCK_TYPES.GATEWAY_JOIN, icon: IoGitMergeOutline, color: '#c026d3' },
      { type: BLOCK_TYPES.SPLITTER, icon: LuSplit, color: '#dc2626' },
      { type: BLOCK_TYPES.TIMER, icon: IoTime, color: '#0ea5e9' },
    ],
  },
]

const Palette = () => {
  const { scheme, addNodeToScheme } = useBusinessProcessStore()
  const [copiedKey, setCopiedKey] = useState('')
  const [expandedGroups, setExpandedGroups] = useState({})
  const toggleGroup = (groupLabel) => {
    setExpandedGroups((prev) => ({ ...prev, [groupLabel]: !prev[groupLabel] }))
  }

  const additionalInfoKeys = useMemo(() => {
    const nodes = Array.isArray(scheme?.nodes) ? scheme.nodes : []
    const keys = []
    for (const n of nodes) {
      if (n.type !== BLOCK_TYPES.ADDITIONAL_INFO) continue
      const fields = Array.isArray(n.settings?.fields) ? n.settings.fields : []
      for (const f of fields) {
        const k = String(f?.key || '').trim()
        if (k) keys.push(k)
      }
    }
    return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [scheme?.nodes])

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
        // Для дорожки по умолчанию держим пустую строку (покажем плейсхолдер визуально),
        // чтобы при редактировании не было «скачка» на дефолтное имя.
        label: type === BLOCK_TYPES.LANE ? '' : (BLOCK_LABELS[type] || type),
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
      <div className="palette__groups">
        {PALETTE_GROUPS.map((group) => (
          <div key={group.groupLabel} className="palette__group">
            {group.expandable ? (
              <>
                <button
                  type="button"
                  className="palette__group-toggle"
                  onClick={() => toggleGroup(group.groupLabel)}
                  aria-expanded={expandedGroups[group.groupLabel]}
                >
                  <span className="palette__group-label">{group.groupLabel}</span>
                  <span className="palette__group-arrow">{expandedGroups[group.groupLabel] ? '▼' : '▶'}</span>
                </button>
                {expandedGroups[group.groupLabel] && (
                  <ul className="palette__list palette__list--nested">
                    {group.items.map((item) => (
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
                )}
              </>
            ) : (
              <>
                <span className="palette__group-label palette__group-label--static">{group.groupLabel}</span>
                <ul className="palette__list">
                  {group.items.map((item) => (
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
              </>
            )}
          </div>
        ))}
      </div>

      <div className="palette__vars">
        <h3 className="palette__title" style={{ marginTop: 16 }}>Переменные</h3>
        <p className="palette__hint">
          Ключи из блоков «Доп. информация». Клик — скопировать подстановку в буфер.
        </p>
        {additionalInfoKeys.length === 0 ? (
          <p className="palette__hint">Добавьте блок «Доп. информация» и задайте ключи.</p>
        ) : (
          <ul className="palette__list">
            {additionalInfoKeys.map((k) => {
              const token = `{доп:${k}}`
              return (
                <li key={k} className="palette__item">
                  <button
                    type="button"
                    className="palette__btn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(token)
                        setCopiedKey(k)
                        setTimeout(() => setCopiedKey(''), 1200)
                      } catch (e) {
                        // fallback: ничего, пользователь может скопировать вручную
                      }
                    }}
                    title="Скопировать"
                  >
                    <span className="palette__label" style={{ fontFamily: 'monospace' }}>{token}</span>
                    {copiedKey === k && <span className="palette__hint" style={{ marginLeft: 8 }}>Скопировано</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function getDefaultSettings(type) {
  switch (type) {
    case BLOCK_TYPES.START:
      return { initiatorType: 'current_user', allowAllLaunchers: true, allowedLauncherUserIds: [] }
    case BLOCK_TYPES.END:
      return { outcome: 'SUCCESS', comment: '' }
    case BLOCK_TYPES.LANE:
      return { width: 420, height: 220 }
    case BLOCK_TYPES.ADDITIONAL_INFO:
      return {
        // fields: [{ key, value, requiredAtRuntime, requiredFor: { source, userIds, departmentId, roleId }, promptText }]
        fields: [],
      }
    case BLOCK_TYPES.CREATE_PROJECT:
      return {
        createMode: 'prepared',
        title: '',
        description: '',
        goals: [],
        deadline: null,
        priority: 'medium',
        additionalInfo: [],
        responsibles: [],
      }
    case BLOCK_TYPES.PROJECT_UPDATE_STATUS:
      return { projectSource: 'last', projectNodeId: null, fixedProjectId: null, status: 'Новая' }
    case BLOCK_TYPES.PROJECT_ADD_COMMENT:
      return { projectSource: 'last', projectNodeId: null, fixedProjectId: null, comment: '' }
    case BLOCK_TYPES.PROJECT_POST_CHAT:
      return { projectSource: 'last', projectNodeId: null, fixedProjectId: null, text: '', title: '' }
    case BLOCK_TYPES.PROJECT_ADD_RESPONSIBLES:
      return { projectSource: 'last', projectNodeId: null, fixedProjectId: null, responsibles: [] }
    case BLOCK_TYPES.PROJECT_UPDATE_GOALS:
      return { projectSource: 'last', projectNodeId: null, fixedProjectId: null, goals: [] }
    case BLOCK_TYPES.PROJECT_UPDATE_ADDITIONAL_INFO:
      return { projectSource: 'last', projectNodeId: null, fixedProjectId: null, additionalInfo: [] }
    case BLOCK_TYPES.PROJECT_ADD_ATTACHMENT:
      return {
        projectSource: 'last',
        projectNodeId: null,
        fixedProjectId: null,
        file_url: '',
        file_type: '',
        name_file: '',
        comment_file: '',
      }
    case BLOCK_TYPES.PROJECT_UPDATE_TASK_STATUS:
      return { taskSource: 'last', taskNodeId: null, fixedTaskId: null, status: 'backlog' }
    case BLOCK_TYPES.TASK_UPDATE_STATUS:
      return { taskSource: 'last', taskSourceNodeId: null, fixedTaskId: null, status: 'backlog' }
    case BLOCK_TYPES.TASK_ADD_COMMENT:
      return { taskSource: 'last', taskSourceNodeId: null, fixedTaskId: null, comment: '' }
    case BLOCK_TYPES.TASK_ADD_ATTACHMENT:
      return {
        taskSource: 'last',
        taskSourceNodeId: null,
        fixedTaskId: null,
        file_url: '',
        file_type: '',
        name_file: '',
        comment_file: '',
      }
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
        deadlineMode: null,
        deadline: null,
        deadlineOffsetDays: null,
        linkToProject: false,
        projectSource: 'last',
        projectNodeId: null,
        fixedProjectId: null,
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
    case BLOCK_TYPES.SPLITTER:
      return { outgoingCount: 2 }
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

