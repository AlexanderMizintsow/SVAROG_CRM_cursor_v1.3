/**
 * Узел «Подзадача проекта: изменить статус задачи».
 * Работает с обычными tasks (в т.ч. подзадачами проекта).
 */
const { getOutgoingEdges } = require('./projectUtils')

function resolveTaskId(context, settings) {
  const source = settings?.taskSource || 'last' // last | by_node | fixed
  if (source === 'fixed') {
    const id = settings?.fixedTaskId
    return id != null ? (Number(id) || id) : null
  }
  if (source === 'by_node') {
    const nodeId = settings?.taskNodeId
    if (!nodeId) return null
    const outs = context?.block_outputs && typeof context.block_outputs === 'object' ? context.block_outputs : {}
    const v = outs[nodeId]?.task_id
    return v != null ? (Number(v) || v) : null
  }
  const last = context?.last_task_id
  return last != null ? (Number(last) || last) : null
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  if (settings?.taskSource === 'by_node' && settings?.taskNodeId) {
    const outs = context?.block_outputs && typeof context.block_outputs === 'object' ? context.block_outputs : {}
    if (outs[settings.taskNodeId]?.skipped === true) {
      const edges = getOutgoingEdges(scheme, node.id)
      const nextEdge = edges[0]
      if (!nextEdge) return { fail: 'У узла «Подзадача: статус» нет исходящего ребра' }
      return { nextNodeId: nextEdge.target }
    }
  }

  const taskId = resolveTaskId(context, settings)
  if (!taskId) return { fail: 'Подзадача: не найден task_id (создайте задачу выше или выберите источник)' }

  const status = settings.status ? String(settings.status) : ''
  if (!status) return { fail: 'Подзадача: не задан статус' }

  try {
    await reg.updateTaskStatus(taskId, status)
  } catch (e) {
    return { fail: `Подзадача: не удалось обновить статус: ${e?.message || 'ошибка'}` }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла «Подзадача: статус» нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }

