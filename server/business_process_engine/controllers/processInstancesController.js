const { runProcessFromStart, runProcessFromTaskCreation, runProcessFromProjectCreation, runProcessFromDecision, runProcessFromAdditionalInfo } = require('../engine/runner')

/**
 * Внутренний запуск процесса (для HTTP и для планировщика).
 * @param {object} dbPool
 * @param {string|number} processId
 * @param {{ initiator_id?: number, launched_by_user_id: number }} options
 * @returns {Promise<object>} созданный экземпляр
 */
async function startProcessInternal(dbPool, processId, options = {}) {
  const { initiator_id, launched_by_user_id, initial_additional_info } = options
  if (!launched_by_user_id) {
    const err = new Error('Не указан launched_by_user_id')
    err.code = 'MISSING_LAUNCHED_BY'
    throw err
  }
  const defResult = await dbPool.query(
    'SELECT id, name, scheme FROM bp_process_definitions WHERE id = $1 AND is_draft = false',
    [String(processId)]
  )
  if (defResult.rows.length === 0) {
    const err = new Error('Процесс не найден или не опубликован')
    err.code = 'NOT_FOUND'
    throw err
  }
  const definition = defResult.rows[0]
  const scheme = typeof definition.scheme === 'object' ? definition.scheme : JSON.parse(definition.scheme)
  const startNode = (scheme.nodes || []).find((n) => n.type === 'start')
  if (!startNode) {
    const err = new Error('В схеме нет узла Старт')
    err.code = 'NO_START_NODE'
    throw err
  }

  const startSettings = startNode.settings || {}
  const allowAllLaunchers = startSettings.allowAllLaunchers !== false
  const allowedLauncherUserIds = Array.isArray(startSettings.allowedLauncherUserIds)
    ? startSettings.allowedLauncherUserIds.map((x) => Number(x)).filter((x) => Number.isFinite(x))
    : []
  if (!allowAllLaunchers) {
    const allowed = allowedLauncherUserIds.includes(Number(launched_by_user_id))
    if (!allowed) {
      const err = new Error('У вас нет прав на запуск этого процесса')
      err.code = 'FORBIDDEN'
      throw err
    }
  }

  let initiatorId = initiator_id || launched_by_user_id
  if (!initiatorId && startNode.settings) {
    if (startNode.settings.initiatorType === 'fixed_user' && startNode.settings.fixedUserId) {
      initiatorId = startNode.settings.fixedUserId
    } else {
      initiatorId = launched_by_user_id
    }
  }

  const initialAdditionalInfo = initial_additional_info && typeof initial_additional_info === 'object'
    ? initial_additional_info
    : {}
  const context = { initiator_id: initiatorId || null }
  if (Object.keys(initialAdditionalInfo).length > 0) {
    context.additional_info = initialAdditionalInfo
  }

  const instResult = await dbPool.query(
    `INSERT INTO bp_process_instances (process_id, initiator_id, launched_by_user_id, current_node_id, status, context)
     VALUES ($1, $2, $3, $4, 'running', $5)
     RETURNING id, process_id, started_at, initiator_id, status, current_node_id`,
    [
      processId,
      initiatorId || null,
      launched_by_user_id || null,
      startNode.id,
      JSON.stringify(context),
    ]
  )
  const instance = instResult.rows[0]
  runProcessFromStart(dbPool, instance.id).catch((err) => {
    console.error('runProcessFromStart error:', err)
  })
  return instance
}

async function startProcess(dbPool, req, res) {
  try {
    const processId = req.params.id
    const { initiator_id, launched_by_user_id, initial_additional_info } = req.body || {}
    const instance = await startProcessInternal(dbPool, processId, {
      initiator_id,
      launched_by_user_id,
      initial_additional_info,
    })
    res.status(201).json(instance)
  } catch (err) {
    if (err.code === 'MISSING_LAUNCHED_BY') return res.status(400).json({ error: err.message })
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message })
    if (err.code === 'NO_START_NODE') return res.status(400).json({ error: err.message })
    if (err.code === 'FORBIDDEN') return res.status(403).json({ error: err.message })
    console.error('startProcess:', err)
    res.status(500).json({ error: 'Ошибка при запуске процесса' })
  }
}

