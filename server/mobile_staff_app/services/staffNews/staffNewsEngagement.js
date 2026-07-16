/**
 * Комментарии, опросы и отчёт по вовлечённости staff_news.
 */

const normalizePollPayload = (poll) => {
  if (!poll || typeof poll !== 'object') return null
  const question = String(poll.question || '').trim()
  const options = (Array.isArray(poll.options) ? poll.options : [])
    .map((o) => String(typeof o === 'string' ? o : o?.label || '').trim())
    .filter(Boolean)
    .slice(0, 8)
  if (!question || options.length < 2) return null
  return {
    question,
    isMultiple: Boolean(poll.isMultiple),
    options,
  }
}

const savePoll = async (client, newsId, pollPayload) => {
  const poll = normalizePollPayload(pollPayload)
  await client.query(`DELETE FROM staff_news_polls WHERE news_id = $1`, [newsId])
  if (!poll) return null

  const insert = await client.query(
    `INSERT INTO staff_news_polls (news_id, question, is_multiple)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [newsId, poll.question, poll.isMultiple]
  )
  const pollId = insert.rows[0].id
  for (let i = 0; i < poll.options.length; i += 1) {
    await client.query(
      `INSERT INTO staff_news_poll_options (poll_id, label, display_order)
       VALUES ($1, $2, $3)`,
      [pollId, poll.options[i], i]
    )
  }
  return pollId
}

const getPollForNews = async (pool, newsId, userId = null) => {
  const pollRes = await pool.query(
    `SELECT id, question, is_multiple FROM staff_news_polls WHERE news_id = $1`,
    [newsId]
  )
  if (!pollRes.rows.length) return null
  const poll = pollRes.rows[0]
  const optionsRes = await pool.query(
    `SELECT o.id, o.label, o.display_order,
            COUNT(v.id)::int AS votes
       FROM staff_news_poll_options o
       LEFT JOIN staff_news_poll_votes v ON v.option_id = o.id
      WHERE o.poll_id = $1
      GROUP BY o.id
      ORDER BY o.display_order, o.id`,
    [poll.id]
  )
  let myOptionIds = []
  if (userId) {
    const myVotes = await pool.query(
      `SELECT option_id FROM staff_news_poll_votes
        WHERE poll_id = $1 AND user_id = $2`,
      [poll.id, userId]
    )
    myOptionIds = myVotes.rows.map((r) => Number(r.option_id))
  }
  const totalVotes = optionsRes.rows.reduce((sum, r) => sum + Number(r.votes || 0), 0)
  return {
    id: Number(poll.id),
    question: poll.question,
    isMultiple: Boolean(poll.is_multiple),
    totalVotes,
    myOptionIds,
    options: optionsRes.rows.map((o) => ({
      id: Number(o.id),
      label: o.label,
      votes: Number(o.votes || 0),
      percent: totalVotes
        ? Math.round((Number(o.votes || 0) / totalVotes) * 100)
        : 0,
      selected: myOptionIds.includes(Number(o.id)),
    })),
  }
}

const listComments = async (pool, newsId, { limit = 50 } = {}) => {
  const res = await pool.query(
    `SELECT c.id, c.user_id, c.body, c.created_at, c.updated_at,
            u.last_name, u.first_name, u.middle_name
       FROM staff_news_comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.news_id = $1 AND c.is_deleted = FALSE
      ORDER BY c.created_at ASC
      LIMIT $2`,
    [newsId, Math.min(100, Math.max(1, limit))]
  )
  return res.rows.map((row) => ({
    id: Number(row.id),
    userId: Number(row.user_id),
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorName: [row.last_name, row.first_name, row.middle_name]
      .filter(Boolean)
      .join(' '),
  }))
}

const addComment = async (pool, newsId, userId, bodyRaw) => {
  const body = String(bodyRaw || '').trim()
  if (!body) throw new Error('Пустой комментарий')
  if (body.length > 2000) throw new Error('Комментарий слишком длинный')
  const res = await pool.query(
    `INSERT INTO staff_news_comments (news_id, user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [newsId, userId, body]
  )
  return { id: Number(res.rows[0].id), createdAt: res.rows[0].created_at }
}

const softDeleteComment = async (pool, commentId, { userId, isEditor = false }) => {
  const existing = await pool.query(
    `SELECT id, user_id FROM staff_news_comments
      WHERE id = $1 AND is_deleted = FALSE`,
    [commentId]
  )
  if (!existing.rows.length) return { ok: false, status: 404, message: 'Комментарий не найден' }
  if (!isEditor && Number(existing.rows[0].user_id) !== Number(userId)) {
    return { ok: false, status: 403, message: 'Нельзя удалить чужой комментарий' }
  }
  await pool.query(
    `UPDATE staff_news_comments
        SET is_deleted = TRUE, updated_at = NOW()
      WHERE id = $1`,
    [commentId]
  )
  return { ok: true }
}

const votePoll = async (pool, newsId, userId, optionIdsRaw) => {
  const poll = await getPollForNews(pool, newsId, userId)
  if (!poll) throw Object.assign(new Error('Опрос не найден'), { status: 404 })

  const optionIds = (Array.isArray(optionIdsRaw) ? optionIdsRaw : [optionIdsRaw])
    .map((x) => parseInt(x, 10))
    .filter((x) => Number.isFinite(x))

  if (!optionIds.length) throw Object.assign(new Error('Выберите вариант'), { status: 400 })

  const validIds = new Set(poll.options.map((o) => o.id))
  if (optionIds.some((id) => !validIds.has(id))) {
    throw Object.assign(new Error('Некорректный вариант'), { status: 400 })
  }

  const chosen = poll.isMultiple ? optionIds : [optionIds[0]]
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM staff_news_poll_votes WHERE poll_id = $1 AND user_id = $2`, [
      poll.id,
      userId,
    ])
    for (const optionId of chosen) {
      await client.query(
        `INSERT INTO staff_news_poll_votes (poll_id, option_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (poll_id, user_id, option_id) DO NOTHING`,
        [poll.id, optionId, userId]
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  return getPollForNews(pool, newsId, userId)
}

const getEngagementReport = async (pool, newsId) => {
  const [reactionRows, reactionUsers, comments, poll] = await Promise.all([
    pool.query(
      `SELECT reaction, COUNT(*)::int AS count
         FROM staff_news_reactions
        WHERE news_id = $1
        GROUP BY reaction`,
      [newsId]
    ),
    pool.query(
      `SELECT r.reaction, r.created_at, u.id AS user_id,
              u.last_name, u.first_name, u.middle_name,
              d.name AS department_name
         FROM staff_news_reactions r
         JOIN users u ON u.id = r.user_id
         LEFT JOIN departments d ON d.id = u.department_id
        WHERE r.news_id = $1
        ORDER BY r.reaction, u.last_name`,
      [newsId]
    ),
    listComments(pool, newsId, { limit: 100 }),
    getPollForNews(pool, newsId, null),
  ])

  const reactionCounts = { like: 0, useful: 0, clarify: 0 }
  for (const row of reactionRows.rows) {
    if (reactionCounts[row.reaction] != null) reactionCounts[row.reaction] = row.count
  }

  const mapName = (row) =>
    [row.last_name, row.first_name, row.middle_name].filter(Boolean).join(' ')

  const reactionsByType = { like: [], useful: [], clarify: [] }
  for (const row of reactionUsers.rows) {
    if (!reactionsByType[row.reaction]) continue
    reactionsByType[row.reaction].push({
      userId: Number(row.user_id),
      name: mapName(row),
      department: row.department_name || '—',
      createdAt: row.created_at,
    })
  }

  return {
    reactionCounts,
    reactionsByType,
    commentsCount: comments.length,
    comments,
    poll,
  }
}

module.exports = {
  normalizePollPayload,
  savePoll,
  getPollForNews,
  listComments,
  addComment,
  softDeleteComment,
  votePoll,
  getEngagementReport,
}
