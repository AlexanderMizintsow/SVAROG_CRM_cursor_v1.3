/**
 * Свойства блока «Развилка-Слияние».
 * Несколько входящих (задачи, Принятие решения) — ожидание всех; исходящие ветки с совокупностью условий (И/ИЛИ).
 */
import { useEffect, useMemo, useState } from 'react'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import { getReferencesUsers } from '../../../../api/businessProcessApi'
import {
  JOIN_CONDITION_ANY,
  GATEWAY_JOIN_TASK_CONDITIONS,
  GATEWAY_JOIN_PROJECT_CONDITIONS,
  CONDITION_OPERATOR,
} from '../../constants/blockTypes'
import './PropertiesPanel.scss'

const SOURCE_TYPE_LABEL = {
  create_task: 'Создать задачу',
  assign_task: 'Назначить задачу',
  create_project: 'Создать проект',
  decision: 'Принятие решения',
}

/** Значение assignee_contains_user хранится как "assignee_contains_user|userId" */
const ASSIGNEE_CONDITION_PREFIX = 'assignee_contains_user|'

const ADD_INFO_CONDITIONS = [
  { value: '', label: '— не использовать —' },
  { value: 'ai_var_true', label: 'Доп.инфо: ключ заполнен (true)' },
  { value: 'ai_var_false', label: 'Доп.инфо: ключ пустой/не задан (false)' },
  { value: 'ai_var_equals', label: 'Доп.инфо: ключ равен значению' },
]

const GatewayJoinNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const { scheme } = useBusinessProcessStore()
  const [users, setUsers] = useState([])

  useEffect(() => {
    getReferencesUsers().catch(() => []).then((u) => setUsers(Array.isArray(u) ? u : []))
  }, [])

  const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
  const edgesList = Array.isArray(scheme?.edges) ? scheme.edges : []

  const incomingEdges = edgesList.filter((e) => e.target === node.id)
  const incomingSources = useMemo(() => {
    const list = []
    for (const e of incomingEdges) {
      const src = nodesList.find((n) => n.id === e.source)
      const allowed = src && (
        src.type === 'create_task' ||
        src.type === 'assign_task' ||
        src.type === 'create_project' ||
        src.type === 'decision'
      )
      if (allowed && !list.some((x) => x.id === src.id)) list.push(src)
    }
    return list
  }, [incomingEdges, nodesList])

  const outgoingEdges = edgesList.filter((e) => e.source === node.id)

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

  const handleChange = (key, value) => {
    onUpdate({ settings: { ...settings, [key]: value } })
  }

  const handleOutgoingCount = (value) => {
    const raw = Number(value)
    const safe = Number.isFinite(raw) ? Math.round(raw) : 3
    const clamped = Math.max(1, Math.min(10, safe))
    const withUsedGuard = Math.max(clamped, usedOutgoingIndexMax || 1)
    handleChange('outgoingCount', withUsedGuard)
  }

  const edgesMeta = Array.isArray(settings.edges) ? settings.edges : []

  const getEdgeMeta = (edgeId) => edgesMeta.find((e) => e.edgeId === edgeId) || null

  const setEdgeMeta = (edgeId, meta) => {
    const list = [...edgesMeta]
    const idx = list.findIndex((e) => e.edgeId === edgeId)
    if (idx >= 0) list[idx] = { ...list[idx], ...meta }
    else list.push({ edgeId, ...meta })
    handleChange('edges', list)
  }

  const setEdgeCombination = (edgeId, sourceNodeId, value) => {
    const meta = getEdgeMeta(edgeId) || { edgeId, operator: 'and', combination: {} }
    const combination = { ...(meta.combination || {}), [sourceNodeId]: value }
    setEdgeMeta(edgeId, { ...meta, combination })
  }

  const setEdgeOperator = (edgeId, operator) => {
    const meta = getEdgeMeta(edgeId) || { edgeId, operator: 'and', combination: {} }
    setEdgeMeta(edgeId, { ...meta, operator })
  }

  const setEdgeAiCondition = (edgeId, aiCondition) => {
    const meta = getEdgeMeta(edgeId) || { edgeId, operator: 'and', combination: {} }
    const nextCond = aiCondition || ''
    const nextConfig = nextCond ? { ...(meta.aiConfig || {}), key: (meta.aiConfig || {}).key || '', value: (meta.aiConfig || {}).value || '' } : {}
    setEdgeMeta(edgeId, { ...meta, aiCondition: nextCond, aiConfig: nextConfig })
  }

  const setEdgeAiConfig = (edgeId, patch) => {
    const meta = getEdgeMeta(edgeId) || { edgeId, operator: 'and', combination: {} }
    const next = { ...(meta.aiConfig || {}), ...(patch || {}) }
    setEdgeMeta(edgeId, { ...meta, aiConfig: next })
  }

  const getOptionsForSource = (sourceNode) => {
    if (sourceNode.type === 'decision') {
      const buttons = Array.isArray(sourceNode.settings?.buttons) ? sourceNode.settings.buttons : []
      return [
        { value: JOIN_CONDITION_ANY, label: 'Неважно' },
        ...buttons.map((b) => ({ value: b.id, label: b.label || b.id })),
      ]
    }
    if (sourceNode.type === 'create_project') {
      return GATEWAY_JOIN_PROJECT_CONDITIONS
    }
    return GATEWAY_JOIN_TASK_CONDITIONS
  }

  const isAssigneeCondition = (val) => val && String(val).startsWith(ASSIGNEE_CONDITION_PREFIX)

  const getAssigneeUserId = (val) => {
    if (!isAssigneeCondition(val)) return null
    const parsed = Number(String(val).replace(ASSIGNEE_CONDITION_PREFIX, ''))
    return Number.isFinite(parsed) ? parsed : null
  }

  const setAssigneeCondition = (edgeId, sourceNodeId, userId) => {
    const meta = getEdgeMeta(edgeId) || { edgeId, operator: 'and', combination: {} }
    const value = userId ? `${ASSIGNEE_CONDITION_PREFIX}${userId}` : 'assignee_contains_user'
    const combination = { ...(meta.combination || {}), [sourceNodeId]: value }
    setEdgeMeta(edgeId, { ...meta, combination })
  }

  return (
    <div className="properties-panel__fields">
      <p className="properties-panel__hint" style={{ marginBottom: '0.5rem' }}>
        Блок ждёт выполнения условий от всех входящих веток, затем выбирает исходящую ветку по совокупности условий (И/ИЛИ).
      </p>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Входящие источники</label>
        {incomingSources.length === 0 ? (
          <p className="properties-panel__hint">
            Подключите к блоку стрелки от блоков «Создать задачу», «Назначить задачу», «Создать проект» или «Принятие решения».
          </p>
        ) : (
          <ul className="properties-panel__list-simple">
            {incomingSources.map((src) => (
              <li key={src.id}>
                {src.label || SOURCE_TYPE_LABEL[src.type] || src.type} ({SOURCE_TYPE_LABEL[src.type]})
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Количество исходящих веток</label>
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

      {outgoingEdges.length > 0 && incomingSources.length > 0 && (
        <div className="properties-panel__field">
          <label className="properties-panel__label">Совокупность условий по исходящим веткам</label>
          <p className="properties-panel__hint" style={{ marginBottom: '0.5rem' }}>
            Для каждой ветки задайте условие по каждому входящему источнику (или «Неважно») и оператор И/ИЛИ.
          </p>
          {outgoingEdges.map((edge) => {
            const targetNode = nodesList.find((n) => n.id === edge.target)
            const targetLabel = targetNode?.label || edge.target
            const meta = getEdgeMeta(edge.id) || { edgeId: edge.id, operator: 'and', combination: {} }
            const combination = meta.combination || {}
            const aiCondition = meta.aiCondition || ''
            const aiConfig = meta.aiConfig || {}
            return (
              <div
                key={edge.id}
                className="properties-panel__field gateway-join-edge"
                style={{ marginTop: '0.75rem', paddingLeft: '0.5rem', borderLeft: '2px solid #e2e8f0' }}
              >
                <span className="properties-panel__label">→ {targetLabel}</span>
                <div className="properties-panel__field" style={{ marginTop: '0.35rem' }}>
                  <label className="properties-panel__label" style={{ fontSize: '0.8rem' }}>Оператор между условиями</label>
                  <select
                    className="properties-panel__select"
                    value={meta.operator || 'and'}
                    onChange={(e) => setEdgeOperator(edge.id, e.target.value)}
                  >
                    {CONDITION_OPERATOR.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {additionalInfoKeys.length > 0 && (
                  <div className="properties-panel__field" style={{ marginTop: '0.35rem' }}>
                    <label className="properties-panel__label" style={{ fontSize: '0.8rem' }}>Доп. информация (доп. условие)</label>
                    <select
                      className="properties-panel__select"
                      value={aiCondition}
                      onChange={(e) => setEdgeAiCondition(edge.id, e.target.value)}
                    >
                      {ADD_INFO_CONDITIONS.map((opt) => (
                        <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    {!!aiCondition && (
                      <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <select
                          className="properties-panel__select"
                          value={aiConfig.key || ''}
                          onChange={(e) => setEdgeAiConfig(edge.id, { key: e.target.value || '' })}
                          style={{ flex: '1 1 220px', minWidth: 220 }}
                        >
                          <option value="">— Выберите ключ —</option>
                          {additionalInfoKeys.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                        {aiCondition === 'ai_var_equals' && (
                          <input
                            type="text"
                            className="properties-panel__input"
                            value={aiConfig.value ?? ''}
                            onChange={(e) => setEdgeAiConfig(edge.id, { value: e.target.value })}
                            placeholder="значение"
                            style={{ flex: '1 1 160px', minWidth: 160 }}
                          />
                        )}
                      </div>
                    )}
                    <p className="properties-panel__hint">
                      Это условие проверяется по <b>общим переменным процесса</b> (из блоков «Доп. информация»).
                    </p>
                  </div>
                )}

                {incomingSources.map((src) => {
                  const options = getOptionsForSource(src)
                  const value = combination[src.id] ?? JOIN_CONDITION_ANY
                  const showUserSelect = src.type !== 'decision' && (value === 'assignee_contains_user' || isAssigneeCondition(value))
                  const assigneeUserId = getAssigneeUserId(value)
                  return (
                    <div key={src.id} className="properties-panel__field" style={{ marginTop: '0.35rem' }}>
                      <label className="properties-panel__label" style={{ fontSize: '0.8rem' }}>
                        {src.label || SOURCE_TYPE_LABEL[src.type]}:
                      </label>
                      <select
                        className="properties-panel__select"
                        value={value === 'assignee_contains_user' || isAssigneeCondition(value) ? 'assignee_contains_user' : value}
                        onChange={(e) => setEdgeCombination(edge.id, src.id, e.target.value)}
                      >
                        {options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {showUserSelect && (
                        <select
                          className="properties-panel__select"
                          style={{ marginTop: '0.25rem' }}
                          value={assigneeUserId ?? ''}
                          onChange={(e) => setAssigneeCondition(edge.id, src.id, e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">— Выберите пользователя —</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {[u.last_name, u.first_name].filter(Boolean).join(' ') || u.username}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {outgoingEdges.length === 0 && (
        <p className="properties-panel__hint">
          Соедините блок со следующими узлами стрелками, затем настройте совокупность условий для каждой ветки.
        </p>
      )}
    </div>
  )
}

export default GatewayJoinNodeProps
