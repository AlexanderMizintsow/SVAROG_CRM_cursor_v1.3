const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const isExpoPushToken = (token) =>
  /^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(String(token || ''))

const buildNewsRecipientsQuery = async (pool, newsId) => {
  const segmentsRes = await pool.query(
    `SELECT segment_type, segment_value
       FROM dealer_news_segments
      WHERE news_id = $1`,
    [newsId]
  )
  const byType = {
    region: segmentsRes.rows.filter((s) => s.segment_type === 'region').map((s) => s.segment_value),
    city: segmentsRes.rows.filter((s) => s.segment_type === 'city').map((s) => s.segment_value),
    company: segmentsRes.rows.filter((s) => s.segment_type === 'company').map((s) => s.segment_value),
  }

  const companiesRes = await pool.query(
    `SELECT c.id AS company_id, c.name_companies AS company_name, ca.region, ca.city
       FROM companies c
       LEFT JOIN company_addresses ca ON ca.company_id = c.id
      WHERE TRIM(COALESCE(c.name_companies, '')) <> ''`
  )

  const uniqueCompanies = new Map()
  for (const row of companiesRes.rows) {
    const key = String(row.company_id)
    if (!uniqueCompanies.has(key)) {
      uniqueCompanies.set(key, {
        company_id: row.company_id,
        company_name: row.company_name,
        regions: [],
        cities: [],
      })
    }
    const item = uniqueCompanies.get(key)
    if (row.region && !item.regions.includes(row.region)) item.regions.push(row.region)
    if (row.city && !item.cities.includes(row.city)) item.cities.push(row.city)
  }

  return [...uniqueCompanies.values()].filter((company) => {
    const companyOk =
      !byType.company.length ||
      byType.company.some((x) => x.toLowerCase() === String(company.company_name || '').toLowerCase())
    const regionOk = !byType.region.length || byType.region.some((x) => company.regions.includes(x))
    const cityOk = !byType.city.length || byType.city.some((x) => company.cities.includes(x))
    return companyOk && regionOk && cityOk
  })
}

const sendExpoPushMessage = async ({ token, title, body, data }) => {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      sound: 'default',
      title,
      body,
      data,
    }),
  })

  const responseJson = await response.json().catch(() => ({}))
  if (!response.ok || responseJson?.data?.status === 'error') {
    const message =
      responseJson?.data?.message ||
      responseJson?.errors?.[0]?.message ||
      `Expo push error: ${response.status}`
    throw new Error(message)
  }
  return responseJson
}

const createPushEvent = async (pool, { eventType, entityType, entityId, title, body, payload, createdBy }) => {
  const result = await pool.query(
    `INSERT INTO mobile_push_events
      (event_type, entity_type, entity_id, title, body, payload_json, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'queued', $7)
     RETURNING id`,
    [eventType, entityType || null, entityId || null, title, body, JSON.stringify(payload || {}), createdBy || null]
  )
  return result.rows[0].id
}

