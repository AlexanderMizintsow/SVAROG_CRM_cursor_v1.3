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

  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
  let activeTokens = Array.isArray(context.active_tokens) ? [...context.active_tokens] : []
  if (activeTokens.length === 0 && instance.current_node_id) {
    activeTokens = [instance.current_node_id]
  }
  if (activeTokens.length === 0) return

  // Защита от бесконечных циклов/зависаний схемы
  let steps = 0
  const MAX_STEPS = 2000

  while (activeTokens.length > 0) {
    steps += 1
    if (steps > MAX_STEPS) {
      await dbPool.query(
        `UPDATE bp_process_instances SET status = 'failed', error_message = $1, finished_at = NOW() WHERE id = $2`,
        ['Превышен лимит шагов выполнения (циклическая схема)', instanceId]
      )
      return
    }

    const currentNodeId = activeTokens.shift()
    await logEnter(dbPool, instanceId, currentNodeId)

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

    const instAfter = (await dbPool.query('SELECT * FROM bp_process_instances WHERE id = $1', [instanceId])).rows[0]
    const ctxCurrent = typeof instAfter.context === 'object' ? instAfter.context : (instAfter.context ? JSON.parse(instAfter.context) : {})

    if (result.nextNodeIds && Array.isArray(result.nextNodeIds) && result.nextNodeIds.length > 0) {
      await logExit(dbPool, instanceId, currentNodeId, 'success', { nextNodeIds: result.nextNodeIds })
      activeTokens.push(...result.nextNodeIds)
      const newContext = { ...ctxCurrent, active_tokens: activeTokens }
      const displayNode = activeTokens[0]
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1, current_node_id = $2 WHERE id = $3',
        [JSON.stringify(newContext), displayNode, instanceId]
      )
      continue
    }

    if (result.nextNodeId) {
      await logExit(dbPool, instanceId, currentNodeId, 'success', { nextNodeId: result.nextNodeId })
      if (node.type === 'gateway_join') {
        const atJoin = activeTokens.filter((id) => id === currentNodeId)
        activeTokens = activeTokens.filter((id) => id !== currentNodeId)
        activeTokens.push(result.nextNodeId)
      } else {
        activeTokens.push(result.nextNodeId)
      }
      const newContext = { ...ctxCurrent, active_tokens: activeTokens }
      const displayNode = activeTokens[0] || null
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1, current_node_id = $2 WHERE id = $3',
        [JSON.stringify(newContext), displayNode, instanceId]
      )
      continue
    }

    if (result.waitGateway && result.waitGateway.taskId) {
      await logExit(dbPool, instanceId, currentNodeId, 'condition_met', { waitGateway: result.waitGateway.taskId })
      activeTokens.unshift(currentNodeId)
      const newContext = { ...ctxCurrent, active_tokens: activeTokens }
      await dbPool.query(
        'INSERT INTO bp_gateway_waiting (instance_id, node_id, task_id) VALUES ($1, $2, $3)',
        [instanceId, currentNodeId, result.waitGateway.taskId]
      )
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
        [JSON.stringify(newContext), 'waiting_gateway', currentNodeId, instanceId]
      )
      return
    }

    if (result.waitGatewayProject && result.waitGatewayProject.globalTaskId) {
      await logExit(dbPool, instanceId, currentNodeId, 'condition_met', { waitGatewayProject: result.waitGatewayProject.globalTaskId })
      activeTokens.unshift(currentNodeId)
      const newContext = { ...ctxCurrent, active_tokens: activeTokens }
      try {
        await dbPool.query(
          'INSERT INTO bp_gateway_project_waiting (instance_id, node_id, global_task_id) VALUES ($1, $2, $3)',
          [instanceId, currentNodeId, result.waitGatewayProject.globalTaskId]
        )
      } catch (e) {
        if (e?.code === '42P01') {
          throw new Error(
            'BPE: не создана таблица bp_gateway_project_waiting (см. server/business_process_engine/db/SQL_MANUAL_QUERIES.sql, раздел 6.1)'
          )
        }
        throw e
      }
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
        [JSON.stringify(newContext), 'waiting_gateway', currentNodeId, instanceId]
      )
      return
    }

    if (result.waitTimer && result.waitTimer.resumeAt) {
      const resumeAt = result.waitTimer.resumeAt instanceof Date
        ? result.waitTimer.resumeAt
        : new Date(result.waitTimer.resumeAt)
      await logExit(dbPool, instanceId, currentNodeId, 'timer_scheduled', { resumeAt: resumeAt.toISOString() })
      activeTokens.unshift(currentNodeId)
      const newContext = { ...ctxCurrent, active_tokens: activeTokens }
      await dbPool.query(
        'INSERT INTO bp_timer_waiting (instance_id, node_id, resume_at) VALUES ($1, $2, $3) ON CONFLICT (instance_id) DO UPDATE SET node_id = $2, resume_at = $3',
        [instanceId, currentNodeId, resumeAt]
      )
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
        [JSON.stringify(newContext), 'waiting_timer', currentNodeId, instanceId]
      )
      return
    }

    if (result.waitUserInput) {
      await logExit(dbPool, instanceId, currentNodeId, 'waiting_user_input', {})
      activeTokens.unshift(currentNodeId)
      const newContext = { ...ctxCurrent, active_tokens: activeTokens }
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1 WHERE id = $2',
        [JSON.stringify(newContext), instanceId]
      )
      return
    }

    if (result.waitDecision) {
      await logExit(dbPool, instanceId, currentNodeId, 'waiting_decision', { nodeId: result.waitDecision.nodeId })
      activeTokens.unshift(currentNodeId)
      const newContext = { ...ctxCurrent, active_tokens: activeTokens }
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1 WHERE id = $2',
        [JSON.stringify(newContext), instanceId]
      )
      return
    }

    if (result.waitAdditionalInfo) {
      await logExit(dbPool, instanceId, currentNodeId, 'waiting_additional_info', { nodeId: result.waitAdditionalInfo.nodeId })
      activeTokens.unshift(currentNodeId)
      const newContext = { ...ctxCurrent, active_tokens: activeTokens }
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1 WHERE id = $2',
        [JSON.stringify(newContext), instanceId]
      )
      return
    }

    if (result.waitJoin) {
      await logExit(dbPool, instanceId, currentNodeId, 'waiting_join', { nodeId: result.waitJoin.nodeId })
      activeTokens.unshift(currentNodeId)
      const newContext = { ...ctxCurrent, active_tokens: activeTokens }
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1 WHERE id = $2',
        [JSON.stringify(newContext), instanceId]
      )
      return
    }

    if (result.end) {
      await logExit(dbPool, instanceId, currentNodeId, 'success', {
        end: true,
        outcome: result.outcome || 'SUCCESS',
        comment: result.comment || '',
      })
      if (activeTokens.length === 0) {
        const newContext = { ...ctxCurrent, active_tokens: [] }
        await dbPool.query(
          'UPDATE bp_process_instances SET context = $1, status = $2, finished_at = NOW(), current_node_id = NULL WHERE id = $3',
          [JSON.stringify(newContext), 'completed', instanceId]
        )
        return
      }
      const newContext = { ...ctxCurrent, active_tokens: activeTokens }
      const displayNode = activeTokens[0]
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1, current_node_id = $2 WHERE id = $3',
        [JSON.stringify(newContext), displayNode, instanceId]
      )
      continue
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

  const ctxForResume = { ...newContext, active_tokens: [nextEdge.target] }
  await dbPool.query(
    'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
    [JSON.stringify(ctxForResume), 'running', nextEdge.target, instanceId]
  )
  await runProcessFromStart(dbPool, instanceId)
}

async function runProcessFromProjectCreation(dbPool, instanceId, projectId) {
  const instResult = await dbPool.query(
    'SELECT * FROM bp_process_instances WHERE id = $1 AND status = $2',
    [instanceId, 'waiting_user_input']
  )
  if (instResult.rows.length === 0) return

  const instance = instResult.rows[0]
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
  const pending = context.pending_project_creation
  if (!pending || !pending.nodeId) return

  const nodeId = pending.nodeId
  const projectOutputs = context.project_outputs && typeof context.project_outputs === 'object' ? context.project_outputs : {}
  projectOutputs[nodeId] = { global_task_id: Number(projectId) || projectId }
  const newContext = { ...context, last_global_task_id: Number(projectId) || projectId, project_outputs: projectOutputs }
  delete newContext.pending_project_creation

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

  const ctxForResume = { ...newContext, active_tokens: [nextEdge.target] }
  await dbPool.query(
    'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
    [JSON.stringify(ctxForResume), 'running', nextEdge.target, instanceId]
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
      await dbPool.query('DELETE FROM bp_gateway_waiting WHERE instance_id = $1 AND node_id = $2', [instanceId, gatewayNodeId])
      const ctx = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
      const newContext = { ...ctx, active_tokens: [result.nextNodeId] }
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
        [JSON.stringify(newContext), 'running', result.nextNodeId, instanceId]
      )
      await runProcessFromStart(dbPool, instanceId)
      continue
    }

    // Если условие не подошло — продолжаем ожидать (НЕ удаляем запись ожидания).
    // Следующий task-updated по этой же задаче снова вызовет runProcessFromGateway.
  }
}

