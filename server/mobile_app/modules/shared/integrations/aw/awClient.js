const getOrderItems = async ({ orderNo, inn, year = 2026 }) => {
  const directBase = String(process.env.AW_API_BASE_URL || '').trim()
  const legacyBase = String(process.env.API_BASE_URL || '').trim()
  const baseUrl = directBase || (legacyBase ? `${legacyBase}5005/` : '')
  if (!baseUrl) {
    throw new Error('AW_API_BASE_URL is not configured')
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const path =
    Number(year) === 2026
      ? `app/order/items/${encodeURIComponent(orderNo)}/${encodeURIComponent(inn)}`
      : `app/order/items/${encodeURIComponent(orderNo)}/${encodeURIComponent(inn)}/${encodeURIComponent(year)}`

  try {
    const response = await fetch(`${normalizedBase}${path}`)
    if (!response.ok) {
      throw new Error(`AW request failed: ${response.status}`)
    }

    try {
      return await response.json()
    } catch (error) {
      throw new Error('AW invalid response format')
    }
  } catch (error) {
    if (/fetch failed|timed out|EHOSTUNREACH|ECONNREFUSED|ENETUNREACH/i.test(String(error?.message || ''))) {
      throw new Error('AW service unavailable')
    }
    throw error
  }
}

module.exports = {
  awClient: {
    getOrderItems,
  },
}
