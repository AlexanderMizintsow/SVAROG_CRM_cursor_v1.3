const { runProcessFromStart } = require('../engine/runner')

async function startProcess(dbPool, req, res) {
  try {
    const processId = req.params.id
    const { initiator_id, launched_by_user_id } = req.body
    const defResult = await dbPool.query(
      'SELECT id, name, scheme FROM bp_process_definitions WHERE id = $1 AND is_draft = false',
      [processId]
    )
    if (defResult.rows.length === 0) {
      return res.status(404).json({ error: 'Процесс не найден или не опубликован' })
    }
    const definition = defResult.rows[0]
    const scheme = typeof definition.scheme === 'object' ? definition.scheme : JSON.parse(definition.scheme)
    const startNode = (scheme.nodes || []).find((n) => n.type === 'start')
    if (!startNode) {
      return res.status(400).json({ error: 'В схеме нет узла Старт' })
    }
    let initiatorId = initiator_id || launched_by_user_id
    if (!initiatorId && startNode.settings) {
      if (startNode.settings.initiatorType === 'fixed_user' && startNode.settings.fixedUserId) {
        initiatorId = startNode.settings.fixedUserId
      } else {
        initiatorId = launched_by_user_id
      }
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
        JSON.stringify({ initiator_id: initiatorId || null }),
      ]
    )
    const instance = instResult.rows[0]
    res.status(201).json(instance)
    runProcessFromStart(dbPool, instance.id).catch((err) => {
      console.error('runProcessFromStart error:', err)
    })
  } catch (err) {
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

async function cancelInstance(dbPool, req, res) {
  try {
    const { id } = req.params
    const result = await dbPool.query(
      `UPDATE bp_process_instances SET status = 'cancelled', finished_at = NOW() WHERE id = $1 AND status IN ('running', 'waiting_gateway', 'waiting_timer') RETURNING id`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Экземпляр не найден или уже завершён' })
    }
    await dbPool.query('DELETE FROM bp_gateway_waiting WHERE instance_id = $1', [id])
    await dbPool.query('DELETE FROM bp_timer_waiting WHERE instance_id = $1', [id])
    res.json({ success: true })
  } catch (err) {
    console.error('cancelInstance:', err)
    res.status(500).json({ error: 'Ошибка при отмене' })
  }
}

module.exports = {
  startProcess,
  getInstances,
  getInstanceById,
  cancelInstance,
}
