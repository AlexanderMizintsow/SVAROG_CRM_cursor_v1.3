/**
 * Обращения к Директору (веб CRM / register :5000).
 * Адресат всегда пользователь с ролью «Директор».
 * Доступ: Директор, Администратор, сотрудники с supervisor_id = Директор.
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

const resolveUserId = (req) => {
  const fromQuery = req.query?.userId != null ? Number(req.query.userId) : null
  const fromBody = req.body?.userId != null ? Number(req.body.userId) : null
  const id = fromBody || fromQuery
  return Number.isFinite(id) && id > 0 ? id : null
}

const tableMissing = (error) => error && error.code === '42P01'

const findDirector = async (dbPool) => {
  const { rows } = await dbPool.query(
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

const getUserMeta = async (dbPool, userId) => {
  const { rows } = await dbPool.query(
    `
    SELECT
      u.id,
      u.supervisor_id,
      r.name AS role_name
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
  const canAccess = Boolean(isAdmin || isDirector || isDirectReport)
  const canCreate = Boolean((isAdmin || isDirectReport) && director && Number(userMeta?.id) !== director.id)
  return {
    canAccess,
    canCreate,
    isDirector: Boolean(isDirector),
    isAdmin,
    isDirectReport: Boolean(isDirectReport),
  }
}

const insertCrmNotification = async (dbPool, { userId, requestId, eventType, message }) => {
  try {
    await dbPool.query(
      `
      INSERT INTO notifications (user_id, task_id, message, event_type, is_read, is_sent)
      VALUES ($1, NULL, $2, $3, false, false)
      `,
      [userId, `[[mr:${requestId}]]${message}`, eventType]
    )
  } catch (err) {
    console.warn('[manager-requests][crm-notify]', err.message || err)
  }
}

const notifyBoth = async (dbPool, { userIds, title, body, requestId, eventType }) => {
  const ids = [...new Set((userIds || []).map(Number).filter((id) => id > 0))]
  if (!ids.length) return
  notifyStaffDevicesSafe(dbPool, {
    userIds: ids,
    title,
    body,
    data: { type: 'manager_request', requestId, eventType },
  })
  await Promise.all(
    ids.map((uid) =>
      insertCrmNotification(dbPool, {
        userId: uid,
        requestId,
        eventType,
        message: body,
      })
    )
  )
}

const clearUnreadForViewer = async (dbPool, row, userId) => {
  if (Number(row.from_user_id) === userId && row.author_has_unread) {
    await dbPool.query(
      `UPDATE staff_manager_requests SET author_has_unread = FALSE, updated_at = NOW() WHERE id = $1`,
      [row.id]
    )
  }
  if (Number(row.to_user_id) === userId && row.recipient_has_unread) {
    await dbPool.query(
      `UPDATE staff_manager_requests SET recipient_has_unread = FALSE, updated_at = NOW() WHERE id = $1`,
      [row.id]
    )
  }
}

const getMyManager = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })

    const director = await findDirector(dbPool)
    const userMeta = await getUserMeta(dbPool, userId)
    const access = buildAccess(userMeta, director)

    if (!director) {
      return res.json({
        manager: null,
        access,
        errorHint: 'В системе не найден пользователь с ролью «Директор»',
      })
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
    const { rows } = await dbPool.query(
      `${SELECT_BASE}
       WHERE r.from_user_id = $1 ${statusSql}
       ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
       LIMIT 200`,
      params
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
    const { rows } = await dbPool.query(
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
    await clearUnreadForViewer(dbPool, row, userId)
    const refreshed = await dbPool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    return res.json({ request: mapRow(refreshed.rows[0] || row) })
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

    const director = await findDirector(dbPool)
    if (!director) {
      return res.status(422).json({
        error: 'В системе не найден пользователь с ролью «Директор»',
      })
    }
    const userMeta = await getUserMeta(dbPool, fromUserId)
    const access = buildAccess(userMeta, director)
    if (!access.canCreate) {
      return res.status(403).json({
        error:
          'Создавать обращения могут сотрудники, у которых прямой руководитель — Директор (и администратор)',
      })
    }

    const toUserId = director.id
    const inserted = await dbPool.query(
      `
      INSERT INTO staff_manager_requests (
        from_user_id, to_user_id, type, title, body, status,
        author_has_unread, recipient_has_unread
      )
      VALUES ($1, $2, $3, $4, $5, 'open', FALSE, TRUE)
      RETURNING id
      `,
      [fromUserId, toUserId, type, title, body]
    )
    const id = inserted.rows[0].id
    const full = await dbPool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    await notifyBoth(dbPool, {
      userIds: [toUserId],
      title: 'Новое обращение',
      body: `${TYPE_LABELS[type]}: ${title}`,
      requestId: id,
      eventType: 'manager_request_new',
    })

    return res.status(201).json({ request: mapped })
  } catch (error) {
    console.error('[manager-requests][create]', error)
    if (tableMissing(error)) {
      return res.status(503).json({
        error:
          'Таблица обращений не создана. Выполните миграции add_staff_manager_requests.sql и enhance_staff_manager_requests_v2.sql',
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

    const { rows } = await dbPool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ error: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.to_user_id) !== userId) {
      return res.status(403).json({ error: 'Отвечать может только адресат (Директор)' })
    }
    if (!ACTIVE_STATUSES.has(row.status)) {
      return res.status(422).json({ error: 'Обращение уже закрыто' })
    }

    await dbPool.query(
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

    // Официальный ответ хранится в answer_text; в чат не дублируем (иначе ломается хронология)

    const full = await dbPool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    await notifyBoth(dbPool, {
      userIds: [Number(row.from_user_id)],
      title: 'Ответ на обращение',
      body: `Директор ответил на «${row.title}»`,
      requestId: id,
      eventType: 'manager_request_answered',
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

    const { rows } = await dbPool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ error: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.to_user_id) !== userId) {
      return res.status(403).json({ error: 'Закрыть может только адресат (Директор)' })
    }

    await dbPool.query(
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
    const full = await dbPool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    await notifyBoth(dbPool, {
      userIds: [Number(row.from_user_id)],
      title: 'Обращение закрыто',
      body: `Обращение «${row.title}» закрыто директором`,
      requestId: id,
      eventType: 'manager_request_closed',
    })

    return res.json({ request: mapped })
  } catch (error) {
    console.error('[manager-requests][close]', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

/**
 * Связать задачу с обращением. Статус НЕ закрывает обращение —
 * директор закрывает вручную после ответа / создания задачи.
 */
