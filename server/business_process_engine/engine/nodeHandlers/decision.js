/**
 * Узел «Принятие решения»: отправляет уведомление с кнопками, ожидает нажатия от получателя.
 * При нажатии — записывает выбранную кнопку в context и переходит к следующему узлу.
 */
function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

async function resolveRecipientUserIds(settings, context, registerClient) {
  const source = settings.recipientSource || 'users'
  if (source === 'users' && settings.userIds && settings.userIds.length) {
    return settings.userIds
  }
  if (source === 'department' && settings.departmentId) {
    const users = await registerClient.getUsers()
    return (users || []).filter((u) => u.department_id === settings.departmentId).map((u) => u.id)
  }
  if (source === 'role' && settings.roleId) {
    const users = await registerClient.getUsers()
    return (users || []).filter((u) => u.role_id === settings.roleId).map((u) => u.id)
  }
  if (source === 'initiator') {
    return context.initiator_id ? [context.initiator_id] : []
  }
  if (source === 'task_assignee' && settings.taskSourceNodeId && context.block_outputs) {
    const out = context.block_outputs[settings.taskSourceNodeId]
    if (!out || !out.task_id) return []
    const task = await registerClient.getTask(out.task_id)
    const assignees = (task && task.assignees) || []
    return assignees.map((a) => (typeof a === 'object' ? a.id : a))
  }
  return []
}

function substituteText(text, context) {
  if (!text || typeof text !== 'string') return text
  let out = text
  const addInfo = context && typeof context === 'object' && context.additional_info && typeof context.additional_info === 'object'
    ? context.additional_info
    : {}
  out = out.replace(/\{доп:([^}]+)\}/gi, (_, kRaw) => {
    const k = String(kRaw || '').trim()
    if (!k) return ''
    const v = addInfo[k]
    if (v === undefined || v === null) return 'false'
    if (typeof v === 'string') return v.trim() ? v : 'false'
    if (v === false) return 'false'
    return String(v)
  })
  out = out.replace(/\{\{([^}]+)\}\}/g, (_, kRaw) => {
    const k = String(kRaw || '').trim()
    if (!k) return ''
    const v = addInfo[k]
    if (v === undefined || v === null) return ''
    if (typeof v === 'string') return v.trim()
    if (v === false) return ''
    return String(v)
  })
  return out
}

function substituteMessage(text, context, processName) {
  if (!text || typeof text !== 'string') return text
  let out = text
  if (context.initiator_id) {
    out = out.replace(/\{инициатор\}/gi, `Пользователь #${context.initiator_id}`)
  }
  if (processName) {
    out = out.replace(/\{название_процесса\}/gi, processName)
  }
  out = substituteText(out, context)
  return out
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  const defResult = await dbPool.query('SELECT name FROM bp_process_definitions WHERE id = $1', [instance.process_id])
  const processName = defResult.rows[0]?.name || 'Бизнес-процесс'

  const userIds = await resolveRecipientUserIds(settings, context, reg)
  const messageText = substituteMessage(settings.messageText || '', context, processName)
  const buttons = Array.isArray(settings.buttons) ? settings.buttons : [{ id: 'approve', label: 'Принять' }, { id: 'reject', label: 'Отклонить' }]
  if (buttons.length === 0) {
    return { fail: 'В блоке «Принятие решения» задайте хотя бы одну кнопку' }
  }
  if (userIds.length === 0) {
    return { fail: 'В блоке «Принятие решения» не указаны получатели' }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) {
    return { fail: 'У узла «Принятие решения» нет исходящего ребра' }
  }

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

  let missingTableWarned = false
  try {
    for (const uid of userIds) {
      await dbPool.query(
        `INSERT INTO bp_decision_requests (instance_id, node_id, user_id, process_name, message, buttons, initiator_id, initiator_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          instance.id,
          node.id,
          uid,
          processName,
          messageText || '',
          JSON.stringify(buttons),
          initiatorId,
          initiatorName,
        ]
      )
    }
  } catch (e) {
    if (e && e.code === '42P01') {
      if (!missingTableWarned) {
        missingTableWarned = true
        console.warn('decision: таблица bp_decision_requests не создана. Выполните SQL из docs/BPE_DB_MANUAL_SCRIPTS.md (п.10).')
      }
      return { fail: 'Таблица bp_decision_requests не создана. Обратитесь к администратору.' }
    }
    throw e
  }

  await dbPool.query(
    `UPDATE bp_process_instances SET status = 'waiting_decision', current_node_id = $1 WHERE id = $2`,
    [node.id, instance.id]
  )

  return { waitDecision: { nodeId: node.id, nextNodeId: nextEdge.target } }
}

module.exports = { handle }
