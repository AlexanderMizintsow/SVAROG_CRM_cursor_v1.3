/**
 * Движок исполнения процесса: цикл по узлам, вызов обработчиков, обновление instance и лога.
 */
const { getHandler } = require('./nodeHandlers')
const registerClient = require('./integrations/registerClient')
const telegramClient = require('./integrations/telegramClient')

const integrations = {
  registerClient,
  telegramClient,
}

function getNodeById(scheme, nodeId) {
  const nodes = scheme.nodes || []
  return nodes.find((n) => n.id === nodeId)
}

async function logEnter(dbPool, instanceId, nodeId) {
  await dbPool.query(
    'INSERT INTO bp_node_execution_log (instance_id, node_id, outcome) VALUES ($1, $2, NULL)',
    [instanceId, nodeId]
  )
}

async function logExit(dbPool, instanceId, nodeId, outcome, payload) {
  await dbPool.query(
    `UPDATE bp_node_execution_log
     SET exited_at = NOW(), outcome = $1, payload = $2
     WHERE instance_id = $3 AND node_id = $4 AND exited_at IS NULL`,
    [outcome || null, payload ? JSON.stringify(payload) : null, instanceId, nodeId]
  )
}

async function getLastLogId(dbPool, instanceId, nodeId) {
  const r = await dbPool.query(
    'SELECT id FROM bp_node_execution_log WHERE instance_id = $1 AND node_id = $2 ORDER BY entered_at DESC LIMIT 1',
    [instanceId, nodeId]
  )
  return r.rows[0] ? r.rows[0].id : null
}

async function runProcessFromStart(dbPool, instanceId) {
  const instResult = await dbPool.query(
    'SELECT * FROM bp_process_instances WHERE id = $1 AND status = $2',
    [instanceId, 'running']
  )
  if (instResult.rows.length === 0) return

  const instance = instResult.rows[0]
  const defResult = await dbPool.query(
    'SELECT scheme FROM bp_process_definitions WHERE id = $1',
    [instance.process_id]
  )
  if (defResult.rows.length === 0) return

  const scheme = typeof defResult.rows[0].scheme === 'object'
    ? defResult.rows[0].scheme
    : JSON.parse(defResult.rows[0].scheme)

  let currentNodeId = instance.current_node_id
  if (!currentNodeId) return

  await logEnter(dbPool, instanceId, currentNodeId)

  while (currentNodeId) {
    const node = getNodeById(scheme, currentNodeId)
    if (!node) {
      await logExit(dbPool, instanceId, currentNodeId, 'error', { error: 'Узел не найден' })
      await dbPool.query(
        `UPDATE bp_process_instances SET status = 'failed', error_message = $1, finished_at = NOW() WHERE id = $2`,
        ['Узел не найден: ' + currentNodeId, instanceId]
      )
      return
    }

    const handler = getHandler(node.type)
    if (!handler || !handler.handle) {
      await logExit(dbPool, instanceId, currentNodeId, 'error', { error: 'Нет обработчика для типа ' + node.type })
      await dbPool.query(
        `UPDATE bp_process_instances SET status = 'failed', error_message = $1, finished_at = NOW() WHERE id = $2`,
        ['Нет обработчика для типа ' + node.type, instanceId]
      )
      return
    }

    const instCurrent = (await dbPool.query('SELECT * FROM bp_process_instances WHERE id = $1', [instanceId])).rows[0]
    let result
    try {
      result = await handler.handle(instCurrent, node, scheme, integrations, dbPool)
    } catch (err) {
      console.error('runner node handle error:', node.id, node.type, err)
      await logExit(dbPool, instanceId, currentNodeId, 'error', { error: err.message })
      await dbPool.query(
        `UPDATE bp_process_instances SET status = 'failed', error_message = $1, finished_at = NOW() WHERE id = $2`,
        [err.message || 'Ошибка выполнения узла', instanceId]
      )
      return
    }

    if (result.nextNodeId) {
      await logExit(dbPool, instanceId, currentNodeId, 'success', { nextNodeId: result.nextNodeId })
      await dbPool.query(
        'UPDATE bp_process_instances SET current_node_id = $1 WHERE id = $2',
        [result.nextNodeId, instanceId]
      )
      currentNodeId = result.nextNodeId
      await logEnter(dbPool, instanceId, currentNodeId)
      continue
    }

    if (result.waitGateway && result.waitGateway.taskId) {
      await logExit(dbPool, instanceId, currentNodeId, 'condition_met', { waitGateway: result.waitGateway.taskId })
      await dbPool.query(
        'INSERT INTO bp_gateway_waiting (instance_id, node_id, task_id) VALUES ($1, $2, $3)',
        [instanceId, currentNodeId, result.waitGateway.taskId]
      )
      await dbPool.query(
        `UPDATE bp_process_instances SET status = 'waiting_gateway', current_node_id = $1 WHERE id = $2`,
        [currentNodeId, instanceId]
      )
      return
    }

    if (result.waitTimer && result.waitTimer.resumeAt) {
      const resumeAt = result.waitTimer.resumeAt instanceof Date
        ? result.waitTimer.resumeAt
        : new Date(result.waitTimer.resumeAt)
      await logExit(dbPool, instanceId, currentNodeId, 'timer_scheduled', { resumeAt: resumeAt.toISOString() })
      await dbPool.query(
        'INSERT INTO bp_timer_waiting (instance_id, node_id, resume_at) VALUES ($1, $2, $3) ON CONFLICT (instance_id) DO UPDATE SET node_id = $2, resume_at = $3',
        [instanceId, currentNodeId, resumeAt]
      )
      await dbPool.query(
        `UPDATE bp_process_instances SET status = 'waiting_timer', current_node_id = $1 WHERE id = $2`,
        [currentNodeId, instanceId]
      )
      return
    }

    if (result.end) {
      await logExit(dbPool, instanceId, currentNodeId, 'success', { end: true })
      await dbPool.query(
        `UPDATE bp_process_instances SET status = 'completed', finished_at = NOW(), current_node_id = NULL WHERE id = $1`,
        [instanceId]
      )
      return
    }

    if (result.fail) {
      await logExit(dbPool, instanceId, currentNodeId, 'error', { fail: result.fail })
      await dbPool.query(
        `UPDATE bp_process_instances SET status = 'failed', error_message = $1, finished_at = NOW() WHERE id = $2`,
        [result.fail, instanceId]
      )
      return
    }

    break
  }
}

async function runProcessFromGateway(dbPool, taskId) {
  const links = await dbPool.query(
    'SELECT process_instance_id, node_id FROM bp_gateway_waiting WHERE task_id = $1',
    [taskId]
  )
  if (links.rows.length === 0) return

  for (const row of links.rows) {
    const instanceId = row.process_instance_id
    const gatewayNodeId = row.node_id

    const instResult = await dbPool.query(
      'SELECT * FROM bp_process_instances WHERE id = $1 AND status = $2',
      [instanceId, 'waiting_gateway']
    )
    if (instResult.rows.length === 0) continue

    const instance = instResult.rows[0]
    const defResult = await dbPool.query(
      'SELECT scheme FROM bp_process_definitions WHERE id = $1',
      [instance.process_id]
    )
    if (defResult.rows.length === 0) continue

    const scheme = typeof defResult.rows[0].scheme === 'object'
      ? defResult.rows[0].scheme
      : JSON.parse(defResult.rows[0].scheme)
    const node = getNodeById(scheme, gatewayNodeId)
    if (!node || node.type !== 'gateway') continue

    const handler = getHandler('gateway')
    if (!handler || !handler.handle) continue

    const result = await handler.handle(instance, node, scheme, integrations, dbPool)

    await dbPool.query('DELETE FROM bp_gateway_waiting WHERE instance_id = $1 AND node_id = $2', [instanceId, gatewayNodeId])

    if (result.nextNodeId) {
      await dbPool.query(
        'UPDATE bp_process_instances SET status = $1, current_node_id = $2 WHERE id = $3',
        ['running', result.nextNodeId, instanceId]
      )
      await runProcessFromStart(dbPool, instanceId)
      return
    }
  }
}

module.exports = {
  runProcessFromStart,
  runProcessFromGateway,
}
