const express = require('express')
const router = express.Router()

module.exports = (pool) => {
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, name, contact_fio, phones, emails, created_at, updated_at FROM suppliers ORDER BY name'
      )
      res.json(result.rows)
    } catch (error) {
      console.error('Ошибка при получении поставщиков:', error)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

  router.post('/', async (req, res) => {
    const { name, contact_fio, phones, emails } = req.body
    const phonesVal = Array.isArray(phones) ? phones : []
    const emailsVal = Array.isArray(emails) ? emails : []
    try {
      const result = await pool.query(
        `INSERT INTO suppliers (name, contact_fio, phones, emails)
         VALUES ($1, $2, $3::jsonb, $4::jsonb) RETURNING *`,
        [name || '', contact_fio || '', JSON.stringify(phonesVal), JSON.stringify(emailsVal)]
      )
      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error('Ошибка при добавлении поставщика:', error)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

  router.put('/:id', async (req, res) => {
    const { id } = req.params
    const { name, contact_fio, phones, emails } = req.body
    const phonesVal = Array.isArray(phones) ? phones : []
    const emailsVal = Array.isArray(emails) ? emails : []
    try {
      const result = await pool.query(
        `UPDATE suppliers SET name = $1, contact_fio = $2, phones = $3::jsonb, emails = $4::jsonb, updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [name || '', contact_fio || '', JSON.stringify(phonesVal), JSON.stringify(emailsVal), id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Поставщик не найден' })
      }
      res.json(result.rows[0])
    } catch (error) {
      console.error('Ошибка при обновлении поставщика:', error)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

  router.delete('/:id', async (req, res) => {
    const { id } = req.params
    try {
      const result = await pool.query('DELETE FROM suppliers WHERE id = $1 RETURNING id', [id])
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Поставщик не найден' })
      }
      res.status(200).json({ message: 'Удалено' })
    } catch (error) {
      console.error('Ошибка при удалении поставщика:', error)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

  return router
}
