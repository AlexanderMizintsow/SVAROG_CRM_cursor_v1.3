/**
 * Конфиг email-service. На другом ПК задайте CORS_ORIGINS в .env.
 */
function getCorsOrigins() {
  const raw = process.env.CORS_ORIGINS
  if (raw && typeof raw === 'string') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return [
    'http://localhost:5173',
    'http://192.168.57.112:5173',
    'http://172.26.32.1:5173',
  ]
}

module.exports = { getCorsOrigins }
