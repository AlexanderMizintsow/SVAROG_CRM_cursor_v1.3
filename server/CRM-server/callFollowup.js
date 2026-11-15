// Итог «перезвонить»: напоминание на менеджера, который сохранил звонок, и на компанию номера.

const { getCallParty } = require('../asterisk_server/callParty')
const { scheduleCallTime } = require('./workHours')

const createCallbackReminder = async (pool, { callId, userId, callbackAt, description }) => {
  const call = await pool.query(
    `SELECT id, caller_number, receiver_number, direction, reminder_id
     FROM calls
     WHERE id = $1`,
    [callId]
  )
  if (!call.rows.length) {
    return { status: 404, error: 'Звонок не найден' }
  }

  const row = call.rows[0]
  const phone = row.direction === 'outgoing' ? row.receiver_number : row.caller_number
  const party = await getCallParty(pool, phone)
  if (!party.companyId) {
    return {
      status: 400,
      error: 'Номер не привязан к компании. Сначала привяжите его к дилеру.',
    }
  }

  const requested = new Date(callbackAt)
  if (Number.isNaN(requested.getTime())) {
    return { status: 400, error: 'Некорректное время перезвона' }
  }
  let when = requested
  let adjusted = false
  let workStart = null
  let workEnd = null
  try {
    const scheduled = await scheduleCallTime(pool, userId, requested)
    when = scheduled.date
    adjusted = scheduled.adjusted
    workStart = scheduled.start
    workEnd = scheduled.end
  } catch (error) {
    console.error('Рабочие часы перезвона:', error.message)
  }

  const comment = description || party.companyName || 'Перезвонить'
  if (row.reminder_id) {
    await pool.query(
      `UPDATE reminders
       SET user_id = $1,
           company_id = $2,
           date_time = $3,
           comment = $4,
           type_reminders = 'call',
           title = 'Перезвонить',
           is_completed = false
       WHERE id = $5`,
      [userId, party.companyId, when, comment, row.reminder_id]
    )
    return {
      reminderId: row.reminder_id,
      companyId: party.companyId,
      companyName: party.companyName,
      scheduledAt: when,
      adjusted,
      workStart,
      workEnd,
    }
  }

  const inserted = await pool.query(
    `INSERT INTO reminders (
       related_id, user_id, company_id, date_time, comment,
       type_reminders, title, priority_notifications, tags, links
     )
     VALUES ($1, $2, $3, $4, $5, 'call', 'Перезвонить', 'normal', $6::jsonb, $7::jsonb)
     RETURNING id`,
    [callId, userId, party.companyId, when, comment, '[]', '[]']
  )

  return {
    reminderId: inserted.rows[0].id,
    companyId: party.companyId,
    companyName: party.companyName,
    scheduledAt: when,
    adjusted,
    workStart,
    workEnd,
  }
}

module.exports = { createCallbackReminder }
