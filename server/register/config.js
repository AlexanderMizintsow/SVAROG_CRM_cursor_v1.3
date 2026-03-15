/**
 * Центральный конфиг Register-сервера.
 * Все URL и допустимые origin берутся из переменных окружения (.env).
 * На другом ПК задайте в .env свои значения (например BPE_API_URL=http://192.168.57.112:5010).
 */

const BPE_API_URL = process.env.BPE_API_URL || process.env.BPE_WEBHOOK_URL || 'http://localhost:5010'

/** CORS/Socket.io: список допустимых origin. Из CORS_ORIGINS + всегда localhost:5173 (кросс-домен: фронт локально, бэк на другом ПК) */
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
function getCorsOrigins() {
  const raw = process.env.CORS_ORIGINS
  const fromEnv = raw && typeof raw === 'string'
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://192.168.57.112:5173', 'http://172.26.32.1:5173']
  return [...new Set([...DEV_ORIGINS, ...fromEnv])]
}

module.exports = {
  BPE_API_URL,
  getCorsOrigins,
}
