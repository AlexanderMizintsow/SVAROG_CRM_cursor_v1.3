/**
 * Узел «Задача: добавить вложение».
 * Использует /api/tasks/attachment/add с tableType='local'.
 */
const { getOutgoingEdges, resolveTaskId, isTaskSourceSkipped } = require('./taskUtils')

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  if (isTaskSourceSkipped(context, settings)) {
    const edges = getOutgoingEdges(scheme, node.id)
    const nextEdge = edges[0]
    if (!nextEdge) return { fail: 'У узла «Задача: вложение» нет исходящего ребра' }
    return { nextNodeId: nextEdge.target }
  }

  const taskId = resolveTaskId(context, settings)
  if (!taskId) return { fail: 'Задача: не найден task_id (создайте задачу или выберите источник)' }

  const fileUrl = settings.file_url || settings.fileUrl
  const fileType = settings.file_type || settings.fileType
  const nameFile = settings.name_file || settings.nameFile
  const commentFile = settings.comment_file || settings.commentFile || ''
  const uploadedBy = context.initiator_id || instance.launched_by_user_id || null

  if (!fileUrl || !fileType || !nameFile) {
    return { fail: 'Задача: укажите file_url, file_type и name_file' }
  }

  try {
    await reg.addTaskAttachment({
      task_id: taskId,
      file_url: fileUrl,
      file_type: fileType,
      uploaded_by: uploadedBy,
      comment_file: commentFile,
      name_file: nameFile,
      tableType: 'local',
    })
  } catch (e) {
    return { fail: `Задача: не удалось добавить вложение: ${e?.message || 'ошибка'}` }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла «Задача: вложение» нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }
