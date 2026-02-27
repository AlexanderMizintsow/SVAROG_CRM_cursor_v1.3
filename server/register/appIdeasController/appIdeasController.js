/**
 * Идеи и предложения пользователей по улучшению приложения.
 */

function submitAppIdea(dbPool, uploadDir) {
  return async (req, res) => {
    try {
      const userId = req.body.userId != null ? Number(req.body.userId) : null
      const title = (req.body.title || '').trim()
      const message = (req.body.message || '').trim()

      if (!userId || !title) {
        return res.status(400).json({ error: 'Укажите пользователя и наименование обращения.' })
      }

      let filePath = null
      let fileName = null
      if (req.file) {
        filePath = `/uploads/${req.file.filename}`
        fileName = req.file.originalname || req.file.filename
      }

      const result = await dbPool.query(
        `INSERT INTO app_ideas (user_id, title, message, file_path, file_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, title, message, file_path, file_name, created_at, is_applied, admin_comment, applied_at`,
        [userId, title, message, filePath, fileName]
      )

      res.status(201).json(result.rows[0])
    } catch (err) {
      console.error('submitAppIdea:', err)
      res.status(500).json({ error: 'Ошибка при сохранении предложения.' })
    }
  }
}

function getAppIdeas(dbPool) {
  return async (req, res) => {
    try {
      const userId = req.query.userId != null ? Number(req.query.userId) : null
      if (!userId) {
        return res.status(400).json({ error: 'Укажите userId.' })
      }

      const roleResult = await dbPool.query(
        'SELECT r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1',
        [userId]
      )
      const isAdmin = roleResult.rows[0]?.role_name === 'Администратор'

      if (isAdmin) {
        const result = await dbPool.query(
          `SELECT ai.id, ai.user_id, ai.title, ai.message, ai.file_path, ai.file_name, ai.created_at, ai.is_applied, ai.admin_comment, ai.applied_at,
                  TRIM(CONCAT(u.last_name, ' ', u.first_name, ' ', COALESCE(u.middle_name, ''))) AS user_fio
           FROM app_ideas ai
           JOIN users u ON u.id = ai.user_id
           ORDER BY u.last_name, u.first_name, ai.created_at DESC`
        )
        const byUser = {}
        result.rows.forEach((row) => {
          const key = row.user_id
          if (!byUser[key]) {
            byUser[key] = { user_id: row.user_id, user_fio: row.user_fio || 'Без имени', ideas: [] }
          }
          byUser[key].ideas.push({
            id: row.id,
            title: row.title,
            message: row.message,
            file_path: row.file_path,
            file_name: row.file_name,
            created_at: row.created_at,
            is_applied: row.is_applied,
            admin_comment: row.admin_comment,
            applied_at: row.applied_at,
          })
        })
        return res.json({ admin: true, grouped: Object.values(byUser) })
      }

      const result = await dbPool.query(
        `SELECT id, user_id, title, message, file_path, file_name, created_at, is_applied, admin_comment, applied_at
         FROM app_ideas WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      )
      res.json({ admin: false, ideas: result.rows })
    } catch (err) {
      console.error('getAppIdeas:', err)
      res.status(500).json({ error: 'Ошибка при получении предложений.' })
    }
  }
}

function applyAppIdea(dbPool) {
  return async (req, res) => {
    try {
      const ideaId = Number(req.params.id)
      const { is_applied, admin_comment, admin_user_id } = req.body || {}

      if (!ideaId) {
        return res.status(400).json({ error: 'Укажите id предложения.' })
      }

      const ideaResult = await dbPool.query(
        'SELECT id, user_id, title, is_applied FROM app_ideas WHERE id = $1',
        [ideaId]
      )
      if (ideaResult.rows.length === 0) {
        return res.status(404).json({ error: 'Предложение не найдено.' })
      }
      const idea = ideaResult.rows[0]
      const targetUserId = idea.user_id
      const title = idea.title || 'Без названия'

      await dbPool.query(
        `UPDATE app_ideas SET is_applied = $1, admin_comment = $2, applied_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE applied_at END WHERE id = $3`,
        [!!is_applied, admin_comment != null ? String(admin_comment).trim() : null, ideaId]
      )

      if (is_applied === true) {
        const comment = (admin_comment || '').trim()
        const message = `Идея/предложение: «${title}». Применено в приложении.${comment ? '\nКомментарий администратора: ' + comment : ''}`

        await dbPool.query(
          `INSERT INTO notifications (user_id, task_id, message, event_type, is_sent)
           VALUES ($1, NULL, $2, 'idea_applied', false)`,
          [targetUserId, message]
        )
      }

      const updated = await dbPool.query(
        'SELECT id, user_id, title, message, file_path, file_name, created_at, is_applied, admin_comment, applied_at FROM app_ideas WHERE id = $1',
        [ideaId]
      )
      res.json(updated.rows[0])
    } catch (err) {
      console.error('applyAppIdea:', err)
      res.status(500).json({ error: 'Ошибка при обновлении предложения.' })
    }
  }
}

module.exports = {
  submitAppIdea,
  getAppIdeas,
  applyAppIdea,
}
