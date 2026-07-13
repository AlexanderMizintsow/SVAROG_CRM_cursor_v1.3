require('dotenv').config()
const http = require('http')
const express = require('express')
const pool = require('./db/pool')
const employeeAuthRoutes = require('./routes/employeeAuthRoutes')
const { configureSecurity } = require('./middleware/security')

const app = express()
const httpServer = http.createServer(app)
const port = process.env.PORT || 5011
const isProduction = process.env.NODE_ENV === 'production'

if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET и JWT_REFRESH_SECRET обязательны')
}

if (
  process.env.JWT_ACCESS_SECRET.includes('replace_with') ||
  process.env.JWT_REFRESH_SECRET.includes('replace_with')
) {
  throw new Error('Замените шаблонные JWT секреты в .env')
}

if (isProduction && process.env.CORS_ORIGIN === '*') {
  throw new Error('В production CORS_ORIGIN не должен быть *')
}

configureSecurity(app)
app.use(express.json({ limit: '1mb' }))
app.set('trust proxy', 1)

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({ status: 'ok', service: 'mobile_staff_app' })
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'DB connection failed' })
  }
})

app.use('/api/mobile/employee/auth', employeeAuthRoutes(pool))
app.use('/api/mobile/auth', employeeAuthRoutes(pool))

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`mobile_staff_app server started on ${port}`)
})
