/**
 * Обращения к непосредственному руководителю (веб CRM / register :5000).
 * Та же таблица staff_manager_requests, что и у mobile BFF.
 */

const { notifyStaffDevicesSafe } = require('../staffMobilePush')

const TYPES = new Set(['question', 'proposal', 'escalation'])
const TYPE_LABELS = {
  question: 'Вопрос',
  proposal: 'Предложение',
  escalation: 'Эскалация',
}
const STATUS_LABELS = {
  open: 'Открыто',
  answered: 'Отвечено',
  closed: 'Закрыто',
  converted_to_task: 'Создана задача',
}

const mapRow = (row) => ({
  id: Number(row.id),
  fromUserId: Number(row.from_user_id),
  toUserId: Number(row.to_user_id),
  type: row.type,
  typeLabel: TYPE_LABELS[row.type] || row.type,
  title: row.title,
  body: row.body,
  status: row.status,
  statusLabel: STATUS_LABELS[row.status] || row.status,
  answerText: row.answer_text || null,
  answeredAt: row.answered_at || null,
  answeredBy: row.answered_by != null ? Number(row.answered_by) : null,
  relatedTaskId: row.related_task_id != null ? Number(row.related_task_id) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  fromUserName: row.from_user_name || null,
  toUserName: row.to_user_name || null,
})

const SELECT_BASE = `
  SELECT
    r.*,
    TRIM(CONCAT(COALESCE(fu.last_name, ''), ' ', COALESCE(fu.first_name, ''), ' ', COALESCE(fu.middle_name, ''))) AS from_user_name,
    TRIM(CONCAT(COALESCE(tu.last_name, ''), ' ', COALESCE(tu.first_name, ''), ' ', COALESCE(tu.middle_name, ''))) AS to_user_name
  FROM staff_manager_requests r
  LEFT JOIN users fu ON fu.id = r.from_user_id
  LEFT JOIN users tu ON tu.id = r.to_user_id
`

const resolveUserId = (req) => {
  const fromQuery = req.query?.userId != null ? Number(req.query.userId) : null
  const fromBody = req.body?.userId != null ? Number(req.body.userId) : null
  const id = fromBody || fromQuery
  return Number.isFinite(id) && id > 0 ? id : null
}

const tableMissing = (error) => error && error.code === '42P01'

const getMyManager = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })

    const { rows } = await dbPool.query(
      `
      SELECT
        u.id,
        u.first_name,
        u.middle_name,
        u.last_name,
        COALESCE(p.name, '') AS position_name
      FROM users me
      JOIN users u ON u.id = me.supervisor_id
      LEFT JOIN positions p ON p.id = u.position_id
      WHERE me.id = $1
      `,
      [userId]
    )
    if (!rows.length) return res.json({ manager: null })
    const m = rows[0]
    return res.json({
      manager: {
        id: Number(m.id),
        name: [m.last_name, m.first_name, m.middle_name].filter(Boolean).join(' '),
        positionName: m.position_name || '',
      },
    })
  } catch (error) {
    console.error('[manager-requests][manager]', error)
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица обращений не создана. Выполните миграцию add_staff_manager_requests.sql',
      })
    }
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const listMine = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const { rows } = await dbPool.query(
      `${SELECT_BASE} WHERE r.from_user_id = $1 ORDER BY r.created_at DESC LIMIT 200`,
      [userId]
    )
    return res.json({ requests: rows.map(mapRow) })
  } catch (error) {
    console.error('[manager-requests][mine]', error)
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица обращений не создана. Выполните миграцию add_staff_manager_requests.sql',
      })
    }
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const listInbox = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const status = String(req.query.status || 'open').trim()
    const params = [userId]
    let statusSql = ` AND r.status = 'open'`
    if (status === 'all') {
      statusSql = ''
    } else if (status && status !== 'open') {
      params.push(status)
      statusSql = ` AND r.status = $${params.length}`
    }
    const { rows } = await dbPool.query(
      `${SELECT_BASE}
       WHERE r.to_user_id = $1 ${statusSql}
       ORDER BY r.created_at DESC
       LIMIT 200`,
      params
    )
    return res.json({ requests: rows.map(mapRow) })
  } catch (error) {
    console.error('[manager-requests][inbox]', error)
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица обращений не создана. Выполните миграцию add_staff_manager_requests.sql',
      })
    }
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const getOne = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    const id = Number(req.params.id)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const { rows } = await dbPool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    if (!rows.length) return res.status(404).json({ error: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.from_user_id) !== userId && Number(row.to_user_id) !== userId) {
      return res.status(403).json({ error: 'Нет доступа к обращению' })
    }
    return res.json({ request: mapRow(row) })
  } catch (error) {
    console.error('[manager-requests][get]', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const createRequest = (dbPool) => async (req, res) => {
  try {
    const fromUserId = resolveUserId(req)
    const type = String(req.body?.type || '').trim()
    const title = String(req.body?.title || '').trim()
    const body = String(req.body?.body || '').trim()

    if (!fromUserId) return res.status(400).json({ error: 'Укажите userId' })
    if (!TYPES.has(type)) {
      return res.status(400).json({ error: 'Тип: question, proposal или escalation' })
    }
    if (!title) return res.status(400).json({ error: 'Укажите тему' })
    if (!body) return res.status(400).json({ error: 'Укажите текст обращения' })

    const mgr = await dbPool.query(`SELECT supervisor_id FROM users WHERE id = $1`, [
      fromUserId,
    ])
    const toUserId = mgr.rows[0]?.supervisor_id
    if (!toUserId) {
      return res.status(422).json({
        error: 'Непосредственный руководитель не назначен. Обратитесь в отдел кадров.',
      })
    }

    const inserted = await dbPool.query(
      `
      INSERT INTO staff_manager_requests (from_user_id, to_user_id, type, title, body, status)
      VALUES ($1, $2, $3, $4, $5, 'open')
      RETURNING id
      `,
      [fromUserId, toUserId, type, title, body]
    )
    const id = inserted.rows[0].id
    const full = await dbPool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    notifyStaffDevicesSafe(dbPool, {
      userIds: [Number(toUserId)],
      title: 'Новое обращение',
      body: `${TYPE_LABELS[type]}: ${title}`,
      data: { type: 'manager_request', requestId: id },
    })

    return res.status(201).json({ request: mapped })
  } catch (error) {
    console.error('[manager-requests][create]', error)
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица обращений не создана. Выполните миграцию add_staff_manager_requests.sql',
      })
    }
    return res.status(500).json({ error: error.message || 'Ошибка создания' })
  }
}

const answerRequest = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    const id = Number(req.params.id)
    const answerText = String(req.body?.answerText || req.body?.answer_text || '').trim()
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    if (!answerText) return res.status(400).json({ error: 'Укажите текст ответа' })

    const { rows } = await dbPool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [
      id,
    ])
    if (!rows.length) return res.status(404).json({ error: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.to_user_id) !== userId) {
      return res.status(403).json({ error: 'Отвечать может только адресат' })
    }
    if (row.status !== 'open' && row.status !== 'answered') {
      return res.status(422).json({ error: 'Обращение уже закрыто' })
    }

    await dbPool.query(
      `
      UPDATE staff_manager_requests
      SET answer_text = $1,
          answered_at = NOW(),
          answered_by = $2,
          status = 'answered',
          updated_at = NOW()
      WHERE id = $3
      `,
      [answerText, userId, id]
    )
    const full = await dbPool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    notifyStaffDevicesSafe(dbPool, {
      userIds: [Number(row.from_user_id)],
      title: 'Ответ на обращение',
      body: row.title,
      data: { type: 'manager_request', requestId: id },
    })

    return res.json({ request: mapped })
  } catch (error) {
    console.error('[manager-requests][answer]', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const closeRequest = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    const id = Number(req.params.id)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })

    const { rows } = await dbPool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [
      id,
    ])
    if (!rows.length) return res.status(404).json({ error: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.to_user_id) !== userId) {
      return res.status(403).json({ error: 'Закрыть может только адресат' })
    }

    await dbPool.query(
      `
      UPDATE staff_manager_requests
      SET status = 'closed', updated_at = NOW()
      WHERE id = $1
      `,
      [id]
    )
    const full = await dbPool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    notifyStaffDevicesSafe(dbPool, {
      userIds: [Number(row.from_user_id)],
      title: 'Обращение закрыто',
      body: row.title,
      data: { type: 'manager_request', requestId: id },
    })

    return res.json({ request: mapped })
  } catch (error) {
    console.error('[manager-requests][close]', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const markConverted = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    const id = Number(req.params.id)
    const relatedTaskId = Number(req.body?.relatedTaskId || req.body?.related_task_id)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    if (!Number.isFinite(relatedTaskId) || relatedTaskId <= 0) {
      return res.status(400).json({ error: 'Укажите relatedTaskId' })
    }

    const { rows } = await dbPool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [
      id,
    ])
    if (!rows.length) return res.status(404).json({ error: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.to_user_id) !== userId) {
      return res.status(403).json({ error: 'Только адресат может создать задачу из обращения' })
    }

    await dbPool.query(
      `
      UPDATE staff_manager_requests
      SET status = 'converted_to_task',
          related_task_id = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [relatedTaskId, id]
    )
    const full = await dbPool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    notifyStaffDevicesSafe(dbPool, {
      userIds: [Number(row.from_user_id)],
      title: 'По обращению создана задача',
      body: row.title,
      data: { type: 'manager_request', requestId: id, taskId: relatedTaskId },
    })

    return res.json({ request: mapped })
  } catch (error) {
    console.error('[manager-requests][convert]', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

module.exports = {
  getMyManager,
  listMine,
  listInbox,
  getOne,
  createRequest,
  answerRequest,
  closeRequest,
  markConverted,
}
