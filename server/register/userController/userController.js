const bcrypt = require('bcrypt')
const binaryToBase64 = (binaryData) => {
  return Buffer.from(binaryData).toString('base64')
}

// Получение списка всех пользователей из таблицы users
const getUsers = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT 
        users.id,
        users.first_name,
        users.middle_name,
        users.last_name,
        users.email,
        users.birth_date,
        users.username,
        users.password,
        users.role_assigned,
        roles.name AS role_name,
        positions.name AS position_name,
        supervisor.id AS supervisor_id, 
        supervisor.first_name AS supervisor_first_name,
        supervisor.last_name AS supervisor_last_name,
        users.department_id,
        users.role_id,
        users.position_id, 
        users.created_at,
        users.updated_at, 
        users.gender
      FROM users
      LEFT JOIN roles ON users.role_id = roles.id
      LEFT JOIN positions ON users.position_id = positions.id
      LEFT JOIN users AS supervisor ON users.supervisor_id = supervisor.id
    `)
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении пользователей:', err)
    res.status(500).json({ error: 'Ошибка при получении пользователей' })
  }
}

// Обновление пользователя
const updateUser = (dbPool) => async (req, res) => {
  const { id } = req.params
  const {
    last_name,
    first_name,
    middle_name,
    gender,
    email,
    birth_date,
    role_id,
    department_id,
    position_id,
    supervisor_id,
    role_assigned,
  } = req.body // Включаем role_id и department_id

  // Проверка наличия полей
  if (!last_name || !first_name || !middle_name) {
    return res
      .status(400)
      .json({ message: 'Все поля (фамилия, имя, отчество) обязательны' })
  }

  try {
    // Создаем запрос на обновление
    const updateUserQuery = `
      UPDATE users
      SET last_name = $1, first_name = $2, middle_name = $3, gender = $4, email = $5, birth_date = $6, role_id = $7, department_id = $8, position_id = $9,
      supervisor_id = $10, role_assigned = $11
      WHERE id = $12
      RETURNING *
    `

    // Выполняем обновление и возвращаем обновленные данные
    const updatedUser = await dbPool.query(updateUserQuery, [
      last_name,
      first_name,
      middle_name,
      gender,
      email,
      birth_date,
      role_id, // Обновляем role_id
      department_id,
      position_id,
      supervisor_id,
      role_assigned,
      id,
    ])
    res.json(updatedUser.rows[0])
  } catch (error) {
    console.error('Ошибка при обновлении данных пользователя:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Удаление пользователя
const deleteUser = (dbPool) => async (req, res) => {
  const { id } = req.params

  try {
    const findDepartmentsQuery = `
      SELECT id
      FROM departments
      WHERE head_user_id = $1
    `
    const departmentsResponse = await dbPool.query(findDepartmentsQuery, [id])
    const departmentsToUpdate = departmentsResponse.rows

    // Обновить записи в departments, установив head_user_id в NULL
    const updateDepartmentsPromises = departmentsToUpdate.map(async (dept) => {
      const updateDepartmentQuery = `
        UPDATE departments
        SET head_user_id = NULL
        WHERE id = $1
      `
      await dbPool.query(updateDepartmentQuery, [dept.id])
    })
    await Promise.all(updateDepartmentsPromises)

    const deleteUserQuery = `
      DELETE FROM users
      WHERE id = $1
      RETURNING *
    `
    const deletedUser = await dbPool.query(deleteUserQuery, [id])

    if (deletedUser.rowCount === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' })
    }

    res.json(deletedUser.rows[0])
  } catch (error) {
    console.error('Ошибка при удалении пользователя:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Добавление пользователя
const createUser = (dbPool) => async (req, res) => {
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    const {
      first_name,
      middle_name,
      last_name,
      birth_date,
      username,
      password,
      email,
      role_id,
      supervisor_id,
      departments,
      phone_numbers,
    } = req.body

    const hashedPassword = await bcrypt.hash(password, 10)

    const userInsertQuery = `
      INSERT INTO users (first_name, middle_name, last_name, birth_date, username, password, email, role_id, supervisor_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `
    const userResult = await client.query(userInsertQuery, [
      first_name,
      middle_name,
      last_name,
      birth_date,
      username,
      hashedPassword,
      email,
      role_id,
      supervisor_id,
    ])

    const userId = userResult.rows[0].id

    /*for (const department of departments) {
      const { department_id, position_id, start_date, is_current } = department
      const deptInsertQuery = `
        INSERT INTO user_department_position (user_id, department_id, position_id, start_date, is_current)
        VALUES ($1, $2, $3, $4, $5)
      `
      await client.query(deptInsertQuery, [
        userId,
        department_id,
        position_id,
        start_date,
        is_current,
      ])
    }*/

    for (const phone of phone_numbers) {
      const { phone_number, phone_type } = phone
      if (phone_number && phone_type) {
        const phoneInsertQuery = `
          INSERT INTO user_phones (user_id, phone_number, phone_type)
          VALUES ($1, $2, $3)
        `
        await client.query(phoneInsertQuery, [userId, phone_number, phone_type])
      }
    }

    await client.query('COMMIT')
    res
      .status(201)
      .json({ message: 'Новый пользователь был успешно добавлен!' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при добавлении пользователя:', err)
    res.status(500).json({ error: 'Ошибка при добавлении пользователя' })
  } finally {
    client.release()
  }
}

// Обновление статуса пользователя
const updateUserStatus = (dbPool, io) => async (req, res) => {
  const { userId, status } = req.body
  // console.log(userId)
  // console.log(status)
  if (!userId || !status) {
    return res
      .status(400)
      .json({ error: 'Не указан ID пользователя или статус' })
  }

  try {
    const updateQuery = `
      UPDATE users
      SET status = $2
      WHERE id = $1
    `
    const result = await dbPool.query(updateQuery, [userId, status])

    if (result.rowCount > 0) {
      io.emit('userStatusUpdated', { userId, status })
      res
        .status(200)
        .json({ message: `Статус пользователя успешно обновлен на ${status}` })
    } else {
      res.status(404).json({ error: 'Пользователь не найден' })
    }
  } catch (error) {
    console.error('Ошибка при обновлении статуса пользователя:', error)
    res
      .status(500)
      .json({ error: 'Ошибка сервера при обновлении статуса пользователя' })
  }
}

// Загрузка аватарки пользователя
const uploadAvatar = (dbPool, multer) => {
  return async (req, res) => {
    const { id } = req.params
    const file = req.file

    if (!file) {
      return res.status(400).send('Файл не был загружен')
    }

    try {
      const fileBuffer = file.buffer
      const updateUserQuery = `
          UPDATE users
          SET user_photo = $1
          WHERE id = $2
          RETURNING id
        `
      const updatedUser = await dbPool.query(updateUserQuery, [fileBuffer, id])
      res.json({
        message: 'Аватар успешно загружен',
        userId: updatedUser.rows[0].id,
      })
    } catch (error) {
      console.error('Ошибка при сохранении аватара:', error)
      res.status(500).send('Ошибка сервера')
    }
  }
}

// Получение аватарки пользователя
const getAvatar = (dbPool) => async (req, res) => {
  const { id } = req.params
  try {
    const userQuery = 'SELECT user_photo FROM users WHERE id = $1'
    const userResult = await dbPool.query(userQuery, [id])
    if (userResult.rows.length > 0 && userResult.rows[0].user_photo) {
      const base64Image = binaryToBase64(userResult.rows[0].user_photo)
      res.send({ image: `data:image/jpeg;base64,${base64Image}` })
    } else {
      res.send({ image: null })
    }
  } catch (error) {
    console.error('Ошибка при получении изображения:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Получения номера телефона пользователя +
const getUserPhones = (dbPool) => async (req, res) => {
  const { id } = req.params

  try {
    const phoneQuery = `
      SELECT id, phone_number, phone_type
      FROM user_phones
      WHERE user_id = $1
    `
    const phoneResult = await dbPool.query(phoneQuery, [id])

    res.json(phoneResult.rows)
  } catch (error) {
    console.error('Ошибка при получении номеров телефонов:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Добавление номера телефона пользователя +
const addPhone = (dbPool) => async (req, res) => {
  const { userId } = req.params
  const { phone_number, phone_type } = req.body

  try {
    const addQuery = `
      INSERT INTO user_phones (user_id, phone_number, phone_type)
      VALUES ($1, $2, $3)
      RETURNING id, phone_number, phone_type
    `
    const addResult = await dbPool.query(addQuery, [
      userId,
      phone_number,
      phone_type,
    ])

    res.status(201).json(addResult.rows[0])
  } catch (error) {
    console.error('Ошибка при добавлении номера телефона:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Изменение номера телефона пользователя
const updatePhone = (dbPool) => async (req, res) => {
  const { phoneId } = req.params
  const { phone_number, phone_type } = req.body

  try {
    const updateQuery = `
      UPDATE user_phones
      SET phone_number = $1, phone_type = $2
      WHERE id = $3
      RETURNING id, phone_number, phone_type
    `
    const updateResult = await dbPool.query(updateQuery, [
      phone_number,
      phone_type,
      phoneId,
    ])

    if (updateResult.rowCount === 0) {
      return res.status(404).send('Телефон не найден')
    }

    res.json(updateResult.rows[0])
  } catch (error) {
    console.error('Ошибка при обновлении номера телефона:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Удаление номера телефона пользователя
const deletePhone = (dbPool) => async (req, res) => {
  const { phoneId } = req.params // Извлечь phoneId из параметров маршрута

  console.log('Сервер получил phoneId для удаления:', phoneId) // Отладочная строка

  try {
    const result = await dbPool.query(
      'DELETE FROM user_phones WHERE id = $1 RETURNING id',
      [phoneId]
    )

    if (result.rowCount === 0) {
      return res.status(404).send('Телефонный номер не найден')
    }

    res.status(204).send()
  } catch (error) {
    console.error('Ошибка при удалении номера телефона:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Создание нового статуса пользователя
const createUserStatus = (dbPool) => async (req, res) => {
  const { user_id, status, start_date, end_date } = req.body

  console.log('Создание статуса для пользователя:', user_id) // Отладочная строка

  try {
    const result = await dbPool.query(
      `INSERT INTO user_statuses (user_id, status, start_date, end_date) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [user_id, status, start_date, end_date]
    )

    const userStatusId = result.rows[0].id

    // Если это не период, добавляем конкретные даты
    if (end_date === null) {
      const specificDates = req.body.specific_dates // Получаем список конкретных дат
      console.log(specificDates)
      if (Array.isArray(specificDates)) {
        for (const date of specificDates) {
          await dbPool.query(
            `INSERT INTO user_status_dates (user_status_id, specific_date) 
             VALUES ($1, $2)`,
            [userStatusId, date]
          )
        }
      }
    }

    res.status(201).json({ id: userStatusId })
  } catch (error) {
    console.error('Ошибка при создании статуса пользователя:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Получить id МПП или его зама в зависимости от доступности и приоритета
const getMppIdByCompanyId = (dbPool) => async (req, res) => {
  const { id } = req.params
  try {
    const query = `
      WITH active_mpp AS (
        SELECT u.id AS mpp_id
        FROM companies c
        JOIN users u ON u.id = c.mpp_id
        WHERE c.id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM user_statuses us
          WHERE us.user_id = u.id
          AND (
            (us.start_date <= CURRENT_DATE AND (us.end_date IS NULL OR us.end_date >= CURRENT_DATE))
            OR EXISTS (
              SELECT 1
              FROM user_status_dates usd
              WHERE usd.user_status_id = us.id
              AND usd.specific_date = CURRENT_DATE
            )
          )
        )
      ), replacing_mpp_candidates AS (
        SELECT r.user_id AS replacing_mpp_id, mpp.priority_level
        FROM replacing_mpp r
        JOIN mpp_priority mpp ON r.id = mpp.replacing_mpp_id
        WHERE r.company_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM user_statuses us
          WHERE us.user_id = r.user_id
          AND (
            (us.start_date <= CURRENT_DATE AND (us.end_date IS NULL OR us.end_date >= CURRENT_DATE))
            OR EXISTS (
              SELECT 1
              FROM user_status_dates usd
              WHERE usd.user_status_id = us.id
              AND usd.specific_date = CURRENT_DATE
            )
          )
        )
      )
      SELECT 
        COALESCE((SELECT mpp_id FROM active_mpp), 
                  (SELECT replacing_mpp_id FROM replacing_mpp_candidates ORDER BY priority_level ASC LIMIT 1)) AS result_id;
    `

    const result = await dbPool.query(query, [id])
    const row = result.rows[0]

    if (row && row.result_id) {
      res.json({ id: row.result_id })
    } else {
      res
        .status(404)
        .json({ error: 'MPP not found for the provided company ID' })
    }
  } catch (error) {
    console.error('Ошибка при получении MPP ID:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Получить id МПР или его зама в зависимости от доступности
const getMprIdByCompanyId = (dbPool) => async (req, res) => {
  const { id } = req.params
  try {
    const query = `
      WITH active_mpr AS (
    SELECT u.id AS mpr_id
    FROM companies c
    JOIN users u ON u.id = c.mpr_id
    WHERE c.id = $1
    AND NOT EXISTS (
        SELECT 1
        FROM user_statuses us
        WHERE us.user_id = u.id
        AND (
            (us.start_date <= CURRENT_DATE AND (us.end_date IS NULL OR us.end_date >= CURRENT_DATE))
            OR EXISTS (
                SELECT 1
                FROM user_status_dates usd
                WHERE usd.user_status_id = us.id
                AND usd.specific_date = CURRENT_DATE
            )
        )
    )
), replacing_mpr_candidates AS (
    SELECT r.user_id AS replacing_mpr_id
    FROM replacing_mpr r
    WHERE r.company_id = $1
    AND NOT EXISTS (
        SELECT 1
        FROM user_statuses us
        WHERE us.user_id = r.user_id
        AND (
            (us.start_date <= CURRENT_DATE AND (us.end_date IS NULL OR us.end_date >= CURRENT_DATE))
            OR EXISTS (
                SELECT 1
                FROM user_status_dates usd
                WHERE usd.user_status_id = us.id
                AND usd.specific_date = CURRENT_DATE
            )
        )
    )
)
SELECT 
    COALESCE(
        (SELECT mpr_id FROM active_mpr), 
        (SELECT replacing_mpr_id FROM replacing_mpr_candidates LIMIT 1)
    ) AS result_id;
    `

    const result = await dbPool.query(query, [id])
    const row = result.rows[0]

    if (row && row.result_id) {
      res.json({ id: row.result_id })
    } else {
      res
        .status(404)
        .json({ error: 'MPR not found for the provided company ID' })
    }
  } catch (error) {
    console.error('Ошибка при получении MPR ID:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Получить id НОК или МПП или его зама в зависимости от доступности и приоритета
const getNokOrMppIdByCompanyId = (dbPool) => async (req, res) => {
  const { id } = req.params
  try {
    const query = `
      WITH nok_user AS (
    SELECT u.id AS nok_id
    FROM users u
    JOIN positions p ON u.position_id = p.id
    WHERE p.name = 'НОК' 
    AND NOT EXISTS (
      SELECT 1
      FROM user_statuses us
      WHERE us.user_id = u.id
      AND (
          (us.start_date <= CURRENT_DATE AND (us.end_date IS NULL OR us.end_date >= CURRENT_DATE))
          OR EXISTS (
              SELECT 1
              FROM user_status_dates usd
              WHERE usd.user_status_id = us.id
              AND usd.specific_date = CURRENT_DATE
          )
      )
    )
), active_mpp AS (
    SELECT u.id AS mpp_id
    FROM companies c
    JOIN users u ON u.id = c.mpp_id
    WHERE c.id = $1
    AND NOT EXISTS (
      SELECT 1
      FROM user_statuses us
      WHERE us.user_id = u.id
      AND (
          (us.start_date <= CURRENT_DATE AND (us.end_date IS NULL OR us.end_date >= CURRENT_DATE))
          OR EXISTS (
              SELECT 1
              FROM user_status_dates usd
              WHERE usd.user_status_id = us.id
              AND usd.specific_date = CURRENT_DATE
          )
      )
    )
), replacing_mpp_candidates AS (
    SELECT r.user_id AS replacing_mpp_id, mpp.priority_level
    FROM replacing_mpp r
    JOIN mpp_priority mpp ON r.id = mpp.replacing_mpp_id
    WHERE r.company_id = $1
    AND NOT EXISTS (
      SELECT 1
      FROM user_statuses us
      WHERE us.user_id = r.user_id
      AND (
          (us.start_date <= CURRENT_DATE AND (us.end_date IS NULL OR us.end_date >= CURRENT_DATE))
          OR EXISTS (
              SELECT 1
              FROM user_status_dates usd
              WHERE usd.user_status_id = us.id
              AND usd.specific_date = CURRENT_DATE
          )
      )
    )
)
SELECT 
    COALESCE(
        (SELECT nok_id FROM nok_user), 
        (SELECT mpp_id FROM active_mpp), 
        (SELECT replacing_mpp_id FROM replacing_mpp_candidates ORDER BY priority_level ASC LIMIT 1)
    ) AS result_id;

    `

    const result = await dbPool.query(query, [id])
    const row = result.rows[0]

    if (row && row.result_id) {
      res.json({ id: row.result_id })
    } else {
      res
        .status(404)
        .json({ error: 'MPP not found for the provided company ID' })
    }
  } catch (error) {
    console.error('Ошибка при получении MPP ID:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Переназначение уведомлений для сотрудников
const updateReminderUserNotification = (dbPool) => async (req, res) => {
  const { selectedEmployeeId, taskId, newTag } = req.body

  if (!selectedEmployeeId || !taskId || !newTag) {
    return res.status(400).json({ message: 'Missing parameters' })
  }

  try {
    const query = `
      UPDATE reminders 
      SET user_id = $1,
      is_completed = false, 
      tags = tags || $2::jsonb 
      WHERE id = $3`
    const newTagJson = JSON.stringify([newTag])
    await dbPool.query(query, [selectedEmployeeId, newTagJson, taskId])
    return res
      .status(200)
      .json({ message: 'Изменение напоминания прошло успешно' })
  } catch (error) {
    console.error(error)
    return res
      .status(500)
      .json({ message: 'Ошибка в ходе изменения уведомления' })
  }
}

const getRemindersCalls = (dbPool) => async (req, res) => {
  const userId = req.params.userId // Предполагается, что вы передаете userId в запросе
  console.log(userId)
  try {
    const result = await dbPool.query(
      `SELECT id, title, comment, type_reminders, date_time, created_at 
       FROM reminders 
       WHERE user_id = $1 AND is_completed = false AND date_time >= NOW()`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error(error)
    res.status(500).send('Ошибка при получении данных')
  }
}

// Обновление времени и комментария для напоминаний о звонке
const updateReminder = (dbPool) => async (req, res) => {
  const reminderId = req.params.id
  const { date_time, comment } = req.body

  if (!date_time || !comment) {
    return res
      .status(400)
      .json({ error: 'Поля "date_time" и "comment" обязательны.' })
  }

  try {
    const result = await dbPool.query(
      'UPDATE reminders SET date_time = $1, comment = $2 WHERE id = $3 RETURNING *',
      [date_time, comment, reminderId]
    )

    // Проверка, было ли обновлено какое-либо напоминание
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Напоминание не найдено.' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Ошибка при обновлении напоминания:', error)
    res.status(500).json({ error: 'Ошибка при обновлении напоминания' })
  }
}

// Тэги *****************************************************************************************
// Получение всех тегов
const getTags = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query('SELECT * FROM tags ORDER BY id')
    res.json(result.rows)
  } catch (error) {
    console.error('Ошибка при получении тегов:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Создание нового тега
const createTag = (dbPool) => async (req, res) => {
  const { name } = req.body // icon — если нужно сохранять и иконки
  if (!name) {
    return res.status(400).send('Имя тега обязательно')
  }
  try {
    const result = await dbPool.query(
      'INSERT INTO tags (name) VALUES ($1) RETURNING *',
      [name]
    )
    res.json(result.rows[0])
  } catch (error) {
    console.error('Ошибка при добавлении тега:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Удаление тега по id
const deleteTag = (dbPool) => async (req, res) => {
  const { id } = req.params
  try {
    await dbPool.query('DELETE FROM tags WHERE id = $1', [id])
    res.json({ success: true })
  } catch (error) {
    console.error('Ошибка при удалении тега:', error)
    res.status(500).send('Ошибка сервера')
  }
}

module.exports = {
  getUsers,
  updateUser,
  deleteUser,
  createUser,
  updateUserStatus,
  uploadAvatar,
  getAvatar,
  getUserPhones,
  addPhone,
  updatePhone,
  deletePhone,
  createUserStatus,
  getMppIdByCompanyId,
  getMprIdByCompanyId,
  updateReminderUserNotification,
  getNokOrMppIdByCompanyId,
  getRemindersCalls,
  updateReminder,
  deleteTag,
  createTag,
  getTags,
}
