import { useEffect, useMemo, useState } from 'react'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import { GATEWAY_CONDITIONS } from '../../constants/blockTypes'
import {
  getReferencesUsers,
  getReferencesDepartments,
  getReferencesRoles,
} from '../../../../api/businessProcessApi.js'
import './PropertiesPanel.scss'

const GatewayNodeProps = ({ node, onUpdate }) => {
  const settings = node.settings || {}
  const { scheme } = useBusinessProcessStore()
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])

  const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
  const edgesList = Array.isArray(scheme?.edges) ? scheme.edges : []
  const taskSourceNodes = nodesList.filter(
    (n) => n.type === 'create_task' || n.type === 'assign_task'
  )

  const outgoingEdges = edgesList.filter((e) => e.source === node.id)
  const incomingEdges = edgesList.filter((e) => e.target === node.id)
  const firstIncoming = incomingEdges[0]
  const predecessorNode = firstIncoming ? nodesList.find((n) => n.id === firstIncoming.source) : null
  const predecessorType = predecessorNode?.type || null

  useEffect(() => {
    const load = async () => {
      try {
        const [u, d, r] = await Promise.all([
          getReferencesUsers().catch(() => []),
          getReferencesDepartments().catch(() => []),
          getReferencesRoles().catch(() => []),
        ])
        setUsers(Array.isArray(u) ? u : [])
        setDepartments(Array.isArray(d) ? d : [])
        setRoles(Array.isArray(r) ? r : [])
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
      nextList.push({ edgeId, condition, config: prev?.config || {} })
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

  const sourceTypeDefault = predecessorType === 'start' ? 'initiator' : 'task'
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
        >
          <option value="event">Ожидать события по задаче (рекомендуется)</option>
          <option value="default">Использовать «Иначе» / продолжить по схеме</option>
        </select>
        {resolvedSourceType !== 'task' && (
          <p className="properties-panel__hint">Режим ожидания доступен только для условий по задаче.</p>
        )}
      </div>

      <div className="properties-panel__field">
        <label className="properties-panel__label">Задача для проверки условия</label>
        <select
          className="properties-panel__select"
          value={settings.taskSourceNodeId ?? ''}
          onChange={(e) => handleChange('taskSourceNodeId', e.target.value || null)}
          disabled={resolvedSourceType !== 'task'}
        >
          <option value="">— Последняя созданная в процессе —</option>
          {taskSourceNodes.map((n) => (
            <option key={n.id} value={n.id}>{n.label || n.type}</option>
          ))}
        </select>
        {resolvedSourceType !== 'task' && (
          <p className="properties-panel__hint">Отключено, т.к. выбран источник «Инициатор».</p>
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
            const meta = getEdgeMeta(edge.id)
            const condition = meta?.condition ?? ''
            const config = meta?.config || {}
            return (
              <div key={edge.id} className="properties-panel__field" style={{ marginTop: '0.5rem' }}>
                <span className="properties-panel__label">→ {targetLabel}</span>
                <select
                  className="properties-panel__select"
                  value={condition}
                  onChange={(e) => handleEdgeCondition(edge.id, e.target.value || null)}
                >
                  <option value="">— Не задано —</option>
                  {GATEWAY_CONDITIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {condition === 'initiator_is_user' && (
                  <select
                    className="properties-panel__select"
                    value={config.userId ?? ''}
                    onChange={(e) => updateEdgeConfig(edge.id, { userId: e.target.value ? Number(e.target.value) : null })}
                    style={{ marginTop: '0.25rem' }}
                  >
                    <option value="">— Выберите пользователя —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}
                      </option>
                    ))}
                  </select>
                )}

                {condition === 'initiator_has_role' && (
                  <select
                    className="properties-panel__select"
                    value={config.roleId ?? ''}
                    onChange={(e) => updateEdgeConfig(edge.id, { roleId: e.target.value ? Number(e.target.value) : null })}
                    style={{ marginTop: '0.25rem' }}
                  >
                    <option value="">— Выберите роль —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}

                {condition === 'initiator_in_department' && (
                  <select
                    className="properties-panel__select"
                    value={config.departmentId ?? ''}
                    onChange={(e) => updateEdgeConfig(edge.id, { departmentId: e.target.value ? Number(e.target.value) : null })}
                    style={{ marginTop: '0.25rem' }}
                  >
                    <option value="">— Выберите отдел —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}

                {condition === 'assignee_contains_user' && (
                  <select
                    className="properties-panel__select"
                    value={config.userId ?? ''}
                    onChange={(e) => updateEdgeConfig(edge.id, { userId: e.target.value ? Number(e.target.value) : null })}
                    style={{ marginTop: '0.25rem' }}
                  >
                    <option value="">— Выберите пользователя —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}
                      </option>
                    ))}
                  </select>
                )}
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
