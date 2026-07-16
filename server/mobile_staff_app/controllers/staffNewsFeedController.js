const {
  extractExcerpt,
  canNewsBeVisibleNow,
  buildSegmentsByType,
  isVisibleForEmployee,
  getEmployeeProfile,
  getNewsById,
} = require('../services/staffNews/staffNewsService')

const assertVisible = async (pool, newsId, profile, userId) => {
  const news = await getNewsById(pool, newsId)
  if (!news || !canNewsBeVisibleNow(news)) {
    return { ok: false, status: 404, message: 'Новость не найдена', news: null }
  }
  const segmentsRes = await pool.query(
    `SELECT segment_type, segment_value FROM staff_news_segments WHERE news_id = $1`,
    [newsId]
  )
  const segmentsByType = buildSegmentsByType(segmentsRes.rows)
  if (
    segmentsRes.rows.length &&
    !isVisibleForEmployee({
      segmentsByType,
      userId,
      departmentId: profile.department_id,
      roleName: profile.role_name,
    })
  ) {
    return { ok: false, status: 403, message: 'Нет доступа к новости', news: null }
  }
  return { ok: true, news }
}

const listFeed = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const profile = await getEmployeeProfile(pool, userId)
    if (!profile) return res.status(404).json({ message: 'Пользователь не найден' })

    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '10', 10)))
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10))
    const filterRaw = String(req.query.filter || 'all').trim().toLowerCase()
    const filter = ['unread', 'needs_ack'].includes(filterRaw) ? filterRaw : 'all'

    await pool.query(
      `UPDATE staff_news
          SET status = 'published', updated_at = NOW()
        WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= NOW()`
    )
    await pool.query(
      `UPDATE staff_news
          SET status = 'archived', updated_at = NOW()
        WHERE status IN ('published', 'scheduled')
          AND unpublish_at IS NOT NULL AND unpublish_at <= NOW()`
    )

    const fetchLimit =
      filter === 'all' ? Math.max(limit * 5, 50) : Math.max(limit * 20, 100)
    const rows = await pool.query(
      `SELECT n.id, n.title, n.summary, n.content_html, n.cover_image_url, n.status,
              n.importance, n.is_pinned,
              COALESCE(n.requires_ack, FALSE) AS requires_ack,
              n.publish_at, n.unpublish_at, n.created_at, n.updated_at,
              EXISTS (
                SELECT 1 FROM staff_news_reads r
                 WHERE r.news_id = n.id AND r.user_id = $1
              ) AS is_read,
              EXISTS (
                SELECT 1 FROM staff_news_acks a
                 WHERE a.news_id = n.id AND a.user_id = $1
              ) AS is_acked
         FROM staff_news n
        WHERE n.status IN ('published', 'scheduled')
        ORDER BY n.is_pinned DESC, COALESCE(n.publish_at, n.created_at) DESC, n.id DESC
        LIMIT $2 OFFSET $3`,
      [userId, fetchLimit, offset]
    )

    const filtered = []
    for (const row of rows.rows) {
      if (!canNewsBeVisibleNow(row)) continue
      const segmentsRes = await pool.query(
        `SELECT segment_type, segment_value FROM staff_news_segments WHERE news_id = $1`,
        [row.id]
      )
      const segmentsByType = buildSegmentsByType(segmentsRes.rows)
      const visible =
        !segmentsRes.rows.length ||
        isVisibleForEmployee({
          segmentsByType,
          userId,
          departmentId: profile.department_id,
          roleName: profile.role_name,
        })
      if (!visible) continue
      if (filter === 'unread' && row.is_read) continue
      if (filter === 'needs_ack' && !(row.requires_ack && !row.is_acked)) continue
      filtered.push(row)
      if (filtered.length >= limit) break
    }

    return res.json({
      items: filtered.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        excerpt: extractExcerpt(row.summary, row.content_html),
        coverImageUrl: row.cover_image_url,
        importance: row.importance,
        isPinned: row.is_pinned,
        requiresAck: Boolean(row.requires_ack),
        needsAck: Boolean(row.requires_ack) && !row.is_acked,
        isAcked: Boolean(row.is_acked),
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
        publishAt: row.publish_at,
      })),
      hasMore: filtered.length >= limit,
      nextOffset: offset + filtered.length,
    })
  } catch (error) {
    console.error('[staff_news][feed_list]', error)
    return res.status(500).json({ message: 'Ошибка ленты новостей' })
  }
}