async function getInstances(dbPool, req, res) {
  try {
    const { process_id, initiator_id, status } = req.query
    let query = 'SELECT * FROM bp_process_instances WHERE 1=1'
    const params = []
    let i = 1
    if (process_id) {
      query += ` AND process_id = $${i}`
      params.push(process_id)
      i++
    }
    if (initiator_id) {
      query += ` AND initiator_id = $${i}`
      params.push(initiator_id)
      i++
    }
    if (status) {
      query += ` AND status = $${i}`
      params.push(status)
      i++
    }
    query += ' ORDER BY started_at DESC'
    const result = await dbPool.query(query, params)
    res.json(result.rows)
  } catch (err) {
    console.error('getInstances:', err)
    res.status(500).json({ error: 'Ошибка при получении экземпляров' })
  }
}

async function getInstanceById(dbPool, req, res) {
  try {
    const { id } = req.params
    const result = await dbPool.query('SELECT * FROM bp_process_instances WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Экземпляр не найден' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('getInstanceById:', err)
    res.status(500).json({ error: 'Ошибка при получении экземпляра' })
  }
}

async function completeTaskCreation(dbPool, req, res) {
  try {
    const { id } = req.params
    const { task_id: taskId } = req.body
    if (!taskId) {
      return res.status(400).json({ error: 'Не указан task_id' })
    }
    const result = await dbPool.query(
      'SELECT id FROM bp_process_instances WHERE id = $1 AND status = $2',
      [id, 'waiting_user_input']
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Экземпляр не найден или не ожидает создания задачи' })
    }
    await runProcessFromTaskCreation(dbPool, id, taskId)
    const updated = await dbPool.query('SELECT id, status, current_node_id FROM bp_process_instances WHERE id = $1', [id])
    res.json(updated.rows[0] || { success: true })
  } catch (err) {
    console.error('completeTaskCreation:', err)
    res.status(500).json({ error: 'Ошибка при завершении создания задачи' })
  }
}

async function completeProjectCreation(dbPool, req, res) {
  try {
    const { id } = req.params
    const projectId = req.body.project_id != null ? req.body.project_id : req.body.task_id
    if (projectId == null) {
      return res.status(400).json({ error: 'Не указан project_id' })
    }
    const result = await dbPool.query(
      'SELECT id FROM bp_process_instances WHERE id = $1 AND status = $2',
      [id, 'waiting_user_input']
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Экземпляр не найден или не ожидает создания проекта' })
    }
    await runProcessFromProjectCreation(dbPool, Number(id), projectId)
    const updated = await dbPool.query('SELECT id, status, current_node_id FROM bp_process_instances WHERE id = $1', [id])
    res.json(updated.rows[0] || { success: true })
  } catch (err) {
    console.error('completeProjectCreation:', err)
    res.status(500).json({ error: 'Ошибка при завершении создания проекта' })
  }
}

async function respondDecision(dbPool, req, res) {
  try {
    const { id } = req.params
    const { node_id: nodeId, button_id: buttonId } = req.body
    if (!nodeId || !buttonId) {
      return res.status(400).json({ error: 'Не указаны node_id или button_id' })
    }
    const instResult = await dbPool.query(
      'SELECT id FROM bp_process_instances WHERE id = $1 AND status = $2',
      [id, 'waiting_decision']
    )
    if (instResult.rows.length === 0) {
      return res.status(404).json({ error: 'Экземпляр не найден или не ожидает решения' })
    }
    const userId = req.body.user_id ?? req.headers['x-user-id']
    if (!userId) {
      return res.status(400).json({ error: 'Не указан user_id (текущий пользователь)' })
    }
    const r = await dbPool.query(
      'SELECT id FROM bp_decision_requests WHERE instance_id = $1 AND node_id = $2 AND user_id = $3 AND responded_at IS NULL',
      [id, nodeId, userId]
    )
    if (r.rows.length === 0) {
      return res.status(403).json({ error: 'Запрос на решение не найден или уже обработан' })
    }
    await dbPool.query(
      'UPDATE bp_decision_requests SET selected_button_id = $1, responded_at = NOW() WHERE instance_id = $2 AND node_id = $3 AND user_id = $4',
      [buttonId, id, nodeId, userId]
    )
    await runProcessFromDecision(dbPool, Number(id), nodeId, buttonId)
    const updated = await dbPool.query('SELECT id, status, current_node_id FROM bp_process_instances WHERE id = $1', [id])
    res.json(updated.rows[0] || { success: true })
  } catch (err) {
    console.error('respondDecision:', err)
    res.status(500).json({ error: 'Ошибка при принятии решения' })
  }
}

async function respondAdditionalInfo(dbPool, req, res) {
  try {
    const { id } = req.params
    const instanceId = Number(id)
    const { node_id: nodeId, values, user_id: userIdRaw } = req.body || {}
    const userId = userIdRaw ?? req.headers['x-user-id']
    if (!instanceId) return res.status(400).json({ error: 'Некорректный id' })
    if (!nodeId) return res.status(400).json({ error: 'Не указан node_id' })
    if (!userId) return res.status(400).json({ error: 'Не указан user_id (текущий пользователь)' })

    const instResult = await dbPool.query(
      'SELECT id FROM bp_process_instances WHERE id = $1 AND status = $2',
      [instanceId, 'waiting_additional_info']
    )
    if (instResult.rows.length === 0) {
      return res.status(404).json({ error: 'Экземпляр не найден или не ожидает доп. информации' })
    }

    // проверяем, что запрос существует для пользователя и ещё не закрыт
    const r = await dbPool.query(
      'SELECT id FROM bp_additional_info_requests WHERE instance_id = $1 AND node_id = $2 AND user_id = $3 AND responded_at IS NULL',
      [instanceId, nodeId, userId]
    )
    if (r.rows.length === 0) {
      return res.status(403).json({ error: 'Запрос на доп. информацию не найден или уже обработан' })
    }

    // закрываем все запросы по этому узлу/экземпляру (чтобы не висели у других пользователей)
    try {
      await dbPool.query(
        'UPDATE bp_additional_info_requests SET responded_at = NOW(), responded_values = $1 WHERE instance_id = $2 AND node_id = $3 AND responded_at IS NULL',
        [JSON.stringify(values || {}), instanceId, nodeId]
      )
    } catch (e) {
      if (e?.code === '42P01') {
        return res.status(500).json({ error: 'Таблица bp_additional_info_requests не создана' })
      }
      throw e
    }

    await runProcessFromAdditionalInfo(dbPool, instanceId, nodeId, values || {})
    const updated = await dbPool.query('SELECT id, status, current_node_id FROM bp_process_instances WHERE id = $1', [instanceId])
    res.json(updated.rows[0] || { success: true })
  } catch (err) {
    console.error('respondAdditionalInfo:', err)
    res.status(500).json({ error: 'Ошибка при заполнении доп. информации' })
  }
}

async function cancelInstance(dbPool, req, res) {
  try {
    const { id } = req.params
    const result = await dbPool.query(
      `UPDATE bp_process_instances SET status = 'cancelled', finished_at = NOW() WHERE id = $1 AND status IN ('running', 'waiting_gateway', 'waiting_timer', 'waiting_user_input', 'waiting_decision', 'waiting_additional_info', 'waiting_join') RETURNING id`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Экземпляр не найден или уже завершён' })
    }
    await dbPool.query('DELETE FROM bp_gateway_waiting WHERE instance_id = $1', [id])
    try {
      await dbPool.query('DELETE FROM bp_gateway_project_waiting WHERE instance_id = $1', [id])
    } catch (e) {
      if (e?.code !== '42P01') throw e
    }
    try {
      await dbPool.query('UPDATE bp_decision_requests SET responded_at = NOW() WHERE instance_id = $1 AND responded_at IS NULL', [id])
    } catch (e) {
      if (e?.code !== '42P01') throw e
    }
    try {
      await dbPool.query('UPDATE bp_additional_info_requests SET responded_at = NOW() WHERE instance_id = $1 AND responded_at IS NULL', [id])
    } catch (e) {
      if (e?.code !== '42P01') throw e
    }
    try {
      await dbPool.query('DELETE FROM bp_gateway_join_waiting WHERE instance_id = $1', [id])
    } catch (e) {
      if (e?.code !== '42P01') throw e
    }
    await dbPool.query('DELETE FROM bp_timer_waiting WHERE instance_id = $1', [id])
    res.json({ success: true })
  } catch (err) {
    console.error('cancelInstance:', err)
    res.status(500).json({ error: 'Ошибка при отмене' })
  }
}

function safeParseContext(ctx) {
  if (!ctx) return {}
  if (typeof ctx === 'object') return ctx
  try {
    return JSON.parse(ctx)
  } catch (e) {
    return {}
  }
}

async function getInstancesOverview(dbPool, req, res) {
  try {
    const limitRaw = req.query.limit != null ? Number(req.query.limit) : 200
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, Math.round(limitRaw))) : 200

    const r = await dbPool.query(
      `SELECT
         i.id,
         i.process_id,
         i.started_at,
         i.finished_at,
         i.initiator_id,
         i.launched_by_user_id,
         i.current_node_id,
         i.status,
         i.context,
         i.error_message,
         gw.task_id AS waiting_task_id,
         tw.resume_at AS waiting_resume_at
       FROM bp_process_instances i
       LEFT JOIN bp_gateway_waiting gw ON gw.instance_id = i.id
       LEFT JOIN bp_timer_waiting tw ON tw.instance_id = i.id
       ORDER BY i.started_at DESC
       LIMIT $1`,
      [limit]
    )

    const rows = r.rows || []
    const processIds = Array.from(new Set(rows.map((x) => Number(x.process_id)).filter((x) => Number.isFinite(x))))
    let defsById = {}
    if (processIds.length) {
      const defs = await dbPool.query(
        'SELECT id, name, scheme FROM bp_process_definitions WHERE id = ANY($1::int[])',
        [processIds]
      )
      defsById = (defs.rows || []).reduce((acc, d) => {
        const scheme = typeof d.scheme === 'object' ? d.scheme : safeParseContext(d.scheme)
        const nodes = Array.isArray(scheme.nodes) ? scheme.nodes : []
        const nodesById = nodes.reduce((m, n) => {
          m[n.id] = n.label || n.type || n.id
          return m
        }, {})
        acc[d.id] = { id: d.id, name: d.name, nodesById }
        return acc
      }, {})
    }

    const out = rows.map((row) => {
      const ctx = safeParseContext(row.context)
      const def = defsById[row.process_id] || null
      const nodeId = row.current_node_id || null
      const nodeLabel = def && nodeId ? (def.nodesById[nodeId] || nodeId) : nodeId

      let waiting = null
      if (row.status === 'waiting_gateway') {
        const dbgAll = ctx.gateway_debug && typeof ctx.gateway_debug === 'object' ? ctx.gateway_debug : null
        const dbg = dbgAll && nodeId ? dbgAll[nodeId] : null
        waiting = {
          type: 'gateway',
          task_id: row.waiting_task_id || null,
          last_status: dbg && typeof dbg === 'object' ? (dbg.status_norm || null) : null,
          last_status_raw: dbg && typeof dbg === 'object' ? (dbg.status_raw || null) : null,
          last_checked_at: dbg && typeof dbg === 'object' ? (dbg.checked_at || null) : null,
          last_resume_reason: dbg && typeof dbg === 'object' ? (dbg.resume_reason || null) : null,
        }
      } else if (row.status === 'waiting_timer') {
        waiting = { type: 'timer', resume_at: row.waiting_resume_at || null }
      } else if (row.status === 'waiting_user_input') {
        const pending = ctx.pending_task_creation || null
        waiting = { type: 'user_input', node_id: pending?.nodeId || null }
      } else if (row.status === 'waiting_join') {
        waiting = { type: 'join', node_id: row.current_node_id || null }
      }

      return {
        id: row.id,
        process_id: row.process_id,
        process_name: def ? def.name : null,
        started_at: row.started_at,
        finished_at: row.finished_at,
        initiator_id: row.initiator_id,
        launched_by_user_id: row.launched_by_user_id,
        status: row.status,
        current_node_id: nodeId,
        current_node_label: nodeLabel,
        waiting,
        last_task_id: ctx.last_task_id || null,
        error_message: row.error_message || null,
      }
    })

    res.json(out)
  } catch (err) {
    console.error('getInstancesOverview:', err)
    res.status(500).json({ error: 'Ошибка при получении обзора экземпляров' })
  }
}

async function deleteInstance(dbPool, req, res) {
  try {
    const { id } = req.params
    const instId = Number(id)
    if (!instId) {
      return res.status(400).json({ error: 'Некорректный id' })
    }

    const r = await dbPool.query('SELECT id, status FROM bp_process_instances WHERE id = $1', [instId])
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Экземпляр не найден' })
    }
    const status = r.rows[0].status
    const isFinal = status === 'completed' || status === 'failed' || status === 'cancelled'
    if (!isFinal) {
      return res.status(400).json({ error: 'Экземпляр активен. Сначала отмените его, затем удалите.' })
    }

    await dbPool.query('DELETE FROM bp_process_instances WHERE id = $1', [instId])
    res.json({ success: true })
  } catch (err) {
    console.error('deleteInstance:', err)
    res.status(500).json({ error: 'Ошибка при удалении экземпляра' })
  }
}

module.exports = {
  startProcess,
  startProcessInternal,
  getInstances,
  getInstancesOverview,
  getInstanceById,
  cancelInstance,
  deleteInstance,
  completeTaskCreation,
  completeProjectCreation,
  respondDecision,
  respondAdditionalInfo,
}
