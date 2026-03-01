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

function getEdgeMeta(settings, edgeId) {
  const list = settings.edges || []
  return list.find((e) => e.edgeId === edgeId) || null
}

function matchTimeConstraint(timeConstraint, now) {
  if (!timeConstraint || !timeConstraint.type || !timeConstraint.value) return true
  const type = String(timeConstraint.type)
  const val = String(timeConstraint.value).trim()
  if (!val) return true

  if (type === 'time_before' || type === 'time_after') {
    const m = val.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return true
    const h = Number(m[1]) || 0
    const min = Number(m[2]) || 0
    const limitMinutes = h * 60 + min
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    if (type === 'time_before') return nowMinutes < limitMinutes
    return nowMinutes >= limitMinutes
  }
  if (type === 'date_before' || type === 'date_after') {
    const limitDate = new Date(val)
    if (Number.isNaN(limitDate.getTime())) return true
    limitDate.setHours(0, 0, 0, 0)
    const nowDate = new Date(now)
    nowDate.setHours(0, 0, 0, 0)
    if (type === 'date_before') return nowDate < limitDate
    return nowDate >= limitDate
  }
  return true
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

function getAdditionalInfoValue(context, key) {
  const k = key != null ? String(key).trim() : ''
  if (!k) return false
  const map = context && typeof context === 'object' && context.additional_info && typeof context.additional_info === 'object'
    ? context.additional_info
    : {}
  const v = map[k]
  if (v === undefined || v === null) return false
  if (typeof v === 'string') {
    const s = v.trim()
    return s ? s : false
  }
  if (v === false) return false
  return v
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
  const blockOutputs = context.block_outputs || {}
  const decisionOutputs = context.decision_outputs || {}

  const schemeMeta = scheme && typeof scheme === 'object' ? (scheme.meta && typeof scheme.meta === 'object' ? scheme.meta : {}) : {}
  const debugNotifyEnabled = schemeMeta.gatewayDebugNotify === true

  async function maybeSendSystemMessage(payload) {
    if (!debugNotifyEnabled) return
    const initiatorId = context && context.initiator_id != null ? Number(context.initiator_id) : null
    if (!initiatorId) return
    try {
      const title = 'Системное сообщение'
      const message = payload && payload.message ? String(payload.message) : ''
      if (!message.trim()) return
      await dbPool.query(
        `INSERT INTO bp_in_app_notifications (user_id, title, message, process_instance_id, node_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [initiatorId, title, message.trim(), instance.id, node.id]
      )
    } catch (e) {
      console.warn('gateway system-message insert:', e?.message || e)
    }
  }

  // Источник данных для условий: auto (по предыдущему узлу), initiator, task или decision
  const incoming = getIncomingEdge(scheme, node.id)
  const predecessor = incoming ? getNodeById(scheme, incoming.source) : null
  let defaultSourceType = 'task'
  if (predecessor && predecessor.type === 'start') defaultSourceType = 'initiator'
  else if (predecessor && predecessor.type === 'decision') defaultSourceType = 'decision'
  else if (predecessor && (predecessor.type === 'create_project' || String(predecessor.type || '').startsWith('project_'))) defaultSourceType = 'project'
  const sourceType = settings.sourceType && settings.sourceType !== 'auto' ? settings.sourceType : defaultSourceType

  // Источник «Принятие решения» — используем last_decision из context, ожидание не нужно
  if (sourceType === 'decision') {
    const lastDecision = context.last_decision
    if (!lastDecision || !lastDecision.nodeId) {
      return { fail: 'Не получен ответ от блока «Принятие решения» (проверьте, что пользователь нажал кнопку)' }
    }
    // Проверяем условия (decision_button_clicked и др.) — сразу переходим к нужной ветке
    const edges = getOutgoingEdges(scheme, node.id)
    const now = new Date()
    const matchEdgeCondition = async (edge) => {
      const meta = getEdgeMeta(settings, edge.id)
      const cond = meta?.condition ?? getConditionForEdge(settings, edge.id)
      if (cond === 'else') return false
      if (meta && meta.timeConstraint && !matchTimeConstraint(meta.timeConstraint, now)) return false
      if (meta?.conditionMode === 'multiple' && meta.conditions && Array.isArray(meta.conditions.items) && meta.conditions.items.length > 0) {
        const results = await Promise.all(
          meta.conditions.items.filter((item) => item.condition && item.condition !== 'else').map((item) => {
            if (item.condition === 'decision_button_clicked') {
              const buttonId = (item.config || {}).buttonId ? String((item.config || {}).buttonId) : null
              return buttonId && String(lastDecision.buttonId) === buttonId
            }
            return false
          })
        )
        const op = meta.conditions.type === 'and' ? 'and' : 'or'
        return op === 'and' ? results.every(Boolean) : results.some(Boolean)
      }
      if (cond === 'decision_button_clicked') {
        const cfg = meta?.config ?? getConfigForEdge(settings, edge.id)
        const buttonId = cfg && cfg.buttonId ? String(cfg.buttonId) : null
        return buttonId && String(lastDecision.buttonId) === buttonId
      }
      return false
    }
    let chosenEdge = null
    for (const edge of edges) {
      if (await matchEdgeCondition(edge)) {
        chosenEdge = edge
        break
      }
    }
    if (chosenEdge) return { nextNodeId: chosenEdge.target }
    const elseEdge = edges.find((e) => getConditionForEdge(settings, e.id) === 'else')
    if (elseEdge) return { nextNodeId: elseEdge.target }
    if (edges.length === 1) return { nextNodeId: edges[0].target }
    return { fail: 'Не удалось выбрать ветку развилки после «Принятие решения»: задайте условие «Иначе» или «Нажата кнопка ответа»' }
  }

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

  let projectId = null
  let project = null
  let projectStatusRaw = ''
  let projectDeadline = null
  let projectOverdue = false
  let projectPriority = ''
  let projectCompletion = 0
  const projectOutputs = context.project_outputs && typeof context.project_outputs === 'object' ? context.project_outputs : {}
  if (sourceType === 'project') {
    const sourceNodeId = settings.projectSourceNodeId || null
    if (sourceNodeId) {
      const out = projectOutputs[sourceNodeId]
      if (!out || (out.global_task_id == null && out.project_id == null)) {
        return { fail: 'Не указан проект для развилки или проект ещё не создан (проверьте "Блок-источник для проверки условия")' }
      }
      projectId = out.global_task_id != null ? out.global_task_id : out.project_id
    } else if (context.last_global_task_id != null) {
      projectId = context.last_global_task_id
    } else {
      return { fail: 'Не указан проект для развилки или проект ещё не создан (нет last_global_task_id)' }
    }
    try {
      project = await reg.getGlobalTaskById(projectId)
    } catch (e) {
      console.warn('gateway getGlobalTaskById', projectId, e.message)
    }
    projectStatusRaw = (project && project.status) ? String(project.status).trim() : ''
    projectDeadline = project && project.deadline ? new Date(project.deadline) : null
    const nowProj = new Date()
    projectOverdue = projectDeadline ? nowProj > projectDeadline : false
    projectPriority = (project && project.priority) ? String(project.priority).toLowerCase() : ''
    projectCompletion = project && project.completion_percentage != null ? Number(project.completion_percentage) : 0
  }

  // Событийный режим: развилка должна "стоять" и реагировать на события (task-updated),
  const waitMode = settings.waitMode || 'event' // event | default
  const isWebhookResume = instance && (instance.__bpe_resume_reason === 'task_updated' || instance.__bpe_resume_reason === 'project_updated')
  if (sourceType === 'task' && waitMode === 'event' && taskId) {
    // Если мы пришли в развилку обычным прогоном (не по вебхуку) — сразу ставим ожидание.
    if (!isWebhookResume) {
      return { waitGateway: { taskId } }
    }
  }
  if (sourceType === 'project' && waitMode === 'event' && projectId) {
    if (!isWebhookResume) {
      return { waitGatewayProject: { globalTaskId: projectId } }
    }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const now = new Date()
  const deadline = task && task.deadline ? new Date(task.deadline) : null
  const isOverdue = deadline ? now > deadline : false
  const isCompleted = task && task.is_completed === true
  const priority = (task && task.priority) ? String(task.priority).toLowerCase() : ''
  const hasDeadline = !!(task && task.deadline)
  const projectHasDeadline = !!(project && project.deadline)

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
    if (cond === 'initiator_has_position') {
      const positionId = cfg && cfg.positionId != null ? Number(cfg.positionId) : null
      if (!positionId || !context.initiator_id) return false
      const users = await reg.getUsers().catch(() => [])
      const initiator = (users || []).find((u) => Number(u.id) === Number(context.initiator_id))
      return initiator && Number(initiator.position_id) === positionId
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

    // После блока «Принятие решения»: проверяем, что предшественник — Decision и нажата нужная кнопка
    if (cond === 'decision_button_clicked') {
      const buttonId = cfg && cfg.buttonId ? String(cfg.buttonId) : null
      if (!buttonId) return false
      const lastDecision = context.last_decision
      if (!lastDecision || !lastDecision.nodeId) return false
      if (predecessor && predecessor.type !== 'decision') return false
      if (predecessor && lastDecision.nodeId !== predecessor.id) return false
      return String(lastDecision.buttonId) === buttonId
    }

    // Исполнители
    if (cond === 'assignee_contains_user') {
      const userId = cfg && cfg.userId != null ? Number(cfg.userId) : null
      if (!userId || !task) return false
      const assignees = (task && task.assignees) || []
      const ids = assignees.map((a) => (typeof a === 'object' ? Number(a.id) : Number(a))).filter((x) => Number.isFinite(x))
      return ids.includes(userId)
    }

    // Проект (блок «Создать проект» и подблоки): статус, дедлайн, приоритет, прогресс
    const projStatus = (projectStatusRaw || '').toLowerCase()
    if (cond === 'project_status_new' && (projStatus === 'новая' || projectStatusRaw === 'Новая')) return true
    if (cond === 'project_status_in_progress' && (projStatus === 'в работе' || projectStatusRaw === 'В работе')) return true
    if (cond === 'project_status_pause' && (projStatus === 'пауза' || projectStatusRaw === 'Пауза')) return true
    if (cond === 'project_status_completed' && (projStatus === 'завершено' || projectStatusRaw === 'Завершено')) return true
    if (cond === 'project_status_failed' && (projStatus === 'провал' || projectStatusRaw === 'Провал')) return true
    if (cond === 'project_overdue' && projectOverdue) return true
    if (cond === 'project_in_time' && projectHasDeadline && !projectOverdue) return true
    if (cond === 'project_no_deadline' && !projectHasDeadline) return true
    if (cond === 'project_deadline_today' && projectHasDeadline && project && project.deadline && isSameDay(project.deadline, now)) return true
    if (cond === 'project_deadline_tomorrow' && projectHasDeadline && project && project.deadline && isTomorrow(project.deadline, now)) return true
    if (cond === 'project_priority_high' && (projectPriority === 'высокий' || projectPriority === 'high')) return true
    if (cond === 'project_priority_medium' && (projectPriority === 'средний' || projectPriority === 'medium' || projectPriority === 'нормальный' || projectPriority === 'normal')) return true
    if (cond === 'project_priority_low' && (projectPriority === 'низкий' || projectPriority === 'low')) return true
    if (cond === 'project_completion_100' && projectCompletion >= 100) return true
    if (cond === 'project_completion_not_100' && projectCompletion < 100) return true
    if (cond === 'project_completion_above') {
      const threshold = cfg && cfg.percent != null ? Number(cfg.percent) : 90
      return Number.isFinite(threshold) && projectCompletion >= threshold
    }

    // Доп. информация (контекст additional_info): пустое значение трактуем как false
    if (cond === 'ai_var_true') {
      const key = cfg && cfg.key != null ? String(cfg.key) : ''
      const v = getAdditionalInfoValue(context, key)
      return v !== false
    }
    if (cond === 'ai_var_false') {
      const key = cfg && cfg.key != null ? String(cfg.key) : ''
      const v = getAdditionalInfoValue(context, key)
      return v === false
    }
    if (cond === 'ai_var_equals') {
      const key = cfg && cfg.key != null ? String(cfg.key) : ''
      const expectedRaw = cfg && cfg.value != null ? String(cfg.value) : ''
      const expected = expectedRaw.trim()
      const v = getAdditionalInfoValue(context, key)
      if (expected === '') {
        return v === false
      }
      return v !== false && String(v).trim() === expected
    }

    return false
  }

  const matchEdgeCondition = async (edge) => {
    const meta = getEdgeMeta(settings, edge.id)
    const cond = meta?.condition ?? getConditionForEdge(settings, edge.id)
    if (cond === 'else') return false

    if (meta && meta.timeConstraint && !matchTimeConstraint(meta.timeConstraint, now)) return false

    if (meta?.conditionMode === 'multiple' && meta.conditions && Array.isArray(meta.conditions.items) && meta.conditions.items.length > 0) {
      const results = await Promise.all(
        meta.conditions.items.filter((item) => item.condition && item.condition !== 'else').map((item) => matchCondition(item.condition, item.config || {}))
      )
      if (results.length === 0) return false
      const op = meta.conditions.type === 'and' ? 'and' : 'or'
      if (op === 'and') return results.every(Boolean)
      return results.some(Boolean)
    }

    const cfg = meta?.config ?? getConfigForEdge(settings, edge.id)
    return matchCondition(cond, cfg)
  }

  let chosenEdge = null
  for (const edge of edges) {
    const cond = getConditionForEdge(settings, edge.id)
    const meta = getEdgeMeta(settings, edge.id)
    const effectiveCond = meta?.condition ?? cond
    if (effectiveCond === 'else') continue
    if (await matchEdgeCondition(edge)) {
      chosenEdge = edge
      break
    }
  }
  if (chosenEdge) {
    await maybeSendSystemMessage({
      message: [
        `Развилка: «${node?.label || node?.id}»`,
        `Источник: ${sourceType === 'project' ? 'Проект' : sourceType === 'task' ? 'Задача' : sourceType === 'decision' ? 'Принятие решения' : 'Инициатор'}`,
        sourceType === 'task'
          ? `task_id=${taskId}, status=${status || statusRaw || '—'}, overdue=${isOverdue ? 'да' : 'нет'}, completed=${isCompleted ? 'да' : 'нет'}`
          : sourceType === 'project'
            ? `project_id=${projectId}, status=${projectStatusRaw || '—'}, completion=${Number.isFinite(projectCompletion) ? projectCompletion : 0}%, overdue=${projectOverdue ? 'да' : 'нет'}`
            : '',
        `Выбрана ветка → ${chosenEdge.target}`,
        `Условие: ${(() => {
          const meta = getEdgeMeta(settings, chosenEdge.id)
          if (!meta) return getConditionForEdge(settings, chosenEdge.id) || 'else'
          if (meta.conditionMode === 'multiple' && meta.conditions && Array.isArray(meta.conditions.items) && meta.conditions.items.length) {
            const op = meta.conditions.type === 'and' ? 'И' : 'ИЛИ'
            const items = meta.conditions.items
              .filter((x) => x && x.condition && x.condition !== 'else')
              .map((x) => `${x.condition}`)
            return `несколько (${op}): ${items.join(', ')}`
          }
          return meta.condition || getConditionForEdge(settings, chosenEdge.id) || 'else'
        })()}`,
      ]
        .filter(Boolean)
        .join('\n'),
    })
    return { nextNodeId: chosenEdge.target }
  }

  // В событийном режиме (задача/проект): не переходим по «Иначе» и не берём единственную ветку без проверки — продолжаем ожидать, пока условие не выполнится.
  const inEventWaitMode = (sourceType === 'task' || sourceType === 'project') && waitMode === 'event' && (taskId || projectId)
  if (inEventWaitMode) {
    if (sourceType === 'task' && taskId) return { waitGateway: { taskId } }
    if (sourceType === 'project' && projectId) return { waitGatewayProject: { globalTaskId: projectId } }
  }

  // Не в событийном режиме: можно перейти по «Иначе» или по единственной ветке
  const elseEdge = edges.find((e) => getConditionForEdge(settings, e.id) === 'else')
  if (elseEdge) {
    await maybeSendSystemMessage({
      message: [
        `Развилка: «${node?.label || node?.id}»`,
        `Выбрана ветка «Иначе» → ${elseEdge.target}`,
      ].join('\n'),
    })
    return { nextNodeId: elseEdge.target }
  }
  if (edges.length === 1) {
    await maybeSendSystemMessage({
      message: `Развилка: «${node?.label || node?.id}»\nОдна исходящая ветка → ${edges[0].target}`,
    })
    return { nextNodeId: edges[0].target }
  }

  if (sourceType === 'task' && taskId) {
    return { waitGateway: { taskId } }
  }
  if (sourceType === 'project' && projectId) {
    return { waitGatewayProject: { globalTaskId: projectId } }
  }
  return { fail: 'Не удалось выбрать ветку развилки: задайте условие «Иначе» или корректные условия' }
}

module.exports = { handle }
