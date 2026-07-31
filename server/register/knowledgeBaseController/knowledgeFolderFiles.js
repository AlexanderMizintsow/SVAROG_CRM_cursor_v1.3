/**
 * Файлы внутри документа/папки базы знаний.
 * Подключается из knowledgeBaseController.js
 */

const mapFileRow = (row, fixFilenameEncoding) => ({
  id: Number(row.id),
  documentId: Number(row.document_id),
  fileUrl: row.file_url,
  fileName: fixFilenameEncoding(row.file_name || '') || null,
  fileType: row.file_type || null,
  fileSize: row.file_size != null ? Number(row.file_size) : null,
  fileHash: row.file_hash || null,
  versionNumber: row.version_number != null ? Number(row.version_number) : 1,
  sortOrder: row.sort_order != null ? Number(row.sort_order) : 0,
  uploadedBy: row.uploaded_by != null ? Number(row.uploaded_by) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

async function archiveFileVersion(client, fileRow) {
  await client.query(
    `INSERT INTO knowledge_document_file_versions (
      file_id, document_id, version_number, file_url, file_name, file_type,
      file_size, file_hash, search_text, uploaded_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (file_id, version_number) DO NOTHING`,
    [
      fileRow.id,
      fileRow.document_id,
      fileRow.version_number || 1,
      fileRow.file_url,
      fileRow.file_name,
      fileRow.file_type,
      fileRow.file_size,
      fileRow.file_hash || null,
      fileRow.search_text || null,
      fileRow.uploaded_by || null,
    ]
  )
}

async function loadFilesMap(dbPool, documentIds) {
  const map = {}
  if (!documentIds.length) return map
  try {
    const { rows } = await dbPool.query(
      `SELECT *
       FROM knowledge_document_files
       WHERE document_id = ANY($1::int[])
       ORDER BY sort_order ASC, id ASC`,
      [documentIds]
    )
    rows.forEach((row) => {
      const id = Number(row.document_id)
      if (!map[id]) map[id] = []
      map[id].push(row)
    })
  } catch (error) {
    // таблица ещё не создана — работаем как раньше (только file_* на документе)
    if (error && error.code !== '42P01') throw error
  }
  return map
}

async function loadFilesCounts(dbPool, documentIds) {
  const map = {}
  if (!documentIds.length) return map
  try {
    const { rows } = await dbPool.query(
      `SELECT document_id, COUNT(*)::int AS cnt
       FROM knowledge_document_files
       WHERE document_id = ANY($1::int[])
       GROUP BY document_id`,
      [documentIds]
    )
    rows.forEach((row) => {
      map[Number(row.document_id)] = Number(row.cnt) || 0
    })
  } catch (error) {
    if (error && error.code !== '42P01') throw error
  }
  return map
}

async function insertDocumentFile(client, payload) {
  const {
    documentId,
    fileUrl,
    fileName,
    fileType,
    fileSize,
    fileHash,
    searchText,
    sortOrder = 0,
    versionNumber = 1,
    uploadedBy,
  } = payload

  const { rows } = await client.query(
    `INSERT INTO knowledge_document_files (
      document_id, file_url, file_name, file_type, file_size, file_hash,
      search_text, sort_order, version_number, uploaded_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *`,
    [
      documentId,
      fileUrl,
      fileName || null,
      fileType || null,
      fileSize != null ? Number(fileSize) : null,
      fileHash || null,
      searchText || null,
      sortOrder,
      versionNumber,
      uploadedBy || null,
    ]
  )
  return rows[0]
}

/**
 * Синхронизирует «главный» файл документа (для списка/старых клиентов)
 * с первым файлом папки.
 */
async function syncPrimaryFileFromChildren(client, documentId) {
  const { rows } = await client.query(
    `SELECT * FROM knowledge_document_files
     WHERE document_id = $1
     ORDER BY sort_order ASC, id ASC
     LIMIT 1`,
    [documentId]
  )
  if (!rows.length) {
    await client.query(
      `UPDATE knowledge_documents SET
        file_url = NULL,
        file_name = NULL,
        file_type = NULL,
        file_size = NULL,
        file_hash = NULL,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [documentId]
    )
    return null
  }
  const f = rows[0]
  await client.query(
    `UPDATE knowledge_documents SET
      file_url = $1,
      file_name = $2,
      file_type = $3,
      file_size = $4,
      file_hash = $5,
      version_number = $6,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $7`,
    [
      f.file_url,
      f.file_name,
      f.file_type,
      f.file_size,
      f.file_hash,
      f.version_number || 1,
      documentId,
    ]
  )
  return f
}

async function rebuildDocumentSearchText(client, documentId, meta = {}) {
  const { rows: files } = await client.query(
    `SELECT file_name, search_text FROM knowledge_document_files
     WHERE document_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [documentId]
  )
  const { rows: docs } = await client.query(
    `SELECT title, description, tags FROM knowledge_documents WHERE id = $1`,
    [documentId]
  )
  const doc = docs[0] || {}
  const title = meta.title != null ? meta.title : doc.title
  const description =
    meta.description != null ? meta.description : doc.description || ''
  const tags = meta.tags != null ? meta.tags : doc.tags || []

  const parts = [
    title,
    description,
    Array.isArray(tags) ? tags.join(' ') : '',
    ...files.map((f) => `${f.file_name || ''} ${f.search_text || ''}`),
  ]
  const blob = parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500000)

  await client.query(
    `UPDATE knowledge_documents SET search_text = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [blob || null, documentId]
  )
  return blob
}

const collectUploadFiles = (req) => {
  const list = []
  if (Array.isArray(req.files) && req.files.length) {
    req.files.forEach((f) => list.push(f))
  } else if (req.file) {
    list.push(req.file)
  }
  return list
}

module.exports = {
  mapFileRow,
  loadFilesMap,
  loadFilesCounts,
  insertDocumentFile,
  archiveFileVersion,
  syncPrimaryFileFromChildren,
  rebuildDocumentSearchText,
  collectUploadFiles,
}
