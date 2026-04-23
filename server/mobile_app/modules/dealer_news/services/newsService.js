const slugify = require('slugify')

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

const normalizeStatus = (rawStatus) => {
  const status = String(rawStatus || 'draft').trim().toLowerCase()
  if (['draft', 'scheduled', 'published', 'archived'].includes(status)) return status
  return 'draft'
}

const buildSlug = (title) =>
  slugify(String(title || 'news'), {
    lower: true,
    strict: true,
    locale: 'ru',
  })

const ensureUniqueSlug = async (pool, title, exceptNewsId = null) => {
  const base = buildSlug(title) || `news-${Date.now()}`
  let candidate = base
  let index = 1

  while (true) {
    const sql = exceptNewsId
      ? 'SELECT id FROM dealer_news WHERE slug = $1 AND id <> $2 LIMIT 1'
      : 'SELECT id FROM dealer_news WHERE slug = $1 LIMIT 1'
    const params = exceptNewsId ? [candidate, exceptNewsId] : [candidate]
    const exists = await pool.query(sql, params)
    if (!exists.rows.length) return candidate
    index += 1
    candidate = `${base}-${index}`
  }
}

const mapSegments = (payload = {}) => {
  const segmentMap = {
    region: normalizeArray(payload.regions),
    city: normalizeArray(payload.cities),
    company: normalizeArray(payload.companies),
  }

  return Object.entries(segmentMap).flatMap(([segmentType, values]) =>
    values.map((segmentValue) => ({
      segmentType,
      segmentValue,
    }))
  )
}

const saveSegments = async (client, newsId, payload) => {
  await client.query('DELETE FROM dealer_news_segments WHERE news_id = $1', [newsId])
  const segments = mapSegments(payload)
  if (!segments.length) return

  for (const segment of segments) {
    await client.query(
      `INSERT INTO dealer_news_segments (news_id, segment_type, segment_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (news_id, segment_type, segment_value) DO NOTHING`,
      [newsId, segment.segmentType, segment.segmentValue]
    )
  }
}

const saveMedia = async (client, newsId, mediaItems = []) => {
  await client.query(
    "DELETE FROM dealer_news_media WHERE news_id = $1 AND placement_key = 'content'",
    [newsId]
  )
  if (!Array.isArray(mediaItems) || !mediaItems.length) return

  for (const [idx, item] of mediaItems.entries()) {
    await client.query(
      `INSERT INTO dealer_news_media
         (news_id, media_type, file_url, file_name, file_size_bytes, mime_type, width_px, height_px, display_order, placement_key)
       VALUES ($1, 'image', $2, $3, $4, $5, $6, $7, $8, 'content')`,
      [
        newsId,
        String(item.file_url || ''),
        String(item.file_name || ''),
        Number(item.file_size_bytes || 0),
        String(item.mime_type || 'image/jpeg'),
        item.width_px || null,
        item.height_px || null,
        idx,
      ]
    )
  }
}

const writeChangeLog = async (client, { newsId = null, userId = null, actionType, details = {} }) => {
  await client.query(
    `INSERT INTO dealer_news_change_log (news_id, user_id, action_type, details_json)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [newsId, userId, actionType, JSON.stringify(details)]
  )
}

const getNewsById = async (pool, newsId) => {
  const newsResult = await pool.query(
    `SELECT id, title, slug, summary, content_html, cover_image_url, status, created_at, updated_at,
            publish_at, unpublish_at, created_by, updated_by
       FROM dealer_news
      WHERE id = $1`,
    [newsId]
  )
  if (!newsResult.rows.length) return null

  const news = newsResult.rows[0]
  const [segmentsRes, mediaRes] = await Promise.all([
    pool.query(
      `SELECT segment_type, segment_value
         FROM dealer_news_segments
        WHERE news_id = $1`,
      [newsId]
    ),
    pool.query(
      `SELECT id, file_url, file_name, file_size_bytes, mime_type, width_px, height_px, display_order
         FROM dealer_news_media
        WHERE news_id = $1
        ORDER BY display_order ASC, id ASC`,
      [newsId]
    ),
  ])

  const segments = {
    regions: [],
    cities: [],
    companies: [],
  }
  for (const row of segmentsRes.rows) {
    if (row.segment_type === 'region') segments.regions.push(row.segment_value)
    if (row.segment_type === 'city') segments.cities.push(row.segment_value)
    if (row.segment_type === 'company') segments.companies.push(row.segment_value)
  }

  return {
    ...news,
    segments,
    media: mediaRes.rows,
  }
}

const extractExcerpt = (summary, html) => {
  const source = String(summary || '').trim() || String(html || '')
  const plain = source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.slice(0, 220)
}

const canNewsBeVisibleNow = (row) => {
  const now = new Date()
  if (row.status === 'published') return true
  if (row.status !== 'scheduled') return false
  if (!row.publish_at) return false
  const publishAt = new Date(row.publish_at)
  const unpublishAt = row.unpublish_at ? new Date(row.unpublish_at) : null
  if (publishAt > now) return false
  if (unpublishAt && unpublishAt <= now) return false
  return true
}

module.exports = {
  normalizeStatus,
  ensureUniqueSlug,
  saveSegments,
  saveMedia,
  writeChangeLog,
  getNewsById,
  extractExcerpt,
  canNewsBeVisibleNow,
}
