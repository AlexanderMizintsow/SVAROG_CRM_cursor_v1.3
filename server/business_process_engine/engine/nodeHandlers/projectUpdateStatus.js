/**
 * Узел «Проект: изменить статус».
 */
const { getOutgoingEdges, resolveProjectId } = require('./projectUtils')

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  const projectId = resolveProjectId(context, settings)
  if (!projectId) return { fail: 'Проект: не найден project_id (создайте проект или выберите источник)' }

  const status = settings.status ? String(settings.status) : ''
  if (!status) return { fail: 'Проект: не задан статус' }

  const userId = context.initiator_id || instance.launched_by_user_id || null
  try {
    await reg.updateGlobalTaskStatus(projectId, status, userId)
  } catch (e) {
    return { fail: `Проект: не удалось обновить статус: ${e?.message || 'ошибка'}` }
  }

  // полезно для условий/уведомлений внутри БП
  const addInfo = context.additional_info && typeof context.additional_info === 'object' ? context.additional_info : {}
  const newContext = { ...context, additional_info: { ...addInfo, project_id: projectId, project_status: status } }
  await dbPool.query('UPDATE bp_process_instances SET context = $1 WHERE id = $2', [JSON.stringify(newContext), instance.id])

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла «Проект: изменить статус» нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }

