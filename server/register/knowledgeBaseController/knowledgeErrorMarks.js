/**
 * Отметки «обнаружена ошибка» в базе знаний (только веб-API).
 * Подключается из knowledgeBaseController.js — не меняет download/view.
 */

const tableMissing = (error) => error && error.code === '42P01'

const AUTHOR_NAME_SQL = `
  TRIM(CONCAT(
    COALESCE(u.last_name, ''),
    CASE
      WHEN COALESCE(u.first_name, '') <> '' OR COALESCE(u.middle_name, '') <> ''
      THEN ' '
      ELSE ''
    END,
    CASE
      WHEN COALESCE(u.first_name, '') <> '' THEN LEFT(u.first_name, 1) || '.'
      ELSE ''
    END,
    CASE
      WHEN COALESCE(u.middle_name, '') <> '' THEN LEFT(u.middle_name, 1) || '.'
      ELSE ''
    END
  ))
`

const mapMarkRow = (row) => ({
  id: Number(row.id),
  documentId: Number(row.document_id),
  fileId: row.file_id != null ? Number(row.file_id) : null,
  comment: String(row.comment || '').trim(),
  createdBy: Number(row.created_by),
  createdByName: String(row.created_by_name || '').trim() || 'Пользователь',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

async function loadErrorMarksMap(dbPool, documentIds) {
  const map = {}
  if (!documentIds.length) return map
  try {
    const { rows } = await dbPool.query(
      `SELECT m.*,
              ${AUTHOR_NAME_SQL} AS created_by_name
       FROM knowledge_document_error_marks m
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.document_id = ANY($1::int[])
       ORDER BY m.updated_at DESC, m.id DESC`,
      [documentIds]
    )
    rows.forEach((row) => {
      const id = Number(row.document_id)
      if (!map[id]) map[id] = []
      map[id].push(mapMarkRow(row))
    })
  } catch (error) {
    if (!tableMissing(error)) throw error
  }
  return map
}

function createErrorMarksHandlers({
  resolveUserId,
  getKnowledgePermissions,
  loadSegmentsMap,
  isVisibleToUser,
}) {
  async function assertDocumentAccess(dbPool, userId, documentId) {
    const perms = await getKnowledgePermissions(dbPool, userId)
    const { rows } = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [documentId]
    )
    if (!rows.length) {
      const err = new Error('Документ не найден')
      err.status = 404
      throw err
    }
    const segmentsMap = await loadSegmentsMap(dbPool, [documentId])
    if (
      !isVisibleToUser(
        rows[0],
        segmentsMap[documentId] || [],
        userId,
        perms.departmentId,
        perms
      )
    ) {
      const err = new Error('Нет доступа к документу')
      err.status = 403
      throw err
    }
    return { doc: rows[0], perms }
  }

  async function assertFileBelongs(dbPool, documentId, fileId) {
    if (fileId == null) return null
    const { rows } = await dbPool.query(
      `SELECT id FROM knowledge_document_files
       WHERE id = $1 AND document_id = $2`,
      [fileId, documentId]
    )
    if (!rows.length) {
      const err = new Error('Файл не найден в этом документе')
      err.status = 404
      throw err
    }
    return fileId
  }

  async function fetchMark(dbPool, markId) {
    const { rows } = await dbPool.query(
      `SELECT m.*,
              ${AUTHOR_NAME_SQL} AS created_by_name
       FROM knowledge_document_error_marks m
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.id = $1`,
      [markId]
    )
    return rows[0] ? mapMarkRow(rows[0]) : null
  }

  const listErrorMarks = (dbPool) => async (req, res) => {
    try {
      const userId = resolveUserId(req)
      if (!userId) return res.status(400).json({ error: 'Укажите userId' })
      const documentId = Number(req.params.id)
      if (!Number.isFinite(documentId)) {
        return res.status(400).json({ error: 'Некорректный id' })
      }
      await assertDocumentAccess(dbPool, userId, documentId)
      const map = await loadErrorMarksMap(dbPool, [documentId])
      return res.json({ marks: map[documentId] || [] })
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message })
      if (tableMissing(error)) {
        return res.status(503).json({
          error: 'Выполните миграцию add_knowledge_document_error_marks.sql',
        })
      }
      console.error('knowledge listErrorMarks:', error)
      return res.status(500).json({ error: error.message || 'Ошибка' })
    }
  }

  const createErrorMark = (dbPool) => async (req, res) => {
    try {
      const userId = resolveUserId(req)
      if (!userId) return res.status(400).json({ error: 'Укажите userId' })
      const documentId = Number(req.params.id)
      if (!Number.isFinite(documentId)) {
        return res.status(400).json({ error: 'Некорректный id' })
      }
      const comment = String(req.body?.comment || '').trim()
      if (!comment) {
        return res.status(400).json({ error: 'Комментарий обязателен' })
      }
      if (comment.length > 2000) {
        return res.status(400).json({ error: 'Комментарий слишком длинный' })
      }
      const rawFileId = req.body?.fileId
      const fileId =
        rawFileId != null && rawFileId !== '' ? Number(rawFileId) : null
      if (fileId != null && !Number.isFinite(fileId)) {
        return res.status(400).json({ error: 'Некорректный fileId' })
      }

      await assertDocumentAccess(dbPool, userId, documentId)
      await assertFileBelongs(dbPool, documentId, fileId)

      const existing = await dbPool.query(
        `SELECT id FROM knowledge_document_error_marks
         WHERE document_id = $1
           AND created_by = $2
           AND COALESCE(file_id, 0) = COALESCE($3::int, 0)`,
        [documentId, userId, fileId]
      )

      let markId
      if (existing.rows.length) {
        const upd = await dbPool.query(
          `UPDATE knowledge_document_error_marks
           SET comment = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING id`,
          [comment, existing.rows[0].id]
        )
        markId = upd.rows[0].id
      } else {
        const ins = await dbPool.query(
          `INSERT INTO knowledge_document_error_marks
             (document_id, file_id, comment, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [documentId, fileId, comment, userId]
        )
        markId = ins.rows[0].id
      }

      const mark = await fetchMark(dbPool, markId)
      return res.json({ mark })
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message })
      if (tableMissing(error)) {
        return res.status(503).json({
          error: 'Выполните миграцию add_knowledge_document_error_marks.sql',
        })
      }
      console.error('knowledge createErrorMark:', error)
      return res.status(500).json({ error: error.message || 'Ошибка' })
    }
  }

  const updateErrorMark = (dbPool) => async (req, res) => {
    try {
      const userId = resolveUserId(req)
      if (!userId) return res.status(400).json({ error: 'Укажите userId' })
      const documentId = Number(req.params.id)
      const markId = Number(req.params.markId)
      if (!Number.isFinite(documentId) || !Number.isFinite(markId)) {
        return res.status(400).json({ error: 'Некорректный id' })
      }
      const comment = String(req.body?.comment || '').trim()
      if (!comment) {
        return res.status(400).json({ error: 'Комментарий обязателен' })
      }
      if (comment.length > 2000) {
        return res.status(400).json({ error: 'Комментарий слишком длинный' })
      }

      await assertDocumentAccess(dbPool, userId, documentId)

      const { rows } = await dbPool.query(
        `SELECT id, created_by, document_id
         FROM knowledge_document_error_marks
         WHERE id = $1 AND document_id = $2`,
        [markId, documentId]
      )
      if (!rows.length) return res.status(404).json({ error: 'Отметка не найдена' })
      if (Number(rows[0].created_by) !== userId) {
        return res.status(403).json({ error: 'Изменить можно только свою отметку' })
      }

      await dbPool.query(
        `UPDATE knowledge_document_error_marks
         SET comment = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [comment, markId]
      )
      const mark = await fetchMark(dbPool, markId)
      return res.json({ mark })
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message })
      if (tableMissing(error)) {
        return res.status(503).json({
          error: 'Выполните миграцию add_knowledge_document_error_marks.sql',
        })
      }
      console.error('knowledge updateErrorMark:', error)
      return res.status(500).json({ error: error.message || 'Ошибка' })
    }
  }

  const deleteErrorMark = (dbPool) => async (req, res) => {
    try {
      const userId = resolveUserId(req)
      if (!userId) return res.status(400).json({ error: 'Укажите userId' })
      const documentId = Number(req.params.id)
      const markId = Number(req.params.markId)
      if (!Number.isFinite(documentId) || !Number.isFinite(markId)) {
        return res.status(400).json({ error: 'Некорректный id' })
      }

      await assertDocumentAccess(dbPool, userId, documentId)

      const { rows } = await dbPool.query(
        `SELECT id, created_by
         FROM knowledge_document_error_marks
         WHERE id = $1 AND document_id = $2`,
        [markId, documentId]
      )
      if (!rows.length) return res.status(404).json({ error: 'Отметка не найдена' })
      if (Number(rows[0].created_by) !== userId) {
        return res.status(403).json({ error: 'Удалить можно только свою отметку' })
      }

      await dbPool.query(`DELETE FROM knowledge_document_error_marks WHERE id = $1`, [
        markId,
      ])
      return res.json({ ok: true })
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message })
      if (tableMissing(error)) {
        return res.status(503).json({
          error: 'Выполните миграцию add_knowledge_document_error_marks.sql',
        })
      }
      console.error('knowledge deleteErrorMark:', error)
      return res.status(500).json({ error: error.message || 'Ошибка' })
    }
  }

  return {
    listErrorMarks,
    createErrorMark,
    updateErrorMark,
    deleteErrorMark,
  }
}

module.exports = {
  loadErrorMarksMap,
  createErrorMarksHandlers,
  mapMarkRow,
}
