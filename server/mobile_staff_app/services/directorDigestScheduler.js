/**
 * Утренний push-дайджест для директоров / руководителей с подчинёнными.
 * Текст: «N ждут решения · M просрочек по команде · K обращений»
 */

const { notifyStaffUsers } = require('./staffPushService')

const DIGEST_HOUR = Number(process.env.DIRECTOR_DIGEST_HOUR || 8)
const INTERVAL_MS = 20 * 60 * 1000

const ensurePrefsTable = async (pool) => {
  try {
    await pool.query(`SELECT 1 FROM staff_director_digest_prefs LIMIT 1`)
    return true
  } catch (error) {
    if (error.code === '42P01') return false
    throw error
  }
}

const todayYmd = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const computeDigestCounts = async (pool, userId) => {
  const [appealsRes, decisionsRes, extensionsRes, overdueRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS cnt
         FROM staff_manager_requests
        WHERE to_user_id = $1 AND status = 'open'`,
      [userId]
    ).catch(() => ({ rows: [{ cnt: 0 }] })),
    pool.query(
      `SELECT COUNT(*)::int AS cnt
         FROM tasks t
        WHERE t.created_by = $1
          AND t.status = 'done'
          AND COALESCE(t.is_completed, FALSE) = FALSE`,
      [userId]
    ).catch(() => ({ rows: [{ cnt: 0 }] })),
    pool.query(
      `SELECT COUNT(*)::int AS cnt
         FROM task_deadline_extension_requests r
         JOIN tasks t ON t.id = r.task_id
        WHERE t.created_by = $1
          AND r.status = 'pending'`,
      [userId]
    ).catch(() => ({ rows: [{ cnt: 0 }] })),
    pool.query(
      `
      SELECT COUNT(DISTINCT t.id)::int AS cnt
        FROM users subordinate
        JOIN users teammate ON teammate.department_id = subordinate.department_id
        JOIN task_assignments ta ON ta.user_id = teammate.id
        JOIN tasks t ON t.id = ta.task_id
       WHERE subordinate.supervisor_id = $1
         AND subordinate.department_id IS NOT NULL
         AND t.deadline IS NOT NULL
         AND t.deadline < NOW()
         AND t.status IS DISTINCT FROM 'done'
         AND COALESCE(t.is_completed, FALSE) = FALSE
      `,
      [userId]
    ).catch(() => ({ rows: [{ cnt: 0 }] })),
  ])

  const approvalsRes = await pool
    .query(
      `
      SELECT COUNT(DISTINCT t.id)::int AS cnt
        FROM task_approvals ta
        JOIN tasks t ON t.id = ta.task_id
       WHERE ta.approver_id = $1
         AND COALESCE(ta.is_approved, FALSE) = FALSE
         AND COALESCE(t.is_completed, FALSE) = FALSE
      `,
      [userId]
    )
    .catch(() => ({ rows: [{ cnt: 0 }] }))

  const appeals = Number(appealsRes.rows[0]?.cnt) || 0
  const decisions = Number(decisionsRes.rows[0]?.cnt) || 0
  const extensions = Number(extensionsRes.rows[0]?.cnt) || 0
  const approvals = Number(approvalsRes.rows[0]?.cnt) || 0
  const overdue = Number(overdueRes.rows[0]?.cnt) || 0
  const awaiting = approvals + decisions + extensions + appeals

  return { awaiting, overdue, appeals, approvals, decisions, extensions }
}

const buildDigestBody = (counts) => {
  const parts = [
    `${counts.awaiting} ждут решения`,
    `${counts.overdue} просрочек по команде`,
    `${counts.appeals} обращений`,
  ]
  return parts.join(' · ')
}

const listDigestRecipients = async (pool) => {
  const { rows } = await pool.query(
    `
    SELECT DISTINCT u.id AS user_id
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN staff_director_digest_prefs p ON p.user_id = u.id
     WHERE (
            r.name = 'Директор'
            OR EXISTS (SELECT 1 FROM users s WHERE s.supervisor_id = u.id)
          )
       AND COALESCE(p.enabled, TRUE) = TRUE
       AND (p.last_sent_on IS NULL OR p.last_sent_on < CURRENT_DATE)
    `
  )
  return rows.map((r) => Number(r.user_id)).filter((id) => id > 0)
}

const runDirectorDigest = async (pool) => {
  const prefsOk = await ensurePrefsTable(pool)
  if (!prefsOk) {
    return { sent: 0, skipped: true, reason: 'prefs_table_missing' }
  }

  const hour = new Date().getHours()
  if (hour !== DIGEST_HOUR) {
    return { sent: 0, skipped: true, reason: 'wrong_hour', hour }
  }

  const recipients = await listDigestRecipients(pool)
  let sent = 0

  for (const userId of recipients) {
    const counts = await computeDigestCounts(pool, userId)
    if (counts.awaiting === 0 && counts.overdue === 0 && counts.appeals === 0) {
      await pool.query(
        `
        INSERT INTO staff_director_digest_prefs (user_id, enabled, last_sent_on, updated_at)
        VALUES ($1, TRUE, CURRENT_DATE, NOW())
        ON CONFLICT (user_id) DO UPDATE
          SET last_sent_on = CURRENT_DATE, updated_at = NOW()
        `,
        [userId]
      )
      continue
    }

    await notifyStaffUsers(pool, {
      userIds: [userId],
      title: 'Утренний обзор',
      body: buildDigestBody(counts),
      data: { type: 'director_digest' },
    })

    await pool.query(
      `
      INSERT INTO staff_director_digest_prefs (user_id, enabled, last_sent_on, updated_at)
      VALUES ($1, TRUE, CURRENT_DATE, NOW())
      ON CONFLICT (user_id) DO UPDATE
        SET last_sent_on = EXCLUDED.last_sent_on,
            enabled = staff_director_digest_prefs.enabled,
            updated_at = NOW()
      `,
      [userId]
    )
    sent += 1
  }

  return { sent, checked: recipients.length, day: todayYmd() }
}

const startDirectorDigestScheduler = (pool) => {
  const tick = async () => {
    try {
      const result = await runDirectorDigest(pool)
      if (result.sent > 0) {
        console.log(
          `[directorDigest] sent=${result.sent} checked=${result.checked}`
        )
      }
    } catch (error) {
      console.warn('[directorDigest]', error.message)
    }
  }

  setTimeout(tick, 20_000)
  setInterval(tick, INTERVAL_MS)
  console.log(
    `[directorDigest] scheduler started (hour=${DIGEST_HOUR}, every 20 min)`
  )
}

module.exports = {
  computeDigestCounts,
  runDirectorDigest,
  startDirectorDigestScheduler,
  buildDigestBody,
}