async function runProcessFromGatewayProject(dbPool, globalTaskId) {
  let links
  try {
    links = await dbPool.query(
      'SELECT instance_id, node_id FROM bp_gateway_project_waiting WHERE global_task_id = $1',
      [globalTaskId]
    )
  } catch (e) {
    if (e?.code === '42P01') {
      // Таблица ожиданий по проектам не создана — игнорируем вебхук
      return
    }
    throw e
  }
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

    instance.__bpe_resume_reason = 'project_updated'
    const result = await handler.handle(instance, node, scheme, integrations, dbPool)

    if (result.nextNodeId) {
      try {
        await dbPool.query(
          'DELETE FROM bp_gateway_project_waiting WHERE instance_id = $1 AND node_id = $2',
          [instanceId, gatewayNodeId]
        )
      } catch (e) {
        if (e?.code !== '42P01') throw e
      }
      const ctx = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
      const newContext = { ...ctx, active_tokens: [result.nextNodeId] }
      await dbPool.query(
        'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
        [JSON.stringify(newContext), 'running', result.nextNodeId, instanceId]
      )
      await runProcessFromStart(dbPool, instanceId)
      continue
    }
  }
}

function getIncomingSourceNodes(scheme, nodeId) {
  const edges = (scheme.edges || []).filter((e) => e.target === nodeId)
  const nodes = scheme.nodes || []
  const seen = new Set()
  const list = []
  for (const e of edges) {
    const src = nodes.find((n) => n.id === e.source)
    if (
      src &&
      (src.type === 'create_task' || src.type === 'assign_task' || src.type === 'decision' || src.type === 'create_project') &&
      !seen.has(src.id)
    ) {
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
        const ctxForResume = { ...newContext, active_tokens: [joinNodeId] }
        await dbPool.query(
          'UPDATE bp_process_instances SET context = $1, status = $2 WHERE id = $3',
          [JSON.stringify(ctxForResume), 'running', instanceId]
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

async function runProcessFromGatewayJoinProject(dbPool, globalTaskId) {
  let links
  try {
    links = await dbPool.query('SELECT instance_id, node_id FROM bp_gateway_join_waiting')
  } catch (e) {
    if (e?.code === '42P01') return
    throw e
  }
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
    const projectOutputs = context.project_outputs && typeof context.project_outputs === 'object' ? context.project_outputs : {}
    const joinSignals = context.join_signals && typeof context.join_signals === 'object' ? context.join_signals : {}
    const sources = getIncomingSourceNodes(scheme, joinNodeId)

    let updated = false
    for (const src of sources) {
      if (src.type !== 'create_project') continue
      const pid =
        projectOutputs[src.id]?.global_task_id ??
        projectOutputs[src.id]?.project_id ??
        context.last_global_task_id
      if (pid == null || Number(pid) !== Number(globalTaskId)) continue
      try {
        const project = await integrations.registerClient.getGlobalTaskById(globalTaskId)
        const projStatusRaw = (project && project.status) ? String(project.status).trim() : ''
        const now = new Date()
        const deadline = project && project.deadline ? new Date(project.deadline) : null
        const isOverdue = deadline ? now > deadline : false
        const priority = (project && project.priority) ? String(project.priority).toLowerCase() : ''
        const hasDeadline = !!(project && project.deadline)
        const completion = project && project.completion_percentage != null ? Number(project.completion_percentage) : 0
        const projectSignal = {
          type: 'project',
          projectStatusRaw: projStatusRaw,
          project,
          deadline,
          now,
          isOverdue,
          hasDeadline,
          priority,
          completion,
        }
        const newJoinSignals = { ...joinSignals, [src.id]: projectSignal }
        const newContext = { ...context, join_signals: newJoinSignals }
        const ctxForResume = { ...newContext, active_tokens: [joinNodeId] }
        await dbPool.query(
          'UPDATE bp_process_instances SET context = $1, status = $2 WHERE id = $3',
          [JSON.stringify(ctxForResume), 'running', instanceId]
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
        console.warn('runProcessFromGatewayJoinProject getGlobalTaskById:', globalTaskId, e?.message)
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

  const defResult = await dbPool.query(
    'SELECT scheme FROM bp_process_definitions WHERE id = $1',
    [instance.process_id]
  )
  if (defResult.rows.length === 0) return

  const scheme = typeof defResult.rows[0].scheme === 'object'
    ? defResult.rows[0].scheme
    : JSON.parse(defResult.rows[0].scheme)

  // Попробуем дополнить label кнопки по схеме (для подстановок/переменных)
  let buttonLabel = null
  try {
    const nodes = Array.isArray(scheme.nodes) ? scheme.nodes : []
    const decisionNode = nodes.find((n) => n.id === nodeId && n.type === 'decision')
    const btns = Array.isArray(decisionNode?.settings?.buttons) ? decisionNode.settings.buttons : []
    const btn = btns.find((b) => String(b.id) === String(buttonId)) || null
    buttonLabel = btn ? (btn.label || null) : null
  } catch (e) {
    buttonLabel = null
  }

  decisionOutputs[nodeId] = { button_id: buttonId, button_label: buttonLabel }
  const newContext = { ...context, decision_outputs: decisionOutputs, last_decision: { nodeId, buttonId, buttonLabel } }
  const edges = (scheme.edges || []).filter((e) => e.source === nodeId)
  const nextEdge = edges[0]
  if (!nextEdge) return

  const ctxForResume = { ...newContext, active_tokens: [nextEdge.target] }
  await dbPool.query(
    'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
    [JSON.stringify(ctxForResume), 'running', nextEdge.target, instanceId]
  )
  await runProcessFromStart(dbPool, instanceId)
}

async function runProcessFromAdditionalInfo(dbPool, instanceId, nodeId, values) {
  const instResult = await dbPool.query(
    'SELECT * FROM bp_process_instances WHERE id = $1 AND status = $2',
    [instanceId, 'waiting_additional_info']
  )
  if (instResult.rows.length === 0) return

  const instance = instResult.rows[0]
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})
  const addInfo = context.additional_info && typeof context.additional_info === 'object' ? context.additional_info : {}

  const patch = values && typeof values === 'object' ? values : {}
  const nextAddInfo = { ...addInfo }
  Object.keys(patch).forEach((k) => {
    const key = String(k || '').trim()
    if (!key) return
    const vRaw = patch[k]
    if (vRaw === undefined || vRaw === null) {
      nextAddInfo[key] = false
      return
    }
    const s = typeof vRaw === 'string' ? vRaw.trim() : vRaw
    nextAddInfo[key] = (typeof s === 'string' && !s) ? false : s
  })

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

  const newContext = { ...context, additional_info: nextAddInfo }
  const ctxForResume = { ...newContext, active_tokens: [nextEdge.target] }
  await dbPool.query(
    'UPDATE bp_process_instances SET context = $1, status = $2, current_node_id = $3 WHERE id = $4',
    [JSON.stringify(ctxForResume), 'running', nextEdge.target, instanceId]
  )
  await runProcessFromStart(dbPool, instanceId)
}

module.exports = {
  runProcessFromStart,
  runProcessFromGateway,
  runProcessFromGatewayProject,
  runProcessFromGatewayJoin,
  runProcessFromGatewayJoinProject,
  runProcessFromTaskCreation,
  runProcessFromProjectCreation,
  runProcessFromDecision,
  runProcessFromAdditionalInfo,
}
