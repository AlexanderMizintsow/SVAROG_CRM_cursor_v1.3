const { validationResult } = require('express-validator')

// Получение всех ролей
function getRoles(dbPool) {
  return async (req, res) => {
    try {
      const result = await dbPool.query('SELECT * FROM roles')
      res.json(result.rows)
    } catch (err) {
      console.error('Ошибка при получении ролей:', err)
      res.status(500).json({ error: 'Ошибка при получении ролей' })
    }
  }
}

// Создание новой роли
function createRole(dbPool) {
  return async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { name } = req.body

    try {
      const newRoleQuery = 'INSERT INTO roles (name) VALUES ($1) RETURNING *'
      const result = await dbPool.query(newRoleQuery, [name])
      const newRole = result.rows[0]
      res
        .status(201)
        .json({ message: 'Новая роль успешно добавлена', role: newRole })
    } catch (err) {
      console.error('Ошибка при добавлении новой роли:', err)
      res.status(500).json({ error: 'Ошибка при добавлении новой роли' })
    }
  }
}

// Удаление роли
function deleteRole(dbPool) {
  return async (req, res) => {
    const { id } = req.params
    try {
      const result = await dbPool.query('DELETE FROM roles WHERE id = $1', [id])
      if (result.rowCount === 0) {
        return res.status(404).send('Роль не найдена')
      }
      res.status(200).send('Роль успешно удалена')
    } catch (error) {
      console.error('Ошибка при удалении роли:', error)
      res.status(500).send('Ошибка при удалении роли')
    }
  }
}

module.exports = {
  getRoles,
  createRole,
  deleteRole,
}
