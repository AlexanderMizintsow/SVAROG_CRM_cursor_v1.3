/**
 * Узел «Проект: обновить цели».
 */
const { getOutgoingEdges, resolveProjectId } = require('./projectUtils')

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  const projectId = resolveProjectId(context, settings)
  if (!projectId) return { fail: 'Проект: не найден project_id (создайте проект или выберите источник)' }

  const goals = Array.isArray(settings.goals) ? settings.goals.map((x) => String(x || '')).filter((x) => x.trim()) : []
  const userId = context.initiator_id || instance.launched_by_user_id || null
  try {
    await reg.updateGlobalTaskGoals(projectId, goals, userId)
  } catch (e) {
    return { fail: `Проект: не удалось обновить цели: ${e?.message || 'ошибка'}` }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла «Проект: цели» нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }

