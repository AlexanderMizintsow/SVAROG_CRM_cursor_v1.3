/**
 * Редактор условия для одной стрелки развилки.
 * Поддержка: одно условие, несколько (И/ИЛИ), ограничение по времени/дате.
 */
import { GATEWAY_CONDITIONS, CONDITION_MODE, CONDITION_OPERATOR, TIME_CONSTRAINT_TYPES } from '../../constants/blockTypes'
import './PropertiesPanel.scss'

const renderConfigSelect = (condition, config, onConfigChange, users, roles, departments, positions, decisionButtons = [], additionalInfoKeys = []) => {
  const commonProps = { style: { marginTop: '0.25rem' }, className: 'properties-panel__select' }
  if (condition === 'initiator_is_user') {
    return (
      <select {...commonProps} value={config.userId ?? ''} onChange={(e) => onConfigChange({ userId: e.target.value ? Number(e.target.value) : null })}>
        <option value="">— Выберите пользователя —</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}</option>
        ))}
      </select>
    )
  }
  if (condition === 'initiator_has_role') {
    return (
      <select {...commonProps} value={config.roleId ?? ''} onChange={(e) => onConfigChange({ roleId: e.target.value ? Number(e.target.value) : null })}>
        <option value="">— Выберите роль —</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    )
  }
  if (condition === 'initiator_in_department') {
    return (
      <select {...commonProps} value={config.departmentId ?? ''} onChange={(e) => onConfigChange({ departmentId: e.target.value ? Number(e.target.value) : null })}>
        <option value="">— Выберите отдел —</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    )
  }
  if (condition === 'initiator_has_position') {
    return (
      <select {...commonProps} value={config.positionId ?? ''} onChange={(e) => onConfigChange({ positionId: e.target.value ? Number(e.target.value) : null })}>
        <option value="">— Выберите должность —</option>
        {positions.map((pos) => (
          <option key={pos.id} value={pos.id}>{pos.name}</option>
        ))}
      </select>
    )
  }
  if (condition === 'assignee_contains_user') {
    return (
      <select {...commonProps} value={config.userId ?? ''} onChange={(e) => onConfigChange({ userId: e.target.value ? Number(e.target.value) : null })}>
        <option value="">— Выберите пользователя —</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}</option>
        ))}
      </select>
    )
  }
  if (condition === 'decision_button_clicked') {
    const btns = Array.isArray(decisionButtons) ? decisionButtons : []
    return (
      <select {...commonProps} value={config.buttonId ?? ''} onChange={(e) => onConfigChange({ buttonId: e.target.value || null })}>
        <option value="">— Выберите кнопку —</option>
        {btns.map((b) => (
          <option key={b.id} value={b.id}>{b.label || b.id}</option>
        ))}
      </select>
    )
  }
  if (condition === 'ai_var_true' || condition === 'ai_var_false') {
    const keys = Array.isArray(additionalInfoKeys) ? additionalInfoKeys : []
    return (
      <select
        {...commonProps}
        value={config.key || ''}
        onChange={(e) => onConfigChange({ key: e.target.value || '' })}
      >
        <option value="">— Выберите ключ —</option>
        {keys.map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>
    )
  }
  if (condition === 'ai_var_equals') {
    const keys = Array.isArray(additionalInfoKeys) ? additionalInfoKeys : []
    return (
      <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        <select
          className="properties-panel__select"
          value={config.key || ''}
          onChange={(e) => onConfigChange({ key: e.target.value || '' })}
          style={{ flex: '1 1 180px', minWidth: 180 }}
        >
          <option value="">— Выберите ключ —</option>
          {keys.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <input
          type="text"
          className="properties-panel__input"
          value={config.value ?? ''}
          onChange={(e) => onConfigChange({ value: e.target.value })}
          placeholder="Значение (строка)"
          style={{ flex: '1 1 160px', minWidth: 160 }}
        />
      </div>
    )
  }
  return null
}

const GatewayEdgeConditionEditor = ({
  edge,
  targetLabel,
  meta,
  getEdgeMeta,
  handleEdgeCondition,
  updateEdgeConfig,
  updateEdgeFull,
  users,
  roles,
  departments,
  positions,
  decisionButtons = [],
  additionalInfoKeys = [],
}) => {
  const edgeId = edge.id
  const conditionMode = meta?.conditionMode || 'single'
  const condition = meta?.condition ?? ''
  const config = meta?.config || {}
  const conditionsData = meta?.conditions || { type: 'or', items: [{ condition: '', config: {} }] }
  const timeConstraint = meta?.timeConstraint || { type: '', value: '' }

  const handleConditionModeChange = (mode) => {
    const next = { ...meta, conditionMode: mode }
    if (mode === 'single') {
      next.condition = conditionsData.items?.[0]?.condition || ''
      next.config = conditionsData.items?.[0]?.config || {}
      delete next.conditions
    } else {
      next.conditions = {
        type: conditionsData.type || 'or',
        items: meta.condition
          ? [{ condition: meta.condition, config: meta.config || {} }]
          : [{ condition: '', config: {} }],
      }
    }
    updateEdgeFull(edgeId, next)
  }

  const handleConditionsOperatorChange = (type) => {
    updateEdgeFull(edgeId, { ...meta, conditions: { ...conditionsData, type } })
  }

  const handleConditionItemChange = (idx, cond, cfg) => {
    const items = [...(conditionsData.items || [])]
    while (items.length <= idx) items.push({ condition: '', config: {} })
    items[idx] = { condition: cond, config: cfg || {} }
    updateEdgeFull(edgeId, { ...meta, conditions: { ...conditionsData, items } })
  }

  const addConditionItem = () => {
    const items = [...(conditionsData.items || []), { condition: '', config: {} }]
    updateEdgeFull(edgeId, { ...meta, conditions: { ...conditionsData, items } })
  }

  const removeConditionItem = (idx) => {
    const items = (conditionsData.items || []).filter((_, i) => i !== idx)
    if (items.length === 0) items.push({ condition: '', config: {} })
    updateEdgeFull(edgeId, { ...meta, conditions: { ...conditionsData, items } })
  }

  const handleTimeConstraintChange = (field, val) => {
    const next = { ...timeConstraint, [field]: val }
    if (!next.type) next.value = ''
    updateEdgeFull(edgeId, { ...meta, timeConstraint: next })
  }

  return (
    <div className="properties-panel__field gateway-edge-condition" style={{ marginTop: '0.75rem', paddingLeft: '0.5rem', borderLeft: '2px solid #e2e8f0' }}>
      <span className="properties-panel__label">→ {targetLabel}</span>

      <div className="properties-panel__field" style={{ marginTop: '0.35rem' }}>
        <label className="properties-panel__label" style={{ fontSize: '0.8rem' }}>Режим условия</label>
        <select
          className="properties-panel__select"
          value={conditionMode}
          onChange={(e) => handleConditionModeChange(e.target.value)}
        >
          {CONDITION_MODE.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {conditionMode === 'single' ? (
        <>
          <select
            className="properties-panel__select"
            value={condition}
            onChange={(e) => handleEdgeCondition(edgeId, e.target.value || null)}
            style={{ marginTop: '0.35rem' }}
          >
            <option value="">— Не задано —</option>
            {GATEWAY_CONDITIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {renderConfigSelect(
            condition,
            config,
            (patch) => updateEdgeConfig(edgeId, patch),
            users,
            roles,
            departments,
            positions,
            decisionButtons,
            additionalInfoKeys
          )}
        </>
      ) : (
        <div style={{ marginTop: '0.5rem' }}>
          <div className="properties-panel__field">
            <label className="properties-panel__label" style={{ fontSize: '0.8rem' }}>Оператор</label>
            <select
              className="properties-panel__select"
              value={conditionsData.type || 'or'}
              onChange={(e) => handleConditionsOperatorChange(e.target.value)}
            >
              {CONDITION_OPERATOR.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {(conditionsData.items || []).map((item, idx) => (
            <div key={idx} className="properties-panel__field" style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <select
                  className="properties-panel__select"
                  value={item.condition || ''}
                  onChange={(e) => handleConditionItemChange(idx, e.target.value || '', item.config)}
                  style={{ flex: '1 1 180px', minWidth: 0 }}
                >
                  <option value="">— Не задано —</option>
                  {GATEWAY_CONDITIONS.filter((o) => o.value !== 'else').map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button type="button" className="properties-panel__btn-remove" onClick={() => removeConditionItem(idx)} title="Удалить условие">−</button>
              </div>
              {renderConfigSelect(
                item.condition,
                item.config || {},
                (patch) => handleConditionItemChange(idx, item.condition, { ...(item.config || {}), ...patch }),
                users,
                roles,
                departments,
                positions,
                decisionButtons,
                additionalInfoKeys
              )}
            </div>
          ))}
          <button type="button" className="properties-panel__btn-add" onClick={addConditionItem} style={{ marginTop: '0.35rem' }}>+ Добавить условие</button>
        </div>
      )}

      <div className="properties-panel__field" style={{ marginTop: '0.5rem' }}>
        <label className="properties-panel__label" style={{ fontSize: '0.8rem' }}>Ограничение по времени/дате</label>
        <select
          className="properties-panel__select"
          value={timeConstraint.type || ''}
          onChange={(e) => handleTimeConstraintChange('type', e.target.value)}
        >
          {TIME_CONSTRAINT_TYPES.map((opt) => (
            <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {timeConstraint.type && (
          <input
            type="text"
            className="properties-panel__input"
            value={timeConstraint.value || ''}
            onChange={(e) => handleTimeConstraintChange('value', e.target.value)}
            placeholder={timeConstraint.type?.includes('time') ? 'HH:MM (например 18:00)' : 'YYYY-MM-DD'}
            style={{ marginTop: '0.25rem' }}
          />
        )}
      </div>
    </div>
  )
}

export default GatewayEdgeConditionEditor
