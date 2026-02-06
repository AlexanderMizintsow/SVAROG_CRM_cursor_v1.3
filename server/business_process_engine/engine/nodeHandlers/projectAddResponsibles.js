/**
 * Узел «Проект: добавить ответственных».
 */
const { getOutgoingEdges, resolveProjectId } = require('./projectUtils')

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  const projectId = resolveProjectId(context, settings)
  if (!projectId) return { fail: 'Проект: не найден project_id (создайте проект или выберите источник)' }

  const responsibles = Array.isArray(settings.responsibles) ? settings.responsibles : []
  if (responsibles.length === 0) return { fail: 'Проект: не указаны ответственные' }

  const userId = context.initiator_id || instance.launched_by_user_id || null
  try {
    await reg.addGlobalTaskResponsibles(projectId, responsibles, userId)
  } catch (e) {
    return { fail: `Проект: не удалось добавить ответственных: ${e?.message || 'ошибка'}` }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла «Проект: ответственные» нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }

