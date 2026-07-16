const {
  normalizeStatus,
  normalizeImportance,
  ensureUniqueSlug,
  saveSegments,
  saveMedia,
  writeChangeLog,
  getNewsById,
  resolveAudienceUserIds,
  estimateAudienceCount,
} = require('../services/staffNews/staffNewsService')
const { sanitizeNewsHtml } = require('../services/staffNews/sanitizeNewsHtml')
const { notifyStaffUsers } = require('../services/staffPushService')

const parseEditorUserId = (req) => {
  const value = req.headers['x-user-id'] || req.body?.userId || req.query?.userId
  const id = parseInt(value, 10)
  return Number.isFinite(id) ? id : null
}

const checkEditorAccess = async (pool, req) => {
  const userId = parseEditorUserId(req)
  if (!userId) {
    return { ok: false, status: 401, message: 'Не указан пользователь CRM', userId: null }
  }
  const isAdminHeader = String(req.headers['x-user-is-admin'] || '').trim()
  if (isAdminHeader === '1' || isAdminHeader.toLowerCase() === 'true') {
    return { ok: true, userId, isAdmin: true }
  }
  const roleName = decodeURIComponent(
    String(req.headers['x-user-role'] || req.body?.userRole || '')
  ).trim()
  if (roleName === 'Администратор' || roleName === 'Директор') {
    return { ok: true, userId, isAdmin: roleName === 'Администратор' }
  }
  const permission = await pool.query(
    `SELECT id FROM staff_news_permissions WHERE user_id = $1 AND can_edit = TRUE LIMIT 1`,
    [userId]
  )
  if (!permission.rows.length) {
    return {
      ok: false,
      status: 403,
      message: 'Недостаточно прав для управления новостями сотрудников',
      userId,
    }
  }
  return { ok: true, userId, isAdmin: false }
}

const sendPublishedPush = async (pool, { newsId, title, excludeUserId }) => {
  const userIds = await resolveAudienceUserIds(pool, newsId)
  await notifyStaffUsers(pool, {
    userIds: userIds.filter((id) => id !== Number(excludeUserId)),
    title: 'Новость для сотрудников',
    body: String(title || 'Новая публикация').slice(0, 120),
    data: { type: 'staff_news', newsId: Number(newsId) },
  })
}

const syncTimedStatuses = async (pool) => {
  const becamePublishedRes = await pool.query(
    `UPDATE staff_news
        SET status = 'published', updated_at = NOW()
      WHERE id IN (
        SELECT id FROM staff_news
         WHERE status = 'scheduled'
           AND publish_at IS NOT NULL
           AND publish_at <= NOW()
      )
      RETURNING id, title`
  )
  await pool.query(
    `UPDATE staff_news
        SET status = 'archived', updated_at = NOW()
      WHERE status IN ('published', 'scheduled')
        AND unpublish_at IS NOT NULL
        AND unpublish_at <= NOW()`
  )
  for (const row of becamePublishedRes.rows) {
    try {
      await sendPublishedPush(pool, { newsId: row.id, title: row.title })
    } catch (error) {
      console.warn('[staff_news][sync_push]', error.message)
    }
  }
}

const validatePayload = (payload) => {
  const title = String(payload.title || '').trim()
  const coverImageUrl = String(payload.coverImageUrl || '').trim()
  if (!title) return 'Заголовок обязателен'
  if (!coverImageUrl) return 'Главное изображение обязательно'
  return ''
}

const listNewsAdmin = (pool) => async (req, res) => {
  try {
    await syncTimedStatuses(pool)
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })

    const statusFilter = String(req.query.status || '').trim().toLowerCase()
    const searchRaw = String(req.query.search || '').trim()
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '40', 10)))
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10))
    const where = []
    const params = []
    if (statusFilter) {
      params.push(statusFilter)
      where.push(`n.status = $${params.length}`)
    }
    if (searchRaw) {
      params.push(`%${searchRaw.toLowerCase()}%`)
      where.push(
        `(LOWER(n.title) LIKE $${params.length} OR LOWER(n.summary) LIKE $${params.length})`
      )
    }
    params.push(limit, offset)
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const result = await pool.query(
      `SELECT n.id, n.title, n.summary, n.status, n.importance, n.is_pinned,
              COALESCE(n.requires_ack, FALSE) AS requires_ack,
              n.cover_image_url,
              n.publish_at, n.unpublish_at, n.created_at, n.updated_at, n.created_by, n.updated_by
         FROM staff_news n
         ${whereSql}
        ORDER BY n.is_pinned DESC, n.updated_at DESC, n.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    return res.json({ items: result.rows })
  } catch (error) {
    console.error('[staff_news][list_admin]', error)
    return res.status(500).json({ message: 'Ошибка получения новостей' })
  }
}

const getNewsAdmin = (pool) => async (req, res) => {
  try {
    await syncTimedStatuses(pool)
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID' })
    const news = await getNewsById(pool, newsId)
    if (!news) return res.status(404).json({ message: 'Новость не найдена' })
    return res.json(news)
  } catch (error) {
    console.error('[staff_news][get_admin]', error)
    return res.status(500).json({ message: 'Ошибка получения новости' })
  }
}

const createNews = (pool) => async (req, res) => {
  const client = await pool.connect()
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const err = validatePayload(req.body)
    if (err) return res.status(400).json({ message: err })

    const title = String(req.body.title || '').trim()
    const summary = String(req.body.summary || '').trim()
    const status = normalizeStatus(req.body.status)
    const importance = normalizeImportance(req.body.importance)
    const isPinned = Boolean(req.body.isPinned)
    const requiresAck = Boolean(req.body.requiresAck)
    const commentsEnabled =
      req.body.commentsEnabled === undefined ? true : Boolean(req.body.commentsEnabled)
    const contentHtml = sanitizeNewsHtml(req.body.contentHtml)
    const coverImageUrl = String(req.body.coverImageUrl || '').trim()
    const publishAt =
      status === 'published'
        ? new Date().toISOString()
        : status === 'scheduled'
          ? req.body.publishAt || null
          : null
    const unpublishAt = req.body.unpublishAt || null
    const slug = await ensureUniqueSlug(pool, title)

    await client.query('BEGIN')
    const insertRes = await client.query(
      `INSERT INTO staff_news
        (title, slug, summary, content_html, cover_image_url, status, importance, is_pinned,
         requires_ack, comments_enabled, publish_at, unpublish_at, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
       RETURNING id`,
      [
        title,
        slug,
        summary,
        contentHtml,
        coverImageUrl,
        status,
        importance,
        isPinned,
        requiresAck,
        commentsEnabled,
        publishAt,
        unpublishAt,
        access.userId,
      ]
    )
    const newsId = insertRes.rows[0].id
    await saveSegments(client, newsId, req.body.segments || {})
    await saveMedia(client, newsId, req.body.media || [], req.body.attachments || [])
    const { savePoll } = require('../services/staffNews/staffNewsEngagement')
    await savePoll(client, newsId, req.body.poll || null)
    await writeChangeLog(client, {
      newsId,
      userId: access.userId,
      actionType: 'create',
      details: { title, status, importance, isPinned, requiresAck, commentsEnabled },
    })
    await client.query('COMMIT')

    if (status === 'published') {
      sendPublishedPush(pool, {
        newsId,
        title,
        excludeUserId: access.userId,
      }).catch((e) => console.warn('[staff_news][create_push]', e.message))
    }

    return res.status(201).json(await getNewsById(pool, newsId))
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[staff_news][create]', error)
    return res.status(500).json({ message: 'Ошибка создания новости' })
  } finally {
    client.release()
  }
}

const updateNews = (pool) => async (req, res) => {
  const client = await pool.connect()
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID' })
    const err = validatePayload(req.body)
    if (err) return res.status(400).json({ message: err })

    const prev = await getNewsById(pool, newsId)
    if (!prev) return res.status(404).json({ message: 'Новость не найдена' })

    const title = String(req.body.title || '').trim()
    const summary = String(req.body.summary || '').trim()
    const status = normalizeStatus(req.body.status)
    const importance = normalizeImportance(req.body.importance)
    const isPinned = Boolean(req.body.isPinned)
    const requiresAck = Boolean(req.body.requiresAck)
    const commentsEnabled =
      req.body.commentsEnabled === undefined ? true : Boolean(req.body.commentsEnabled)
    const contentHtml = sanitizeNewsHtml(req.body.contentHtml)
    const coverImageUrl = String(req.body.coverImageUrl || '').trim()
    let publishAt = req.body.publishAt || prev.publish_at
    if (status === 'published' && prev.status !== 'published') {
      publishAt = new Date().toISOString()
    }
    if (status === 'scheduled') publishAt = req.body.publishAt || null
    if (status === 'draft') publishAt = null
    const unpublishAt = req.body.unpublishAt || null
    const slug = await ensureUniqueSlug(pool, title, newsId)

    await client.query('BEGIN')
    await client.query(
      `UPDATE staff_news SET
         title=$1, slug=$2, summary=$3, content_html=$4, cover_image_url=$5,
         status=$6, importance=$7, is_pinned=$8, requires_ack=$9, comments_enabled=$10,
         publish_at=$11, unpublish_at=$12,
         updated_by=$13, updated_at=NOW()
       WHERE id=$14`,
      [
        title,
        slug,
        summary,
        contentHtml,
        coverImageUrl,
        status,
        importance,
        isPinned,
        requiresAck,
        commentsEnabled,
        publishAt,
        unpublishAt,
        access.userId,
        newsId,
      ]
    )
    await saveSegments(client, newsId, req.body.segments || {})
    await saveMedia(client, newsId, req.body.media || [], req.body.attachments || [])
    const { savePoll } = require('../services/staffNews/staffNewsEngagement')
    await savePoll(client, newsId, req.body.poll || null)
    await writeChangeLog(client, {
      newsId,
      userId: access.userId,
      actionType: 'update',
      details: { title, status, prevStatus: prev.status, requiresAck },
    })
    await client.query('COMMIT')

    if (status === 'published' && prev.status !== 'published') {
      sendPublishedPush(pool, {
        newsId,
        title,
        excludeUserId: access.userId,
      }).catch((e) => console.warn('[staff_news][update_push]', e.message))
    }

    return res.json(await getNewsById(pool, newsId))
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[staff_news][update]', error)
    return res.status(500).json({ message: 'Ошибка обновления новости' })
  } finally {
    client.release()
  }
}

const deleteNews = (pool) => async (req, res) => {
  const client = await pool.connect()
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID' })
    const prev = await getNewsById(pool, newsId)
    if (!prev) return res.status(404).json({ message: 'Новость не найдена' })
    await client.query('BEGIN')
    await writeChangeLog(client, {
      newsId,
      userId: access.userId,
      actionType: 'delete',
      details: { title: prev.title },
    })
    await client.query('DELETE FROM staff_news WHERE id = $1', [newsId])
    await client.query('COMMIT')
    return res.json({ ok: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[staff_news][delete]', error)
    return res.status(500).json({ message: 'Ошибка удаления' })
  } finally {
    client.release()
  }
}

const getTaxonomy = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const [deps, roles, users] = await Promise.all([
      pool.query(`SELECT id, name FROM departments ORDER BY name`),
      pool.query(`SELECT id, name FROM roles ORDER BY name`),
      pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.middle_name, u.department_id, r.name AS role_name
           FROM users u
           LEFT JOIN roles r ON r.id = u.role_id
          ORDER BY u.last_name, u.first_name`
      ),
    ])
    return res.json({
      departments: deps.rows.map((d) => ({ id: String(d.id), name: d.name })),
      roles: roles.rows.map((r) => ({ id: String(r.id), name: r.name })),
      users: users.rows.map((u) => ({
        id: String(u.id),
        name: `${u.last_name || ''} ${u.first_name || ''} ${u.middle_name || ''}`.trim(),
        departmentId: u.department_id ? String(u.department_id) : null,
        roleName: u.role_name || null,
      })),
    })
  } catch (error) {
    console.error('[staff_news][taxonomy]', error)
    return res.status(500).json({ message: 'Ошибка справочников' })
  }
}

const estimateAudience = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const count = await estimateAudienceCount(pool, req.body?.segments || {})
    return res.json({ count })
  } catch (error) {
    console.error('[staff_news][estimate]', error)
    return res.status(500).json({ message: 'Ошибка оценки охвата' })
  }
}

const listChangeLog = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)))
    const result = await pool.query(
      `SELECT l.id, l.news_id, l.user_id, l.action_type, l.details_json, l.created_at,
              u.last_name, u.first_name
         FROM staff_news_change_log l
         LEFT JOIN users u ON u.id = l.user_id
        ORDER BY l.created_at DESC
        LIMIT $1`,
      [limit]
    )
    return res.json({ items: result.rows })
  } catch (error) {
    console.error('[staff_news][changelog]', error)
    return res.status(500).json({ message: 'Ошибка истории' })
  }
}

const listPermissions = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    if (!access.isAdmin) return res.status(403).json({ message: 'Только администратор' })
    const result = await pool.query(
      `SELECT p.id, p.user_id, p.can_edit, p.created_at,
              u.last_name, u.first_name, u.middle_name
         FROM staff_news_permissions p
         JOIN users u ON u.id = p.user_id
        ORDER BY u.last_name`
    )
    return res.json({ items: result.rows })
  } catch (error) {
    console.error('[staff_news][permissions_list]', error)
    return res.status(500).json({ message: 'Ошибка прав' })
  }
}

const getMyPermission = (pool) => async (req, res) => {
  try {
    const userId = parseInt(req.query.userId || req.headers['x-user-id'], 10)
    if (!Number.isFinite(userId)) return res.json({ canEdit: false })
    const isAdmin = String(req.headers['x-user-is-admin'] || '') === '1'
    if (isAdmin) return res.json({ canEdit: true })
    const roleName = decodeURIComponent(String(req.headers['x-user-role'] || '')).trim()
    if (roleName === 'Администратор' || roleName === 'Директор') {
      return res.json({ canEdit: true })
    }
    const permission = await pool.query(
      `SELECT id FROM staff_news_permissions WHERE user_id = $1 AND can_edit = TRUE LIMIT 1`,
      [userId]
    )
    return res.json({ canEdit: permission.rows.length > 0 })
  } catch (error) {
    return res.json({ canEdit: false })
  }
}

const grantPermission = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    if (!access.isAdmin) return res.status(403).json({ message: 'Только администратор' })
    const targetId = parseInt(req.body.user_id, 10)
    if (!Number.isFinite(targetId)) return res.status(400).json({ message: 'user_id обязателен' })
    await pool.query(
      `INSERT INTO staff_news_permissions (user_id, can_edit, created_by)
       VALUES ($1, TRUE, $2)
       ON CONFLICT (user_id) DO UPDATE SET can_edit = TRUE`,
      [targetId, access.userId]
    )
    return res.status(201).json({ ok: true })
  } catch (error) {
    console.error('[staff_news][grant]', error)
    return res.status(500).json({ message: 'Ошибка выдачи прав' })
  }
}

const revokePermission = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    if (!access.isAdmin) return res.status(403).json({ message: 'Только администратор' })
    const id = parseInt(req.params.id, 10)
    await pool.query(`DELETE FROM staff_news_permissions WHERE id = $1`, [id])
    return res.json({ ok: true })
  } catch (error) {
    console.error('[staff_news][revoke]', error)
    return res.status(500).json({ message: 'Ошибка отзыва прав' })
  }
}

