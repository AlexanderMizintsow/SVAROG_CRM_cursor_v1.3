/**
 * Центральный конфиг Register-сервера.
 * Все URL и допустимые origin берутся из переменных окружения (.env).
 * На другом ПК задайте в .env свои значения (например BPE_API_URL=http://192.168.57.112:5010).
 */

const BPE_API_URL = process.env.BPE_API_URL || process.env.BPE_WEBHOOK_URL || 'http://localhost:5010'

/** CORS/Socket.io: список допустимых origin через запятую в CORS_ORIGINS, либо значения по умолчанию */
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

module.exports = {
  BPE_API_URL,
  getCorsOrigins,
}
