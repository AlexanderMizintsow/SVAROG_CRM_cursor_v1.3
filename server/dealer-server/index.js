const express = require('express')
const { Pool } = require('pg')
const cors = require('cors')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5003

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})

app.use(cors())
app.use(express.json())
const companyRoutes = require('./companyRoutes/companyRoutes')(pool)
app.use('/api', companyRoutes)

const dealersRoutes = require('./dealersRoutes/dealersRoutes')(pool)
app.use('/api', dealersRoutes)

const competitorRoutes = require('./competitorRoutes/competitorRoutes')(pool)
app.use('/api/competitors', competitorRoutes)

app.listen(port, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${port}`)
})
