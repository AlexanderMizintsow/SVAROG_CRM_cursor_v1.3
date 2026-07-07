/**
 * Узел Создать задачу:
 * - prepared: создать задачу сразу в register
 * - modal_at_runtime: поставить экземпляр на waiting_user_input и отдать templateData на клиент
 *
 * Важно: статусы задач нормализуются под статусы канбана SVAROG:
 * backlog / todo / wait / doing / done / pause (+ алиасы pending/in_progress/completed/on_hold/cancelled).
 */
const { resolveProjectId, resolveParentTaskId } = require('./projectUtils')
const {
  computeConditionalDeadline,
  computeStartDayDeadline,
  computeOffsetFromStartDeadline,
  computeOffsetFromNowDeadline,
} = require('./deadlineUtils')

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

function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

function normalizeStatus(raw) {
  const s = raw != null ? String(raw) : ''
  if (!s) return ''
  const v = s.toLowerCase()
  if (v === 'pending') return 'wait'
  if (v === 'in_progress') return 'doing'
  if (v === 'completed') return 'done'
  if (v === 'on_hold') return 'pause'
  if (v === 'cancelled') return 'cancelled'
  return v
}

async function resolveUserIds(settings, context, registerClient) {
  const source = settings.assigneeSource || 'users'
  if (source === 'users' && settings.assigneeUserIds && settings.assigneeUserIds.length) {
    return settings.assigneeUserIds
  }
  if (source === 'department' && settings.departmentId) {
    const deps = await registerClient.getDepartments()
    const dep = (deps || []).find((d) => Number(d.id) === Number(settings.departmentId))
    if (dep && dep.user_ids && dep.user_ids.length) return dep.user_ids
    const users = await registerClient.getUsers()
    return (users || []).filter((u) => Number(u.department_id) === Number(settings.departmentId)).map((u) => u.id)
  }
  if (source === 'role' && settings.roleId) {
    const users = await registerClient.getUsers()
    return (users || []).filter((u) => Number(u.role_id) === Number(settings.roleId)).map((u) => u.id)
  }
  return []
}

async function skipTaskCreation(dbPool, instance, node, scheme, context, reason, blocked = []) {
  const blockOutputs = context.block_outputs || {}
  blockOutputs[node.id] = {
    task_id: null,
    skipped: true,
    skip_code: 'absence_no_substitute',
    skip_reason: reason,
    blocked_assignees: blocked,
  }
  const newContext = { ...context, block_outputs: blockOutputs }
  await dbPool.query('UPDATE bp_process_instances SET context = $1 WHERE id = $2', [
    JSON.stringify(newContext),
    instance.id,
  ])

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла Создать задачу нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context =
    typeof instance.context === 'object'
      ? instance.context
      : instance.context
        ? JSON.parse(instance.context)
        : {}

  let title = substituteText(settings.title || 'Задача из процесса', context)
  let description = substituteText(settings.description || '', context)
  let priority = settings.priority || 'низкий'
  let tags = settings.tags
  let deadlineOffsetDays = settings.deadlineOffsetDays != null ? settings.deadlineOffsetDays : null
  let deadlineOffsetFromNowValue =
    settings.deadlineOffsetFromNowValue != null ? settings.deadlineOffsetFromNowValue : null
  let deadlineOffsetFromNowUnit = settings.deadlineOffsetFromNowUnit || 'hours'

  // Опционально: создать задачу как подзадачу проекта (global_task_id)
  const linkToProject = settings.linkToProject === true
  const projectId = linkToProject
    ? resolveProjectId(context, {
        projectSource: settings.projectSource || 'last',
        projectNodeId: settings.projectNodeId || null,
        fixedProjectId: settings.fixedProjectId || null,
      })
    : null

  // Опционально: создать задачу как подзадачу задачи из схемы (parent_id)
  const linkToParentTask = settings.linkToParentTask === true
  const parentTaskId = linkToParentTask
    ? resolveParentTaskId(context, {
        parentTaskSource: settings.parentTaskSource || 'last',
        parentTaskNodeId: settings.parentTaskNodeId || null,
        fixedParentTaskId: settings.fixedParentTaskId || null,
      })
    : null

  // Если выбран BPE-шаблон — используем его как базу, но поля блока имеют приоритет
  if (settings.templateId) {
    const templateResult = await dbPool.query('SELECT * FROM bp_task_templates WHERE id = $1', [settings.templateId])
    if (templateResult.rows.length) {
      const t = templateResult.rows[0]
      const templateTitle = substituteText(t.name || '', context)
      const templateDesc = substituteText(t.description || '', context)
      if (!title || title === 'Задача из процесса') title = templateTitle || t.name || title
      if (!description) description = templateDesc || t.description || ''
      if (!priority) priority = t.priority_default || 'низкий'
      if (tags == null) tags = t.tags_default
      if (deadlineOffsetDays == null && t.deadline_offset_days != null) deadlineOffsetDays = t.deadline_offset_days
    }
  }

  const createMode = settings.createMode || 'prepared'
  if (createMode === 'modal_at_runtime') {
    if (linkToProject) {
      return { fail: 'Создать задачу: режим «окно при запуске» сейчас не поддерживает подзадачи проекта. Используйте режим «создать сразу».' }
    }
    if (linkToParentTask) {
      return { fail: 'Создать задачу: режим «окно при запуске» сейчас не поддерживает подзадачу задачи из схемы. Используйте режим «создать сразу».' }
    }
    let templateDeadline = null
    if (settings.deadlineMode === 'fixed' && settings.deadline) {
      const deadlineStr = String(settings.deadline).trim()
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(deadlineStr)) templateDeadline = deadlineStr
      else {
        const dt = new Date(settings.deadline)
        if (Number.isFinite(dt.getTime())) templateDeadline = dt.toISOString()
      }
    } else if (settings.deadlineMode === 'conditional') {
      const def = { boundary: '12:00', sameDayTime: '18:00', nextDayTime: '16:00' }
      const raw = settings.conditionalDeadline || {}
      const rule = { boundary: raw.boundary ?? def.boundary, sameDayTime: raw.sameDayTime ?? def.sameDayTime, nextDayTime: raw.nextDayTime ?? def.nextDayTime }
      templateDeadline = computeConditionalDeadline(rule)
    } else if (settings.deadlineMode === 'start_day_time' && settings.deadlineStartDayTime && instance.started_at) {
      templateDeadline = computeStartDayDeadline(instance.started_at, settings.deadlineStartDayTime)
    } else if (settings.deadlineMode === 'offset' && deadlineOffsetDays != null && instance.started_at) {
      templateDeadline = computeOffsetFromStartDeadline(instance.started_at, deadlineOffsetDays, settings.deadlineOffsetTime)
    } else if (settings.deadlineMode === 'offset_from_now' && deadlineOffsetFromNowValue != null && instance.started_at) {
      const valueNum = Number(deadlineOffsetFromNowValue)
      const minutes = deadlineOffsetFromNowUnit === 'hours' ? valueNum * 60 : valueNum
      templateDeadline = computeOffsetFromNowDeadline(instance.started_at, minutes)
    }
    const templateData = {
      title: substituteText(title, context),
      description: substituteText(description, context),
      priority: priority || 'низкий',
      assigneeUserIds: settings.assigneeUserIds || [],
      approverUserIds: settings.approverUserIds || [],
      viewerUserIds: settings.viewerUserIds || [],
      deadlineOffsetDays: deadlineOffsetDays != null ? deadlineOffsetDays : null,
      deadlineMode: settings.deadlineMode || null,
      deadline: templateDeadline || settings.deadline || null,
    }
    const pending = { nodeId: node.id, templateData }
    const newContext = { ...context, pending_task_creation: pending }
    await dbPool.query('UPDATE bp_process_instances SET context = $1, status = $2 WHERE id = $3', [
      JSON.stringify(newContext),
      'waiting_user_input',
      instance.id,
    ])
    return { waitUserInput: true }
  }

  // Автор задачи
  let createdBy = context.initiator_id
  if (settings.authorSource === 'fixed' && settings.authorUserId) {
    createdBy = settings.authorUserId
  }

  // Дедлайн: только если выбран соответствующий режим (при смене режима старые поля не используются)
  // Для «конкретная дата» передаём строку как в модалке «Создать задачу» (YYYY-MM-DDTHH:mm) без toISOString(),
  // чтобы register сохранил то же значение и в карточке задачи отображалось выбранное время
  let deadline = null
  if (settings.deadlineMode === 'fixed' && settings.deadline) {
    const deadlineStr = String(settings.deadline).trim()
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(deadlineStr)) {
      deadline = deadlineStr
    } else {
      const dt = new Date(settings.deadline)
      if (!Number.isFinite(dt.getTime())) {
        return { fail: 'Создать задачу: некорректная дата/время дедлайна в настройках блока' }
      }
      deadline = dt.toISOString()
    }
  } else if (settings.deadlineMode === 'conditional') {
    const def = { boundary: '12:00', sameDayTime: '18:00', nextDayTime: '16:00' }
    const raw = settings.conditionalDeadline || {}
    const rule = {
      boundary: raw.boundary ?? def.boundary,
      sameDayTime: raw.sameDayTime ?? raw.same_day_time ?? def.sameDayTime,
      nextDayTime: raw.nextDayTime ?? raw.next_day_time ?? def.nextDayTime,
    }
    deadline = computeConditionalDeadline(rule)
  } else if (settings.deadlineMode === 'start_day_time' && settings.deadlineStartDayTime && instance.started_at) {
    deadline = computeStartDayDeadline(instance.started_at, settings.deadlineStartDayTime)
  } else if (settings.deadlineMode === 'offset' && deadlineOffsetDays != null && instance.started_at) {
    deadline = computeOffsetFromStartDeadline(instance.started_at, deadlineOffsetDays, settings.deadlineOffsetTime)
  } else if (settings.deadlineMode === 'offset' && deadlineOffsetDays != null) {
    const d = new Date()
    d.setDate(d.getDate() + Number(deadlineOffsetDays))
    deadline = d.toISOString()
  } else if (settings.deadlineMode === 'offset_from_now' && deadlineOffsetFromNowValue != null && instance.started_at) {
    const valueNum = Number(deadlineOffsetFromNowValue)
    const minutes = deadlineOffsetFromNowUnit === 'hours' ? valueNum * 60 : valueNum
    deadline = computeOffsetFromNowDeadline(instance.started_at, minutes)
  } else if (settings.deadlineMode === 'offset_from_now' && deadlineOffsetFromNowValue != null) {
    const valueNum = Number(deadlineOffsetFromNowValue)
    const minutes = deadlineOffsetFromNowUnit === 'hours' ? valueNum * 60 : valueNum
    deadline = computeOffsetFromNowDeadline(new Date(), minutes)
  }

  // Статус
  const allowedStatuses = new Set(['backlog', 'todo', 'wait', 'doing', 'done', 'pause', 'cancelled'])
  const initialStatusRaw = settings.initialStatus != null ? settings.initialStatus : 'backlog'
  const normalized = normalizeStatus(initialStatusRaw) || 'backlog'
  const initialStatus = allowedStatuses.has(normalized) ? normalized : 'backlog'

  // Теги
  const tagsValue = Array.isArray(tags) ? tags : typeof tags === 'string' ? (tags ? JSON.parse(tags) : []) : []

  const payload = {
    title,
    description,
    created_by: createdBy,
    deadline: deadline || undefined,
    priority: priority || 'низкий',
    tags: tagsValue,
    status: initialStatus,
    business_process_instance_id: instance.id,
    ...(linkToProject ? { global_task_id: projectId } : {}),
    ...(linkToParentTask ? { parent_id: parentTaskId } : {}),
  }

  if (linkToProject && !projectId) {
    return { fail: 'Создать задачу: включено «как подзадача проекта», но проект не найден (создайте проект выше или выберите источник)' }
  }
  if (linkToParentTask && !parentTaskId) {
    return { fail: 'Создать задачу: включено «как подзадача задачи из схемы», но родительская задача не найдена (создайте задачу выше или выберите блок)' }
  }
  if (linkToProject && linkToParentTask) {
    return { fail: 'Создать задачу: нельзя одновременно выбрать подзадачу проекта и подзадачу задачи из схемы' }
  }

  // Pre-check для автоматического режима:
  // если исполнители заданы, но все недоступны (отсутствие без замещающего),
  // задачу не создаём и мягко продолжаем процесс.
  const assigneeIds = await resolveUserIds(settings, context, reg)
  let assignmentPlan = []
  if (assigneeIds.length > 0) {
    let assigneeCheck
    try {
      assigneeCheck = await reg.resolveAssignees(assigneeIds)
    } catch (err) {
      return {
        fail: `Создать задачу: не удалось проверить исполнителей перед созданием: ${
          err?.message || 'ошибка'
        }`,
      }
    }

    assignmentPlan = Array.isArray(assigneeCheck?.resolved) ? assigneeCheck.resolved : []

    if (!assigneeCheck?.canAssignAny) {
      const blocked = Array.isArray(assigneeCheck?.blocked) ? assigneeCheck.blocked : []
      const reason =
        blocked.map((b) => b.reason).filter(Boolean).join(' ') ||
        'Все исполнители отсутствуют и не имеют доступного замещающего.'
      return skipTaskCreation(dbPool, instance, node, scheme, context, reason, blocked)
    }
  }

  let task
  try {
    task = await reg.createTask(payload)
  } catch (err) {
    console.error('createTask node register createTask:', err)
    return { fail: `Не удалось создать задачу в register: ${err.message || 'ошибка'}` }
  }

  const taskId = task.id

  for (const item of assignmentPlan) {
    try {
      await reg.addTaskAssignment(taskId, item.effectiveId)
    } catch (e) {
      console.warn('addTaskAssignment', taskId, item.effectiveId, e.message)
    }
  }

  const approverIds = settings.approverUserIds || []
  for (const uid of approverIds) {
    try {
      await reg.addTaskApproval(taskId, uid)
    } catch (e) {
      console.warn('addTaskApproval', taskId, uid, e.message)
    }
  }

  const viewerIds = settings.viewerUserIds || []
  for (const uid of viewerIds) {
    try {
      await reg.addTaskVisibility(taskId, uid)
    } catch (e) {
      console.warn('addTaskVisibility', taskId, uid, e.message)
    }
  }

  try {
    const notifyAssignees = assignmentPlan.map((item) => item.effectiveId)
    await reg.notifyTaskCreated(taskId, createdBy, notifyAssignees, approverIds, viewerIds)
  } catch (e) {
    console.warn('notifyTaskCreated (канбан не обновится без перезагрузки):', e.message)
  }

  await dbPool.query('INSERT INTO bp_task_process_links (task_id, process_instance_id, node_id) VALUES ($1, $2, $3)', [
    taskId,
    instance.id,
    node.id,
  ])

  const blockOutputs = context.block_outputs || {}
  blockOutputs[node.id] = { task_id: taskId }
  const newContext = { ...context, last_task_id: taskId, block_outputs: blockOutputs }
  await dbPool.query('UPDATE bp_process_instances SET context = $1 WHERE id = $2', [JSON.stringify(newContext), instance.id])

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла Создать задачу нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }

