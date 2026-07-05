/**
 * Информативная сводка открытых ролей сотрудника в задачах и проектах.
 * Только чтение — без изменений в БД.
 */

const ACTIVE_TASK_FILTER = `
  COALESCE(t.is_completed, false) = false
  AND COALESCE(t.status, '') NOT IN ('done', 'cancelled')
`

const ACTIVE_PROJECT_FILTER = `
  gt.status NOT IN ('Завершено', 'Провал', 'Удален')
`

function mapTaskRow(row) {
  return {
    task_id: row.task_id,
    title: row.title,
    deadline: row.deadline || null,
    status: row.status || null,
    project_title: row.project_title || null,
  }
}

function mapProjectRow(row) {
  return {
    project_id: row.project_id,
    title: row.title,
    role: row.role || null,
    deadline: row.deadline || null,
  }
}

async function getWorkloadSummary(dbPool, userId) {
  const uid = Number(userId)
  if (!Number.isFinite(uid)) {
    return null
  }

  const detailLimit = 12

  const [
    executorCount,
    executorDetails,
    taskApprovalCount,
    taskApprovalDetails,
    projectApprovalCount,
    projectApprovalDetails,
    observerCount,
    authorCount,
    projectParticipantCount,
    projectParticipantDetails,
    projectAuthorCount,
  ] = await Promise.all([
    dbPool.query(
      `SELECT COUNT(DISTINCT t.id)::int AS cnt
       FROM tasks t
       JOIN task_assignments ta ON ta.task_id = t.id
       WHERE ta.user_id = $1 AND ${ACTIVE_TASK_FILTER}`,
      [uid]
    ),
    dbPool.query(
      `SELECT t.id AS task_id, t.title, t.deadline, t.status, gt.title AS project_title
       FROM tasks t
       JOIN task_assignments ta ON ta.task_id = t.id
       LEFT JOIN global_tasks gt ON gt.id = t.global_task_id
       WHERE ta.user_id = $1 AND ${ACTIVE_TASK_FILTER}
       ORDER BY t.deadline NULLS LAST, t.created_at DESC
       LIMIT $2`,
      [uid, detailLimit]
    ),
    dbPool.query(
      `SELECT COUNT(DISTINCT t.id)::int AS cnt
       FROM tasks t
       JOIN task_approvals tap ON tap.task_id = t.id
       WHERE tap.approver_id = $1 AND COALESCE(tap.is_approved, false) = false AND ${ACTIVE_TASK_FILTER}`,
      [uid]
    ),
    dbPool.query(
      `SELECT t.id AS task_id, t.title, t.deadline, t.status, gt.title AS project_title
       FROM tasks t
       JOIN task_approvals tap ON tap.task_id = t.id
       LEFT JOIN global_tasks gt ON gt.id = t.global_task_id
       WHERE tap.approver_id = $1 AND COALESCE(tap.is_approved, false) = false AND ${ACTIVE_TASK_FILTER}
       ORDER BY t.deadline NULLS LAST, t.created_at DESC
       LIMIT $2`,
      [uid, detailLimit]
    ),
    dbPool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM global_task_responsibles gtr
       JOIN global_tasks gt ON gt.id = gtr.global_task_id
       WHERE gtr.user_id = $1
         AND gtr.requires_approval = true
         AND (gtr.approval_status IS NULL OR gtr.approval_status NOT IN ('approved', 'rejected'))
         AND ${ACTIVE_PROJECT_FILTER}`,
      [uid]
    ),
    dbPool.query(
      `SELECT gt.id AS project_id, gt.title, gt.deadline, gtr.role
       FROM global_task_responsibles gtr
       JOIN global_tasks gt ON gt.id = gtr.global_task_id
       WHERE gtr.user_id = $1
         AND gtr.requires_approval = true
         AND (gtr.approval_status IS NULL OR gtr.approval_status NOT IN ('approved', 'rejected'))
         AND ${ACTIVE_PROJECT_FILTER}
       ORDER BY gt.deadline NULLS LAST, gt.created_at DESC
       LIMIT $2`,
      [uid, detailLimit]
    ),
    dbPool.query(
      `SELECT COUNT(DISTINCT t.id)::int AS cnt
       FROM tasks t
       JOIN task_visibility tv ON tv.task_id = t.id
       WHERE tv.user_id = $1 AND ${ACTIVE_TASK_FILTER}`,
      [uid]
    ),
    dbPool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM tasks t
       WHERE t.created_by = $1 AND ${ACTIVE_TASK_FILTER}`,
      [uid]
    ),
    dbPool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM global_task_responsibles gtr
       JOIN global_tasks gt ON gt.id = gtr.global_task_id
       WHERE gtr.user_id = $1 AND ${ACTIVE_PROJECT_FILTER}`,
      [uid]
    ),
    dbPool.query(
      `SELECT gt.id AS project_id, gt.title, gt.deadline, gtr.role
       FROM global_task_responsibles gtr
       JOIN global_tasks gt ON gt.id = gtr.global_task_id
       WHERE gtr.user_id = $1 AND ${ACTIVE_PROJECT_FILTER}
       ORDER BY gt.deadline NULLS LAST, gt.created_at DESC
       LIMIT $2`,
      [uid, detailLimit]
    ),
    dbPool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM global_tasks gt
       WHERE gt.created_by = $1 AND ${ACTIVE_PROJECT_FILTER}`,
      [uid]
    ),
  ])

  const summary = {
    critical: {
      executor: executorCount.rows[0]?.cnt || 0,
      task_approval: taskApprovalCount.rows[0]?.cnt || 0,
      project_approval: projectApprovalCount.rows[0]?.cnt || 0,
    },
    informational: {
      observer: observerCount.rows[0]?.cnt || 0,
      author: authorCount.rows[0]?.cnt || 0,
      project_participant: projectParticipantCount.rows[0]?.cnt || 0,
      project_author: projectAuthorCount.rows[0]?.cnt || 0,
    },
  }

  const criticalTotal =
    summary.critical.executor +
    summary.critical.task_approval +
    summary.critical.project_approval

  const informationalTotal =
    summary.informational.observer +
    summary.informational.author +
    summary.informational.project_participant +
    summary.informational.project_author

  return {
    user_id: uid,
    generated_at: new Date().toISOString(),
    summary,
    totals: {
      critical: criticalTotal,
      informational: informationalTotal,
      all: criticalTotal + informationalTotal,
    },
    details: {
      executor: executorDetails.rows.map(mapTaskRow),
      task_approval: taskApprovalDetails.rows.map(mapTaskRow),
      project_approval: projectApprovalDetails.rows.map(mapProjectRow),
      project_participant: projectParticipantDetails.rows.map(mapProjectRow),
    },
  }
}

module.exports = {
  getWorkloadSummary,
}
