/**
 * Обращения к непосредственному руководителю.
 */

const { safeNotify } = require('../services/staffNotifyHelpers')

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

const getMyManager = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const { rows } = await pool.query(
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
    if (!rows.length) {
      return res.json({ manager: null })
    }
    const m = rows[0]
    return res.json({
      manager: {
        id: Number(m.id),
        name: [m.last_name, m.first_name, m.middle_name].filter(Boolean).join(' '),
        positionName: m.position_name || '',
      },
    })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][manager]', error)
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

const listMine = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const { rows } = await pool.query(
      `${SELECT_BASE} WHERE r.from_user_id = $1 ORDER BY r.created_at DESC LIMIT 200`,
      [userId]
    )
    return res.json({ requests: rows.map(mapRow) })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][mine]', error)
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

const listInbox = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const status = String(req.query.status || 'open').trim()
    const params = [userId]
    let statusSql = ` AND r.status = 'open'`
    if (status === 'all') {
      statusSql = ''
    } else if (status && status !== 'open') {
      params.push(status)
      statusSql = ` AND r.status = $${params.length}`
    }
    const { rows } = await pool.query(
      `${SELECT_BASE}
       WHERE r.to_user_id = $1 ${statusSql}
       ORDER BY r.created_at DESC
       LIMIT 200`,
      params
    )
    return res.json({ requests: rows.map(mapRow) })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][inbox]', error)
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

const createRequest = (pool) => async (req, res) => {
  try {
    const fromUserId = Number(req.user.userId)
    const type = String(req.body?.type || '').trim()
    const title = String(req.body?.title || '').trim()
    const body = String(req.body?.body || '').trim()

    if (!TYPES.has(type)) {
      return res.status(400).json({ message: 'Тип: question, proposal или escalation' })
    }
    if (!title) return res.status(400).json({ message: 'Укажите тему' })
    if (!body) return res.status(400).json({ message: 'Укажите текст обращения' })

    const mgr = await pool.query(`SELECT supervisor_id FROM users WHERE id = $1`, [fromUserId])
    const toUserId = mgr.rows[0]?.supervisor_id
    if (!toUserId) {
      return res.status(422).json({
        message: 'Непосредственный руководитель не назначен. Обратитесь в отдел кадров.',
      })
    }

    const inserted = await pool.query(
      `
      INSERT INTO staff_manager_requests (from_user_id, to_user_id, type, title, body, status)
      VALUES ($1, $2, $3, $4, $5, 'open')
      RETURNING id
      `,
      [fromUserId, toUserId, type, title, body]
    )
    const id = inserted.rows[0].id
    const full = await pool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    safeNotify(pool, {
      userIds: [Number(toUserId)],
      title: 'Новое обращение',
      body: `${TYPE_LABELS[type]}: ${title}`,
      data: { type: 'manager_request', requestId: id },
    })

    return res.status(201).json({ request: mapped })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][create]', error)
    if (error.code === '42P01') {
      return res.status(503).json({
        message:
          'Таблица обращений ещё не создана. Выполните миграцию add_staff_manager_requests.sql',
      })
    }
    return res.status(500).json({ message: error.message || 'Ошибка создания' })
  }
}

const getOne = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const { rows } = await pool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    if (!rows.length) return res.status(404).json({ message: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.from_user_id) !== userId && Number(row.to_user_id) !== userId) {
      return res.status(403).json({ message: 'Нет доступа к обращению' })
    }
    return res.json({ request: mapRow(row) })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][get]', error)
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

const answerRequest = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const answerText = String(req.body?.answerText || req.body?.answer_text || '').trim()
    if (!answerText) return res.status(400).json({ message: 'Укажите текст ответа' })

    const { rows } = await pool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ message: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.to_user_id) !== userId) {
      return res.status(403).json({ message: 'Отвечать может только адресат' })
    }
    if (row.status !== 'open' && row.status !== 'answered') {
      return res.status(422).json({ message: 'Обращение уже закрыто' })
    }

    await pool.query(
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
    const full = await pool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    safeNotify(pool, {
      userIds: [Number(row.from_user_id)],
      title: 'Ответ на обращение',
      body: row.title,
      data: { type: 'manager_request', requestId: id },
    })

    return res.json({ request: mapped })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][answer]', error)
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

const closeRequest = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const { rows } = await pool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ message: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.to_user_id) !== userId) {
      return res.status(403).json({ message: 'Закрыть может только адресат' })
    }

    await pool.query(
      `
      UPDATE staff_manager_requests
      SET status = 'closed', updated_at = NOW()
      WHERE id = $1
      `,
      [id]
    )
    const full = await pool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    safeNotify(pool, {
      userIds: [Number(row.from_user_id)],
      title: 'Обращение закрыто',
      body: row.title,
      data: { type: 'manager_request', requestId: id },
    })

    return res.json({ request: mapped })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][close]', error)
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

const markConverted = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const relatedTaskId = Number(req.body?.relatedTaskId || req.body?.related_task_id)
    if (!Number.isFinite(relatedTaskId) || relatedTaskId <= 0) {
      return res.status(400).json({ message: 'Укажите relatedTaskId' })
    }

    const { rows } = await pool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ message: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.to_user_id) !== userId) {
      return res.status(403).json({ message: 'Только адресат может создать задачу из обращения' })
    }

    await pool.query(
      `
      UPDATE staff_manager_requests
      SET status = 'converted_to_task',
          related_task_id = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [relatedTaskId, id]
    )
    const full = await pool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    safeNotify(pool, {
      userIds: [Number(row.from_user_id)],
      title: 'По обращению создана задача',
      body: row.title,
      data: { type: 'manager_request', requestId: id, taskId: relatedTaskId },
    })

    return res.json({ request: mapped })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][convert]', error)
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

module.exports = {
  getMyManager,
  listMine,
  listInbox,
  createRequest,
  getOne,
  answerRequest,
  closeRequest,
  markConverted,
  TYPE_LABELS,
}
