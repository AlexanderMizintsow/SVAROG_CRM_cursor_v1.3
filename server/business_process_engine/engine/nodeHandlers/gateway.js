/**
 * Узел Развилка: привязка к задаче из context; если условие по задаче можно вычислить — nextNodeId по ребру condition, иначе waitGateway(taskId).
 */
function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
  const blockOutputs = context.block_outputs || {}
  const sourceNodeId = settings.taskSourceNodeId
  if (!sourceNodeId || !blockOutputs[sourceNodeId]) {
    return { fail: 'Не указана задача для развилки или задача ещё не создана' }
  }
  const taskId = blockOutputs[sourceNodeId].task_id
  if (!taskId) {
    return { fail: 'Задача для развилки не найдена' }
  }

  let task = null
  try {
    task = await reg.getTask(taskId)
  } catch (e) {
    console.warn('gateway getTask', taskId, e.message)
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const now = new Date()
  const deadline = task && task.deadline ? new Date(task.deadline) : null
  const isOverdue = deadline ? now > deadline : false
  const status = (task && task.status) || ''

  let matchedCondition = null
  for (const edge of edges) {
    const cond = edge.condition || 'else'
    if (cond === 'task_completed' && status === 'done') {
      matchedCondition = cond
      break
    }
    if (cond === 'task_not_completed' && status !== 'done') {
      matchedCondition = cond
      break
    }
    if (cond === 'task_overdue' && isOverdue) {
      matchedCondition = cond
      break
    }
    if (cond === 'task_in_time' && !isOverdue && status !== 'done') {
      matchedCondition = cond
      break
    }
    if (cond === 'approval_pending') {
      // упрощённо: если задача не done — считаем ожидание одобрения
      if (status !== 'done') {
        matchedCondition = cond
        break
      }
    }
    if (cond === 'else') {
      matchedCondition = 'else'
    }
  }
  if (matchedCondition && matchedCondition !== 'else') {
    const chosenEdge = edges.find((e) => e.condition === matchedCondition)
    if (chosenEdge) {
      return { nextNodeId: chosenEdge.target }
    }
  }
  const elseEdge = edges.find((e) => e.condition === 'else')
  if (elseEdge) {
    return { nextNodeId: elseEdge.target }
  }
  if (edges.length === 1) {
    return { nextNodeId: edges[0].target }
  }

  return { waitGateway: { taskId } }
}

module.exports = { handle }
