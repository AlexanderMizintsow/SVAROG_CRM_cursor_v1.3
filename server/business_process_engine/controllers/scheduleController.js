/**
 * Расписание автоматического запуска процессов: GET/PUT для процесса.
 */
const { getNextRuns } = require('../utils/scheduleRunner')

async function getSchedule(dbPool, req, res) {
  try {
    const processId = req.params.id
    const result = await dbPool.query(
      'SELECT id, process_id, enabled, schedule_type, time_hour, time_minute, config, launched_by_user_id, last_triggered_at, updated_at FROM bp_process_schedules WHERE process_id = $1',
      [processId]
    )
    if (result.rows.length === 0) {
      return res.json(null)
    }
    const row = result.rows[0]
    const config = typeof row.config === 'object' ? row.config : (row.config ? JSON.parse(row.config) : {})
    const schedulePayload = {
      id: row.id,
      process_id: row.process_id,
      enabled: row.enabled,
      schedule_type: row.schedule_type,
      time_hour: row.time_hour,
      time_minute: row.time_minute,
      time: `${String(row.time_hour).padStart(2, '0')}:${String(row.time_minute).padStart(2, '0')}`,
      config,
      launched_by_user_id: row.launched_by_user_id,
      last_triggered_at: row.last_triggered_at,
      updated_at: row.updated_at,
    }
    if (row.enabled) {
      schedulePayload.next_runs = getNextRuns(
        { schedule_type: row.schedule_type, time_hour: row.time_hour, time_minute: row.time_minute, config },
        new Date(),
        10
      )
    }
    res.json(schedulePayload)
  } catch (err) {
    console.error('getSchedule:', err)
    res.status(500).json({ error: 'Ошибка при получении расписания' })
  }
}

async function putSchedule(dbPool, req, res) {
  try {
    const processId = req.params.id
    const {
      enabled,
      schedule_type,
      time,
      time_hour,
      time_minute,
      config,
      launched_by_user_id,
    } = req.body

    const defResult = await dbPool.query(
      'SELECT id FROM bp_process_definitions WHERE id = $1 AND is_draft = false',
      [processId]
    )
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Процесс не найден или не опубликован' })
    }

    let hour, minute
    if (time != null && /^\d{1,2}:\d{2}$/.test(String(time).trim())) {
      const [h, m] = String(time).trim().split(':').map(Number)
      hour = h
      minute = m
    } else if (Number.isInteger(time_hour) && Number.isInteger(time_minute)) {
      hour = time_hour
      minute = time_minute
    } else {
      return res.status(400).json({ error: 'Укажите время (time в формате HH:mm или time_hour и time_minute)' })
    }
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return res.status(400).json({ error: 'Некорректное время' })
    }

    const scheduleType = schedule_type === 'dates' || schedule_type === 'weekdays' || schedule_type === 'interval'
      ? schedule_type
      : 'weekdays'
    const configObj = config && typeof config === 'object' ? config : {}

    const existing = await dbPool.query('SELECT id FROM bp_process_schedules WHERE process_id = $1', [processId])
    if (existing.rows.length > 0) {
      await dbPool.query(
        `UPDATE bp_process_schedules SET
          enabled = COALESCE($2, enabled),
          schedule_type = $3,
          time_hour = $4,
          time_minute = $5,
          config = $6,
          launched_by_user_id = $7,
          updated_at = NOW()
        WHERE process_id = $1`,
        [processId, enabled !== false, scheduleType, hour, minute, JSON.stringify(configObj), launched_by_user_id ?? null]
      )
    } else {
      await dbPool.query(
        `INSERT INTO bp_process_schedules (process_id, enabled, schedule_type, time_hour, time_minute, config, launched_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [processId, enabled !== false, scheduleType, hour, minute, JSON.stringify(configObj), launched_by_user_id ?? null]
      )
    }

    const updated = await dbPool.query(
      'SELECT id, process_id, enabled, schedule_type, time_hour, time_minute, config, launched_by_user_id, last_triggered_at, updated_at FROM bp_process_schedules WHERE process_id = $1',
      [processId]
    )
    const row = updated.rows[0]
    const outConfig = typeof row.config === 'object' ? row.config : (row.config ? JSON.parse(row.config) : {})
    const payload = {
      id: row.id,
      process_id: row.process_id,
      enabled: row.enabled,
      schedule_type: row.schedule_type,
      time_hour: row.time_hour,
      time_minute: row.time_minute,
      time: `${String(row.time_hour).padStart(2, '0')}:${String(row.time_minute).padStart(2, '0')}`,
      config: outConfig,
      launched_by_user_id: row.launched_by_user_id,
      last_triggered_at: row.last_triggered_at,
      updated_at: row.updated_at,
    }
    if (row.enabled) {
      payload.next_runs = getNextRuns(
        { schedule_type: row.schedule_type, time_hour: row.time_hour, time_minute: row.time_minute, config: outConfig },
        new Date(),
        10
      )
    }
    res.json(payload)
  } catch (err) {
    console.error('putSchedule:', err)
    res.status(500).json({ error: 'Ошибка при сохранении расписания' })
  }
}

module.exports = { getSchedule, putSchedule }
