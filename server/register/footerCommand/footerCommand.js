const { exec } = require('child_process') // npm i child_process ?
// // Добавление и обновление отзыва
const addOrUpdateReview = (dbPool) => async (req, res) => {
  const { userId, rating, feedback } = req.body

  if (!userId || !rating || rating < 1 || rating > 5 || !feedback) {
    return res.status(400).json({ message: 'Неверные данные запроса' })
  }

  try {
    // Проверяем, есть ли уже отзыв от этого пользователя
    const existingReview = await dbPool.query(
      'SELECT * FROM reviews WHERE user_id = $1',
      [userId]
    )

    if (existingReview.rows.length > 0) {
      // Если отзыв существует, обновляем его
      const result = await dbPool.query(
        'UPDATE reviews SET rating = $1, feedback = $2, updated_at = NOW() WHERE user_id = $3 RETURNING *',
        [rating, feedback, userId]
      )

      const updatedReview = result.rows[0]
      return res
        .status(200)
        .json({ message: 'Отзыв обновлен', review: updatedReview })
    } else {
      // Если отзыва нет, добавляем новый
      const result = await dbPool.query(
        'INSERT INTO reviews (user_id, rating, feedback) VALUES ($1, $2, $3) RETURNING *',
        [userId, rating, feedback]
      )

      const newReview = result.rows[0]
      return res
        .status(201)
        .json({ message: 'Отзыв добавлен', review: newReview })
    }
  } catch (error) {
    console.error('Ошибка при добавлении/обновлении отзыва:', error)
    res.status(500).json({ message: 'Ошибка сервера' })
  }
}

// Получение отзыва для пользователя
const getReview = (dbPool) => async (req, res) => {
  const { userId } = req.params

  try {
    const result = await dbPool.query(
      'SELECT * FROM reviews WHERE user_id = $1',
      [userId]
    )

    // console.log('Результаты запроса:', result.rows) // Подробный вывод результатов запроса

    if (result.rows.length > 0) {
      return res.status(200).json(result.rows[0])
    } else {
      return res.status(404).json({ message: 'Отзыв не найден' })
    }
  } catch (error) {
    console.error('Ошибка при получении отзыва:', error)
    return res.status(500).json({ message: 'Ошибка сервера' })
  }
}

// Получение средней оценки
const getAverageRating = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(
      'SELECT AVG(rating) AS average_rating FROM reviews'
    )
    res.json(result.rows[0])
  } catch (error) {
    console.error('Ошибка при получении средней оценки:', error)
    res.status(500).json({ message: 'Ошибка сервера' })
  }
}

// Получение всех отзывов с информацией о пользователе
const getAllReviews = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT reviews.*, 
             users.first_name, 
             users.middle_name, 
             users.last_name 
      FROM reviews 
      JOIN users ON reviews.user_id = users.id 
      ORDER BY reviews.updated_at DESC
    `)
    res.json(result.rows)
  } catch (error) {
    console.error('Ошибка при получении всех отзывов:', error)
    res.status(500).json({ message: 'Ошибка сервера' })
  }
}

// Новая версия получения было ли ознакомление
const getIntroductionNewVersion = (dbPool) => async (req, res) => {
  const { userId } = req.params

  try {
    const result = await dbPool.query(
      'SELECT is_approved FROM version_app WHERE user_id = $1',
      [userId]
    )

    //console.log('Результаты запроса:', result.is_approved) // Подробный вывод результатов запроса

    if (result.rows.length > 0) {
      return res.status(200).json({ is_approved: result.rows[0].is_approved })
    } else {
      return res.status(200).json({ is_approved: false }) // Возвращаем false, если записи нет
    }
  } catch (error) {
    console.error('Ошибка при получении отзыва:', error)
    return res.status(500).json({ message: 'Ошибка сервера' })
  }
}

// Новая версия запись о прочтении
const postVersionApp = (dbPool) => async (req, res) => {
  const { user_id } = req.body

  try {
    // Вставка записи с user_id и is_approved. Если запись уже существует, ничего не делать.
    const result = await dbPool.query(
      `INSERT INTO version_app (user_id, is_approved) 
       VALUES ($1, TRUE)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING *`,
      [user_id]
    )

    if (result.rowCount === 0) {
      // Если запись не была вставлена, значит, уже существует
      return res
        .status(200)
        .json({ message: 'Запись уже существует, ничего не сделано' })
    }

    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Ошибка при создании или обновлении версии приложения:', err)
    res
      .status(500)
      .json({ error: 'Ошибка при создании или обновлении версии приложения' })
  }
}

// Удалить данные о просмотрах и показать обновление
const showVersionApp = (dbPool) => async (req, res) => {
  try {
    await dbPool.query(`DELETE FROM version_app;`)
    res.status(200).json({ message: 'Данные о версиях успешно удалены.' })
  } catch (err) {
    console.error('Ошибка ShowVersionApp', err)
  }
}

// Загрузка обновлений с Git
const updateApp = (dbPool) => async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      exec('git pull origin main', (error, stdout, stderr) => {
        if (error) {
          console.error(`Ошибка: ${stderr}`)
          return reject(`Ошибка при обновлении приложения: ${stderr}`)
        }
        console.log(stdout)
        resolve(stdout)
      })
    })

    res.status(200).json({ message: 'Приложение обновлено' })
  } catch (err) {
    console.error('Ошибка при обновлении приложения:', err)
    res.status(500).json({ message: 'Ошибка при обновлении приложения' })
  }
}

module.exports = {
  addOrUpdateReview,
  getReview,
  getAverageRating,
  getAllReviews,
  getIntroductionNewVersion,
  postVersionApp,
  showVersionApp,
  updateApp,
}