const getFeedItem = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID' })

    const profile = await getEmployeeProfile(pool, userId)
    if (!profile) return res.status(404).json({ message: 'Пользователь не найден' })

    const access = await assertVisible(pool, newsId, profile, userId)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const news = access.news

    await pool.query(
      `INSERT INTO staff_news_reads (news_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (news_id, user_id) DO UPDATE SET read_at = NOW()`,
      [newsId, userId]
    )

    const engagement = require('../services/staffNews/staffNewsEngagement')
    const [ackRes, myReactions, counts, comments, poll] = await Promise.all([
      pool.query(
        `SELECT acked_at FROM staff_news_acks WHERE news_id = $1 AND user_id = $2`,
        [newsId, userId]
      ),
      pool.query(
        `SELECT reaction FROM staff_news_reactions WHERE news_id = $1 AND user_id = $2`,
        [newsId, userId]
      ),
      pool.query(
        `SELECT reaction, COUNT(*)::int AS count
           FROM staff_news_reactions
          WHERE news_id = $1
          GROUP BY reaction`,
        [newsId]
      ),
      engagement.listComments(pool, newsId, { limit: 80 }),
      engagement.getPollForNews(pool, newsId, userId),
    ])

    const reactionCounts = { like: 0, useful: 0, clarify: 0 }
    for (const row of counts.rows) {
      if (reactionCounts[row.reaction] != null) reactionCounts[row.reaction] = row.count
    }

    return res.json({
      id: news.id,
      title: news.title,
      summary: news.summary,
      contentHtml: news.content_html,
      coverImageUrl: news.cover_image_url,
      importance: news.importance,
      isPinned: news.is_pinned,
      requiresAck: Boolean(news.requires_ack),
      commentsEnabled: news.comments_enabled !== false,
      isAcked: ackRes.rows.length > 0,
      ackedAt: ackRes.rows[0]?.acked_at || null,
      publishAt: news.publish_at,
      createdAt: news.created_at,
      media: news.media,
      attachments: news.attachments || [],
      myReactions: myReactions.rows.map((r) => r.reaction),
      reactionCounts,
      comments,
      poll,
      isRead: true,
    })
  } catch (error) {
    console.error('[staff_news][feed_item]', error)
    return res.status(500).json({ message: 'Ошибка загрузки новости' })
  }
}

const ackNews = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID' })
    const profile = await getEmployeeProfile(pool, userId)
    if (!profile) return res.status(404).json({ message: 'Пользователь не найден' })

    const access = await assertVisible(pool, newsId, profile, userId)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    if (!access.news.requires_ack) {
      return res.status(400).json({ message: 'Для этой новости ознакомление не требуется' })
    }

    await pool.query(
      `INSERT INTO staff_news_acks (news_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (news_id, user_id) DO UPDATE SET acked_at = NOW()`,
      [newsId, userId]
    )
    await pool.query(
      `INSERT INTO staff_news_reads (news_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (news_id, user_id) DO UPDATE SET read_at = NOW()`,
      [newsId, userId]
    )
    return res.json({ ok: true, isAcked: true })
  } catch (error) {
    console.error('[staff_news][ack]', error)
    return res.status(500).json({ message: 'Ошибка подтверждения' })
  }
}

const toggleReaction = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const newsId = parseInt(req.params.newsId, 10)
    const reaction = String(req.body?.reaction || '').trim().toLowerCase()
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID' })
    if (!['like', 'useful', 'clarify'].includes(reaction)) {
      return res.status(400).json({ message: 'Некорректная реакция' })
    }
    const profile = await getEmployeeProfile(pool, userId)
    if (!profile) return res.status(404).json({ message: 'Пользователь не найден' })

    const access = await assertVisible(pool, newsId, profile, userId)
    if (!access.ok) return res.status(access.status).json({ message: access.message })

    const existing = await pool.query(
      `SELECT id FROM staff_news_reactions
        WHERE news_id = $1 AND user_id = $2 AND reaction = $3`,
      [newsId, userId, reaction]
    )
    if (existing.rows.length) {
      await pool.query(`DELETE FROM staff_news_reactions WHERE id = $1`, [existing.rows[0].id])
    } else {
      await pool.query(
        `INSERT INTO staff_news_reactions (news_id, user_id, reaction)
         VALUES ($1, $2, $3)
         ON CONFLICT (news_id, user_id, reaction) DO NOTHING`,
        [newsId, userId, reaction]
      )
    }

    const [myReactions, counts] = await Promise.all([
      pool.query(
        `SELECT reaction FROM staff_news_reactions WHERE news_id = $1 AND user_id = $2`,
        [newsId, userId]
      ),
      pool.query(
        `SELECT reaction, COUNT(*)::int AS count
           FROM staff_news_reactions
          WHERE news_id = $1
          GROUP BY reaction`,
        [newsId]
      ),
    ])
    const reactionCounts = { like: 0, useful: 0, clarify: 0 }
    for (const row of counts.rows) {
      if (reactionCounts[row.reaction] != null) reactionCounts[row.reaction] = row.count
    }
    return res.json({
      myReactions: myReactions.rows.map((r) => r.reaction),
      reactionCounts,
    })
  } catch (error) {
    console.error('[staff_news][react]', error)
    return res.status(500).json({ message: 'Ошибка реакции' })
  }
}

