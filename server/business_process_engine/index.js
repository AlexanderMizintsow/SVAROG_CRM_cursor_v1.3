require('dotenv').config()
const express = require('express')
const cors = require('cors')
const config = require('./config')
const pool = require('./db/pool')
const processDefinitionsRoutes = require('./routes/processDefinitions')
const processInstancesRoutes = require('./routes/processInstances')
const taskTemplatesRoutes = require('./routes/taskTemplates')
const referencesRoutes = require('./routes/references')
const webhooksRoutes = require('./routes/webhooks')
const analyticsRoutes = require('./routes/analytics')
const notificationsRoutes = require('./routes/notifications')
const { startTimerWorker } = require('./engine/workers/timerWorker')
const { startScheduleWorker } = require('./engine/workers/scheduleWorker')

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/bp/processes', processDefinitionsRoutes(pool))
app.use('/api/bp/instances', processInstancesRoutes(pool))
app.use('/api/bp/task-templates', taskTemplatesRoutes(pool))
app.use('/api/bp/references', referencesRoutes())
app.use('/api/bp/webhooks', webhooksRoutes(pool))
app.use('/api/bp/analytics', analyticsRoutes(pool))
app.use('/api/bp/notifications', notificationsRoutes(pool))

app.get('/api/bp/health', (req, res) => {
  res.json({ status: 'ok', service: 'business_process_engine' })
})

startTimerWorker(pool)
startScheduleWorker(pool)

const port = config.port
app.listen(port, '0.0.0.0', () => {
  console.log(`Business Process Engine запущен на порту ${port}`)
})
