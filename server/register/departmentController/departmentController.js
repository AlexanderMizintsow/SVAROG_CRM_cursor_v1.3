const { validationResult } = require('express-validator')

// Вспомогательная функция для обработки запросов
const handleRequest = (queryFn) => async (req, res) => {
  try {
    res.json(await queryFn(req, res))
  } catch (err) {
    console.error('Ошибка:', err)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
}

// Получение всех отделов
const getDepartments = (dbPool) =>
  handleRequest(async () => {
    return (await dbPool.query('SELECT * FROM departments')).rows
  })

// Создание нового отдела
const createDepartment = (dbPool) =>
  handleRequest(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() })

    const { name, head_user_id } = req.body
    const result = await dbPool.query(
      'INSERT INTO departments (name, head_user_id) VALUES ($1, $2) RETURNING *',
      [name, head_user_id]
    )

    return {
      message: 'Новый отдел успешно добавлен',
      department: result.rows[0],
    }
  })

// Назначение руководителя отдела
const assignHeadToDepartment = (dbPool) =>
  handleRequest(async (req, res) => {
    const { id } = req.params
    const { head_user_id } = req.body

    const departmentResult = await dbPool.query(
      'SELECT * FROM departments WHERE id = $1',
      [id]
    )
    if (departmentResult.rowCount === 0)
      return res.status(404).json({ message: 'Отдел не найден' })

    const updateResult = await dbPool.query(
      'UPDATE departments SET head_user_id = $1 WHERE id = $2 RETURNING *',
      [head_user_id, id]
    )

    return {
      message: 'Руководитель отдела успешно назначен',
      department: updateResult.rows[0],
    }
  })

// Удаление руководителя из отдела
const removeHeadFromDepartment = (dbPool) =>
  handleRequest(async (req) => {
    const { departmentId } = req.params
    const result = await dbPool.query(
      'UPDATE departments SET head_user_id = NULL WHERE id = $1 RETURNING *',
      [departmentId]
    )

    return {
      message: 'Руководитель отдела успешно удален',
      department: result.rows[0],
    }
  })

// Удаление отдела
const deleteDepartment = (dbPool) =>
  handleRequest(async (req, res) => {
    const { id } = req.params
    const result = await dbPool.query('DELETE FROM departments WHERE id = $1', [
      id,
    ])
    if (result.rowCount === 0) return res.status(404).send('Отдел не найден')

    return { message: 'Отдел успешно удален' }
  })

module.exports = {
  getDepartments,
  createDepartment,
  assignHeadToDepartment,
  removeHeadFromDepartment,
  deleteDepartment,
}
