/**
 * Узел «Развилка-Слияние»: несколько входящих (задачи, Принятие решения).
 * Ожидание значений от всех входящих; выбор исходящей ветки по совокупности условий (И/ИЛИ).
 */
const JOIN_CONDITION_ANY = 'any'

function getIncomingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.target === nodeId)
}

function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

function getNodeById(scheme, nodeId) {
  const nodes = scheme.nodes || []
  return nodes.find((n) => n.id === nodeId) || null
}

function normalizeTaskStatus(raw) {
  const s = raw != null ? String(raw) : ''
  if (!s) return ''
  const v = s.toLowerCase()
  if (v === 'pending') return 'wait'
  if (v === 'in_progress') return 'doing'
  if (v === 'completed') return 'done'
  if (v === 'on_hold') return 'pause'
  if (v === 'cancelled') return 'cancelled'
  if (v === 'backlog' || v === 'todo' || v === 'wait' || v === 'doing' || v === 'done' || v === 'pause') return v
  return v
}

function isSameDay(d1, d2) {
  if (!d1 || !d2) return false
  const a = new Date(d1)
  const b = new Date(d2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isTomorrow(d, ref) {
  if (!d || !ref) return false
  const a = new Date(d)
  const r = new Date(ref)
  r.setDate(r.getDate() + 1)
  return isSameDay(a, r)
}

/** Входящие источники — только create_task, assign_task, decision */
function getIncomingSourceNodes(scheme, nodeId) {
  const incoming = getIncomingEdges(scheme, nodeId)
  const seen = new Set()
  const list = []
  for (const e of incoming) {
    const src = getNodeById(scheme, e.source)
    if (src && (src.type === 'create_task' || src.type === 'assign_task' || src.type === 'decision') && !seen.has(src.id)) {
      seen.add(src.id)
      list.push(src)
    }
  }
  return list
}

/** Текущее состояние по входящим: { [sourceNodeId]: { type, status?, buttonId?, task? } } */
async function buildCurrentState(instance, scheme, nodeId, reg, joinSignals) {
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
  const blockOutputs = context.block_outputs || {}
  const decisionOutputs = context.decision_outputs || {}
  const lastDecision = context.last_decision || {}
  const sources = getIncomingSourceNodes(scheme, nodeId)
  const state = {}

  for (const src of sources) {
    if (joinSignals && joinSignals[src.id]) {
      state[src.id] = joinSignals[src.id]
      continue
    }
    if (src.type === 'create_task' || src.type === 'assign_task') {
      const taskId = blockOutputs[src.id]?.task_id || null
      if (!taskId) continue
      try {
        const task = await reg.getTask(taskId)
        const status = normalizeTaskStatus(task && task.status)
        const now = new Date()
        const deadline = task && task.deadline ? new Date(task.deadline) : null
        const isOverdue = deadline ? now > deadline : false
        const isCompleted = task && task.is_completed === true
        const priority = (task && task.priority) ? String(task.priority).toLowerCase() : ''
        const hasDeadline = !!(task && task.deadline)
        const assignees = (task && task.assignees) || []
        const assigneeIds = assignees.map((a) => (typeof a === 'object' ? Number(a.id) : Number(a))).filter((x) => Number.isFinite(x))

        state[src.id] = {
          type: 'task',
          status,
          task,
          deadline,
          now,
          isOverdue,
          isCompleted,
          priority,
          hasDeadline,
          assigneeIds,
        }
      } catch (e) {
        // skip
      }
    } else if (src.type === 'decision') {
      const out = decisionOutputs[src.id] || (lastDecision.nodeId === src.id ? { button_id: lastDecision.buttonId } : null)
      if (out && out.button_id != null) {
        state[src.id] = { type: 'decision', buttonId: String(out.button_id) }
      }
    }
  }
  return state
}

/** Проверка одного условия: requiredValue === 'any' или совпадение по типу */
function matchOneCondition(requiredValue, current) {
  if (!requiredValue || String(requiredValue) === JOIN_CONDITION_ANY) return true
  if (!current) return false
  const r = String(requiredValue)

  if (current.type === 'task') {
    const status = current.status || ''
    const isOverdue = current.isOverdue || false
    const isCompleted = current.isCompleted || false
    const hasDeadline = current.hasDeadline || false
    const priority = current.priority || ''
    const assigneeIds = Array.isArray(current.assigneeIds) ? current.assigneeIds : []
    const task = current.task
    const now = current.now || new Date()

    // Статусы
    if (r.startsWith('status_')) {
      const want = r.replace('status_', '')
      return status === want
    }
    // Одобрение / выполнение
    if (r === 'task_completed' && status === 'done' && isCompleted) return true
    if (r === 'task_not_completed' && status !== 'done') return true
    if (r === 'returned_for_rework' && status === 'todo') return true
    if (r === 'rejected_by_customer' && status === 'done' && !isCompleted) return true
    if (r === 'approval_pending' && status === 'done' && !isCompleted) return true
    if (r === 'done_and_approved' && status === 'done' && isCompleted) return true
    if (r === 'done_not_approved' && status === 'done' && !isCompleted) return true
    // Дедлайн
    if (r === 'task_overdue' && isOverdue) return true
    if (r === 'task_in_time' && hasDeadline && !isOverdue) return true
    if (r === 'task_no_deadline' && !hasDeadline) return true
    if (r === 'deadline_today' && hasDeadline && task && task.deadline && isSameDay(task.deadline, now)) return true
    if (r === 'deadline_tomorrow' && hasDeadline && task && task.deadline && isTomorrow(task.deadline, now)) return true
    if (r === 'overdue_and_doing' && isOverdue && status === 'doing') return true
    if (r === 'overdue_not_done' && isOverdue && status !== 'done') return true
    // Приоритет
    if (r === 'priority_high' && (priority === 'высокий' || priority === 'high')) return true
    if (r === 'priority_medium' && (priority === 'средний' || priority === 'medium' || priority === 'нормальный' || priority === 'normal')) return true
    if (r === 'priority_low' && (priority === 'низкий' || priority === 'low')) return true
    // Исполнители: assignee_contains_user|userId
    if (r.startsWith('assignee_contains_user|')) {
      const userId = Number(r.replace('assignee_contains_user|', ''))
      if (!Number.isFinite(userId)) return false
      return assigneeIds.includes(userId)
    }
    return false
  }

  if (current.type === 'decision') {
    return current.buttonId === r
  }
  return false
}

/** Совокупность условий по ветке: combination = { [sourceId]: value }, operator = 'and' | 'or' */
function matchCombination(combination, currentState, sourceIds, operator) {
  const conditions = sourceIds
    .filter((sid) => combination[sid] && String(combination[sid]) !== JOIN_CONDITION_ANY)
    .map((sid) => matchOneCondition(combination[sid], currentState[sid]))
  if (conditions.length === 0) return true
  if (operator === 'or') return conditions.some(Boolean)
  return conditions.every(Boolean)
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
  const joinSignals = context.join_signals && typeof context.join_signals === 'object' ? context.join_signals : {}

  const sources = getIncomingSourceNodes(scheme, node.id)
  if (sources.length === 0) {
    return { fail: 'К блоку «Развилка-Слияние» не подключены входящие блоки (Создать задачу, Назначить задачу, Принятие решения)' }
  }

  const currentState = await buildCurrentState(instance, scheme, node.id, reg, joinSignals)
  const sourceIds = sources.map((s) => s.id)
  const allReady = sourceIds.every((sid) => currentState[sid] != null)

  if (!allReady) {
    const newJoinSignals = { ...joinSignals, ...currentState }
    const newContext = { ...context, join_signals: newJoinSignals }
    await dbPool.query(
      'UPDATE bp_process_instances SET context = $1, status = $2 WHERE id = $3',
      [JSON.stringify(newContext), 'waiting_join', instance.id]
    )
    try {
      await dbPool.query(
        'INSERT INTO bp_gateway_join_waiting (instance_id, node_id) VALUES ($1, $2) ON CONFLICT (instance_id) DO UPDATE SET node_id = $2',
        [instance.id, node.id]
      )
    } catch (e) {
      if (e && e.code === '42P01') {
        console.warn('gatewayJoin: таблица bp_gateway_join_waiting не создана')
      }
    }
    return { waitJoin: { nodeId: node.id } }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const edgesMeta = Array.isArray(settings.edges) ? settings.edges : []

  for (const edge of edges) {
    const meta = edgesMeta.find((m) => m.edgeId === edge.id) || {}
    const combination = meta.combination && typeof meta.combination === 'object' ? meta.combination : {}
    const operator = meta.operator === 'or' ? 'or' : 'and'
    if (matchCombination(combination, currentState, sourceIds, operator)) {
      try {
        await dbPool.query('DELETE FROM bp_gateway_join_waiting WHERE instance_id = $1', [instance.id])
      } catch (e) {
        if (e?.code !== '42P01') throw e
      }
      return { nextNodeId: edge.target }
    }
  }

  // Ни одно условие не подошло — ожидаем изменения (например, выполнение задачи)
  const newJoinSignals = { ...joinSignals, ...currentState }
  const newContext = { ...context, join_signals: newJoinSignals }
  await dbPool.query(
    'UPDATE bp_process_instances SET context = $1, status = $2 WHERE id = $3',
    [JSON.stringify(newContext), 'waiting_join', instance.id]
  )
  try {
    await dbPool.query(
      'INSERT INTO bp_gateway_join_waiting (instance_id, node_id) VALUES ($1, $2) ON CONFLICT (instance_id) DO UPDATE SET node_id = $2',
      [instance.id, node.id]
    )
  } catch (e) {
    if (e && e.code === '42P01') {
      console.warn('gatewayJoin: таблица bp_gateway_join_waiting не создана')
    }
  }
  return { waitJoin: { nodeId: node.id } }
}

module.exports = { handle }