const getAckReport = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID' })

    const news = await getNewsById(pool, newsId)
    if (!news) return res.status(404).json({ message: 'Новость не найдена' })
    if (!news.requires_ack) {
      return res.json({
        newsId,
        title: news.title,
        requiresAck: false,
        total: 0,
        acked: 0,
        pending: 0,
        percent: 0,
        ackedUsers: [],
        pendingUsers: [],
        message: 'Для этой новости обязательное ознакомление не включено',
      })
    }

    const audienceIds = await resolveAudienceUserIds(pool, newsId)
    if (!audienceIds.length) {
      return res.json({
        newsId,
        title: news.title,
        requiresAck: true,
        total: 0,
        acked: 0,
        pending: 0,
        percent: 0,
        ackedUsers: [],
        pendingUsers: [],
      })
    }

    const usersRes = await pool.query(
      `SELECT u.id, u.last_name, u.first_name, u.middle_name,
              d.name AS department_name, r.name AS role_name,
              a.acked_at
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN roles r ON r.id = u.role_id
         LEFT JOIN staff_news_acks a ON a.user_id = u.id AND a.news_id = $1
        WHERE u.id = ANY($2::int[])
        ORDER BY u.last_name, u.first_name`,
      [newsId, audienceIds]
    )

    const mapUser = (row) => ({
      id: row.id,
      name: [row.last_name, row.first_name, row.middle_name].filter(Boolean).join(' '),
      department: row.department_name || '—',
      role: row.role_name || '—',
      ackedAt: row.acked_at || null,
    })

    const ackedUsers = usersRes.rows.filter((r) => r.acked_at).map(mapUser)
    const pendingUsers = usersRes.rows.filter((r) => !r.acked_at).map(mapUser)
    const total = usersRes.rows.length
    const acked = ackedUsers.length
    const percent = total ? Math.round((acked / total) * 100) : 0

    return res.json({
      newsId,
      title: news.title,
      requiresAck: true,
      total,
      acked,
      pending: pendingUsers.length,
      percent,
      ackedUsers,
      pendingUsers,
    })
  } catch (error) {
    console.error('[staff_news][ack_report]', error)
    return res.status(500).json({ message: 'Ошибка отчёта по ознакомлению' })
  }
}

const getEngagementReport = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID' })
    const news = await getNewsById(pool, newsId)
    if (!news) return res.status(404).json({ message: 'Новость не найдена' })
    const {
      getEngagementReport: loadEngagement,
    } = require('../services/staffNews/staffNewsEngagement')
    const report = await loadEngagement(pool, newsId)
    return res.json({
      newsId,
      title: news.title,
      ...report,
    })
  } catch (error) {
    console.error('[staff_news][engagement]', error)
    return res.status(500).json({ message: 'Ошибка отчёта по вовлечённости' })
  }
}

const deleteCommentAdmin = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const commentId = parseInt(req.params.commentId, 10)
    if (!Number.isFinite(commentId)) return res.status(400).json({ message: 'Некорректный ID' })
    const { softDeleteComment } = require('../services/staffNews/staffNewsEngagement')
    const result = await softDeleteComment(pool, commentId, {
      userId: access.userId,
      isEditor: true,
    })
    if (!result.ok) return res.status(result.status).json({ message: result.message })
    return res.json({ ok: true })
  } catch (error) {
    console.error('[staff_news][admin_comment_delete]', error)
    return res.status(500).json({ message: 'Ошибка удаления комментария' })
  }
}

module.exports = {
  checkEditorAccess,
  listNewsAdmin,
  getNewsAdmin,
  createNews,
  updateNews,
  deleteNews,
  getTaxonomy,
  estimateAudience,
  listChangeLog,
  listPermissions,
  getMyPermission,
  grantPermission,
  revokePermission,
  getAckReport,
  getEngagementReport,
  deleteCommentAdmin,
}
