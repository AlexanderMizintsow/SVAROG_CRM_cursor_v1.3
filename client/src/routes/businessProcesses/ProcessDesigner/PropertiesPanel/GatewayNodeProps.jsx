import { useEffect, useMemo, useState } from 'react'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import GatewayEdgeConditionEditor from './GatewayEdgeConditionEditor'
import {
  getReferencesUsers,
  getReferencesDepartments,
  getReferencesRoles,
  getReferencesPositions,
} from '../../../../api/businessProcessApi.js'
import './PropertiesPanel.scss'

const GatewayNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const { scheme } = useBusinessProcessStore()
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])
  const [positions, setPositions] = useState([])

  const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
  const edgesList = Array.isArray(scheme?.edges) ? scheme.edges : []
  const taskSourceNodes = nodesList.filter(
    (n) => n.type === 'create_task' || n.type === 'assign_task'
  )

  const outgoingEdges = edgesList.filter((e) => e.source === node.id)
  const incomingEdges = edgesList.filter((e) => e.target === node.id)
  const firstIncoming = incomingEdges[0]
  const predecessorNode = firstIncoming ? nodesList.find((n) => n.id === firstIncoming.source) : null
  const decisionButtons = predecessorNode?.type === 'decision' ? (predecessorNode.settings?.buttons || []) : []
  const predecessorType = predecessorNode?.type || null

  const additionalInfoKeys = useMemo(() => {
    const keys = []
    for (const n of nodesList) {
      if (n.type !== 'additional_info') continue
      const fields = Array.isArray(n.settings?.fields) ? n.settings.fields : []
      for (const f of fields) {
        const k = String(f?.key || '').trim()
        if (k) keys.push(k)
      }
    }
    return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [nodesList])

  useEffect(() => {
    const load = async () => {
      try {
        const [u, d, r, p] = await Promise.all([
          getReferencesUsers().catch(() => []),
          getReferencesDepartments().catch(() => []),
          getReferencesRoles().catch(() => []),
          getReferencesPositions().catch(() => []),
        ])
        setUsers(Array.isArray(u) ? u : [])
        setDepartments(Array.isArray(d) ? d : [])
        setRoles(Array.isArray(r) ? r : [])
        setPositions(Array.isArray(p) ? p : [])
      } catch (e) {
        console.error(e)
      }
    }
    load()
  }, [])

  const handleChange = (key, value) => {
    onUpdate({ settings: { ...settings, [key]: value } })
  }

  const usedOutgoingIndexMax = useMemo(() => {
    let max = 0
    for (const e of outgoingEdges) {
      const sh = e.sourceHandle
      if (typeof sh !== 'string') continue
      const m = sh.match(/^out-(\d+)$/)
      if (!m) continue
      const idx = Number(m[1])
      if (Number.isFinite(idx) && idx > max) max = idx
    }
    return max
  }, [outgoingEdges])

  const outgoingCount = useMemo(() => {
    const raw = Number(settings.outgoingCount ?? 3)
    const safe = Number.isFinite(raw) ? Math.round(raw) : 3
    return Math.max(1, Math.min(10, safe))
  }, [settings.outgoingCount])

  const handleOutgoingCount = (value) => {
    const raw = Number(value)
    const safe = Number.isFinite(raw) ? Math.round(raw) : 3
    const clamped = Math.max(1, Math.min(10, safe))
    const withUsedGuard = Math.max(clamped, usedOutgoingIndexMax || 1)
    handleChange('outgoingCount', withUsedGuard)
  }

  const handleEdgeCondition = (edgeId, condition) => {
    const list = Array.isArray(settings.edges) ? settings.edges : []
    const prev = list.find((e) => e.edgeId === edgeId) || null
    const nextList = list.filter((e) => e.edgeId !== edgeId)
    if (condition) {
      nextList.push({ edgeId, condition, config: prev?.config || {}, conditionMode: prev?.conditionMode || 'single' })
    }
    onUpdate({ settings: { ...settings, edges: nextList } })
  }

  const getEdgeMeta = (edgeId) => {
    const found = (Array.isArray(settings.edges) ? settings.edges : []).find((e) => e.edgeId === edgeId)
    return found || null
  }

  const updateEdgeConfig = (edgeId, patch) => {
    const list = Array.isArray(settings.edges) ? settings.edges : []
    const next = list.map((e) => {
      if (e.edgeId !== edgeId) return e
      return { ...e, config: { ...(e.config || {}), ...(patch || {}) } }
    })
    onUpdate({ settings: { ...settings, edges: next } })
  }

  const updateEdgeFull = (edgeId, fullMeta) => {
    const list = Array.isArray(settings.edges) ? settings.edges : []
    const exists = list.some((e) => e.edgeId === edgeId)
    const nextList = exists
      ? list.map((e) => (e.edgeId === edgeId ? { ...fullMeta, edgeId } : e))
      : [...list, { ...fullMeta, edgeId }]
    onUpdate({ settings: { ...settings, edges: nextList } })
  }

  const sourceTypeDefault = predecessorType === 'start' ? 'initiator' : (predecessorType === 'decision' ? 'decision' : 'task')
  const sourceType = settings.sourceType || 'auto'
  const resolvedSourceType = sourceType === 'auto' ? sourceTypeDefault : sourceType
  const waitMode = settings.waitMode || 'event'

  return (
    <div className="properties-panel__fields">
      <p className="properties-panel__hint" style={{ marginBottom: '0.5rem' }}>
        Развилка проверяет условия по событию изменения задачи (task-updated) и продолжает процесс только когда условие совпало.
      </p>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Количество выходов развилки</label>
        <input
          type="number"
          className="properties-panel__input"
          min={1}
          max={10}
          value={outgoingCount}
          onChange={(e) => handleOutgoingCount(e.target.value)}
        />
        {usedOutgoingIndexMax > outgoingCount && (
          <p className="properties-panel__hint">
            Нельзя уменьшить меньше {usedOutgoingIndexMax}: уже есть стрелка с выходом out-{usedOutgoingIndexMax}.
          </p>
        )}
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Источник данных для условий</label>
        <select
          className="properties-panel__select"
          value={sourceType}
          onChange={(e) => handleChange('sourceType', e.target.value)}
        >
          <option value="auto">Авто (наследовать от предыдущего блока)</option>
          <option value="initiator">Инициатор процесса</option>
          <option value="task">Задача (по данным блока «Создать задачу»)</option>
          <option value="decision">Ответ из блока «Принятие решения»</option>
        </select>
        <p className="properties-panel__hint">
          Сейчас предыдущий блок: <b>{predecessorNode?.label || predecessorType || 'не определён'}</b>. Будет использован источник: <b>{resolvedSourceType}</b>.
        </p>
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Поведение, если условие не подошло</label>
        <select
          className="properties-panel__select"
          value={waitMode}
          onChange={(e) => handleChange('waitMode', e.target.value)}
          disabled={resolvedSourceType !== 'task'}
          style={{ opacity: resolvedSourceType === 'task' ? 1 : 0.7 }}
        >
          <option value="event">Ожидать события по задаче (рекомендуется)</option>
          <option value="default">Использовать «Иначе» / продолжить по схеме</option>
        </select>
        {resolvedSourceType !== 'task' && (
          <p className="properties-panel__hint">
            {resolvedSourceType === 'decision'
              ? 'При источнике «Принятие решения» ветка выбирается сразу по нажатой кнопке.'
              : 'Режим ожидания доступен только для условий по задаче.'}
          </p>
        )}
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Задача для проверки условия</label>
        <select
          className="properties-panel__select"
          value={settings.taskSourceNodeId ?? ''}
          onChange={(e) => handleChange('taskSourceNodeId', e.target.value || null)}
          disabled={resolvedSourceType !== 'task'}
          style={{ opacity: resolvedSourceType === 'task' ? 1 : 0.7 }}
        >
          <option value="">— Последняя созданная в процессе —</option>
          {taskSourceNodes.map((n) => (
            <option key={n.id} value={n.id}>{n.label || n.type}</option>
          ))}
        </select>
        {resolvedSourceType !== 'task' && (
          <p className="properties-panel__hint">
            Отключено, т.к. выбран источник «{resolvedSourceType === 'initiator' ? 'Инициатор' : 'Принятие решения'}».
          </p>
        )}
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
            const meta = getEdgeMeta(edge.id) || { edgeId: edge.id, condition: '', config: {}, conditionMode: 'single' }
            return (
              <GatewayEdgeConditionEditor
                key={edge.id}
                edge={edge}
                targetLabel={targetLabel}
                meta={meta}
                getEdgeMeta={getEdgeMeta}
                handleEdgeCondition={handleEdgeCondition}
                updateEdgeConfig={updateEdgeConfig}
                updateEdgeFull={updateEdgeFull}
                users={users}
                roles={roles}
                departments={departments}
                positions={positions}
                decisionButtons={decisionButtons}
                additionalInfoKeys={additionalInfoKeys}
              />
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
