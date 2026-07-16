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

const normalizeImportance = (raw) => {
  const v = String(raw || 'normal').trim().toLowerCase()
  return v === 'high' ? 'high' : 'normal'
}

const buildSlug = (title) =>
  slugify(String(title || 'news'), { lower: true, strict: true, locale: 'ru' })

const ensureUniqueSlug = async (pool, title, exceptNewsId = null) => {
  const base = buildSlug(title) || `news-${Date.now()}`
  let candidate = base
  let index = 1
  while (true) {
    const sql = exceptNewsId
      ? 'SELECT id FROM staff_news WHERE slug = $1 AND id <> $2 LIMIT 1'
      : 'SELECT id FROM staff_news WHERE slug = $1 LIMIT 1'
    const params = exceptNewsId ? [candidate, exceptNewsId] : [candidate]
    const exists = await pool.query(sql, params)
    if (!exists.rows.length) return candidate
    index += 1
    candidate = `${base}-${index}`
  }
}

const mapSegments = (payload = {}) => {
  const segmentMap = {
    department: normalizeArray(payload.departments),
    role: normalizeArray(payload.roles),
    user: normalizeArray(payload.users).map(String),
  }
  return Object.entries(segmentMap).flatMap(([segmentType, values]) =>
    values.map((segmentValue) => ({ segmentType, segmentValue }))
  )
}

const saveSegments = async (client, newsId, payload) => {
  await client.query('DELETE FROM staff_news_segments WHERE news_id = $1', [newsId])
  const segments = mapSegments(payload)
  for (const segment of segments) {
    await client.query(
      `INSERT INTO staff_news_segments (news_id, segment_type, segment_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (news_id, segment_type, segment_value) DO NOTHING`,
      [newsId, segment.segmentType, segment.segmentValue]
    )
  }
}

const saveMedia = async (client, newsId, mediaItems = [], attachments = []) => {
  await client.query(
    `DELETE FROM staff_news_media
      WHERE news_id = $1 AND placement_key IN ('content', 'attachment')`,
    [newsId]
  )
  const contentItems = Array.isArray(mediaItems) ? mediaItems : []
  for (const [idx, item] of contentItems.entries()) {
    await client.query(
      `INSERT INTO staff_news_media
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
  const attachItems = Array.isArray(attachments) ? attachments : []
  for (const [idx, item] of attachItems.entries()) {
    await client.query(
      `INSERT INTO staff_news_media
         (news_id, media_type, file_url, file_name, file_size_bytes, mime_type, width_px, height_px, display_order, placement_key)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7, 'attachment')`,
      [
        newsId,
        String(item.media_type || 'pdf') === 'image' ? 'image' : 'pdf',
        String(item.file_url || ''),
        String(item.file_name || ''),
        Number(item.file_size_bytes || 0),
        String(item.mime_type || 'application/pdf'),
        idx,
      ]
    )
  }
}

const writeChangeLog = async (client, { newsId = null, userId = null, actionType, details = {} }) => {
  await client.query(
    `INSERT INTO staff_news_change_log (news_id, user_id, action_type, details_json)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [newsId, userId, actionType, JSON.stringify(details)]
  )
}

const segmentsFromRows = (rows) => {
  const segments = { departments: [], roles: [], users: [] }
  for (const row of rows || []) {
    if (row.segment_type === 'department') segments.departments.push(row.segment_value)
    if (row.segment_type === 'role') segments.roles.push(row.segment_value)
    if (row.segment_type === 'user') segments.users.push(row.segment_value)
  }
  return segments
}

const getNewsById = async (pool, newsId) => {
  const newsResult = await pool.query(
    `SELECT id, title, slug, summary, content_html, cover_image_url, status, importance, is_pinned,
            COALESCE(requires_ack, FALSE) AS requires_ack,
            COALESCE(comments_enabled, TRUE) AS comments_enabled,
            created_at, updated_at, publish_at, unpublish_at, created_by, updated_by
       FROM staff_news
      WHERE id = $1`,
    [newsId]
  )
  if (!newsResult.rows.length) return null
  const news = newsResult.rows[0]
  const [segmentsRes, mediaRes] = await Promise.all([
    pool.query(
      `SELECT segment_type, segment_value FROM staff_news_segments WHERE news_id = $1`,
      [newsId]
    ),
    pool.query(
      `SELECT id, media_type, file_url, file_name, file_size_bytes, mime_type, width_px, height_px,
              display_order, placement_key
         FROM staff_news_media
        WHERE news_id = $1
        ORDER BY display_order ASC, id ASC`,
      [newsId]
    ),
  ])
  const mediaRows = mediaRes.rows || []
  let poll = null
  try {
    const { getPollForNews } = require('./staffNewsEngagement')
    poll = await getPollForNews(pool, newsId, null)
  } catch (_) {
    poll = null
  }
  return {
    ...news,
    requires_ack: Boolean(news.requires_ack),
    comments_enabled: news.comments_enabled !== false,
    segments: segmentsFromRows(segmentsRes.rows),
    media: mediaRows.filter((m) => m.placement_key === 'content'),
    attachments: mediaRows.filter((m) => m.placement_key === 'attachment'),
    poll,
  }
}

