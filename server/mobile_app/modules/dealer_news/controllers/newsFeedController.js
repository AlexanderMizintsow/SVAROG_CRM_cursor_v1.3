const { extractExcerpt, canNewsBeVisibleNow } = require('../services/newsService')

const buildSegmentsByType = (segments = []) => ({
  region: segments.filter((s) => s.segment_type === 'region').map((s) => s.segment_value),
  city: segments.filter((s) => s.segment_type === 'city').map((s) => s.segment_value),
  company: segments.filter((s) => s.segment_type === 'company').map((s) => s.segment_value),
})

const isVisibleForDealer = ({ segmentsByType, dealerRegion, dealerCity, companyName }) => {
  const regionOk =
    !segmentsByType.region.length ||
    segmentsByType.region.some((x) => x.toLowerCase() === dealerRegion.toLowerCase())
  const cityOk =
    !segmentsByType.city.length || segmentsByType.city.some((x) => x.toLowerCase() === dealerCity.toLowerCase())
  const companyOk =
    !segmentsByType.company.length ||
    segmentsByType.company.some((x) => x.toLowerCase() === companyName.toLowerCase())
  return regionOk && cityOk && companyOk
}

const listFeed = (pool) => async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '10', 10)))
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10))
    const companyName = String(req.user?.companyName || '').trim()
    const profileRes = await pool.query(
      `SELECT ca.region, ca.city
         FROM companies c
         LEFT JOIN company_addresses ca ON ca.company_id = c.id
        WHERE LOWER(c.name_companies) = LOWER($1)
        ORDER BY ca.is_primary DESC NULLS LAST, ca.id ASC
        LIMIT 1`,
      [companyName]
    )
    const dealerRegion = String(profileRes.rows[0]?.region || '').trim()
    const dealerCity = String(profileRes.rows[0]?.city || '').trim()

    const rows = await pool.query(
      `SELECT n.id, n.title, n.summary, n.content_html, n.cover_image_url, n.status, n.publish_at, n.unpublish_at,
              n.created_at, n.updated_at
         FROM dealer_news n
        WHERE n.status IN ('published', 'scheduled')
        ORDER BY COALESCE(n.publish_at, n.created_at) DESC, n.id DESC
        LIMIT $1 OFFSET $2`,
      [Math.max(limit * 4, 40), offset]
    )

    const filtered = []
    for (const row of rows.rows) {
      if (!canNewsBeVisibleNow(row)) continue

      const segmentsRes = await pool.query(
        `SELECT segment_type, segment_value
           FROM dealer_news_segments
          WHERE news_id = $1`,
        [row.id]
      )
      const segments = segmentsRes.rows
      const segmentsByType = buildSegmentsByType(segments)
      if (
        !segments.length ||
        isVisibleForDealer({ segmentsByType, dealerRegion, dealerCity, companyName })
      ) {
        filtered.push(row)
      }

      if (filtered.length >= limit) break
    }

    return res.status(200).json({
      items: filtered.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        excerpt: extractExcerpt(row.summary, row.content_html),
        coverImageUrl: row.cover_image_url,
        createdAt: row.created_at,
        publishAt: row.publish_at,
      })),
      hasMore: filtered.length >= limit,
      nextOffset: offset + filtered.length,
    })
  } catch (error) {
    console.error('[mobile_app][dealer_news][feed_list] error', error)
    return res.status(500).json({ message: 'Ошибка получения новостей' })
  }
}

const getFeedItem = (pool) => async (req, res) => {
  try {
    const newsId = parseInt(req.params.newsId, 10)
    if (!Number.isFinite(newsId)) return res.status(400).json({ message: 'Некорректный ID новости' })

    const result = await pool.query(
      `SELECT id, title, summary, content_html, cover_image_url, status, publish_at, unpublish_at, created_at
         FROM dealer_news
        WHERE id = $1`,
      [newsId]
    )
    if (!result.rows.length) return res.status(404).json({ message: 'Новость не найдена' })

    const row = result.rows[0]
    if (!canNewsBeVisibleNow(row)) return res.status(404).json({ message: 'Новость не найдена' })

    const companyName = String(req.user?.companyName || '').trim()
    const profileRes = await pool.query(
      `SELECT ca.region, ca.city
         FROM companies c
         LEFT JOIN company_addresses ca ON ca.company_id = c.id
        WHERE LOWER(c.name_companies) = LOWER($1)
        ORDER BY ca.is_primary DESC NULLS LAST, ca.id ASC
        LIMIT 1`,
      [companyName]
    )
    const dealerRegion = String(profileRes.rows[0]?.region || '').trim()
    const dealerCity = String(profileRes.rows[0]?.city || '').trim()
    const segmentsRes = await pool.query(
      `SELECT segment_type, segment_value
         FROM dealer_news_segments
        WHERE news_id = $1`,
      [newsId]
    )
    const segmentsByType = buildSegmentsByType(segmentsRes.rows)
    const visibleForDealer =
      !segmentsRes.rows.length ||
      isVisibleForDealer({ segmentsByType, dealerRegion, dealerCity, companyName })
    if (!visibleForDealer) {
      return res.status(404).json({ message: 'Новость не найдена' })
    }

    const mediaRes = await pool.query(
      `SELECT id, file_url, file_name, file_size_bytes, mime_type, width_px, height_px, display_order
         FROM dealer_news_media
        WHERE news_id = $1
        ORDER BY display_order ASC, id ASC`,
      [newsId]
    )
    return res.status(200).json({
      id: row.id,
      title: row.title,
      summary: row.summary,
      contentHtml: row.content_html,
      coverImageUrl: row.cover_image_url,
      createdAt: row.created_at,
      publishAt: row.publish_at,
      media: mediaRes.rows,
    })
  } catch (error) {
    console.error('[mobile_app][dealer_news][feed_item] error', error)
    return res.status(500).json({ message: 'Ошибка получения новости' })
  }
}

module.exports = {
  listFeed,
  getFeedItem,
}
