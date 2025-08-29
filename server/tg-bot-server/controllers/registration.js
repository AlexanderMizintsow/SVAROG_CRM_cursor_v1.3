// controllers/registration.js

const handleRegistrationMessage = async (msg, bot, dbPool, userStates) => {
  const chatId = msg.chat.id
  const userMessage = msg.text
  const state = userStates[chatId] || {}

  if (userMessage.toLowerCase() === '/start') {
    await bot.sendMessage(
      chatId,
      'Добро пожаловать в чат оповещения приложения SVAROG! Введите свою фамилию для регистрации.'
    )
    userStates[chatId] = { expecting: 'lastName' } // Устанавливаем ожидание фамилии
    return
  }

  // Проверка фамилии
  if (state.expecting === 'lastName') {
    const lastName = userMessage

    const userResult = await dbPool.query(
      'SELECT id FROM users WHERE last_name = $1',
      [lastName]
    )

    if (userResult.rows.length > 0) {
      userStates[chatId] = {
        userId: userResult.rows[0].id,
        expecting: 'password',
      }
      await bot.sendMessage(
        chatId,
        'Введите пароль для завершения регистрации.'
      )
    } else {
      await bot.sendMessage(chatId, 'Фамилия не найдена. Попробуйте еще раз.')
    }
    return
  }

  // Проверка пароля
  if (state.expecting === 'password') {
    const password = userMessage

    if (password === '777') {
      await dbPool.query(
        'INSERT INTO telegramm_registrations_chat (user_id, chat_id, registered) VALUES ($1, $2, $3)',
        [state.userId, chatId, true]
      )
      await bot.sendMessage(chatId, 'Вы успешно зарегистрированы!')
      delete userStates[chatId] // Удаляем состояние после регистрации
    } else {
      await bot.sendMessage(chatId, 'Неправильный пароль. Попробуйте снова.')
    }
    return
  }
}

module.exports = { handleRegistrationMessage }
