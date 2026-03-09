const { Pool } = require('pg')
const config = require('../config')

const pool = new Pool(config.db)

// Единый часовой пояс с register — чтобы NOW(), timestamps интерпретировались одинаково
const dbTimezone = process.env.DB_TIMEZONE || 'Europe/Moscow'
pool.on('connect', (client) => {
  client.query(`SET timezone = '${dbTimezone.replace(/'/g, "''")}'`).catch(() => {})
})

module.exports = pool
