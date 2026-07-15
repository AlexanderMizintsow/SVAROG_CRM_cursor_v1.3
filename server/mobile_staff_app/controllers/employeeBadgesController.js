/**
 * Счётчики для бейджей таббара POZ-Staff.
 */

const getBadges = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const [notif, tasks, projects] = await Promise.all([
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
    ])

    return res.json({
      notifications: notif.rows[0]?.count || 0,
      tasks: tasks.rows[0]?.count || 0,
      projects: projects.rows[0]?.count || 0,
    })
  } catch (error) {
    console.error('[mobile_staff_app][badges]', error)
    return res.status(500).json({ message: error.message || 'Ошибка счётчиков' })
  }
}

module.exports = { getBadges }