const extractExcerpt = (summary, html) => {
  const source = String(summary || '').trim() || String(html || '')
  const plain = source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.slice(0, 220)
}

const canNewsBeVisibleNow = (row) => {
  if (!row) return false
  const now = Date.now()
  if (row.status === 'published') {
    if (row.unpublish_at && new Date(row.unpublish_at).getTime() <= now) return false
    return true
  }
  if (row.status === 'scheduled') {
    if (!row.publish_at) return false
    if (new Date(row.publish_at).getTime() > now) return false
    if (row.unpublish_at && new Date(row.unpublish_at).getTime() <= now) return false
    return true
  }
  return false
}

const buildSegmentsByType = (segments = []) => ({
  department: segments.filter((s) => s.segment_type === 'department').map((s) => s.segment_value),
  role: segments.filter((s) => s.segment_type === 'role').map((s) => s.segment_value),
  user: segments.filter((s) => s.segment_type === 'user').map((s) => s.segment_value),
})

const isVisibleForEmployee = ({ segmentsByType, userId, departmentId, roleName }) => {
  const hasAny =
    segmentsByType.department.length ||
    segmentsByType.role.length ||
    segmentsByType.user.length
  // Пустая аудитория = всем
  if (!hasAny) return true

  // Аддитивно: отделы ∪ роли ∪ сотрудники (OR между типами и внутри типа)
  const inDepartment = segmentsByType.department.some(
    (x) => String(x) === String(departmentId)
  )
  const inRole = segmentsByType.role.some(
    (x) => String(x).toLowerCase() === String(roleName || '').toLowerCase()
  )
  const inUsers = segmentsByType.user.some((x) => String(x) === String(userId))

  return inDepartment || inRole || inUsers
}

const getEmployeeProfile = async (pool, userId) => {
  const res = await pool.query(
    `SELECT u.id, u.department_id, d.name AS department_name, r.name AS role_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [userId]
  )
  return res.rows[0] || null
}

/**
 * ID сотрудников, которым видна новость (для push).
 */
const resolveAudienceUserIds = async (pool, newsId) => {
  const segmentsRes = await pool.query(
    `SELECT segment_type, segment_value FROM staff_news_segments WHERE news_id = $1`,
    [newsId]
  )
  const byType = buildSegmentsByType(segmentsRes.rows)
  const hasAny =
    byType.department.length || byType.role.length || byType.user.length

  if (!hasAny) {
    const all = await pool.query(`SELECT id FROM users ORDER BY id`)
    return all.rows.map((r) => Number(r.id))
  }

  // Кандидаты: объединение отделов + ролей + точечных сотрудников
  const usersRes = await pool.query(
    `SELECT u.id, u.department_id, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id`
  )
  return usersRes.rows
    .filter((u) =>
      isVisibleForEmployee({
        segmentsByType: byType,
        userId: u.id,
        departmentId: u.department_id,
        roleName: u.role_name,
      })
    )
    .map((u) => Number(u.id))
}

const estimateAudienceCount = async (pool, segmentsPayload) => {
  const mapped = mapSegments(segmentsPayload || {})
  const byType = {
    department: mapped.filter((s) => s.segmentType === 'department').map((s) => s.segmentValue),
    role: mapped.filter((s) => s.segmentType === 'role').map((s) => s.segmentValue),
    user: mapped.filter((s) => s.segmentType === 'user').map((s) => s.segmentValue),
  }
  const usersRes = await pool.query(
    `SELECT u.id, u.department_id, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id`
  )
  const hasAny = byType.department.length || byType.role.length || byType.user.length
  if (!hasAny) return usersRes.rows.length
  return usersRes.rows.filter((u) =>
    isVisibleForEmployee({
      segmentsByType: byType,
      userId: u.id,
      departmentId: u.department_id,
      roleName: u.role_name,
    })
  ).length
}

module.exports = {
  normalizeStatus,
  normalizeImportance,
  ensureUniqueSlug,
  saveSegments,
  saveMedia,
  writeChangeLog,
  getNewsById,
  extractExcerpt,
  canNewsBeVisibleNow,
  buildSegmentsByType,
  isVisibleForEmployee,
  getEmployeeProfile,
  resolveAudienceUserIds,
  estimateAudienceCount,
  mapSegments,
  segmentsFromRows,
}
