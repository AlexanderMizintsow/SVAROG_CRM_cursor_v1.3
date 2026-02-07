/**
 * Узел «Задача: изменить статус».
 */
const { getOutgoingEdges, resolveTaskId } = require('./taskUtils')

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  const taskId = resolveTaskId(context, settings)
  if (!taskId) return { fail: 'Задача: не найден task_id (создайте задачу или выберите источник)' }

  const status = settings.status ? String(settings.status) : ''
  if (!status) return { fail: 'Задача: не задан статус' }

  try {
    await reg.updateTaskStatus(taskId, status)
  } catch (e) {
    return { fail: `Задача: не удалось обновить статус: ${e?.message || 'ошибка'}` }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла «Задача: статус» нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }
