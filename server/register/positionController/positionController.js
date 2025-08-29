// positionController.js
const { validationResult } = require('express-validator')

// Получение всех должностей
exports.getPositions = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query('SELECT * FROM positions')
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении должностей:', err)
    res.status(500).json({ error: 'Ошибка при получении должностей' })
  }
}

// Создание новой должности
exports.createPosition = (dbPool) => async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  const { name } = req.body
  try {
    const newPositionQuery =
      'INSERT INTO positions (name) VALUES ($1) RETURNING *'
    const result = await dbPool.query(newPositionQuery, [name])
    const newPosition = result.rows[0]
    res.status(201).json({
      message: 'Новая должность успешно добавлена',
      position: newPosition,
    })
  } catch (err) {
    console.error('Ошибка при добавлении новой должности:', err)
    res.status(500).json({ error: 'Ошибка при добавлении новой должности' })
  }
}

// Удаление должности
exports.deletePosition = (dbPool) => async (req, res) => {
  const { id } = req.params
  try {
    const result = await dbPool.query('DELETE FROM positions WHERE id = $1', [
      id,
    ])
    if (result.rowCount === 0) {
      return res.status(404).send('Должность не найдена')
    }
    res.status(200).send('Должность успешно удалена')
  } catch (error) {
    console.error('Ошибка при удалении должности:', error)
    res.status(500).send('Ошибка при удалении должности')
  }
}
