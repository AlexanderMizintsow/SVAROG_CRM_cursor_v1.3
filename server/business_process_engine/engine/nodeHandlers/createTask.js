/**
 * Узел Создать задачу: вызов register createTask, assignment/add, запись в bp_task_process_links, обновление context.
 */
function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

async function resolveUserIds(settings, context, registerClient) {
  const source = settings.assigneeSource || 'users'
  if (source === 'users' && settings.assigneeUserIds && settings.assigneeUserIds.length) {
    return settings.assigneeUserIds
  }
  if (source === 'department' && settings.departmentId) {
    const deps = await registerClient.getDepartments()
    const dep = (deps || []).find((d) => d.id === settings.departmentId)
    if (dep && dep.user_ids && dep.user_ids.length) return dep.user_ids
    const users = await registerClient.getUsers()
    return (users || []).filter((u) => u.department_id === settings.departmentId).map((u) => u.id)
  }
  if (source === 'role' && settings.roleId) {
    const users = await registerClient.getUsers()
    return (users || []).filter((u) => u.role_id === settings.roleId).map((u) => u.id)
  }
  return []
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  let title = settings.title || 'Задача из процесса'
  let description = settings.description || ''
  let priority = settings.priority || 'низкий'
  let tags = settings.tags
  let deadlineOffsetDays = settings.deadlineOffsetDays != null ? settings.deadlineOffsetDays : null

  if (settings.templateId) {
    const templateResult = await dbPool.query('SELECT * FROM bp_task_templates WHERE id = $1', [settings.templateId])
    if (templateResult.rows.length) {
      const t = templateResult.rows[0]
      if (!title || title === 'Задача из процесса') title = t.name || title
      if (!description) description = t.description || ''
      if (!priority) priority = t.priority_default || 'низкий'
      if (tags == null) tags = t.tags_default
      if (deadlineOffsetDays == null && t.deadline_offset_days != null) deadlineOffsetDays = t.deadline_offset_days
    }
  }

  let createdBy = context.initiator_id
  if (settings.authorSource === 'fixed_user' && settings.authorUserId) {
    createdBy = settings.authorUserId
  }

  let deadline = null
  if (deadlineOffsetDays != null) {
    const d = new Date()
    d.setDate(d.getDate() + Number(deadlineOffsetDays))
    deadline = d.toISOString()
  }

  const tagsValue = Array.isArray(tags) ? tags : (typeof tags === 'string' ? (tags ? JSON.parse(tags) : []) : [])
  const payload = {
    title,
    description,
    created_by: createdBy,
    deadline: deadline || undefined,
    priority: priority || 'низкий',
    tags: tagsValue,
    status: 'новая',
    business_process_instance_id: instance.id,
  }

  let task
  try {
    task = await reg.createTask(payload)
  } catch (err) {
    console.error('createTask node register createTask:', err)
    return { fail: err.message || 'Ошибка создания задачи в register' }
  }

  const taskId = task.id

  const assigneeIds = await resolveUserIds(settings, context, reg)
  for (const uid of assigneeIds) {
    try {
      await reg.addTaskAssignment(taskId, uid)
    } catch (e) {
      console.warn('addTaskAssignment', taskId, uid, e.message)
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

  await dbPool.query(
    'INSERT INTO bp_task_process_links (task_id, process_instance_id, node_id) VALUES ($1, $2, $3)',
    [taskId, instance.id, node.id]
  )

  const blockOutputs = context.block_outputs || {}
  blockOutputs[node.id] = { task_id: taskId }
  const newContext = { ...context, last_task_id: taskId, block_outputs: blockOutputs }

  await dbPool.query(
    'UPDATE bp_process_instances SET context = $1 WHERE id = $2',
    [JSON.stringify(newContext), instance.id]
  )

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) {
    return { fail: 'У узла Создать задачу нет исходящего ребра' }
  }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }
