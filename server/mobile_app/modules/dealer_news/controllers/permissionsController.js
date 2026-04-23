const { checkEditorAccess } = require('./newsAdminController')

const ensureAdmin = async (pool, req, res) => {
  const access = await checkEditorAccess(pool, req)
  if (!access.ok) {
    res.status(access.status).json({ message: access.message })
    return null
  }
  if (!access.isAdmin) {
    res.status(403).json({ message: 'Только администратор может управлять правами доступа' })
    return null
  }
  return access
}

const getPermissions = (pool) => async (req, res) => {
  try {
    const userId = parseInt(req.query.userId, 10)
    if (!Number.isFinite(userId)) return res.status(400).json({ message: 'Не указан userId' })
    const row = await pool.query(
      'SELECT id, user_id, can_edit, created_by, created_at FROM dealer_news_permissions WHERE user_id = $1 LIMIT 1',
      [userId]
    )
    return res.status(200).json({ can_edit: !!row.rows[0]?.can_edit })
  } catch (error) {
    console.error('[mobile_app][dealer_news][permissions_get] error', error)
    return res.status(500).json({ message: 'Ошибка получения прав доступа' })
  }
}

const listPermissions = (pool) => async (req, res) => {
  try {
    const access = await ensureAdmin(pool, req, res)
    if (!access) return
    const result = await pool.query(
      `SELECT id, user_id, can_edit, created_by, created_at
         FROM dealer_news_permissions
        ORDER BY created_at DESC`
    )
    return res.status(200).json(result.rows)
  } catch (error) {
    console.error('[mobile_app][dealer_news][permissions_list] error', error)
    return res.status(500).json({ message: 'Ошибка получения списка прав' })
  }
}

const grantPermission = (pool) => async (req, res) => {
  try {
    const access = await ensureAdmin(pool, req, res)
    if (!access) return
    const userId = parseInt(req.body.user_id, 10)
    if (!Number.isFinite(userId)) return res.status(400).json({ message: 'Некорректный user_id' })

    const result = await pool.query(
      `INSERT INTO dealer_news_permissions (user_id, can_edit, created_by)
       VALUES ($1, TRUE, $2)
       ON CONFLICT (user_id) DO UPDATE SET can_edit = TRUE, created_by = EXCLUDED.created_by
       RETURNING id, user_id, can_edit, created_by, created_at`,
      [userId, access.userId]
    )
    return res.status(200).json(result.rows[0])
  } catch (error) {
    console.error('[mobile_app][dealer_news][permissions_grant] error', error)
    return res.status(500).json({ message: 'Ошибка выдачи прав' })
  }
}

const revokePermission = (pool) => async (req, res) => {
  try {
    const access = await ensureAdmin(pool, req, res)
    if (!access) return
    const permissionId = parseInt(req.params.permissionId, 10)
    if (!Number.isFinite(permissionId)) return res.status(400).json({ message: 'Некорректный ID права' })
    await pool.query('DELETE FROM dealer_news_permissions WHERE id = $1', [permissionId])
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[mobile_app][dealer_news][permissions_revoke] error', error)
    return res.status(500).json({ message: 'Ошибка удаления прав' })
  }
}

module.exports = {
  getPermissions,
  listPermissions,
  grantPermission,
  revokePermission,
}
