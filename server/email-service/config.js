/**
 * Конфиг email-service. CORS_ORIGINS в .env дополняется localhost:5173 для кросс-домена.
 */
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
function getCorsOrigins() {
  const raw = process.env.CORS_ORIGINS
  const fromEnv = raw && typeof raw === 'string'
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://192.168.57.112:5173', 'http://172.26.32.1:5173']
  return [...new Set([...DEV_ORIGINS, ...fromEnv])]
}

module.exports = { getCorsOrigins }
