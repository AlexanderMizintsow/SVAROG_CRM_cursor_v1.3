/**
 * Узел «Доп. информация»:
 * - сохраняет пары key -> value в context.additional_info
 * - может требовать заполнение некоторых ключей во время выполнения (waiting_additional_info)
 * - создаёт запросы для пользователей (AlertBanner)
 */
function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

function normalizeKey(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\wа-яА-Я0-9_]/g, '')
}

function normalizeValue(raw) {
  if (raw === undefined || raw === null) return false
  if (raw === false) return false
  const s = typeof raw === 'string' ? raw.trim() : raw
  if (typeof s === 'string' && !s) return false
  return s
}

function computeValueFromSource(field, context) {
  const vs = field && field.valueSource && typeof field.valueSource === 'object' ? field.valueSource : null
  const type = vs && vs.type ? String(vs.type) : 'manual'
  const cfg = vs && vs.config && typeof vs.config === 'object' ? vs.config : {}

  if (type === 'manual') {
    return normalizeValue(field && field.value)
  }

  if (type === 'decision_last_button_id') {
    const last = context.last_decision || {}
    return normalizeValue(last.buttonId != null ? String(last.buttonId) : false)
  }

  if (type === 'decision_last_button_label') {
    const last = context.last_decision || {}
    return normalizeValue(last.buttonLabel != null ? String(last.buttonLabel) : false)
  }

  if (type === 'decision_node_button_id') {
    const nodeId = cfg.nodeId ? String(cfg.nodeId) : ''
    const out = context.decision_outputs && typeof context.decision_outputs === 'object' ? context.decision_outputs : {}
    const v = nodeId && out[nodeId] ? out[nodeId].button_id : null
    return normalizeValue(v != null ? String(v) : false)
  }

  if (type === 'decision_node_button_label') {
    const nodeId = cfg.nodeId ? String(cfg.nodeId) : ''
    const out = context.decision_outputs && typeof context.decision_outputs === 'object' ? context.decision_outputs : {}
    const v = nodeId && out[nodeId] ? out[nodeId].button_label : null
    return normalizeValue(v != null ? String(v) : false)
  }

  if (type === 'timer_node_resume_at') {
    const nodeId = cfg.nodeId ? String(cfg.nodeId) : ''
    const out = context.timer_outputs && typeof context.timer_outputs === 'object' ? context.timer_outputs : {}
    const v = nodeId && out[nodeId] ? out[nodeId].resume_at : null
    return normalizeValue(v != null ? String(v) : false)
  }

  // Неизвестный источник — безопасно считаем как manual
  return normalizeValue(field && field.value)
}

