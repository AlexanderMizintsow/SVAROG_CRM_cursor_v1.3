const getOrderItems = async ({ orderNo, inn, year = 2026 }) => {
  const baseUrl = String(process.env.AW_API_BASE_URL || '').trim()
  if (!baseUrl) {
    throw new Error('AW_API_BASE_URL is not configured')
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const path =
    Number(year) === 2026
      ? `app/order/items/${encodeURIComponent(orderNo)}/${encodeURIComponent(inn)}`
      : `app/order/items/${encodeURIComponent(orderNo)}/${encodeURIComponent(inn)}/${encodeURIComponent(year)}`

  const response = await fetch(`${normalizedBase}${path}`)
  if (!response.ok) {
    throw new Error(`AW request failed: ${response.status}`)
  }

  return response.json()
}

module.exports = {
  awClient: {
    getOrderItems,
  },
}
