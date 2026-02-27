const config = require('../config')

async function getProcesses(dbPool, req, res) {
  try {
    const { is_draft, created_by, user_id, role_name } = req.query
    let query = 'SELECT id, name, description, scheme, is_draft, version, created_at, updated_at, created_by, visibility_user_ids FROM bp_process_definitions WHERE 1=1'
    const params = []
    let i = 1
    if (is_draft !== undefined && is_draft !== '') {
      query += ` AND is_draft = $${i}`
      params.push(is_draft === 'true')
      i++
    }
    if (created_by) {
      query += ` AND created_by = $${i}`
      params.push(Number(created_by))
      i++
    }
    query += ' ORDER BY updated_at DESC'
    let result = await dbPool.query(query, params)
    const rows = result.rows

    if (is_draft === 'false' && user_id != null && user_id !== '') {
      const userId = Number(user_id)
      const isAdmin = String(role_name || '').trim() === 'Администратор'
      if (!isAdmin) {
        const toArr = (v) => {
          if (v == null) return []
          if (Array.isArray(v)) return v
          if (typeof v === 'string') {
            try { return JSON.parse(v) }
            catch { return [] }
          }
          return []
        }
        const filtered = rows.filter((row) => {
          const vis = toArr(row.visibility_user_ids)
          if (vis.length === 0) return true
          return vis.some((id) => Number(id) === userId)
        })
        result = { rows: filtered }
      }
    }

    res.json(result.rows)
  } catch (err) {
    console.error('getProcesses:', err)
    res.status(500).json({ error: 'Ошибка при получении списка процессов' })
  }
}

async function getProcessById(dbPool, req, res) {
  try {
    const { id } = req.params
    const result = await dbPool.query(
      'SELECT id, name, description, scheme, is_draft, version, created_at, updated_at, created_by, visibility_user_ids FROM bp_process_definitions WHERE id = $1',
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Процесс не найден' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('getProcessById:', err)
    res.status(500).json({ error: 'Ошибка при получении процесса' })
  }
}

function checkDesignerAccess(req) {
  const roleIds = config.allowedProcessDesignerRoleIds
  const userIds = config.allowedProcessDesignerUserIds
  if ((!roleIds || roleIds.length === 0) && (!userIds || userIds.length === 0)) return true
  const userId = req.body?.created_by ?? req.body?.user_id ?? req.headers['x-user-id']
  const roleId = req.headers['x-role-id']
  if (userIds && userIds.length && userId && userIds.includes(Number(userId))) return true
  if (roleIds && roleIds.length && roleId && roleIds.includes(Number(roleId))) return true
  return false
}

async function createProcess(dbPool, req, res) {
  try {
    if (!checkDesignerAccess(req)) {
      return res.status(403).json({ error: 'Нет прав на создание процессов' })
    }
    const { name, description, scheme, is_draft, visibility_user_ids } = req.body
    if (!name || !scheme) {
      return res.status(400).json({ error: 'Не указаны name или scheme' })
    }
    const visIds = Array.isArray(visibility_user_ids) ? JSON.stringify(visibility_user_ids) : '[]'
    const result = await dbPool.query(
      `INSERT INTO bp_process_definitions (name, description, scheme, is_draft, created_by, visibility_user_ids)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, name, description, scheme, is_draft, version, created_at, updated_at, created_by`,
      [
        name,
        description || null,
        JSON.stringify(scheme),
        is_draft !== false,
        req.body.created_by || null,
        visIds,
      ]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('createProcess:', err)
    res.status(500).json({ error: 'Ошибка при создании процесса' })
  }
}

async function updateProcess(dbPool, req, res) {
  try {
    if (!checkDesignerAccess(req)) {
      return res.status(403).json({ error: 'Нет прав на редактирование процессов' })
    }
    const { id } = req.params
    const { name, description, scheme, is_draft, visibility_user_ids } = req.body
    const updates = [
      name ?? null,
      description !== undefined ? description : null,
      scheme ? JSON.stringify(scheme) : null,
      is_draft !== undefined ? is_draft : null,
      id,
    ]
    let query = `UPDATE bp_process_definitions
       SET name = COALESCE($1, name), description = COALESCE($2, description),
           scheme = COALESCE($3, scheme), is_draft = COALESCE($4, is_draft),
           updated_at = NOW()`
    if (visibility_user_ids !== undefined) {
      query += `, visibility_user_ids = $6::jsonb`
      updates.push(Array.isArray(visibility_user_ids) ? JSON.stringify(visibility_user_ids) : '[]')
    }
    query += ` WHERE id = $5 RETURNING id, name, description, scheme, is_draft, version, created_at, updated_at, created_by`
    const result = await dbPool.query(query, updates)
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Процесс не найден' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('updateProcess:', err)
    res.status(500).json({ error: 'Ошибка при обновлении процесса' })
  }
}

async function deleteProcess(dbPool, req, res) {
  try {
    if (!checkDesignerAccess(req)) {
      return res.status(403).json({ error: 'Нет прав на удаление процессов' })
    }
    const { id } = req.params
    const force = String(req.query.force || '').toLowerCase()
    const isForce = force === 'true' || force === '1' || force === 'yes'

    if (!isForce) {
      const running = await dbPool.query(
        'SELECT 1 FROM bp_process_instances WHERE process_id = $1 AND status NOT IN ($2, $3, $4)',
        [id, 'completed', 'failed', 'cancelled']
      )
      if (running.rows.length > 0) {
        return res.status(400).json({
          error: 'Есть запущенные экземпляры процесса. Сначала дождитесь их завершения или отмените. Для принудительного удаления используйте force=true.',
        })
      }
    }
    await dbPool.query('DELETE FROM bp_process_definitions WHERE id = $1', [id])
    res.status(204).send()
  } catch (err) {
    console.error('deleteProcess:', err)
    res.status(500).json({ error: 'Ошибка при удалении процесса' })
  }
}

module.exports = {
  getProcesses,
  getProcessById,
  createProcess,
  updateProcess,
  deleteProcess,
}
