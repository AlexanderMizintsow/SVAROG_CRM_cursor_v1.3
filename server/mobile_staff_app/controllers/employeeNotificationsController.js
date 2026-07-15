/**
 * In-app уведомления сотрудника + регистрация push-токена.
 *
 * Список строится из CRM-таблицы `notifications` (те же события, что AlertBanner на вебе).
 * Push: staffPushService.notifyStaffUsers — подключать из контроллеров при новых событиях.
 */

const { registerStaffPushDevice, notifyStaffUsers } = require('../services/staffPushService')

const listUnread = (pool) => async (req, res) => {
  try {
    const userId = req.user.userId
    const result = await pool.query(
      `SELECT
         n.id,
         n.user_id,
         n.task_id,
         n.message,
         n.event_type,
         n.created_at,
         n.is_read,
         t.title AS task_title,
         t.global_task_id AS project_id
       FROM notifications n
       LEFT JOIN tasks t ON n.task_id = t.id
       WHERE n.user_id = $1 AND COALESCE(n.is_read, false) = false
       ORDER BY n.created_at DESC
       LIMIT 200`,
      [userId]
    )
    return res.json({ notifications: result.rows || [] })
  } catch (error) {
    console.error('[mobile_staff_app][notifications][list]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки уведомлений' })
  }
}

const markRead = (pool) => async (req, res) => {
  try {
    const userId = req.user.userId
    const notificationId = Number(req.params.notificationId)
    if (!notificationId) {
      return res.status(400).json({ message: 'notificationId обязателен' })
    }
    const result = await pool.query(
      `UPDATE notifications
          SET is_read = TRUE
        WHERE id = $1 AND user_id = $2
        RETURNING id`,
      [notificationId, userId]
    )
    if (!result.rows.length) {
      return res.status(404).json({ message: 'Уведомление не найдено' })
    }
    return res.json({ ok: true })
  } catch (error) {
    console.error('[mobile_staff_app][notifications][read]', error)
    return res
      .status(500)
      .json({ message: error.message || 'Ошибка отметки прочтения' })
  }
}

const markAllRead = (pool) => async (req, res) => {
  try {
    const userId = req.user.userId
    const result = await pool.query(
      `UPDATE notifications
          SET is_read = TRUE
        WHERE user_id = $1 AND COALESCE(is_read, false) = false`,
      [userId]
    )
    return res.json({ ok: true, updated: result.rowCount || 0 })
  } catch (error) {
    console.error('[mobile_staff_app][notifications][read-all]', error)
    return res.status(500).json({ message: 'Ошибка очистки уведомлений' })
  }
}

const registerPush = (pool) => async (req, res) => {
  try {
    const userId = req.user.userId
    const token = String(req.body.pushToken || '').trim()
    if (!token) return res.status(400).json({ message: 'pushToken обязателен' })

    await registerStaffPushDevice(pool, {
      userId,
      token,
      platform: String(req.body.platform || 'android').trim(),
      appVersion: String(req.body.appVersion || '').trim(),
    })
    return res.json({ success: true })
  } catch (error) {
    console.error('[mobile_staff_app][notifications][push-register]', error)
    return res
      .status(500)
      .json({ message: error.message || 'Ошибка регистрации push' })
  }
}

/**
 * Внутренний helper для будущих контроллеров BFF (не HTTP-route).
 * Пример после создания задачи адресату:
 *   await notifyFromEvent(pool, {
 *     userIds: [assigneeId],
 *     title: 'Новая задача',
 *     body: title,
 *     data: { type: 'task_created', taskId },
 *   })
 */
const notifyFromEvent = (pool, args) => notifyStaffUsers(pool, args)

module.exports = {
  listUnread,
  markRead,
  markAllRead,
  registerPush,
  notifyFromEvent,
  // re-export для удобства require из других контроллеров staff_app:
  notifyStaffUsers,
}
