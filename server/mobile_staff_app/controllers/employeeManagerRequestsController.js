/**
 * Обращения к Директору (mobile BFF).
 * Адресат всегда роль «Директор»; доступ — директор / админ / прямые подчинённые директора.
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
const DIRECTOR_ROLE = 'Директор'
const ADMIN_ROLE = 'Администратор'
const ACTIVE_STATUSES = new Set(['open', 'answered'])

const mapRow = (row) => {
  const relatedTaskId = row.related_task_id != null ? Number(row.related_task_id) : null
  let statusLabel = STATUS_LABELS[row.status] || row.status
  if (relatedTaskId && row.status !== 'converted_to_task') {
    statusLabel = `${statusLabel} · есть задача`
  }
  return {
    id: Number(row.id),
    fromUserId: Number(row.from_user_id),
    toUserId: Number(row.to_user_id),
    type: row.type,
    typeLabel: TYPE_LABELS[row.type] || row.type,
    title: row.title,
    body: row.body,
    status: row.status,
    statusLabel,
    answerText: row.answer_text || null,
    answeredAt: row.answered_at || null,
    answeredBy: row.answered_by != null ? Number(row.answered_by) : null,
    relatedTaskId,
    relatedTaskTitle: row.related_task_title || null,
    authorHasUnread: Boolean(row.author_has_unread),
    recipientHasUnread: Boolean(row.recipient_has_unread),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fromUserName: row.from_user_name || null,
    toUserName: row.to_user_name || null,
  }
}

const mapMessage = (row) => ({
  id: Number(row.id),
  requestId: Number(row.request_id),
  authorId: Number(row.author_id),
  authorName: row.author_name || null,
  body: row.body,
  createdAt: row.created_at,
})

const SELECT_BASE = `
  SELECT
    r.*,
    TRIM(CONCAT(COALESCE(fu.last_name, ''), ' ', COALESCE(fu.first_name, ''), ' ', COALESCE(fu.middle_name, ''))) AS from_user_name,
    TRIM(CONCAT(COALESCE(tu.last_name, ''), ' ', COALESCE(tu.first_name, ''), ' ', COALESCE(tu.middle_name, ''))) AS to_user_name,
    t.title AS related_task_title
  FROM staff_manager_requests r
  LEFT JOIN users fu ON fu.id = r.from_user_id
  LEFT JOIN users tu ON tu.id = r.to_user_id
  LEFT JOIN tasks t ON t.id = r.related_task_id
`

const tableMissing = (error) => error && error.code === '42P01'

const findDirector = async (pool) => {
  const { rows } = await pool.query(
    `
    SELECT
      u.id,
      u.first_name,
      u.middle_name,
      u.last_name,
      COALESCE(p.name, '') AS position_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN positions p ON p.id = u.position_id
    WHERE r.name = $1
    ORDER BY u.id ASC
    LIMIT 1
    `,
    [DIRECTOR_ROLE]
  )
  if (!rows.length) return null
  const m = rows[0]
  return {
    id: Number(m.id),
    name: [m.last_name, m.first_name, m.middle_name].filter(Boolean).join(' '),
    positionName: m.position_name || '',
  }
}

const getUserMeta = async (pool, userId) => {
  const { rows } = await pool.query(
    `
    SELECT u.id, u.supervisor_id, r.name AS role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = $1
    `,
    [userId]
  )
  return rows[0] || null
}

const buildAccess = (userMeta, director) => {
  const roleName = userMeta?.role_name || ''
  const isAdmin = roleName === ADMIN_ROLE
  const isDirector = roleName === DIRECTOR_ROLE || (director && Number(userMeta?.id) === director.id)
  const isDirectReport =
    director && userMeta?.supervisor_id != null && Number(userMeta.supervisor_id) === director.id
  return {
    canAccess: Boolean(isAdmin || isDirector || isDirectReport),
    canCreate: Boolean((isAdmin || isDirectReport) && director && Number(userMeta?.id) !== director.id),
    isDirector: Boolean(isDirector),
    isAdmin,
    isDirectReport: Boolean(isDirectReport),
  }
}

const insertCrmNotification = async (pool, { userId, requestId, eventType, message }) => {
  try {
    await pool.query(
      `
      INSERT INTO notifications (user_id, task_id, message, event_type, is_read, is_sent)
      VALUES ($1, NULL, $2, $3, false, false)
      `,
      [userId, `[[mr:${requestId}]]${message}`, eventType]
    )
  } catch (err) {
    console.warn('[mobile_staff_app][manager-requests][crm-notify]', err.message || err)
  }
}

const notifyBoth = async (pool, { userIds, title, body, requestId, eventType }) => {
  const ids = [...new Set((userIds || []).map(Number).filter((id) => id > 0))]
  if (!ids.length) return
  safeNotify(pool, {
    userIds: ids,
    title,
    body,
    data: { type: 'manager_request', requestId, eventType },
  })
  await Promise.all(
    ids.map((uid) =>
      insertCrmNotification(pool, { userId: uid, requestId, eventType, message: body })
    )
  )
}

const clearUnreadForViewer = async (pool, row, userId) => {
  if (Number(row.from_user_id) === userId && row.author_has_unread) {
    await pool.query(
      `UPDATE staff_manager_requests SET author_has_unread = FALSE, updated_at = NOW() WHERE id = $1`,
      [row.id]
    )
  }
  if (Number(row.to_user_id) === userId && row.recipient_has_unread) {
    await pool.query(
      `UPDATE staff_manager_requests SET recipient_has_unread = FALSE, updated_at = NOW() WHERE id = $1`,
      [row.id]
    )
  }
}

const getMyManager = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const director = await findDirector(pool)
    const userMeta = await getUserMeta(pool, userId)
    const access = buildAccess(userMeta, director)
    if (!director) {
      return res.json({ manager: null, access })
    }
    return res.json({
      manager: {
        id: director.id,
        name: director.name,
        positionName: director.positionName,
        isDirector: true,
      },
      access,
    })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][manager]', error)
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

const listMine = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const status = String(req.query.status || 'all').trim()
    const params = [userId]
    let statusSql = ''
    if (status === 'active' || status === 'open') {
      statusSql = ` AND r.status IN ('open', 'answered')`
    } else if (status === 'closed' || status === 'closed_group') {
      statusSql = ` AND r.status IN ('closed', 'converted_to_task')`
    } else if (status && status !== 'all') {
      params.push(status)
      statusSql = ` AND r.status = $${params.length}`
    }
    const { rows } = await pool.query(
      `${SELECT_BASE}
       WHERE r.from_user_id = $1 ${statusSql}
       ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
       LIMIT 200`,
      params
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
    const status = String(req.query.status || 'active').trim()
    const params = [userId]
    let statusSql = ` AND r.status IN ('open', 'answered')`
    if (status === 'all') {
      statusSql = ''
    } else if (status === 'active' || status === 'open') {
      statusSql = ` AND r.status IN ('open', 'answered')`
    } else if (status === 'closed' || status === 'closed_group') {
      statusSql = ` AND r.status IN ('closed', 'converted_to_task')`
    } else if (status) {
      params.push(status)
      statusSql = ` AND r.status = $${params.length}`
    }
    const { rows } = await pool.query(
      `${SELECT_BASE}
       WHERE r.to_user_id = $1 ${statusSql}
       ORDER BY
         CASE WHEN r.status = 'open' THEN 0 WHEN r.status = 'answered' THEN 1 ELSE 2 END,
         r.updated_at DESC NULLS LAST,
         r.created_at DESC
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

    const director = await findDirector(pool)
    if (!director) {
      return res.status(422).json({ message: 'В системе не найден пользователь с ролью «Директор»' })
    }
    const userMeta = await getUserMeta(pool, fromUserId)
    const access = buildAccess(userMeta, director)
    if (!access.canCreate) {
      return res.status(403).json({
        message:
          'Создавать обращения могут сотрудники, у которых прямой руководитель — Директор',
      })
    }

    const inserted = await pool.query(
      `
      INSERT INTO staff_manager_requests (
        from_user_id, to_user_id, type, title, body, status,
        author_has_unread, recipient_has_unread
      )
      VALUES ($1, $2, $3, $4, $5, 'open', FALSE, TRUE)
      RETURNING id
      `,
      [fromUserId, director.id, type, title, body]
    )
    const id = inserted.rows[0].id
    const full = await pool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    await notifyBoth(pool, {
      userIds: [director.id],
      title: 'Новое обращение',
      body: `${TYPE_LABELS[type]}: ${title}`,
      requestId: id,
      eventType: 'manager_request_new',
    })

    return res.status(201).json({ request: mapped })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][create]', error)
    if (tableMissing(error)) {
      return res.status(503).json({
        message:
          'Таблица обращений ещё не создана. Выполните миграции add_staff_manager_requests.sql и enhance_staff_manager_requests_v2.sql',
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
    await clearUnreadForViewer(pool, row, userId)
    const refreshed = await pool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    return res.json({ request: mapRow(refreshed.rows[0] || row) })
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
      return res.status(403).json({ message: 'Отвечать может только адресат (Директор)' })
    }
    if (!ACTIVE_STATUSES.has(row.status)) {
      return res.status(422).json({ message: 'Обращение уже закрыто' })
    }

    await pool.query(
      `
      UPDATE staff_manager_requests
      SET answer_text = $1,
          answered_at = NOW(),
          answered_by = $2,
          status = 'answered',
          author_has_unread = TRUE,
          recipient_has_unread = FALSE,
          updated_at = NOW()
      WHERE id = $3
      `,
      [answerText, userId, id]
    )

    const full = await pool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    await notifyBoth(pool, {
      userIds: [Number(row.from_user_id)],
      title: 'Ответ на обращение',
      body: `Директор ответил на «${row.title}»`,
      requestId: id,
      eventType: 'manager_request_answered',
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
      return res.status(403).json({ message: 'Закрыть может только адресат (Директор)' })
    }

    await pool.query(
      `
      UPDATE staff_manager_requests
      SET status = 'closed',
          author_has_unread = TRUE,
          recipient_has_unread = FALSE,
          updated_at = NOW()
      WHERE id = $1
      `,
      [id]
    )
    const full = await pool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    await notifyBoth(pool, {
      userIds: [Number(row.from_user_id)],
      title: 'Обращение закрыто',
      body: `Обращение «${row.title}» закрыто директором`,
      requestId: id,
      eventType: 'manager_request_closed',
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
      return res.status(403).json({ message: 'Только адресат может связать задачу с обращением' })
    }
    if (!ACTIVE_STATUSES.has(row.status) && row.status !== 'converted_to_task') {
      return res.status(422).json({ message: 'Нельзя связать задачу с закрытым обращением' })
    }

    await pool.query(
      `
      UPDATE staff_manager_requests
      SET related_task_id = $1,
          author_has_unread = TRUE,
          updated_at = NOW()
      WHERE id = $2
      `,
      [relatedTaskId, id]
    )
    const full = await pool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    await notifyBoth(pool, {
      userIds: [Number(row.from_user_id)],
      title: 'По обращению создана задача',
      body: `По «${row.title}» создана задача №${relatedTaskId}. Обращение остаётся открытым до закрытия директором.`,
      requestId: id,
      eventType: 'manager_request_task_linked',
    })

    return res.json({ request: mapped })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][convert]', error)
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

const listMessages = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const { rows } = await pool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ message: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.from_user_id) !== userId && Number(row.to_user_id) !== userId) {
      return res.status(403).json({ message: 'Нет доступа к обращению' })
    }

    const messages = await pool.query(
      `
      SELECT
        m.*,
        TRIM(CONCAT(COALESCE(u.last_name, ''), ' ', COALESCE(u.first_name, ''), ' ', COALESCE(u.middle_name, ''))) AS author_name
      FROM staff_manager_request_messages m
      LEFT JOIN users u ON u.id = m.author_id
      WHERE m.request_id = $1
      ORDER BY m.id ASC
      `,
      [id]
    )
    return res.json({ messages: messages.rows.map(mapMessage) })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][messages][list]', error)
    if (tableMissing(error)) {
      return res.status(503).json({
        message: 'Выполните миграцию enhance_staff_manager_requests_v2.sql',
      })
    }
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

const postMessage = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const id = Number(req.params.id)
    const body = String(req.body?.body || req.body?.text || '').trim()
    if (!body) return res.status(400).json({ message: 'Введите сообщение' })

    const { rows } = await pool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ message: 'Обращение не найдено' })
    const row = rows[0]
    const isAuthor = Number(row.from_user_id) === userId
    const isRecipient = Number(row.to_user_id) === userId
    if (!isAuthor && !isRecipient) {
      return res.status(403).json({ message: 'Нет доступа к обращению' })
    }
    if (!ACTIVE_STATUSES.has(row.status)) {
      return res.status(422).json({ message: 'Чат доступен только для открытых / отвеченных обращений' })
    }

    const inserted = await pool.query(
      `
      INSERT INTO staff_manager_request_messages (request_id, author_id, body)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [id, userId, body]
    )

    if (isAuthor) {
      await pool.query(
        `UPDATE staff_manager_requests SET recipient_has_unread = TRUE, updated_at = NOW() WHERE id = $1`,
        [id]
      )
    } else {
      await pool.query(
        `UPDATE staff_manager_requests SET author_has_unread = TRUE, updated_at = NOW() WHERE id = $1`,
        [id]
      )
    }

    const msgRows = await pool.query(
      `
      SELECT
        m.*,
        TRIM(CONCAT(COALESCE(u.last_name, ''), ' ', COALESCE(u.first_name, ''), ' ', COALESCE(u.middle_name, ''))) AS author_name
      FROM staff_manager_request_messages m
      LEFT JOIN users u ON u.id = m.author_id
      WHERE m.id = $1
      `,
      [inserted.rows[0].id]
    )
    const message = mapMessage(msgRows.rows[0])

    const notifyUserId = isAuthor ? Number(row.to_user_id) : Number(row.from_user_id)
    const preview = `Уточнение по «${row.title}»: ${body.slice(0, 120)}`
    await notifyBoth(pool, {
      userIds: [notifyUserId],
      title: 'Сообщение по обращению',
      body: preview,
      requestId: id,
      eventType: 'manager_request_chat',
    })

    try {
      const io = req.app?.get?.('io')
      if (io) {
        io.to(String(notifyUserId)).emit('managerRequestChat', {
          requestId: id,
          notifyUserId,
          userIds: [notifyUserId],
          fromUserId: userId,
          title: row.title,
          preview,
          message,
        })
        io.to(String(notifyUserId)).emit('notification', {
          type: 'manager_request_chat',
          userId: notifyUserId,
          requestId: id,
          message: preview,
          title: row.title,
        })
      }
    } catch (socketErr) {
      console.warn('[mobile_staff_app][manager-requests][socket]', socketErr.message || socketErr)
    }

    try {
      const { registerFetch } = require('../services/registerClient')
      await registerFetch('/api/manager-requests/broadcast-chat', {
        method: 'POST',
        body: {
          requestId: id,
          notifyUserId,
          fromUserId: userId,
          title: row.title,
          preview,
          message,
        },
      })
    } catch (broadcastErr) {
      console.warn(
        '[mobile_staff_app][manager-requests][broadcast]',
        broadcastErr.message || broadcastErr
      )
    }

    return res.status(201).json({ message })
  } catch (error) {
    console.error('[mobile_staff_app][manager-requests][messages][post]', error)
    if (tableMissing(error)) {
      return res.status(503).json({
        message: 'Выполните миграцию enhance_staff_manager_requests_v2.sql',
      })
    }
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
  listMessages,
  postMessage,
  TYPE_LABELS,
}
