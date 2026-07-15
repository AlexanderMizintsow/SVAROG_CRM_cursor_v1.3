/**
 * Напоминания о встрече РГ за ~3 часа.
 * Независимо от Telegram (свой флаг staff_notification_sent).
 */

const {
  notifyWorkGroupUsers,
  getGroupParticipantIds,
} = require('./workGroupNotifyService')

const INTERVAL_MS = 30 * 60 * 1000

const runWorkGroupReminders = async (pool) => {
  const now = new Date()
  const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000)

  let groupsResult
  try {
    groupsResult = await pool.query(
      `SELECT id
         FROM work_groups
        WHERE selected_date IS NOT NULL
          AND selected_date > $1
          AND selected_date <= $2
          AND create_type IN ('fixed')
          AND COALESCE(staff_notification_sent, FALSE) = FALSE`,
      [now.toISOString(), threeHoursLater.toISOString()]
    )
  } catch (error) {
    if (/staff_notification_sent/i.test(error.message || '')) {
      // колонки ещё нет — пропускаем до миграции
      return { checked: 0, sent: 0, skipped: true }
    }
    throw error
  }

  let sent = 0
  for (const row of groupsResult.rows) {
    const { group, userIds } = await getGroupParticipantIds(pool, row.id)
    if (!group || !userIds.length) continue

    await notifyWorkGroupUsers(pool, {
      userIds,
      group,
      createType: 'reminder',
    })

    await pool.query(
      `UPDATE work_groups SET staff_notification_sent = TRUE WHERE id = $1`,
      [row.id]
    )
    sent += 1
  }

  return { checked: groupsResult.rows.length, sent }
}

const startWorkGroupReminderScheduler = (pool) => {
  const tick = async () => {
    try {
      const result = await runWorkGroupReminders(pool)
      if (result.sent > 0) {
        console.log(
          `[workGroupReminders] sent=${result.sent} checked=${result.checked}`
        )
      }
    } catch (error) {
      console.warn('[workGroupReminders]', error.message)
    }
  }

  // небольшой delay после старта, затем каждые 30 мин
  setTimeout(tick, 15_000)
  setInterval(tick, INTERVAL_MS)
  console.log('[workGroupReminders] scheduler started (every 30 min)')
}

module.exports = {
  runWorkGroupReminders,
  startWorkGroupReminderScheduler,
}