const dispatchPushEvent = async (pool, eventId, recipients) => {
  await pool.query(`UPDATE mobile_push_events SET status='processing' WHERE id = $1`, [eventId])

  const eventRes = await pool.query(
    `SELECT id, title, body, payload_json
       FROM mobile_push_events
      WHERE id = $1`,
    [eventId]
  )
  if (!eventRes.rows.length) return
  const event = eventRes.rows[0]

  let sentCount = 0
  let errorCount = 0
  const sentTokens = new Set()
  for (const company of recipients) {
    const devicesRes = await pool.query(
      `SELECT id, expo_push_token, company_id, company_name
         FROM mobile_push_devices
        WHERE company_id = $1 AND is_active = TRUE`,
      [company.company_id]
    )

    for (const device of devicesRes.rows) {
      const token = String(device.expo_push_token || '').trim()
      if (sentTokens.has(token)) {
        continue
      }
      if (!isExpoPushToken(token)) {
        await pool.query(
          `INSERT INTO mobile_push_delivery_logs
            (event_id, company_id, company_name, expo_push_token, status, error_message, response_json)
           VALUES ($1, $2, $3, $4, 'error', $5, $6::jsonb)`,
          [eventId, device.company_id, device.company_name, token, 'Некорректный Expo push token', '{}']
        )
        errorCount += 1
        continue
      }

      try {
        const responseJson = await sendExpoPushMessage({
          token,
          title: event.title,
          body: event.body,
          data: event.payload_json || {},
        })
        await pool.query(
          `INSERT INTO mobile_push_delivery_logs
            (event_id, company_id, company_name, expo_push_token, status, response_json)
           VALUES ($1, $2, $3, $4, 'sent', $5::jsonb)`,
          [eventId, device.company_id, device.company_name, token, JSON.stringify(responseJson || {})]
        )
        sentCount += 1
        sentTokens.add(token)
      } catch (error) {
        await pool.query(
          `INSERT INTO mobile_push_delivery_logs
            (event_id, company_id, company_name, expo_push_token, status, error_message, response_json)
           VALUES ($1, $2, $3, $4, 'error', $5, $6::jsonb)`,
          [
            eventId,
            device.company_id,
            device.company_name,
            token,
            error?.message || 'Unknown push error',
            '{}',
          ]
        )
        errorCount += 1
      }
    }
  }

  await pool.query(
    `UPDATE mobile_push_events
        SET status = $2,
            processed_at = NOW()
      WHERE id = $1`,
    [eventId, errorCount > 0 && sentCount === 0 ? 'failed' : 'done']
  )
  console.log('[mobile_app][push] event dispatched', {
    eventId,
    sentCount,
    errorCount,
    recipientsCount: recipients.length,
  })
}

const enqueueAndSendNewsPublishedPush = async (pool, { newsId, title, createdBy }) => {
  const recipients = await buildNewsRecipientsQuery(pool, newsId)
  console.log('[mobile_app][push] publish recipients resolved', {
    newsId,
    recipientsCount: recipients.length,
  })
  const eventId = await createPushEvent(pool, {
    eventType: 'news_published',
    entityType: 'dealer_news',
    entityId: newsId,
    title: 'Новая новость ПОЗ',
    body: title ? `${title}` : 'Опубликована новая новость',
    payload: { type: 'news_published', newsId },
    createdBy,
  })
  await dispatchPushEvent(pool, eventId, recipients)
}

const registerPushDevice = async (pool, { companyId, companyName, token, platform, appVersion }) => {
  const normalizedPlatform = platform || 'android'

  // Keep only one active token per company+platform to prevent duplicate pushes
  // on app reinstall / token rotation scenarios.
  await pool.query(
    `UPDATE mobile_push_devices
        SET is_active = FALSE,
            updated_at = NOW()
      WHERE company_id = $1
        AND platform = $2
        AND expo_push_token <> $3
        AND is_active = TRUE`,
    [companyId, normalizedPlatform, token]
  )

  await pool.query(
    `INSERT INTO mobile_push_devices
      (company_id, company_name, expo_push_token, platform, app_version, is_active, last_seen_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
     ON CONFLICT (company_id, expo_push_token)
     DO UPDATE SET
       company_name = EXCLUDED.company_name,
       platform = EXCLUDED.platform,
       app_version = EXCLUDED.app_version,
       is_active = TRUE,
       last_seen_at = NOW(),
       updated_at = NOW()`,
    [companyId, companyName, token, normalizedPlatform, appVersion || null]
  )
  console.log('[mobile_app][push] device registered', {
    companyId,
    companyName,
    platform: normalizedPlatform,
    appVersion: appVersion || null,
    tokenPrefix: String(token || '').slice(0, 24),
  })
}

const enqueueAndSendCompanyPush = async (pool, { companyId, companyName, title, body, payload }) => {
  const eventId = await createPushEvent(pool, {
    eventType: 'complaint_status',
    entityType: 'complaint',
    entityId: null,
    title,
    body,
    payload,
    createdBy: null,
  })
  await dispatchPushEvent(pool, eventId, [{ company_id: companyId, company_name: companyName }])
}

module.exports = {
  enqueueAndSendNewsPublishedPush,
  registerPushDevice,
  enqueueAndSendCompanyPush,
}
