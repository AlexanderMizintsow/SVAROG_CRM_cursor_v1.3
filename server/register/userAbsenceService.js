/**
 * Сервис проверки отсутствия сотрудников (отпуск, болезнь и т.д.)
 * и автоматического замещения при назначении в задачи и проекты.
 */

function buildAbsenceActiveSql(dateParamIndex) {
  const p = `$${dateParamIndex}`
  return `(
    (us.start_date IS NOT NULL AND us.start_date <= ${p}::date AND (us.end_date IS NULL OR us.end_date >= ${p}::date))
    OR EXISTS (
      SELECT 1 FROM user_status_dates usd
      WHERE usd.user_status_id = us.id AND usd.specific_date = ${p}::date
    )
  )`
}

function toDateString(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateRu(dateStr) {
  if (!dateStr) return ''
  const parts = String(dateStr).slice(0, 10).split('-')
  if (parts.length !== 3) return String(dateStr)
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function formatUserName(firstName, lastName, middleName) {
  return [lastName, firstName, middleName].filter(Boolean).join(' ').trim()
}

function formatAbsencePeriod(absence) {
  if (!absence) return 'не указан'
  if (absence.start_date && absence.end_date) {
    return `с ${formatDateRu(absence.start_date)} по ${formatDateRu(absence.end_date)}`
  }
  if (Array.isArray(absence.specific_dates) && absence.specific_dates.length > 0) {
    return absence.specific_dates.map(formatDateRu).join(', ')
  }
  return 'не указан'
}

function mapAbsenceRow(row) {
  if (!row) return null
  let specificDates = row.specific_dates
  if (typeof specificDates === 'string') {
    try {
      specificDates = JSON.parse(specificDates)
    } catch {
      specificDates = []
    }
  }
  return {
    id: row.id,
    user_id: row.user_id,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
    substitute_user_id: row.substitute_user_id,
    first_name: row.first_name,
    last_name: row.last_name,
    middle_name: row.middle_name,
    substitute_first_name: row.substitute_first_name,
    substitute_last_name: row.substitute_last_name,
    substitute_middle_name: row.substitute_middle_name,
    department_name: row.department_name || null,
    user_department_id: row.user_department_id != null ? Number(row.user_department_id) : null,
    supervisor_first_name: row.supervisor_first_name || null,
    supervisor_last_name: row.supervisor_last_name || null,
    supervisor_middle_name: row.supervisor_middle_name || null,
    specific_dates: Array.isArray(specificDates) ? specificDates : [],
  }
}

async function getActiveAbsence(dbPool, userId, checkDate = new Date()) {
  const uid = Number(userId)
  if (!Number.isFinite(uid)) return null

  const dateStr = toDateString(checkDate)
  const result = await dbPool.query(
    `SELECT us.id, us.user_id, us.status, us.start_date, us.end_date, us.substitute_user_id,
            u.first_name, u.last_name, u.middle_name,
            su.first_name AS substitute_first_name,
            su.last_name AS substitute_last_name,
            su.middle_name AS substitute_middle_name,
            COALESCE(
              (SELECT json_agg(usd.specific_date ORDER BY usd.specific_date)
               FROM user_status_dates usd WHERE usd.user_status_id = us.id),
              '[]'::json
            ) AS specific_dates
     FROM user_statuses us
     JOIN users u ON u.id = us.user_id
     LEFT JOIN users su ON su.id = us.substitute_user_id
     WHERE us.user_id = $1 AND ${buildAbsenceActiveSql(2)}
     ORDER BY us.created_at DESC
     LIMIT 1`,
    [uid, dateStr]
  )

  return mapAbsenceRow(result.rows[0])
}

async function getAllActiveAbsences(dbPool, checkDate = new Date()) {
  const dateStr = toDateString(checkDate)
  const result = await dbPool.query(
    `SELECT us.id, us.user_id, us.status, us.start_date, us.end_date, us.substitute_user_id,
            u.first_name, u.last_name, u.middle_name,
            u.department_id AS user_department_id,
            d.name AS department_name,
            sup.first_name AS supervisor_first_name,
            sup.last_name AS supervisor_last_name,
            sup.middle_name AS supervisor_middle_name,
            su.first_name AS substitute_first_name,
            su.last_name AS substitute_last_name,
            su.middle_name AS substitute_middle_name,
            COALESCE(
              (SELECT json_agg(usd.specific_date ORDER BY usd.specific_date)
               FROM user_status_dates usd WHERE usd.user_status_id = us.id),
              '[]'::json
            ) AS specific_dates
     FROM user_statuses us
     JOIN users u ON u.id = us.user_id
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN users sup ON sup.id = u.supervisor_id
     LEFT JOIN users su ON su.id = us.substitute_user_id
     WHERE ${buildAbsenceActiveSql(1)}
     ORDER BY d.name NULLS LAST, u.last_name, u.first_name`,
    [dateStr]
  )

  return result.rows.map(mapAbsenceRow).filter(Boolean)
}

/**
 * Определяет, кого фактически назначить вместо userId.
 * @returns {{ originalId, effectiveId, substituted, absence, blocked, blockReason }}
 */
async function resolveAssignee(dbPool, userId, checkDate = new Date()) {
  const originalId = Number(userId)
  if (!Number.isFinite(originalId)) {
    return { originalId: null, effectiveId: null, substituted: false, absence: null, blocked: true, blockReason: 'Некорректный ID пользователя' }
  }

  const absence = await getActiveAbsence(dbPool, originalId, checkDate)
  if (!absence) {
    return { originalId, effectiveId: originalId, substituted: false, absence: null, blocked: false }
  }

  const substituteId = absence.substitute_user_id ? Number(absence.substitute_user_id) : null
  if (!substituteId) {
    return {
      originalId,
      effectiveId: null,
      substituted: false,
      absence,
      blocked: true,
      blockReason: buildBlockedMessage(absence),
    }
  }

  const subAbsence = await getActiveAbsence(dbPool, substituteId, checkDate)
  if (subAbsence) {
    const subName = formatUserName(subAbsence.first_name, subAbsence.last_name, subAbsence.middle_name)
    const origName = formatUserName(absence.first_name, absence.last_name, absence.middle_name)
    return {
      originalId,
      effectiveId: null,
      substituted: false,
      absence,
      blocked: true,
      blockReason: `${origName} — ${absence.status} (${formatAbsencePeriod(absence)}). Замещающий ${subName} тоже отсутствует.`,
    }
  }

  return {
    originalId,
    effectiveId: substituteId,
    substituted: true,
    absence,
    blocked: false,
  }
}

function buildBlockedMessage(absence) {
  const name = formatUserName(absence.first_name, absence.last_name, absence.middle_name)
  return `${name} — ${absence.status} (${formatAbsencePeriod(absence)}). Замещающий не назначен.`
}

function buildSubstitutionMessage(absence, roleLabel) {
  const origName = formatUserName(absence.first_name, absence.last_name, absence.middle_name)
  const subName = formatUserName(
    absence.substitute_first_name,
    absence.substitute_last_name,
    absence.substitute_middle_name
  )
  const period = formatAbsencePeriod(absence)
  const role = roleLabel ? ` (${roleLabel})` : ''
  return `${origName}${role} — ${absence.status} ${period}. Назначен замещающий: ${subName}.`
}

async function notifySubstitution(dbPool, io, options) {
  const {
    notifyUserId,
    message,
    taskId = null,
    globalTaskId = null,
    originalUserId = null,
    effectiveUserId = null,
  } = options

  const uid = Number(notifyUserId)
  if (!Number.isFinite(uid) || !message) return

  await dbPool.query(
    `INSERT INTO notifications (user_id, task_id, message, event_type, is_sent)
     VALUES ($1, $2, $3, 'user_absence_substituted', false)`,
    [uid, taskId || globalTaskId || null, message]
  )

  if (io) {
    io.emit('notification', {
      type: 'user_absence_substituted',
      message,
      taskId: taskId || null,
      globalTaskId: globalTaskId || null,
      userId: uid,
      originalUserId,
      effectiveUserId,
    })
  }
}

/**
 * Разрешает одного пользователя для назначения; при замене уведомляет автора.
 */
async function resolveForAssignment(dbPool, io, userId, options = {}) {
  const {
    notifyUserId = null,
    roleLabel = '',
    taskId = null,
    globalTaskId = null,
    taskTitle = null,
    projectTitle = null,
    checkDate = new Date(),
  } = options

  const resolved = await resolveAssignee(dbPool, userId, checkDate)

  if (resolved.blocked) {
    return { ok: false, resolved, error: resolved.blockReason }
  }

  if (resolved.substituted && notifyUserId && resolved.absence) {
    let context = ''
    if (taskTitle) context = `В задаче «${taskTitle}» `
    else if (projectTitle) context = `В проекте «${projectTitle}» `
    const msg = `${context}${buildSubstitutionMessage(resolved.absence, roleLabel)}`
    await notifySubstitution(dbPool, io, {
      notifyUserId,
      message: msg,
      taskId,
      globalTaskId,
      originalUserId: resolved.originalId,
      effectiveUserId: resolved.effectiveId,
    })
  }

  return { ok: true, resolved, effectiveId: resolved.effectiveId }
}

/**
 * Пакетная проверка доступности исполнителей с учетом отсутствий/замещающих.
 */
async function resolveAssigneesBatch(dbPool, userIds, checkDate = new Date()) {
  const sourceIds = Array.isArray(userIds) ? userIds : [userIds]
  const uniqueIds = [...new Set(sourceIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))]

  const resolved = []
  const blocked = []

  for (const userId of uniqueIds) {
    const result = await resolveAssignee(dbPool, userId, checkDate)
    if (result.blocked) {
      blocked.push({
        userId,
        reason: result.blockReason || 'Назначение недоступно',
      })
      continue
    }
    resolved.push({
      originalId: result.originalId,
      effectiveId: result.effectiveId,
      substituted: result.substituted === true,
    })
  }

  return {
    resolved,
    blocked,
    canAssignAny: resolved.length > 0,
    allBlocked: uniqueIds.length > 0 && blocked.length === uniqueIds.length,
  }
}

module.exports = {
  getActiveAbsence,
  getAllActiveAbsences,
  resolveAssignee,
  resolveAssigneesBatch,
  resolveForAssignment,
  notifySubstitution,
  buildBlockedMessage,
  buildSubstitutionMessage,
  formatAbsencePeriod,
  formatUserName,
  formatDateRu,
}
