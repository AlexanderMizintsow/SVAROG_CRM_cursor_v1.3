// authController.js
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator')

// Регистрация
const registerUser = (dbPool) => async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }

  const { username, password, email } = req.body
  try {
    const existingUsername = await dbPool.query('SELECT * FROM users WHERE username = $1', [
      username,
    ])
    if (existingUsername.rows.length > 0) {
      return res.status(409).send('Пользователь с таким логином уже существует')
    }

    const existingEmail = await dbPool.query('SELECT * FROM users WHERE email = $1', [email])
    if (existingEmail.rows.length > 0) {
      return res.status(409).send('Пользователь с такой почтой уже существует')
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = await dbPool.query(
      'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, hashedPassword, email]
    )

    res.status(201).json({
      message: 'Пользователь успешно зарегистрирован',
      user: {
        id: newUser.rows[0].id,
        username: newUser.rows[0].username,
        email: newUser.rows[0].email,
      },
    })
  } catch (error) {
    console.error('Ошибка при регистрации пользователя:', error)
    res.status(500).send('Ошибка сервера')
  }
}

// Вход в приложение
const loginUser = (dbPool) => async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }

  const { username, password } = req.body
  try {
    const userQuery = `
      SELECT users.*, roles.name AS role_name, positions.name AS position
      FROM users
      LEFT JOIN roles ON users.role_id = roles.id
      LEFT JOIN positions on positions.id = users.id
      WHERE username = $1
    `
    const user = await dbPool.query(userQuery, [username])

    if (user.rows.length > 0) {
      const validPassword = await bcrypt.compare(password, user.rows[0].password)

      if (!user.rows[0].role_assigned) {
        return res
          .status(403)
          .send(
            'После регистрации необходимо получить роль. Пожалуйста, обратитесь к администратору для назначения роли.'
          )
      }

      if (validPassword) {
        const userData = {
          id: user.rows[0].id,
          username: user.rows[0].username,
          role_assigned: user.rows[0].role_assigned,
          email: user.rows[0].email,
          first_name: user.rows[0].first_name,
          last_name: user.rows[0].last_name,
          middle_name: user.rows[0].middle_name,
          birth_date: user.rows[0].birth_date,
          role_id: user.rows[0].role_id,
          role_name: user.rows[0].role_name,
          user_photo: user.rows[0].user_photo,
          position: user.rows[0].position,
        }

        const token = jwt.sign({ userId: user.rows[0].id }, process.env.JWT_SECRET, {
          expiresIn: '1h',
        })
        res.status(200).json({ token: `Bearer ${token}`, user: userData })
      } else {
        res.status(401).send('Неверные учетные данные')
      }
    } else {
      res.status(401).send('Пользователь не существует')
    }
  } catch (error) {
    res.status(500).send('Ошибка входа')
  }
}

// Смена пароля пользователя
const changePassword = (dbPool) => async (req, res) => {
  const { userId } = req.params
  const { newPassword } = req.body

  // Проверка валидации пароля может быть добавлена здесь, если необходимо

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await dbPool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId])

    res.status(200).json({ message: 'Пароль успешно изменён' })
  } catch (error) {
    console.error('Ошибка при изменении пароля:', error)
    res.status(500).send('Ошибка сервера')
  }
}

const checkDbConnection = (dbPool) => async (req, res) => {
  try {
    await dbPool.query('SELECT NOW()') //  для проверки соединения

    res.status(200).send('Connected') // Если соединение успешно
  } catch (error) {
    console.error('Ошибка соединения с базой данных:', error)
    res.status(500).send('Not Connected')
  }
}

module.exports = { registerUser, loginUser, changePassword, checkDbConnection }
