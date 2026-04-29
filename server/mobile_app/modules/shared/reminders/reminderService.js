const createReminder = async (
  pool,
  { relatedId = -1, userId, textCalc, typeReminders, priority = 'high', title, tags = [], links = [] }
) => {
  const result = await pool.query(
    `INSERT INTO reminders
      (related_id, user_id, date_time, comment, type_reminders, priority_notifications, title, links, tags)
     VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7::jsonb, $8::jsonb)
     RETURNING id`,
    [relatedId, userId, textCalc, typeReminders, priority, title, JSON.stringify(links), JSON.stringify(tags)]
  )
  return result.rows[0]
}

module.exports = {
  createReminder,
}
