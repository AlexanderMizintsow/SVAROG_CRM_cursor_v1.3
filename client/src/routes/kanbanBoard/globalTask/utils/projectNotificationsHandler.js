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
  const deadline = payload?.deadline ?? null

  if (!id) return

  const store = useTaskStateTracker.getState()
  const isAuthor = authorId != null && currentUserId != null && Number(authorId) === Number(currentUserId)

  switch (reason) {
    case 'created':
      // Создателю проекта не показываем — он и так в курсе, что создал
      if (title && !isAuthor) store.addProjectNotification(id, title, 'created')
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
    case 'final_solution_deleted': {
      const isEmailReply = payload?.isEmailReply === true
      const isUnpublishedEmailChange = payload?.isUnpublishedEmailChange === true
      const senderUserIds = Array.isArray(payload?.senderUserIds) ? payload.senderUserIds : []
      const isSender = currentUserId != null && senderUserIds.some((uid) => Number(uid) === Number(currentUserId))
      const openedId = store.openedProjectCardId != null ? Number(store.openedProjectCardId) : null
      const cardIsOpenWithThisProject = openedId === id

      if (isUnpublishedEmailChange) {
        break
      }
      if (isEmailReply && isSender && !cardIsOpenWithThisProject) {
        if (title) store.addProjectNotification(id, title, 'project_email_message')
      } else if (!isEmailReply && title) {
        const performedBy = payload?.performedByUserId != null ? Number(payload.performedByUserId) : null
        const isActor = performedBy != null && currentUserId != null && Number(performedBy) === Number(currentUserId)
        if (!isActor) {
          store.addProjectNotification(id, title, reason)
          store.setProjectBlinkYellow(id)
        }
      }
      break
    }
    case 'responsiblesAdded':
    case 'responsibleRemoved':
    case 'approval':
    case 'goals':
    case 'goal_checks':
    case 'additionalInfo':
    case 'attachment':
      store.setProjectBlinkYellow(id)
      break
    case 'rework': {
      const assigneeId =
        payload?.assigneeUserId != null ? Number(payload.assigneeUserId) : null
      store.setProjectBlinkYellow(id)
      if (
        title &&
        assigneeId != null &&
        currentUserId != null &&
        Number(currentUserId) === assigneeId
      ) {
        store.addProjectNotification(id, title, 'rework')
      }
      break
    }
    case 'rework_completed':
      store.setProjectBlinkYellow(id)
      break
    case 'subtask_added':
      if (title) store.addProjectNotification(id, title, 'subtask_added')
      break
    case 'deadline_set':
      // Участникам (кроме автора) — автор не получает, он сам установил
      if (title && !isAuthor) store.addProjectNotification(id, title, 'deadline_set', { deadline })
      break
    case 'subtask_status_done':
      store.setProjectBlinkYellow(id)
      break
    default:
      break
  }
}
