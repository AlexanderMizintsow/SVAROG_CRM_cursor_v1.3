/**
 * Узел Назначить задачу: взять task_id из context по sourceNodeId, добавить исполнителей через register.
 */
function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

async function resolveUserIds(settings, registerClient) {
  const source = settings.assigneeSource || 'users'
  if (source === 'users' && settings.assigneeUserIds && settings.assigneeUserIds.length) {
    return settings.assigneeUserIds
  }
  if (source === 'department' && settings.departmentId) {
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
  const blockOutputs = context.block_outputs || {}
  const sourceNodeId = settings.sourceNodeId
  if (!sourceNodeId || !blockOutputs[sourceNodeId]) {
    return { fail: 'Не указан блок-источник задачи или задача ещё не создана' }
  }
  const taskId = blockOutputs[sourceNodeId].task_id
  if (!taskId) {
    return { fail: 'Задача из блока-источника не найдена' }
  }

  const userIds = await resolveUserIds(settings, reg)
  for (const uid of userIds) {
    try {
      await reg.addTaskAssignment(taskId, uid)
    } catch (e) {
      console.warn('assignTask addTaskAssignment', taskId, uid, e.message)
    }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) {
    return { fail: 'У узла Назначить задачу нет исходящего ребра' }
  }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }
