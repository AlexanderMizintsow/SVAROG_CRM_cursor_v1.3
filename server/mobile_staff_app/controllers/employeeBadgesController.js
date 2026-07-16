/**
 * Счётчики для бейджей таббара POZ-Staff.
 */

const {
  buildSegmentsByType,
  isVisibleForEmployee,
  getEmployeeProfile,
} = require('../services/staffNews/staffNewsService')

const countUnreadNews = async (pool, userId) => {
  try {
    const profile = await getEmployeeProfile(pool, userId)
    if (!profile) return 0
    const rows = await pool.query(
      `SELECT n.id
         FROM staff_news n
        WHERE n.status = 'published'
          AND (n.unpublish_at IS NULL OR n.unpublish_at > NOW())
          AND NOT EXISTS (
            SELECT 1 FROM staff_news_reads r
             WHERE r.news_id = n.id AND r.user_id = $1
          )
        ORDER BY n.id DESC
        LIMIT 100`,
      [userId]
    )
    let count = 0
    for (const row of rows.rows) {
      const segmentsRes = await pool.query(
        `SELECT segment_type, segment_value FROM staff_news_segments WHERE news_id = $1`,
        [row.id]
      )
      const segmentsByType = buildSegmentsByType(segmentsRes.rows)
      if (
        !segmentsRes.rows.length ||
        isVisibleForEmployee({
          segmentsByType,
          userId,
          departmentId: profile.department_id,
          roleName: profile.role_name,
        })
      ) {
        count += 1
      }
    }
    return count
  } catch (error) {
    if (/staff_news/i.test(error.message || '')) return 0
    throw error
  }
}

const getBadges = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const [notif, tasks, projects, news] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS count
           FROM notifications
          WHERE user_id = $1 AND COALESCE(is_read, false) = false`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT t.id)::int AS count
           FROM tasks t
           JOIN task_assignments ta ON ta.task_id = t.id
          WHERE ta.user_id = $1
            AND COALESCE(t.is_completed, false) = false
            AND COALESCE(t.status, '') NOT IN ('cancelled')`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT gt.id)::int AS count
           FROM global_tasks gt
           LEFT JOIN global_task_responsibles gtr
             ON gtr.global_task_id = gt.id
          WHERE (gt.created_by = $1 OR gtr.user_id = $1)
            AND COALESCE(gt.status, '') NOT IN ('Завершено', 'Провал', 'Удален')`,
        [userId]
      ),
      countUnreadNews(pool, userId),
    ])

    return res.json({
      notifications: notif.rows[0]?.count || 0,
      tasks: tasks.rows[0]?.count || 0,
      projects: projects.rows[0]?.count || 0,
      news: news || 0,
    })
  } catch (error) {
    console.error('[mobile_staff_app][badges]', error)
    return res.status(500).json({ message: error.message || 'Ошибка счётчиков' })
  }
}

module.exports = { getBadges }
