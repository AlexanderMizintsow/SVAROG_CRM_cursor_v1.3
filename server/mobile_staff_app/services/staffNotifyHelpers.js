/**
 * Хелперы push для POZ-Staff.
 * Подключайте после успешных мутаций в контроллерах (не ломают HTTP при ошибке push).
 */

const { notifyStaffUsers } = require('./staffPushService')

const STATUS_LABELS = {
  backlog: 'Список задач',
  todo: 'К выполнению',
  wait: 'В ожидании',
  doing: 'В процессе',
  done: 'Выполнено',
  pause: 'Пауза',
}

const uniqueUserIds = (ids, excludeUserId) => {
  const exclude = Number(excludeUserId)
  return [
    ...new Set(
      (ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0 && id !== exclude)
    ),
  ]
}

const safeNotify = async (pool, payload) => {
  try {
    return await notifyStaffUsers(pool, payload)
  } catch (error) {
    console.warn('[mobile_staff_app][push]', error.message)
    return { sent: 0 }
  }
}

const getTaskMeta = async (pool, taskId) => {
  const taskRes = await pool.query(
    `SELECT id, title, created_by FROM tasks WHERE id = $1`,
    [taskId]
  )
  if (!taskRes.rows.length) return null
  const task = taskRes.rows[0]

  const [assignees, approvers, viewers] = await Promise.all([
    pool.query(`SELECT user_id FROM task_assignments WHERE task_id = $1`, [taskId]),
    pool.query(`SELECT approver_id AS user_id FROM task_approvals WHERE task_id = $1`, [
      taskId,
    ]),
    pool.query(`SELECT user_id FROM task_visibility WHERE task_id = $1`, [taskId]),
  ])

  const participantIds = [
    task.created_by,
    ...assignees.rows.map((r) => r.user_id),
    ...approvers.rows.map((r) => r.user_id),
    ...viewers.rows.map((r) => r.user_id),
  ]

  return {
    id: task.id,
    title: task.title || 'Задача',
    createdBy: Number(task.created_by),
    assigneeIds: assignees.rows.map((r) => Number(r.user_id)),
    participantIds: uniqueUserIds(participantIds, null),
  }
}

const getProjectMeta = async (pool, projectId) => {
  const projectRes = await pool.query(
    `SELECT id, title, created_by FROM global_tasks WHERE id = $1`,
    [projectId]
  )
  if (!projectRes.rows.length) return null
  const project = projectRes.rows[0]
  const resp = await pool.query(
    `SELECT user_id FROM global_task_responsibles WHERE global_task_id = $1`,
    [projectId]
  )
  const participantIds = [project.created_by, ...resp.rows.map((r) => r.user_id)]
  return {
    id: project.id,
    title: project.title || 'Проект',
    createdBy: Number(project.created_by),
    responsibleIds: resp.rows.map((r) => Number(r.user_id)),
    participantIds: uniqueUserIds(participantIds, null),
  }
}

const notifyTaskParticipants = async (
  pool,
  { taskId, excludeUserId, title, body, type, userIds }
) => {
  let recipients = userIds
  let taskTitle = title
  if (!recipients) {
    const meta = await getTaskMeta(pool, taskId)
    if (!meta) return { sent: 0 }
    recipients = meta.participantIds
    taskTitle = taskTitle || meta.title
  }
  return safeNotify(pool, {
    userIds: uniqueUserIds(recipients, excludeUserId),
    title: title || 'Задача',
    body: body || taskTitle || '',
    data: { type: type || 'task', taskId: Number(taskId) },
  })
}

const notifyProjectParticipants = async (
  pool,
  { projectId, excludeUserId, title, body, type, userIds }
) => {
  let recipients = userIds
  let projectTitle = title
  if (!recipients) {
    const meta = await getProjectMeta(pool, projectId)
    if (!meta) return { sent: 0 }
    recipients = meta.participantIds
    projectTitle = projectTitle || meta.title
  }
  return safeNotify(pool, {
    userIds: uniqueUserIds(recipients, excludeUserId),
    title: title || 'Проект',
    body: body || projectTitle || '',
    data: { type: type || 'project', projectId: Number(projectId) },
  })
}

module.exports = {
  STATUS_LABELS,
  uniqueUserIds,
  safeNotify,
  getTaskMeta,
  getProjectMeta,
  notifyTaskParticipants,
  notifyProjectParticipants,
}