const markConverted = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    const id = Number(req.params.id)
    const relatedTaskId = Number(req.body?.relatedTaskId || req.body?.related_task_id)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    if (!Number.isFinite(relatedTaskId) || relatedTaskId <= 0) {
      return res.status(400).json({ error: 'Укажите relatedTaskId' })
    }

    const { rows } = await dbPool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ error: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.to_user_id) !== userId) {
      return res.status(403).json({ error: 'Только адресат может связать задачу с обращением' })
    }
    if (!ACTIVE_STATUSES.has(row.status) && row.status !== 'converted_to_task') {
      return res.status(422).json({ error: 'Нельзя связать задачу с закрытым обращением' })
    }

    await dbPool.query(
      `
      UPDATE staff_manager_requests
      SET related_task_id = $1,
          author_has_unread = TRUE,
          updated_at = NOW()
      WHERE id = $2
      `,
      [relatedTaskId, id]
    )
    const full = await dbPool.query(`${SELECT_BASE} WHERE r.id = $1`, [id])
    const mapped = mapRow(full.rows[0])

    await notifyBoth(dbPool, {
      userIds: [Number(row.from_user_id)],
      title: 'По обращению создана задача',
      body: `По «${row.title}» создана задача №${relatedTaskId}. Обращение остаётся открытым до закрытия директором.`,
      requestId: id,
      eventType: 'manager_request_task_linked',
    })

    return res.json({ request: mapped })
  } catch (error) {
    console.error('[manager-requests][convert]', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const listMessages = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    const id = Number(req.params.id)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })

    const { rows } = await dbPool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ error: 'Обращение не найдено' })
    const row = rows[0]
    if (Number(row.from_user_id) !== userId && Number(row.to_user_id) !== userId) {
      return res.status(403).json({ error: 'Нет доступа к обращению' })
    }

    const messages = await dbPool.query(
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
    console.error('[manager-requests][messages][list]', error)
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию enhance_staff_manager_requests_v2.sql',
      })
    }
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const postMessage = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    const id = Number(req.params.id)
    const body = String(req.body?.body || req.body?.text || '').trim()
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    if (!body) return res.status(400).json({ error: 'Введите сообщение' })

    const { rows } = await dbPool.query(`SELECT * FROM staff_manager_requests WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ error: 'Обращение не найдено' })
    const row = rows[0]
    const isAuthor = Number(row.from_user_id) === userId
    const isRecipient = Number(row.to_user_id) === userId
    if (!isAuthor && !isRecipient) {
      return res.status(403).json({ error: 'Нет доступа к обращению' })
    }
    if (!ACTIVE_STATUSES.has(row.status)) {
      return res.status(422).json({ error: 'Чат доступен только для открытых / отвеченных обращений' })
    }

    const inserted = await dbPool.query(
      `
      INSERT INTO staff_manager_request_messages (request_id, author_id, body)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [id, userId, body]
    )

    if (isAuthor) {
      await dbPool.query(
        `
        UPDATE staff_manager_requests
        SET recipient_has_unread = TRUE, updated_at = NOW()
        WHERE id = $1
        `,
        [id]
      )
    } else {
      await dbPool.query(
        `
        UPDATE staff_manager_requests
        SET author_has_unread = TRUE, updated_at = NOW()
        WHERE id = $1
        `,
        [id]
      )
    }

    const msgRows = await dbPool.query(
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
    await notifyBoth(dbPool, {
      userIds: [notifyUserId],
      title: 'Сообщение по обращению',
      body: preview,
      requestId: id,
      eventType: 'manager_request_chat',
    })

    try {
      const io = req.app?.get?.('io')
      if (io) {
        io.emit('managerRequestChat', {
          requestId: id,
          notifyUserId,
          userIds: [notifyUserId],
          fromUserId: userId,
          title: row.title,
          preview,
          message,
        })
        io.emit('notification', {
          type: 'manager_request_chat',
          userId: notifyUserId,
          requestId: id,
          message: preview,
          title: row.title,
        })
      }
    } catch (socketErr) {
      console.warn('[manager-requests][messages][socket]', socketErr.message || socketErr)
    }

    return res.status(201).json({ message })
  } catch (error) {
    console.error('[manager-requests][messages][post]', error)
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию enhance_staff_manager_requests_v2.sql',
      })
    }
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
  listMessages,
  postMessage,
}
