let missingTableWarned = false

async function getNotifications(dbPool, req, res) {
  try {
    const { user_id } = req.query
    const userId = user_id ? Number(user_id) : null
    if (!userId) {
      return res.status(400).json({ error: 'Не указан user_id' })
    }
    const result = await dbPool.query(
      `SELECT id, user_id, title, message, process_instance_id, node_id, created_at
       FROM bp_in_app_notifications
       WHERE user_id = $1 AND is_read = false
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    )
    res.json(result.rows || [])
  } catch (err) {
    // Если таблица ещё не создана в БД (ручные SQL), не ломаем приложение и не спамим логами.
    if (err && err.code === '42P01') {
      if (!missingTableWarned) {
        missingTableWarned = true
        console.warn('getNotifications: таблица bp_in_app_notifications не создана. Выполните SQL из docs/BPE_DB_MANUAL_SCRIPTS.md (п.9).')
      }
      return res.json([])
    }
    console.error('getNotifications:', err)
    res.status(500).json({ error: 'Ошибка при получении уведомлений' })
  }
}

let missingDecisionTableWarned = false

async function getDecisionRequests(dbPool, req, res) {
  try {
    const { user_id } = req.query
    const userId = user_id ? Number(user_id) : null
    if (!userId) {
      return res.status(400).json({ error: 'Не указан user_id' })
    }
    const result = await dbPool.query(
      `SELECT id, instance_id, node_id, user_id, process_name, message, buttons, initiator_name, created_at
       FROM bp_decision_requests
       WHERE user_id = $1 AND responded_at IS NULL
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    )
    res.json(result.rows || [])
  } catch (err) {
    if (err && err.code === '42P01') {
      if (!missingDecisionTableWarned) {
        missingDecisionTableWarned = true
        console.warn('getDecisionRequests: таблица bp_decision_requests не создана. Выполните SQL из docs/BPE_DB_MANUAL_SCRIPTS.md (п.10).')
      }
      return res.json([])
    }
    console.error('getDecisionRequests:', err)
    res.status(500).json({ error: 'Ошибка при получении запросов на решение' })
  }
}

let missingAdditionalInfoTableWarned = false

async function getAdditionalInfoRequests(dbPool, req, res) {
  try {
    const { user_id } = req.query
    const userId = user_id ? Number(user_id) : null
    if (!userId) {
      return res.status(400).json({ error: 'Не указан user_id' })
    }
    const result = await dbPool.query(
      `SELECT id, instance_id, node_id, user_id, process_name, prompt_text, required_keys, initiator_name, created_at
       FROM bp_additional_info_requests
       WHERE user_id = $1 AND responded_at IS NULL
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    )
    res.json(result.rows || [])
  } catch (err) {
    if (err && err.code === '42P01') {
      if (!missingAdditionalInfoTableWarned) {
        missingAdditionalInfoTableWarned = true
        console.warn('getAdditionalInfoRequests: таблица bp_additional_info_requests не создана. Выполните SQL из docs/BPE_DB_MANUAL_SCRIPTS.md (п.11).')
      }
      return res.json([])
    }
    console.error('getAdditionalInfoRequests:', err)
    res.status(500).json({ error: 'Ошибка при получении запросов доп. информации' })
  }
}

async function markRead(dbPool, req, res) {
  try {
    const { id } = req.params
    const notifId = Number(id)
    if (!notifId) {
      return res.status(400).json({ error: 'Некорректный id' })
    }
    await dbPool.query('UPDATE bp_in_app_notifications SET is_read = true WHERE id = $1', [notifId])
    res.json({ success: true })
  } catch (err) {
    if (err && err.code === '42P01') {
      return res.json({ success: true })
    }
    console.error('markRead:', err)
    res.status(500).json({ error: 'Ошибка при отметке прочитанным' })
  }
}

module.exports = {
  getNotifications,
  markRead,
  getDecisionRequests,
  getAdditionalInfoRequests,
}

