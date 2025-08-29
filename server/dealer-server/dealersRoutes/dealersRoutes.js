const express = require('express')
const router = express.Router()

module.exports = (pool) => {
  // Маршрут для создания нового дилера
  router.post('/dealers', async (req, res) => {
    const {
      company_id,
      last_name,
      first_name,
      middle_name,
      hobbies,
      position,
      birth_date,
      gender,
      phones,
      emails,
    } = req.body

    try {
      await pool.query('BEGIN')

      const dealerResult = await pool.query(
        `INSERT INTO dealers (company_id, last_name, first_name, middle_name, gender, birth_date) 
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [company_id, last_name, first_name, middle_name, gender, birth_date]
      )

      const dealerId = dealerResult.rows[0].id

      // Добавление хобби
      if (hobbies && hobbies.length > 0) {
        for (const hobby of hobbies) {
          await pool.query(
            'INSERT INTO dealer_hobbies (dealer_id, hobby) VALUES ($1, $2)',
            [dealerId, hobby]
          )
        }
      }

      // Добавление должности
      if (position) {
        await pool.query(
          'INSERT INTO dealer_positions (dealer_id, position) VALUES ($1, $2)',
          [dealerId, position]
        )
      }

      // Добавление телефонов
      if (phones && phones.length > 0) {
        for (const phone of phones) {
          await pool.query(
            'INSERT INTO dealer_phone_numbers (dealer_id, phone_number, phone_type, is_primary) VALUES ($1, $2, $3, $4)',
            [dealerId, phone.phone_number, phone.phone_type, phone.is_primary]
          )
        }
      }

      // Добавление email
      if (emails && emails.length > 0) {
        for (const email of emails) {
          await pool.query(
            'INSERT INTO dealer_emails (dealer_id, email, is_primary) VALUES ($1, $2, $3)',
            [dealerId, email.email, email.is_primary]
          )
        }
      }

      await pool.query('COMMIT')
      res.status(201).json({ id: dealerId })
    } catch (error) {
      await pool.query('ROLLBACK')
      console.error('Ошибка при создании дилера:', error)
      res.status(500).json({ error: 'Ошибка при создании дилера' })
    }
  })
  // Маршрут для обновления данных дилера
  router.put('/dealers/:dealer_id', async (req, res) => {
    const { dealer_id } = req.params
    const {
      first_name,
      last_name,
      middle_name,
      birth_date,
      hobbies,
      positions,
      phones,
      emails,
    } = req.body

    try {
      await pool.query('BEGIN')

      // Обновление основных данных дилера
      await pool.query(
        `UPDATE dealers
      SET first_name = $1, last_name = $2, middle_name = $3, birth_date = $4, updated_at = NOW()
      WHERE id = $5`,
        [first_name, last_name, middle_name, birth_date, dealer_id]
      )

      // Обновление хобби
      await pool.query('DELETE FROM dealer_hobbies WHERE dealer_id = $1', [
        dealer_id,
      ])
      if (hobbies && hobbies.length > 0) {
        for (const hobby of hobbies) {
          await pool.query(
            'INSERT INTO dealer_hobbies (dealer_id, hobby) VALUES ($1, $2)',
            [dealer_id, hobby]
          )
        }
      }

      // Обновление должностей
      await pool.query('DELETE FROM dealer_positions WHERE dealer_id = $1', [
        dealer_id,
      ])
      if (positions && positions.length > 0) {
        for (const position of positions) {
          await pool.query(
            'INSERT INTO dealer_positions (dealer_id, position) VALUES ($1, $2)',
            [dealer_id, position]
          )
        }
      }

      // Обновление телефонов
      if (phones && phones.length > 0) {
        await pool.query(
          'DELETE FROM dealer_phone_numbers WHERE dealer_id = $1',
          [dealer_id]
        )
        for (const phone of phones) {
          await pool.query(
            'INSERT INTO dealer_phone_numbers (dealer_id, phone_number, phone_type, is_primary) VALUES ($1, $2, $3, $4)',
            [
              dealer_id,
              phone.phone_number,
              phone.phone_type || 'рабочий',
              phone.is_primary || false, // Убедитесь, что значение по умолчанию
            ]
          )
        }
      }

      // Обновление электронной почты
      if (emails && emails.length > 0) {
        await pool.query('DELETE FROM dealer_emails WHERE dealer_id = $1', [
          dealer_id,
        ])
        for (const emailObj of emails) {
          await pool.query(
            'INSERT INTO dealer_emails (dealer_id, email, is_primary) VALUES ($1, $2, $3)',
            [dealer_id, emailObj.email.trim(), emailObj.is_primary || false] // Убедитесь, что email обрезан и основной статус по умолчанию
          )
        }
      }

      await pool.query('COMMIT')
      res.status(200).json({ message: 'Данные дилера успешно обновлены' })
    } catch (error) {
      await pool.query('ROLLBACK')
      console.error('Ошибка при обновлении данных дилера:', error)
      res.status(500).json({ error: 'Ошибка при обновлении данных дилера' })
    }
  })

  //********************* */
  // Удаление дилера
  router.delete('/dealers/:dealer_id', async (req, res) => {
    const { dealer_id } = req.params

    try {
      await pool.query('DELETE FROM dealers WHERE id = $1', [dealer_id])
      res.status(200).json({ message: 'Дилер успешно удалён' })
    } catch (error) {
      console.error('Ошибка при удалении дилера:', error)
      res.status(500).json({ error: 'Ошибка при удалении дилера' })
    }
  })
  // Удаление телефона дилера
  router.delete('/dealers/:dealer_id/phones', async (req, res) => {
    const { dealer_id } = req.params
    const { phone_number } = req.body // Получаем номер телефона из тела запроса

    try {
      await pool.query(
        'DELETE FROM dealer_phone_numbers WHERE dealer_id = $1 AND phone_number = $2',
        [dealer_id, phone_number]
      )
      res.status(200).json({ message: 'Телефон успешно удалён' })
    } catch (error) {
      console.error('Ошибка при удалении телефона:', error)
      res.status(500).json({ error: 'Ошибка при удалении телефона' })
    }
  })

  // Удаление электронной почты дилера
  router.delete('/dealers/:dealer_id/emails', async (req, res) => {
    const { dealer_id } = req.params
    const { email } = req.body // Получаем email из тела запроса

    try {
      await pool.query(
        'DELETE FROM dealer_emails WHERE dealer_id = $1 AND email = $2',
        [dealer_id, email]
      )
      res.status(200).json({ message: 'Электронная почта успешно удалена' })
    } catch (error) {
      console.error('Ошибка при удалении электронной почты:', error)
      res.status(500).json({ error: 'Ошибка при удалении электронной почты' })
    }
  })

  //*** */

  ///////////////////////////
  //////////////////////////
  /////////////////////////
  //////////////////////////
  /////////////////////////
  ///////////////////////////////

  // Получить всю информацию о дилерах, включая телефоны, почты и сотрудников по id
  router.get('/dealers', async (req, res) => {
    try {
      const { company_id } = req.query

      const dealersResult = await pool.query(
        `
        SELECT 
          d.id AS dealer_id,
          d.company_id,
          d.last_name,
          d.first_name,
          d.middle_name,
          d.gender,
          d.birth_date,
          (SELECT json_agg(dh.hobby) FROM dealer_hobbies dh WHERE dh.dealer_id = d.id) AS hobbies,
          (SELECT json_agg(dp.position) FROM dealer_positions dp WHERE dp.dealer_id = d.id) AS positions,
          (SELECT json_agg(json_build_object('phone_number', dpn.phone_number, 'phone_type', dpn.phone_type, 'is_primary', dpn.is_primary)) 
           FROM dealer_phone_numbers dpn WHERE dpn.dealer_id = d.id) AS phones,
          (SELECT json_agg(json_build_object('email', dem.email, 'is_primary', dem.is_primary)) 
           FROM dealer_emails dem WHERE dem.dealer_id = d.id) AS emails
        FROM dealers d
        WHERE d.company_id = $1
        GROUP BY d.id
        `,
        [company_id]
      )

      res.json(dealersResult.rows)
    } catch (error) {
      console.error('Ошибка при получении данных дилеров:', error)
      res.status(500).send('Ошибка сервера')
    }
  })

  // Получить всех пользователей дилера
  router.get('/dealers/:dealer_id/users', async (req, res) => {
    try {
      const { dealer_id } = req.params

      const usersResult = await pool.query(
        `
        SELECT 
          u.id AS user_id,
          u.first_name,
          u.middle_name,
          u.last_name,
          u.email,
          u.birth_date,
          u.gender,
          u.position_id,
          u.department_id
        FROM users u
        INNER JOIN dealer_employees de ON u.id = de.employee_id
        WHERE de.dealer_id = $1
        `,
        [dealer_id]
      )

      res.json(usersResult.rows)
    } catch (error) {
      console.error('Ошибка при получении данных пользователей дилера:', error)
      res.status(500).send('Ошибка сервера')
    }
  })

  // Получить всех дилеров компании и их пользователей
  router.get('/companies/:company_id/dealers-users', async (req, res) => {
    try {
      const { company_id } = req.params

      const dealersResult = await pool.query(
        `
      SELECT 
        d.id AS dealer_id,
        d.first_name AS dealer_first_name,
        d.middle_name AS dealer_middle_name,
        d.last_name AS dealer_last_name,
        d.birth_date,
        d.gender,
        (SELECT json_agg(json_build_object('phone_number', dpn.phone_number, 'phone_type', dpn.phone_type, 'is_primary', dpn.is_primary)) 
         FROM dealer_phone_numbers dpn WHERE dpn.dealer_id = d.id) AS phones,
        (SELECT json_agg(json_build_object('email', dem.email, 'is_primary', dem.is_primary)) 
         FROM dealer_emails dem WHERE dem.dealer_id = d.id) AS emails
      FROM dealers d
      WHERE d.company_id = $1
      `,
        [company_id]
      )

      const dealers = dealersResult.rows

      for (const dealer of dealers) {
        const positionsResult = await pool.query(
          `
        SELECT 
          dp.position 
        FROM dealer_positions dp 
        WHERE dp.dealer_id = $1
        `,
          [dealer.dealer_id]
        )
        dealer.positions = positionsResult.rows.map((row) => row.position)
      }

      res.json(dealers)
    } catch (error) {
      console.error(
        'Ошибка при получении данных дилеров и пользователей:',
        error
      )
      res.status(500).send('Ошибка сервера')
    }
  })

  // Получить список всех дилеров
  router.get('/dealers/all', async (req, res) => {
    try {
      const dealersResult = await pool.query(`
        SELECT 
          id,
          company_id,
          first_name,
          middle_name,  
          last_name,
          birth_date,
          gender,
          created_at,
          updated_at
        FROM dealers
      `)

      res.json(dealersResult.rows)
    } catch (error) {
      console.error('Ошибка при получении данных дилеров:', error)
      res.status(500).send('Ошибка сервера')
    }
  })

  return router
}
