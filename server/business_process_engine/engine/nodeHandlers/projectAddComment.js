/**
 * Узел «Проект: добавить комментарий».
 */
const { getOutgoingEdges, resolveProjectId } = require('./projectUtils')

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
  return out
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  const projectId = resolveProjectId(context, settings)
  if (!projectId) return { fail: 'Проект: не найден project_id (создайте проект или выберите источник)' }

  const userId = context.initiator_id || instance.launched_by_user_id || null
  const comment = substituteText(settings.comment || '', context)
  if (!comment) return { fail: 'Проект: комментарий пустой' }

  try {
    await reg.addGlobalTaskComment(projectId, userId, comment)
  } catch (e) {
    return { fail: `Проект: не удалось добавить комментарий: ${e?.message || 'ошибка'}` }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла «Проект: комментарий» нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }

