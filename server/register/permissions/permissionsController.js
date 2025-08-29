const getPermissions = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query('SELECT * FROM permissions')
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении разрешений:', err)
    res.status(500).json({ error: 'Ошибка при получении разрешений' })
  }
}

const getPermissionsByRole = (dbPool) => async (req, res) => {
  const { role_id } = req.params
  try {
    const result = await dbPool.query(
      `SELECT p.*, c.name as component_name 
           FROM permissions p
           JOIN components c ON p.component_id = c.id
           WHERE p.role_id = $1`,
      [role_id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении прав:', err)
    res.status(500).json({ error: 'Ошибка при получении прав' })
  }
}

const postPermission = (dbPool) => async (req, res) => {
  const { role_id, component_id, can_view, can_edit, can_delete, can_create } =
    req.body

  try {
    const result = await dbPool.query(
      `INSERT INTO permissions (role_id, component_id, can_view, can_edit, can_delete, can_create) 
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (role_id, component_id) DO UPDATE
           SET can_view = EXCLUDED.can_view, 
               can_edit = EXCLUDED.can_edit, 
               can_delete = EXCLUDED.can_delete, 
               can_create = EXCLUDED.can_create
           RETURNING *`,
      [role_id, component_id, can_view, can_edit, can_delete, can_create]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Ошибка при создании или обновлении права доступа:', err)
    res
      .status(500)
      .json({ error: 'Ошибка при создании или обновлении права доступа' })
  }
}

const getComponents = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query('SELECT * FROM components')
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении компонентов:', err)
    res.status(500).json({ error: 'Ошибка при получении компонентов' })
  }
}

module.exports = {
  getPermissions,
  getPermissionsByRole,
  postPermission,
  getComponents,
}
