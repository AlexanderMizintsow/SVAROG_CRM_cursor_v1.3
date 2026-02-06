/**
 * Узел «Проект: добавить вложение».
 * Использует общий эндпоинт /api/tasks/attachment/add с tableType='global'.
 */
const { getOutgoingEdges, resolveProjectId } = require('./projectUtils')

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  const projectId = resolveProjectId(context, settings)
  if (!projectId) return { fail: 'Проект: не найден project_id (создайте проект или выберите источник)' }

  const fileUrl = settings.file_url || settings.fileUrl
  const fileType = settings.file_type || settings.fileType
  const nameFile = settings.name_file || settings.nameFile
  const commentFile = settings.comment_file || settings.commentFile || ''
  const uploadedBy = context.initiator_id || instance.launched_by_user_id || null

  if (!fileUrl || !fileType || !nameFile) {
    return { fail: 'Проект: укажите file_url, file_type и name_file' }
  }

  try {
    await reg.addTaskAttachment({
      task_id: projectId,
      file_url: fileUrl,
      file_type: fileType,
      uploaded_by: uploadedBy,
      comment_file: commentFile,
      name_file: nameFile,
      tableType: 'global',
    })
  } catch (e) {
    return { fail: `Проект: не удалось добавить вложение: ${e?.message || 'ошибка'}` }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла «Проект: вложение» нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }

