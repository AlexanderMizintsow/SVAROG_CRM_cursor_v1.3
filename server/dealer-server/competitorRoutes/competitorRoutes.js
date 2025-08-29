const express = require('express')
const router = express.Router()

module.exports = (pool) => {
  // Получить все конкуренты
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM competitors')
      res.json(result.rows)
    } catch (error) {
      console.error('Ошибка при получении конкурентов:', error)
      res.status(500).send('Ошибка сервера')
    }
  })

  // Добавить нового конкурента
  router.post('/', async (req, res) => {
    const { name, industry, contact_email } = req.body
    try {
      const result = await pool.query(
        'INSERT INTO competitors (name, industry, contact_email) VALUES ($1, $2, $3) RETURNING *',
        [name, industry, contact_email]
      )
      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error('Ошибка при добавлении конкурента:', error)
      res.status(500).send('Ошибка сервера')
    }
  })

  return router // Возвращаем маршрутизатор
}
