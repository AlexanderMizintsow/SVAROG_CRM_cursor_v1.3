/**
 * Узел Развилка: привязка к задаче из context; условие берётся из node.settings.edges по edge.id.
 * Если условие по задаче можно вычислить — nextNodeId по ребру, иначе waitGateway(taskId).
 */
function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

function getConditionForEdge(settings, edgeId) {
  const list = settings.edges || []
  const found = list.find((e) => e.edgeId === edgeId)
  return found ? (found.condition || 'else') : 'else'
}

function getConfigForEdge(settings, edgeId) {
  const list = settings.edges || []
  const found = list.find((e) => e.edgeId === edgeId)
  return found && typeof found.config === 'object' ? found.config : {}
}

function getIncomingEdge(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.find((e) => e.target === nodeId) || null
}

function getNodeById(scheme, nodeId) {
  const nodes = scheme.nodes || []
  return nodes.find((n) => n.id === nodeId) || null
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

function normalizeTaskStatus(raw) {
  const s = raw != null ? String(raw) : ''
  if (!s) return ''
  const v = s.toLowerCase()
  // алиасы (NotificationList и др.)
  if (v === 'pending') return 'wait'
  if (v === 'in_progress') return 'doing'
  if (v === 'completed') return 'done'
  if (v === 'on_hold') return 'pause'
  if (v === 'cancelled') return 'cancelled'
  // канбан-статусы
  if (v === 'backlog' || v === 'todo' || v === 'wait' || v === 'doing' || v === 'done' || v === 'pause') return v
  return v
}

async function tryPersistGatewayDebug(dbPool, instanceId, context, nodeId, patch) {
  if (!dbPool || !instanceId || !nodeId) return
  try {
    const ctx = context && typeof context === 'object' ? context : {}
    const prevAll = ctx.gateway_debug && typeof ctx.gateway_debug === 'object' ? ctx.gateway_debug : {}
    const prevNode = prevAll[nodeId] && typeof prevAll[nodeId] === 'object' ? prevAll[nodeId] : {}
    const nextAll = { ...prevAll, [nodeId]: { ...prevNode, ...patch } }
    const newCtx = { ...ctx, gateway_debug: nextAll }
    await dbPool.query('UPDATE bp_process_instances SET context = $1 WHERE id = $2', [JSON.stringify(newCtx), instanceId])
  } catch (e) {
    // Debug-данные не должны ломать выполнение процесса
    console.warn('gateway debug persist failed:', e?.code || e?.message)
  }
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
  const blockOutputs = context.block_outputs || {}

  // Источник данных для условий: auto (по предыдущему узлу), initiator или task
  const incoming = getIncomingEdge(scheme, node.id)
  const predecessor = incoming ? getNodeById(scheme, incoming.source) : null
  const defaultSourceType = predecessor && predecessor.type === 'start' ? 'initiator' : 'task'
  const sourceType = settings.sourceType && settings.sourceType !== 'auto' ? settings.sourceType : defaultSourceType

  let taskId = null
  let task = null
  let statusRaw = ''
  let status = ''
  if (sourceType === 'task') {
    const sourceNodeId = settings.taskSourceNodeId || null
    if (sourceNodeId) {
      const out = blockOutputs[sourceNodeId]
      if (!out || !out.task_id) {
        return { fail: 'Не указана задача для развилки или задача ещё не создана (проверьте "Задача для проверки условия")' }
      }
      taskId = out.task_id
    } else if (context.last_task_id) {
      // "Последняя созданная в процессе" — берём last_task_id
      taskId = context.last_task_id
    } else {
      return { fail: 'Не указана задача для развилки или задача ещё не создана (нет last_task_id)' }
    }
    try {
      task = await reg.getTask(taskId)
    } catch (e) {
      console.warn('gateway getTask', taskId, e.message)
    }

    statusRaw = (task && task.status) || ''
    status = normalizeTaskStatus(statusRaw)
    await tryPersistGatewayDebug(dbPool, instance.id, context, node.id, {
      task_id: Number(taskId) || taskId,
      status_raw: statusRaw,
      status_norm: status,
      checked_at: new Date().toISOString(),
      resume_reason: instance && instance.__bpe_resume_reason ? instance.__bpe_resume_reason : null,
    })
  }

  // Событийный режим: развилка должна "стоять" и реагировать на события (task-updated),
  // иначе схема будет сразу пробегать и/или зацикливаться на петлях.
  const waitMode = settings.waitMode || 'event' // event | default
  const isWebhookResume = instance && instance.__bpe_resume_reason === 'task_updated'
  if (sourceType === 'task' && waitMode === 'event' && taskId) {
    // Если мы пришли в развилку обычным прогоном (не по вебхуку) — сразу ставим ожидание.
    if (!isWebhookResume) {
      return { waitGateway: { taskId } }
    }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const now = new Date()
  const deadline = task && task.deadline ? new Date(task.deadline) : null
  const isOverdue = deadline ? now > deadline : false
  const isCompleted = task && task.is_completed === true
  const priority = (task && task.priority) ? String(task.priority).toLowerCase() : ''
  const hasDeadline = !!(task && task.deadline)

  const matchCondition = async (cond, cfg) => {
    if (!cond || cond === 'else') return false
    // Инициатор процесса
    if (cond === 'initiator_is_user') {
      const userId = cfg && cfg.userId != null ? Number(cfg.userId) : null
      if (!userId) return false
      return Number(context.initiator_id) === userId
    }
    if (cond === 'initiator_has_role') {
      const roleId = cfg && cfg.roleId != null ? Number(cfg.roleId) : null
      if (!roleId || !context.initiator_id) return false
      const users = await reg.getUsers().catch(() => [])
      const initiator = (users || []).find((u) => Number(u.id) === Number(context.initiator_id))
      return initiator && Number(initiator.role_id) === roleId
    }
    if (cond === 'initiator_in_department') {
      const departmentId = cfg && cfg.departmentId != null ? Number(cfg.departmentId) : null
      if (!departmentId || !context.initiator_id) return false
      const users = await reg.getUsers().catch(() => [])
      const initiator = (users || []).find((u) => Number(u.id) === Number(context.initiator_id))
      return initiator && Number(initiator.department_id) === departmentId
    }

    // Статус (поддерживаем и старые значения условий)
    if (cond === 'status_backlog' && status === 'backlog') return true
    if (cond === 'status_wait' && status === 'wait') return true
    if (cond === 'status_doing' && status === 'doing') return true
    if (cond === 'status_todo' && status === 'todo') return true
    if (cond === 'status_done' && status === 'done') return true
    if (cond === 'status_pause' && status === 'pause') return true
    if (cond === 'status_cancelled' && status === 'cancelled') return true

    // Backward compatibility: старые статусы/условия из прежних версий
    if (cond === 'status_новая' && (statusRaw === 'новая' || statusRaw === 'new')) return true
    if (cond === 'task_completed' && status === 'done' && isCompleted) return true
    if (cond === 'task_not_completed' && status !== 'done') return true
    if (cond === 'returned_for_rework' && status === 'todo') return true
    if (cond === 'rejected_by_customer' && status === 'done' && !isCompleted) return true
    if (cond === 'approval_pending' && status === 'done' && !isCompleted) return true
    if (cond === 'done_and_approved' && status === 'done' && isCompleted) return true
    if (cond === 'done_not_approved' && status === 'done' && !isCompleted) return true
    // Дедлайн
    if (cond === 'task_overdue' && isOverdue) return true
    if (cond === 'task_in_time' && hasDeadline && !isOverdue) return true
    if (cond === 'task_no_deadline' && !hasDeadline) return true
    if (cond === 'deadline_today' && hasDeadline && isSameDay(task.deadline, now)) return true
    if (cond === 'deadline_tomorrow' && hasDeadline && isTomorrow(task.deadline, now)) return true
    if (cond === 'overdue_and_doing' && isOverdue && status === 'doing') return true
    if (cond === 'overdue_not_done' && isOverdue && status !== 'done') return true
    // Приоритет (низкий/средний/высокий и low/medium/high)
    if (cond === 'priority_high' && (priority === 'высокий' || priority === 'high')) return true
    if (cond === 'priority_medium' && (priority === 'средний' || priority === 'medium' || priority === 'нормальный' || priority === 'normal')) return true
    if (cond === 'priority_low' && (priority === 'низкий' || priority === 'low')) return true

    // Исполнители
    if (cond === 'assignee_contains_user') {
      const userId = cfg && cfg.userId != null ? Number(cfg.userId) : null
      if (!userId || !task) return false
      const assignees = (task && task.assignees) || []
      const ids = assignees.map((a) => (typeof a === 'object' ? Number(a.id) : Number(a))).filter((x) => Number.isFinite(x))
      return ids.includes(userId)
    }

    return false
  }

  let chosenEdge = null
  for (const edge of edges) {
    const cond = getConditionForEdge(settings, edge.id)
    if (cond === 'else') continue
    const cfg = getConfigForEdge(settings, edge.id)
    if (await matchCondition(cond, cfg)) {
      chosenEdge = edge
      break
    }
  }
  if (chosenEdge) {
    return { nextNodeId: chosenEdge.target }
  }
  // В событийном режиме "else" не выполняем автоматически — продолжаем ожидать,
  // пока не появится подходящее условие.
  if (!(sourceType === 'task' && waitMode === 'event' && taskId)) {
    const elseEdge = edges.find((e) => getConditionForEdge(settings, e.id) === 'else')
    if (elseEdge) {
      return { nextNodeId: elseEdge.target }
    }
  }
  if (edges.length === 1) {
    return { nextNodeId: edges[0].target }
  }

  if (sourceType === 'task' && taskId) {
    return { waitGateway: { taskId } }
  }
  return { fail: 'Не удалось выбрать ветку развилки: задайте условие «Иначе» или корректные условия' }
}

module.exports = { handle }