const unreadCount = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const profile = await getEmployeeProfile(pool, userId)
    if (!profile) return res.json({ count: 0 })

    const rows = await pool.query(
      `SELECT n.id
         FROM staff_news n
        WHERE n.status = 'published'
          AND (n.unpublish_at IS NULL OR n.unpublish_at > NOW())
          AND (
            NOT EXISTS (
              SELECT 1 FROM staff_news_reads r
               WHERE r.news_id = n.id AND r.user_id = $1
            )
            OR (
              COALESCE(n.requires_ack, FALSE) = TRUE
              AND NOT EXISTS (
                SELECT 1 FROM staff_news_acks a
                 WHERE a.news_id = n.id AND a.user_id = $1
              )
            )
          )
        ORDER BY n.id DESC
        LIMIT 200`,
      [userId]
    )

    let count = 0
    for (const row of rows.rows) {
      const segmentsRes = await pool.query(
        `SELECT segment_type, segment_value FROM staff_news_segments WHERE news_id = $1`,
        [row.id]
      )
      const segmentsByType = buildSegmentsByType(segmentsRes.rows)
      if (
        !segmentsRes.rows.length ||
        isVisibleForEmployee({
          segmentsByType,
          userId,
          departmentId: profile.department_id,
          roleName: profile.role_name,
        })
      ) {
        count += 1
      }
    }
    return res.json({ count })
  } catch (error) {
    console.error('[staff_news][unread]', error)
    return res.json({ count: 0 })
  }
}

const {
  listComments,
  addComment,
  softDeleteComment,
  votePoll,
} = require('../services/staffNews/staffNewsEngagement')

const postComment = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID' })
    const profile = await getEmployeeProfile(pool, userId)
    if (!profile) return res.status(404).json({ message: 'Пользователь не найден' })
    const access = await assertVisible(pool, newsId, profile, userId)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    if (access.news.comments_enabled === false) {
      return res.status(400).json({ message: 'Комментарии отключены' })
    }
    await addComment(pool, newsId, userId, req.body?.body)
    const comments = await listComments(pool, newsId, { limit: 80 })
    return res.status(201).json({ comments })
  } catch (error) {
    console.error('[staff_news][comment]', error)
    return res.status(400).json({ message: error.message || 'Ошибка комментария' })
  }
}

const deleteComment = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const newsId = parseInt(req.params.newsId, 10)
    const commentId = parseInt(req.params.commentId, 10)
    if (!Number.isFinite(newsId) || !Number.isFinite(commentId)) {
      return res.status(400).json({ message: 'Некорректный ID' })
    }
    const profile = await getEmployeeProfile(pool, userId)
    if (!profile) return res.status(404).json({ message: 'Пользователь не найден' })
    const access = await assertVisible(pool, newsId, profile, userId)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const result = await softDeleteComment(pool, commentId, { userId, isEditor: false })
    if (!result.ok) return res.status(result.status).json({ message: result.message })
    const comments = await listComments(pool, newsId, { limit: 80 })
    return res.json({ comments })
  } catch (error) {
    console.error('[staff_news][comment_delete]', error)
    return res.status(500).json({ message: 'Ошибка удаления комментария' })
  }
}

const postPollVote = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID' })
    const profile = await getEmployeeProfile(pool, userId)
    if (!profile) return res.status(404).json({ message: 'Пользователь не найден' })
    const access = await assertVisible(pool, newsId, profile, userId)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const poll = await votePoll(pool, newsId, userId, req.body?.optionIds || req.body?.optionId)
    return res.json({ poll })
  } catch (error) {
    console.error('[staff_news][poll_vote]', error)
    const status = error.status || 500
    return res.status(status).json({ message: error.message || 'Ошибка голосования' })
  }
}

module.exports = {
  listFeed,
  getFeedItem,
  unreadCount,
  ackNews,
  toggleReaction,
  postComment,
  deleteComment,
  postPollVote,
}
