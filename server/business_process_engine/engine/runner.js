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

  // Защита от бесконечных циклов/зависаний схемы
  // Циклы допускаются (например, через Таймер + Развилка), но должны быть ограничены разумным числом шагов.
  let steps = 0
  const MAX_STEPS = 500

  while (currentNodeId) {
    steps += 1
    if (steps > MAX_STEPS) {
      await logExit(dbPool, instanceId, currentNodeId, 'error', { error: 'Превышен лимит шагов выполнения (циклическая схема)' })
      await dbPool.query(
        `UPDATE bp_process_instances SET status = 'failed', error_message = $1, finished_at = NOW() WHERE id = $2`,
        ['Превышен лимит шагов выполнения (возможен бесконечный цикл)', instanceId]
      )
      return
    }

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

    if (result.waitUserInput) {
      await logExit(dbPool, instanceId, currentNodeId, 'waiting_user_input', {})
      return
    }

    if (result.waitDecision) {
      await logExit(dbPool, instanceId, currentNodeId, 'waiting_decision', { nodeId: result.waitDecision.nodeId })
      return
    }

    if (result.waitJoin) {
      await logExit(dbPool, instanceId, currentNodeId, 'waiting_join', { nodeId: result.waitJoin.nodeId })
      return
    }

    if (result.end) {
      await logExit(dbPool, instanceId, currentNodeId, 'success', {
        end: true,
        outcome: result.outcome || 'SUCCESS',
        comment: result.comment || '',
      })
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

async function runProcessFromTaskCreation(dbPool, instanceId, taskId) {
  const instResult = await dbPool.query(
    'SELECT * FROM bp_process_instances WHERE id = $1 AND status = $2',
    [instanceId, 'waiting_user_input']
  )
  if (instResult.rows.length === 0) return

  const instance = instResult.rows[0]
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
  const pending = context.pending_task_creation
  if (!pending || !pending.nodeId) return

  const nodeId = pending.nodeId

  await dbPool.query(
    'INSERT INTO bp_task_process_links (task_id, process_instance_id, node_id) VALUES ($1, $2, $3)',
    [taskId, instanceId, nodeId]
  )

  const blockOutputs = context.block_outputs || {}
  blockOutputs[nodeId] = { task_id: taskId }
  const newContext = { ...context, last_task_id: taskId, block_outputs: blockOutputs }
  delete newContext.pending_task_creation

  const defResult = await dbPool.query(
    'SELECT scheme FROM bp_process_definitions WHERE id = $1',
    [instance.process_id]
  )
  if (defResult.rows.length === 0) return

  const scheme = typeof defResult.rows[0].scheme === 'object'
    ? defResult.rows[0].scheme
    : JSON.parse(defResult.rows[0].scheme)
  const edges = (scheme.edges || []).filter((e) => e.source === nodeId)
  const nextEdge = edges[0]
  if (!nextEdge) return

  await dbPool.query(
    'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
    [JSON.stringify(newContext), 'running', nextEdge.target, instanceId]
  )
  await runProcessFromStart(dbPool, instanceId)
}

async function runProcessFromGateway(dbPool, taskId) {
  const links = await dbPool.query(
    'SELECT instance_id, node_id FROM bp_gateway_waiting WHERE task_id = $1',
    [taskId]
  )
  if (links.rows.length === 0) return

  for (const row of links.rows) {
    const instanceId = row.instance_id
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

    // Маркер: развилка выполняется по событию изменения задачи (вебхук)
    instance.__bpe_resume_reason = 'task_updated'
    const result = await handler.handle(instance, node, scheme, integrations, dbPool)

    if (result.nextNodeId) {
      // Условие совпало — снимаем ожидание и продолжаем выполнение.
      await dbPool.query('DELETE FROM bp_gateway_waiting WHERE instance_id = $1 AND node_id = $2', [instanceId, gatewayNodeId])
      await dbPool.query(
        'UPDATE bp_process_instances SET status = $1, current_node_id = $2 WHERE id = $3',
        ['running', result.nextNodeId, instanceId]
      )
      await runProcessFromStart(dbPool, instanceId)
      continue
    }

    // Если условие не подошло — продолжаем ожидать (НЕ удаляем запись ожидания).
    // Следующий task-updated по этой же задаче снова вызовет runProcessFromGateway.
  }
}

function getIncomingSourceNodes(scheme, nodeId) {
  const edges = (scheme.edges || []).filter((e) => e.target === nodeId)
  const nodes = scheme.nodes || []
  const seen = new Set()
  const list = []
  for (const e of edges) {
    const src = nodes.find((n) => n.id === e.source)
    if (src && (src.type === 'create_task' || src.type === 'assign_task' || src.type === 'decision') && !seen.has(src.id)) {
      seen.add(src.id)
      list.push(src)
    }
  }
  return list
}

function normalizeTaskStatus(raw) {
  const s = raw != null ? String(raw) : ''
  if (!s) return ''
  const v = s.toLowerCase()
  if (v === 'pending') return 'wait'
  if (v === 'in_progress') return 'doing'
  if (v === 'completed') return 'done'
  if (v === 'on_hold') return 'pause'
  if (v === 'cancelled') return 'cancelled'
  if (v === 'backlog' || v === 'todo' || v === 'wait' || v === 'doing' || v === 'done' || v === 'pause') return v
  return v
}

async function runProcessFromGatewayJoin(dbPool, taskId) {
  const links = await dbPool.query('SELECT instance_id, node_id FROM bp_gateway_join_waiting')
  if (links.rows.length === 0) return

  for (const row of links.rows) {
    const instanceId = row.instance_id
    const joinNodeId = row.node_id

    const instResult = await dbPool.query(
      'SELECT * FROM bp_process_instances WHERE id = $1 AND status = $2',
      [instanceId, 'waiting_join']
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
    const joinNode = getNodeById(scheme, joinNodeId)
    if (!joinNode || joinNode.type !== 'gateway_join') continue

    const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
    const blockOutputs = context.block_outputs || {}
    const joinSignals = context.join_signals && typeof context.join_signals === 'object' ? context.join_signals : {}
    const sources = getIncomingSourceNodes(scheme, joinNodeId)
    let updated = false
    for (const src of sources) {
      if (src.type !== 'create_task' && src.type !== 'assign_task') continue
      const tid = blockOutputs[src.id]?.task_id
      if (tid == null || Number(tid) !== Number(taskId)) continue
      try {
        const task = await integrations.registerClient.getTask(taskId)
        const status = normalizeTaskStatus(task && task.status)
        const now = new Date()
        const deadline = task && task.deadline ? new Date(task.deadline) : null
        const isOverdue = deadline ? now > deadline : false
        const isCompleted = task && task.is_completed === true
        const priority = (task && task.priority) ? String(task.priority).toLowerCase() : ''
        const hasDeadline = !!(task && task.deadline)
        const assignees = (task && task.assignees) || []
        const assigneeIds = assignees.map((a) => (typeof a === 'object' ? Number(a.id) : Number(a))).filter((x) => Number.isFinite(x))
        const taskSignal = {
          type: 'task',
          status,
          task,
          deadline,
          now,
          isOverdue,
          isCompleted,
          priority,
          hasDeadline,
          assigneeIds,
        }
        const newJoinSignals = { ...joinSignals, [src.id]: taskSignal }
        const newContext = { ...context, join_signals: newJoinSignals }
        await dbPool.query(
          'UPDATE bp_process_instances SET context = $1, status = $2 WHERE id = $3',
          [JSON.stringify(newContext), 'running', instanceId]
        )
        try {
          await dbPool.query('DELETE FROM bp_gateway_join_waiting WHERE instance_id = $1', [instanceId])
        } catch (e) {
          if (e?.code !== '42P01') throw e
        }
        await runProcessFromStart(dbPool, instanceId)
        updated = true
        break
      } catch (e) {
        console.warn('runProcessFromGatewayJoin getTask:', taskId, e?.message)
      }
    }
    if (updated) break
  }
}

async function runProcessFromDecision(dbPool, instanceId, nodeId, buttonId) {
  const instResult = await dbPool.query(
    'SELECT * FROM bp_process_instances WHERE id = $1 AND status = $2',
    [instanceId, 'waiting_decision']
  )
  if (instResult.rows.length === 0) return

  const instance = instResult.rows[0]
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
  const decisionOutputs = context.decision_outputs || {}
  decisionOutputs[nodeId] = { button_id: buttonId }
  const newContext = { ...context, decision_outputs: decisionOutputs, last_decision: { nodeId, buttonId } }

  const defResult = await dbPool.query(
    'SELECT scheme FROM bp_process_definitions WHERE id = $1',
    [instance.process_id]
  )
  if (defResult.rows.length === 0) return

  const scheme = typeof defResult.rows[0].scheme === 'object'
    ? defResult.rows[0].scheme
    : JSON.parse(defResult.rows[0].scheme)
  const edges = (scheme.edges || []).filter((e) => e.source === nodeId)
  const nextEdge = edges[0]
  if (!nextEdge) return

  await dbPool.query(
    'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
    [JSON.stringify(newContext), 'running', nextEdge.target, instanceId]
  )
  await runProcessFromStart(dbPool, instanceId)
}

module.exports = {
  runProcessFromStart,
  runProcessFromGateway,
  runProcessFromGatewayJoin,
  runProcessFromTaskCreation,
  runProcessFromDecision,
}
