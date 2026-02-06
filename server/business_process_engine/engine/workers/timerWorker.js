/**
 * Воркер таймеров: по расписанию выборка bp_timer_waiting где resume_at <= NOW(), переход процесса на следующий узел и запуск runner.
 */
const { runProcessFromStart } = require('../runner')

const POLL_INTERVAL_MS = 60 * 1000

function startTimerWorker(dbPool) {
  async function tick() {
    try {
      const result = await dbPool.query(
        'SELECT instance_id, node_id FROM bp_timer_waiting WHERE resume_at <= NOW()'
      )
      for (const row of result.rows) {
        const instanceId = row.instance_id
        const nodeId = row.node_id

        const instResult = await dbPool.query(
          'SELECT * FROM bp_process_instances WHERE id = $1 AND status = $2',
          [instanceId, 'waiting_timer']
        )
        if (instResult.rows.length === 0) {
          await dbPool.query('DELETE FROM bp_timer_waiting WHERE instance_id = $1', [instanceId])
          continue
        }

        const instance = instResult.rows[0]
        const defResult = await dbPool.query(
          'SELECT scheme FROM bp_process_definitions WHERE id = $1',
          [instance.process_id]
        )
        if (defResult.rows.length === 0) {
          await dbPool.query('DELETE FROM bp_timer_waiting WHERE instance_id = $1', [instanceId])
          continue
        }

        const scheme = typeof defResult.rows[0].scheme === 'object'
          ? defResult.rows[0].scheme
          : JSON.parse(defResult.rows[0].scheme)
        const edges = (scheme.edges || []).filter((e) => e.source === nodeId)
        const nextEdge = edges[0]
        if (!nextEdge) {
          await dbPool.query('DELETE FROM bp_timer_waiting WHERE instance_id = $1', [instanceId])
          await dbPool.query(
            `UPDATE bp_process_instances SET status = 'failed', error_message = $1, finished_at = NOW() WHERE id = $2`,
            ['У таймера нет исходящего ребра', instanceId]
          )
          continue
        }

        const nextNodeId = nextEdge.target
        await dbPool.query('DELETE FROM bp_timer_waiting WHERE instance_id = $1', [instanceId])
        const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
        const newContext = { ...context, active_tokens: [nextNodeId] }
        await dbPool.query(
          'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
          [JSON.stringify(newContext), 'running', nextNodeId, instanceId]
        )

        runProcessFromStart(dbPool, instanceId).catch((err) => {
          console.error('timerWorker runProcessFromStart:', err)
        })
      }
    } catch (err) {
      console.error('timerWorker tick:', err)
    }
  }

  setInterval(tick, POLL_INTERVAL_MS)
  tick()
}

module.exports = { startTimerWorker }
