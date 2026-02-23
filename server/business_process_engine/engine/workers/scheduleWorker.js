/**
 * Воркер расписаний: раз в минуту проверяет bp_process_schedules и запускает процессы по времени.
 */
const { startProcessInternal } = require('../../controllers/processInstancesController')
const { shouldRunNow } = require('../../utils/scheduleRunner')

const POLL_INTERVAL_MS = 60 * 1000

function startScheduleWorker(dbPool) {
  async function tick() {
    try {
      const result = await dbPool.query(
        'SELECT id, process_id, enabled, schedule_type, time_hour, time_minute, config, launched_by_user_id, last_triggered_at FROM bp_process_schedules WHERE enabled = true'
      )
      const now = new Date()
      for (const row of result.rows) {
        const config = typeof row.config === 'object' ? row.config : (row.config ? JSON.parse(row.config) : {})
        const schedule = {
          schedule_type: row.schedule_type,
          time_hour: row.time_hour,
          time_minute: row.time_minute,
          config,
        }
        const lastTriggered = row.last_triggered_at ? new Date(row.last_triggered_at) : null
        const thisMinuteStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0)
        if (lastTriggered && lastTriggered.getTime() >= thisMinuteStart.getTime()) continue
        if (!shouldRunNow(schedule, now, lastTriggered)) continue

        const launchedBy = row.launched_by_user_id
        if (!launchedBy) {
          console.warn('scheduleWorker: пропуск процесса', row.process_id, '— не задан launched_by_user_id')
          continue
        }
        try {
          await startProcessInternal(dbPool, row.process_id, {
            initiator_id: launchedBy,
            launched_by_user_id: launchedBy,
          })
          await dbPool.query(
            'UPDATE bp_process_schedules SET last_triggered_at = NOW() WHERE id = $1',
            [row.id]
          )
        } catch (err) {
          console.error('scheduleWorker startProcess:', row.process_id, err)
        }
      }
    } catch (err) {
      console.error('scheduleWorker tick:', err)
    }
  }

  setInterval(tick, POLL_INTERVAL_MS)
  tick()
}

module.exports = { startScheduleWorker }