async function resolveUserIds(requiredFor, context, registerClient) {
  const rf = requiredFor && typeof requiredFor === 'object' ? requiredFor : {}
  const source = rf.source || 'initiator'
  if (source === 'initiator') {
    return context.initiator_id ? [context.initiator_id] : []
  }
  if (source === 'users') {
    const ids = Array.isArray(rf.userIds) ? rf.userIds : []
    return ids.map((x) => Number(x)).filter((x) => Number.isFinite(x))
  }
  if (source === 'department' && rf.departmentId) {
    const users = await registerClient.getUsers().catch(() => [])
    return (users || []).filter((u) => Number(u.department_id) === Number(rf.departmentId)).map((u) => u.id)
  }
  if (source === 'role' && rf.roleId) {
    const users = await registerClient.getUsers().catch(() => [])
    return (users || []).filter((u) => Number(u.role_id) === Number(rf.roleId)).map((u) => u.id)
  }
  return []
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  const addInfo = context.additional_info && typeof context.additional_info === 'object' ? context.additional_info : {}
  const fields = Array.isArray(settings.fields) ? settings.fields : []

  // 1) применяем дефолтные значения (если в контексте ещё нет значения)
  const nextAddInfo = { ...addInfo }
  for (const f of fields) {
    const key = normalizeKey(f && f.key)
    if (!key) continue

    const has = Object.prototype.hasOwnProperty.call(nextAddInfo, key)
    const currentVal = has ? nextAddInfo[key] : undefined
    const defaultVal = computeValueFromSource(f, context)

    // если значение уже заполнялось ранее — не затираем, иначе ставим дефолт (или false)
    if (currentVal === undefined || currentVal === null || currentVal === false || currentVal === '') {
      nextAddInfo[key] = defaultVal
    } else if (!has) {
      nextAddInfo[key] = defaultVal
    }
  }

  // 2) ищем обязательные поля, которые не заполнены
  const missing = []
  for (const f of fields) {
    const key = normalizeKey(f && f.key)
    if (!key) continue
    if (!f || f.requiredAtRuntime !== true) continue
    const v = normalizeValue(nextAddInfo[key])
    if (v === false) {
      missing.push({ key, promptText: (f.promptText || '').trim(), requiredFor: f.requiredFor || { source: 'initiator' } })
    }
  }

  const newContext = { ...context, additional_info: nextAddInfo }
  await dbPool.query('UPDATE bp_process_instances SET context = $1 WHERE id = $2', [JSON.stringify(newContext), instance.id])

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) {
    return { fail: 'У узла «Доп. информация» нет исходящего ребра' }
  }

  if (missing.length === 0) {
    return { nextNodeId: nextEdge.target }
  }

  // 3) создаём запросы на заполнение (по одному на пользователя) и ставим ожидание
  const defResult = await dbPool.query('SELECT name FROM bp_process_definitions WHERE id = $1', [instance.process_id])
  const processName = defResult.rows[0]?.name || 'Бизнес-процесс'

  const initiatorId = context.initiator_id || null
  let initiatorName = initiatorId ? `Пользователь #${initiatorId}` : '—'
  if (initiatorId) {
    try {
      const users = await reg.getUsers()
      const u = (users || []).find((x) => Number(x.id) === Number(initiatorId))
      if (u) {
        initiatorName = [u.last_name, u.first_name, u.middle_name].filter(Boolean).join(' ') || u.username || initiatorName
      }
    } catch (e) {
      // ignore
    }
  }

  const userIdSet = new Set()
  for (const m of missing) {
    const ids = await resolveUserIds(m.requiredFor, context, reg)
    ids.forEach((id) => userIdSet.add(Number(id)))
  }
  const userIds = Array.from(userIdSet).filter((x) => Number.isFinite(x))
  if (userIds.length === 0) {
    return { fail: 'Для обязательных полей «Доп. информация» не определены пользователи, которым показать требование' }
  }

  const promptLines = missing
    .map((m) => {
      const extra = m.promptText ? ` — ${m.promptText}` : ''
      return `• ${m.key}${extra}`
    })
    .join('\n')
  const promptText = `Заполните доп. данные:\n${promptLines}`

  let missingTableWarned = false
  try {
    for (const uid of userIds) {
      await dbPool.query(
        `INSERT INTO bp_additional_info_requests (instance_id, node_id, user_id, process_name, prompt_text, required_keys, initiator_id, initiator_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          instance.id,
          node.id,
          uid,
          processName,
          promptText,
          JSON.stringify(missing.map((m) => m.key)),
          initiatorId,
          initiatorName,
        ]
      )
    }
  } catch (e) {
    if (e && e.code === '42P01') {
      if (!missingTableWarned) {
        missingTableWarned = true
        console.warn('additional_info: таблица bp_additional_info_requests не создана. Выполните SQL из docs/BPE_DB_MANUAL_SCRIPTS.md (п.11).')
      }
      return { fail: 'Таблица bp_additional_info_requests не создана. Обратитесь к администратору.' }
    }
    throw e
  }

  await dbPool.query(
    `UPDATE bp_process_instances SET status = 'waiting_additional_info', current_node_id = $1 WHERE id = $2`,
    [node.id, instance.id]
  )

  return { waitAdditionalInfo: { nodeId: node.id, nextNodeId: nextEdge.target } }
}

module.exports = { handle }

