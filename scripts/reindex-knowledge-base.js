const path = require('path')

// Зависимости (mammoth/xlsx/pdf-parse/pg) лежат в server/register/node_modules
module.paths.unshift(path.join(__dirname, '..', 'server', 'register', 'node_modules'))

require('dotenv').config({
  path: path.join(__dirname, '..', 'server', 'register', '.env'),
})

const { Pool } = require('pg')
const {
  extractTextFromFile,
  buildSearchBlob,
} = require('../server/register/knowledgeBaseController/extractKnowledgeText')

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})

async function main() {
  const root = path.join(__dirname, '..')
  const { rows } = await pool.query(`
    SELECT id, title, description, tags, file_url, file_name, file_type
    FROM knowledge_documents
    WHERE is_archived = FALSE
  `)

  let updated = 0
  let empty = 0
  for (const row of rows) {
    const filePath = path.join(
      root,
      'uploads',
      'knowledge',
      path.basename(String(row.file_url || ''))
    )
    const extracted = await extractTextFromFile(filePath, {
      fileName: row.file_name,
      mimeType: row.file_type,
    })
    if (!extracted) empty += 1
    const blob = buildSearchBlob({
      title: row.title,
      description: row.description,
      tags: row.tags,
      fileName: row.file_name,
      extractedText: extracted,
    })
    await pool.query(`UPDATE knowledge_documents SET search_text = $1 WHERE id = $2`, [
      blob || null,
      row.id,
    ])
    updated += 1
    console.log(row.id, row.file_name, 'extract=', extracted.length)
  }

  console.log(`DONE updated=${updated} emptyExtract=${empty}`)
  await pool.end()
}

main().catch(async (e) => {
  console.error(e)
  try {
    await pool.end()
  } catch (_) {}
  process.exit(1)
})
