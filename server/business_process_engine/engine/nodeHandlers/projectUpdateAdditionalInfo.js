/**
 * Узел «Проект: обновить доп. информацию».
 * Важно: register ожидает { additionalInfo } объект.
 */
const { getOutgoingEdges, resolveProjectId } = require('./projectUtils')

function normalizeAdditionalInfo(items) {
  const list = Array.isArray(items) ? items : []
  const out = {}
  for (const it of list) {
    const k = String(it?.key || '').trim()
    if (!k) continue
    const vRaw = it?.value
    const v = vRaw == null ? '' : String(vRaw)
    out[k] = v
  }
  return out
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  const projectId = resolveProjectId(context, settings)
  if (!projectId) return { fail: 'Проект: не найден project_id (создайте проект или выберите источник)' }

  const additionalInfo = normalizeAdditionalInfo(settings.additionalInfo)
  const userId = context.initiator_id || instance.launched_by_user_id || null
  try {
    await reg.updateGlobalTaskAdditionalInfo(projectId, additionalInfo, userId)
  } catch (e) {
    return { fail: `Проект: не удалось обновить доп. информацию: ${e?.message || 'ошибка'}` }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла «Проект: доп.инфо» нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }

