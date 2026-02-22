import useTaskStateTracker from '../../../../store/useTaskStateTracker'

/**
 * Обработка события globalTaskChanged: обновляет стор уведомлений и миганий.
 * Вызывать из сокет-обработчика (GlobalTasksContainer, MiniProjectStrip).
 * @param {Object} payload - { globalTaskId, reason, title, authorId }
 * @param {number} currentUserId - id текущего пользователя
 */
export function handleGlobalTaskChangedPayload(payload, currentUserId) {
  const id = payload?.globalTaskId != null ? Number(payload.globalTaskId) : null
  const reason = payload?.reason || 'changed'
  const title = payload?.title || null
  const authorId = payload?.authorId != null ? Number(payload.authorId) : null

  if (!id) return

  const store = useTaskStateTracker.getState()
  const isAuthor = authorId != null && currentUserId != null && Number(authorId) === Number(currentUserId)

  switch (reason) {
    case 'created':
      if (title) store.addProjectNotification(id, title, 'created')
      break
    case 'participant_added':
      if (title) store.addProjectNotification(id, title, 'participant_added')
      break
    case 'participant_removed':
      if (title) store.addProjectNotification(id, title, 'participant_removed')
      break
    case 'status':
    case 'deleted':
      if (title) store.addProjectNotification(id, title, reason === 'deleted' ? 'deleted' : 'status')
      break
    case 'progress_100':
      store.setProjectBlinkGreen(id)
      if (title && isAuthor) store.addProjectNotification(id, title, 'progress_100')
      break
    case 'final_solution_added':
    case 'final_solution_updated':
    case 'final_solution_deleted':
      if (title && isAuthor) store.addProjectNotification(id, title, reason)
      else store.setProjectBlinkYellow(id)
      break
    case 'responsiblesAdded':
    case 'responsibleRemoved':
    case 'approval':
    case 'goals':
    case 'additionalInfo':
    case 'attachment':
      store.setProjectBlinkYellow(id)
      break
    case 'subtask_added':
      if (title) store.addProjectNotification(id, title, 'subtask_added')
      break
    default:
      break
  }
}
