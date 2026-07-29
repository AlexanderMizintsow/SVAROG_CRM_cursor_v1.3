module.paths.unshift(require('path').join(__dirname, '..', 'server', 'register', 'node_modules'))
require('dotenv').config({
  path: require('path').join(__dirname, '..', 'server', 'register', '.env'),
})
const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'db', 'migrations', 'add_knowledge_base_versions_audit.sql'),
    'utf8'
  )
  await pool.query(sql)
  console.log('OK: add_knowledge_base_versions_audit.sql applied')
  await pool.end()
}

main().catch(async (e) => {
  console.error(e)
  try {
    await pool.end()
  } catch (_) {}
  process.exit(1)
})
