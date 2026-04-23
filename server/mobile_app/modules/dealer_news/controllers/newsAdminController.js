const {
  normalizeStatus,
  ensureUniqueSlug,
  saveSegments,
  saveMedia,
  writeChangeLog,
  getNewsById,
} = require('../services/newsService')
const { sanitizeNewsHtml } = require('../utils/sanitizeNewsHtml')
const { enqueueAndSendNewsPublishedPush } = require('../../shared/notifications/pushService')

const parseEditorUserId = (req) => {
  const value = req.headers['x-user-id'] || req.body?.userId || req.query?.userId
  const id = parseInt(value, 10)
  return Number.isFinite(id) ? id : null
}

const checkEditorAccess = async (pool, req) => {
  const userId = parseEditorUserId(req)
  if (!userId) return { ok: false, status: 401, message: 'Не указан пользователь CRM', userId: null }

  const isAdminHeader = String(req.headers['x-user-is-admin'] || '').trim()
  if (isAdminHeader === '1' || isAdminHeader.toLowerCase() === 'true') {
    return { ok: true, userId, isAdmin: true }
  }

  const roleNameRaw = req.headers['x-user-role'] || req.body?.userRole || req.query?.userRole || ''
  const roleName = decodeURIComponent(String(roleNameRaw || '')).trim()
  if (roleName === 'Администратор') return { ok: true, userId, isAdmin: true }

  const permission = await pool.query(
    `SELECT id FROM dealer_news_permissions WHERE user_id = $1 AND can_edit = TRUE LIMIT 1`,
    [userId]
  )
  if (!permission.rows.length) {
    return { ok: false, status: 403, message: 'Недостаточно прав для управления новостями', userId }
  }
  return { ok: true, userId, isAdmin: false }
}

const syncTimedStatuses = async (pool) => {
  // Когда наступило время публикации — делаем новость опубликованной.
  const becamePublishedRes = await pool.query(
    `UPDATE dealer_news
        SET status = 'published',
            updated_at = NOW()
      WHERE id IN (
        SELECT id FROM dealer_news
         WHERE status = 'scheduled'
           AND publish_at IS NOT NULL
           AND publish_at <= NOW()
      )
      RETURNING id, title`
  )

  // Когда наступило время снятия — уводим новость в архив.
  await pool.query(
    `UPDATE dealer_news
        SET status = 'archived',
            updated_at = NOW()
      WHERE status IN ('published', 'scheduled')
        AND unpublish_at IS NOT NULL
        AND unpublish_at <= NOW()`
  )

  for (const row of becamePublishedRes.rows) {
    try {
      await enqueueAndSendNewsPublishedPush(pool, {
        newsId: row.id,
        title: row.title,
        createdBy: null,
      })
    } catch (error) {
      console.error('[mobile_app][dealer_news][sync_publish_push] error', error)
    }
  }
}

