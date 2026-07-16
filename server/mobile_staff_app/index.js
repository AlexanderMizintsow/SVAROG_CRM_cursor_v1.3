require('dotenv').config()
const http = require('http')
const express = require('express')
const pool = require('./db/pool')
const employeeAuthRoutes = require('./routes/employeeAuthRoutes')
const employeeTasksRoutes = require('./routes/employeeTasksRoutes')
const employeeProjectsRoutes = require('./routes/employeeProjectsRoutes')
const employeeNotificationsRoutes = require('./routes/employeeNotificationsRoutes')
const employeeAnalyticsRoutes = require('./routes/employeeAnalyticsRoutes')
const employeeBadgesRoutes = require('./routes/employeeBadgesRoutes')
const employeeAbsencesRoutes = require('./routes/employeeAbsencesRoutes')
const employeeWorkGroupsRoutes = require('./routes/employeeWorkGroupsRoutes')
const staffNewsAdminRoutes = require('./routes/staffNewsAdminRoutes')
const staffNewsFeedRoutes = require('./routes/staffNewsFeedRoutes')
const path = require('path')
const { configureSecurity } = require('./middleware/security')
const { setupSocketBridge } = require('./services/socketBridge')
const {
  startWorkGroupReminderScheduler,
} = require('./services/workGroupReminderScheduler')

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
app.use(express.json({ limit: '5mb' }))
app.set('trust proxy', 1)

app.use(
  '/uploads/staff_news',
  express.static(path.join(__dirname, '..', '..', 'uploads', 'staff_news'))
)

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
app.use('/api/mobile/employee/tasks', employeeTasksRoutes())
app.use('/api/mobile/employee/projects', employeeProjectsRoutes())
app.use('/api/mobile/employee/notifications', employeeNotificationsRoutes(pool))
app.use('/api/mobile/employee/analytics', employeeAnalyticsRoutes())
app.use('/api/mobile/employee/badges', employeeBadgesRoutes(pool))
app.use('/api/mobile/employee/absences', employeeAbsencesRoutes())
app.use('/api/mobile/employee/work-groups', employeeWorkGroupsRoutes(pool))
app.use('/api/mobile/employee/news-admin', staffNewsAdminRoutes(pool))
app.use('/api/mobile/employee/news', staffNewsFeedRoutes(pool))

setupSocketBridge(httpServer)
startWorkGroupReminderScheduler(pool)

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`mobile_staff_app server started on ${port}`)
})