const listNewsAdmin = (pool) => async (req, res) => {
  try {
    await syncTimedStatuses(pool)
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })

    const statusFilter = String(req.query.status || '').trim().toLowerCase()
    const searchRaw = String(req.query.search || '').trim()
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10)))
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10))

    const where = []
    const params = []
    if (statusFilter) {
      params.push(statusFilter)
      where.push(`n.status = $${params.length}`)
    }
    if (searchRaw) {
      params.push(`%${searchRaw.toLowerCase()}%`)
      where.push(`(LOWER(n.title) LIKE $${params.length} OR LOWER(n.summary) LIKE $${params.length})`)
    }
    params.push(limit)
    params.push(offset)
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const result = await pool.query(
      `SELECT n.id, n.title, n.summary, n.status, n.cover_image_url, n.publish_at, n.unpublish_at,
              n.created_at, n.updated_at, n.created_by, n.updated_by
         FROM dealer_news n
         ${whereSql}
        ORDER BY n.updated_at DESC, n.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    return res.status(200).json({ items: result.rows })
  } catch (error) {
    console.error('[mobile_app][dealer_news][list_admin] error', error)
    return res.status(500).json({ message: 'Ошибка получения новостей' })
  }
}

const getNewsAdmin = (pool) => async (req, res) => {
  try {
    await syncTimedStatuses(pool)
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) {
      return res.status(400).json({ message: 'Некорректный ID новости' })
    }
    const news = await getNewsById(pool, newsId)
    if (!news) return res.status(404).json({ message: 'Новость не найдена' })
    return res.status(200).json(news)
  } catch (error) {
    console.error('[mobile_app][dealer_news][get_admin] error', error)
    return res.status(500).json({ message: 'Ошибка получения новости' })
  }
}

const validatePayload = (payload) => {
  const title = String(payload.title || '').trim()
  const coverImageUrl = String(payload.coverImageUrl || '').trim()
  if (!title) return 'Заголовок обязателен'
  if (!coverImageUrl) return 'Главное изображение обязательно'
  return ''
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
    const contentHtml = sanitizeNewsHtml(req.body.contentHtml)
    const coverImageUrl = String(req.body.coverImageUrl || '').trim()
    const publishAt =
      status === 'published' ? new Date().toISOString() : status === 'scheduled' ? req.body.publishAt || null : null
    const unpublishAt = req.body.unpublishAt || null
    const slug = await ensureUniqueSlug(pool, title)

    await client.query('BEGIN')
    const insertRes = await client.query(
      `INSERT INTO dealer_news
        (title, slug, summary, content_html, cover_image_url, status, publish_at, unpublish_at, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       RETURNING id`,
      [title, slug, summary, contentHtml, coverImageUrl, status, publishAt, unpublishAt, access.userId]
    )
    const newsId = insertRes.rows[0].id

    await saveSegments(client, newsId, req.body.segments || {})
    await saveMedia(client, newsId, req.body.media || [])
    await writeChangeLog(client, {
      newsId,
      userId: access.userId,
      actionType: 'create',
      details: { title, status },
    })
    await client.query('COMMIT')
    if (status === 'published') {
      try {
        await enqueueAndSendNewsPublishedPush(pool, {
          newsId,
          title,
          createdBy: access.userId,
        })
      } catch (pushError) {
        console.error('[mobile_app][dealer_news][create_push] error', pushError)
      }
    }
    const full = await getNewsById(pool, newsId)
    return res.status(201).json(full)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[mobile_app][dealer_news][create] error', error)
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
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID новости' })
    const err = validatePayload(req.body)
    if (err) return res.status(400).json({ message: err })

    const existing = await pool.query('SELECT id, cover_image_url FROM dealer_news WHERE id = $1', [newsId])
    if (!existing.rows.length) return res.status(404).json({ message: 'Новость не найдена' })

    const title = String(req.body.title || '').trim()
    const summary = String(req.body.summary || '').trim()
    const status = normalizeStatus(req.body.status)
    const contentHtml = sanitizeNewsHtml(req.body.contentHtml)
    const coverImageUrl = String(req.body.coverImageUrl || '').trim() || existing.rows[0].cover_image_url
    const publishAt =
      status === 'published' ? new Date().toISOString() : status === 'scheduled' ? req.body.publishAt || null : null
    const unpublishAt = req.body.unpublishAt || null
    const slug = await ensureUniqueSlug(pool, title, newsId)

    await client.query('BEGIN')
    await client.query(
      `UPDATE dealer_news
          SET title=$1, slug=$2, summary=$3, content_html=$4, cover_image_url=$5,
              status=$6, publish_at=$7, unpublish_at=$8, updated_at=NOW(), updated_by=$9
        WHERE id=$10`,
      [
        title,
        slug,
        summary,
        contentHtml,
        coverImageUrl,
        status,
        publishAt,
        unpublishAt,
        access.userId,
        newsId,
      ]
    )
    await saveSegments(client, newsId, req.body.segments || {})
    await saveMedia(client, newsId, req.body.media || [])
    await writeChangeLog(client, {
      newsId,
      userId: access.userId,
      actionType: 'update',
      details: { title, status },
    })
    await client.query('COMMIT')
    if (status === 'published') {
      try {
        await enqueueAndSendNewsPublishedPush(pool, {
          newsId,
          title,
          createdBy: access.userId,
        })
      } catch (pushError) {
        console.error('[mobile_app][dealer_news][update_push] error', pushError)
      }
    }

    const full = await getNewsById(pool, newsId)
    return res.status(200).json(full)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[mobile_app][dealer_news][update] error', error)
    return res.status(500).json({ message: 'Ошибка обновления новости' })
  } finally {
    client.release()
  }
}

const removeNews = (pool) => async (req, res) => {
  const client = await pool.connect()
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID новости' })

    await client.query('BEGIN')
    const existing = await client.query('SELECT id, title FROM dealer_news WHERE id = $1', [newsId])
    if (!existing.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Новость не найдена' })
    }
    await writeChangeLog(client, {
      newsId: null,
      userId: access.userId,
      actionType: 'delete',
      details: { title: existing.rows[0].title, deletedNewsId: newsId },
    })
    await client.query('DELETE FROM dealer_news WHERE id = $1', [newsId])
    await client.query('COMMIT')
    return res.status(200).json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[mobile_app][dealer_news][delete] error', error)
    return res.status(500).json({ message: 'Ошибка удаления новости' })
  } finally {
    client.release()
  }
}

const listChangeLog = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const newsId = req.query.newsId ? parseInt(req.query.newsId, 10) : null
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)))

    const params = []
    let where = ''
    if (Number.isFinite(newsId)) {
      params.push(newsId)
      where = `WHERE l.news_id = $${params.length}`
    }
    params.push(limit)
    const result = await pool.query(
      `SELECT l.id, l.news_id, l.user_id, l.action_type, l.details_json, l.created_at
         FROM dealer_news_change_log l
         ${where}
        ORDER BY l.created_at DESC
        LIMIT $${params.length}`,
      params
    )
    return res.status(200).json({ items: result.rows })
  } catch (error) {
    console.error('[mobile_app][dealer_news][change_log] error', error)
    return res.status(500).json({ message: 'Ошибка получения истории' })
  }
}

const listSendLog = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '100', 10)))
    const result = await pool.query(
      `SELECT e.id, e.event_type, e.entity_type, e.entity_id, e.title, e.body, e.status, e.created_at, e.processed_at,
              COALESCE(SUM(CASE WHEN l.status = 'sent' THEN 1 ELSE 0 END), 0)::int AS sent_count,
              COALESCE(SUM(CASE WHEN l.status = 'error' THEN 1 ELSE 0 END), 0)::int AS error_count
         FROM mobile_push_events e
         LEFT JOIN mobile_push_delivery_logs l ON l.event_id = e.id
        GROUP BY e.id
        ORDER BY e.created_at DESC
        LIMIT $1`,
      [limit]
    )
    return res.status(200).json({ items: result.rows })
  } catch (error) {
    console.error('[mobile_app][dealer_news][send_log] error', error)
    return res.status(500).json({ message: 'Ошибка получения лога отправок' })
  }
}

const getTaxonomy = (pool) => async (req, res) => {
  try {
    const access = await checkEditorAccess(pool, req)
    if (!access.ok) return res.status(access.status).json({ message: access.message })
    const [regionsRes, citiesRes, companiesRes, companyAddressRes] = await Promise.all([
      pool.query(
        `SELECT DISTINCT TRIM(region) AS region
           FROM company_addresses
          WHERE TRIM(COALESCE(region, '')) <> ''
          ORDER BY region`
      ),
      pool.query(
        `SELECT DISTINCT TRIM(city) AS city
           FROM company_addresses
          WHERE TRIM(COALESCE(city, '')) <> ''
          ORDER BY city`
      ),
      pool.query(
        `SELECT DISTINCT TRIM(name_companies) AS company_name
           FROM companies
          WHERE TRIM(COALESCE(name_companies, '')) <> ''
          ORDER BY company_name`
      ),
      pool.query(
        `SELECT TRIM(c.name_companies) AS company_name, TRIM(ca.region) AS region, TRIM(ca.city) AS city
           FROM companies c
           LEFT JOIN company_addresses ca ON ca.company_id = c.id
          WHERE TRIM(COALESCE(c.name_companies, '')) <> ''`
      ),
    ])

    const companyMetaMap = new Map()
    const cityRegionMap = new Map()
    const regionCityMap = new Map()

    for (const row of companyAddressRes.rows) {
      const companyName = String(row.company_name || '').trim()
      const region = String(row.region || '').trim()
      const city = String(row.city || '').trim()
      if (!companyName) continue

      if (!companyMetaMap.has(companyName)) {
        companyMetaMap.set(companyName, {
          company_name: companyName,
          regions: [],
          cities: [],
        })
      }
      const companyMeta = companyMetaMap.get(companyName)
      if (region && !companyMeta.regions.includes(region)) companyMeta.regions.push(region)
      if (city && !companyMeta.cities.includes(city)) companyMeta.cities.push(city)

      if (city && region) {
        if (!cityRegionMap.has(city)) cityRegionMap.set(city, [])
        const regions = cityRegionMap.get(city)
        if (!regions.includes(region)) regions.push(region)

        if (!regionCityMap.has(region)) regionCityMap.set(region, [])
        const cities = regionCityMap.get(region)
        if (!cities.includes(city)) cities.push(city)
      }
    }

    return res.status(200).json({
      regions: regionsRes.rows.map((r) => r.region).filter(Boolean),
      cities: citiesRes.rows.map((r) => r.city).filter(Boolean),
      companies: companiesRes.rows.map((r) => r.company_name).filter(Boolean),
      companyMeta: [...companyMetaMap.values()],
      cityRegionMap: Object.fromEntries(cityRegionMap.entries()),
      regionCityMap: Object.fromEntries(regionCityMap.entries()),
    })
  } catch (error) {
    console.error('[mobile_app][dealer_news][taxonomy] error', error)
    return res.status(500).json({ message: 'Ошибка загрузки справочников сегментации' })
  }
}

module.exports = {
  checkEditorAccess,
  listNewsAdmin,
  getNewsAdmin,
  createNews,
  updateNews,
  removeNews,
  listChangeLog,
  listSendLog,
  getTaxonomy,
}
