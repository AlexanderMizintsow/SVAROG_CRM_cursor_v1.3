//файл messageHandler.js
async function handleRegisteredUserMessage(msg, bot, dbPool, userStates) {
  const chatId = msg.chat.id
  const userMessage = msg.text.toLowerCase()
  const validCommands = [
    { command: '/start', description: 'Запустить бота и начать регистрацию' },
    { command: '/help', description: 'Показать доступные команды' },
    {
      command: '/missed_on',
      description: 'Включить уведомления о пропущенных звонках',
    },
    {
      command: '/missed_off',
      description: 'Выключить уведомления о пропущенных звонках',
    },
    {
      command: '/reminders_calls_on',
      description: 'Включить уведомления о напоминаниях для звонков',
    },
    {
      command: '/reminders_calls_off',
      description: 'Выключить уведомления о напоминаниях для звонков',
    },
    // Добавьте другие команды и их описания по необходимости
  ]

  // Пример логики для команды "привет!"
  if (userMessage === 'привет!') {
    bot.sendMessage(chatId, 'Привет!')
    return // Завершить выполнение
  }

  //  "/help"
  if (userMessage === '/help') {
    const commandsList = validCommands
      .map((cmd) => `${cmd.command} - ${cmd.description}`)
      .join('\n') // Объединяем команды и их описания через перевод строки
    bot.sendMessage(chatId, `Доступные команды:\n${commandsList}`) // Отправляем список команд и описания
    return // Завершить выполнение
  }

  // ********* Команды для БД ********************
  // Деактивация уведомлений о звонках.
  if (userMessage === '/missed_off') {
    try {
      // Получаем user_id по chat_id
      const userResult = await dbPool.query(
        'SELECT user_id FROM telegramm_registrations_chat WHERE chat_id = $1',
        [chatId]
      )

      if (userResult.rows.length === 0) {
        return bot.sendMessage(chatId, 'Пользователь не найден.')
      }

      const userId = userResult.rows[0].user_id

      // Обновляем поле showMissedCallsEmployee в таблице calls_settings_users
      await dbPool.query(
        'UPDATE calls_settings_users SET showCallMissedTg = $1 WHERE user_id = $2',
        [false, userId]
      )

      // Проверяем статус после обновления (по желанию)
      const statusResult = await dbPool.query(
        'SELECT showCallMissedTg FROM calls_settings_users WHERE user_id = $1',
        [userId]
      )

      const status = 'Деактивировано'

      // Отправляем сообщение о статусе
      bot.sendMessage(chatId, `Ваш статус: ${status}`)
      return // Завершить выполнение
    } catch (error) {
      console.error('Ошибка при обработке команды:', error)
      bot.sendMessage(chatId, 'Произошла ошибка при выполнении команды.')
      return // Завершить выполнение
    }
  }

  // Активация уведомлений о звонках.
  if (userMessage === '/missed_on') {
    try {
      // Получаем user_id по chat_id
      const userResult = await dbPool.query(
        'SELECT user_id FROM telegramm_registrations_chat WHERE chat_id = $1',
        [chatId]
      )

      if (userResult.rows.length === 0) {
        return bot.sendMessage(chatId, 'Пользователь не найден.')
      }

      const userId = userResult.rows[0].user_id

      // Обновляем поле showMissedCallsEmployee в таблице calls_settings_users
      await dbPool.query(
        'UPDATE calls_settings_users SET showCallMissedTg = $1 WHERE user_id = $2',
        [true, userId]
      )

      // Проверяем статус после обновления (по желанию)
      const statusResult = await dbPool.query(
        'SELECT showCallMissedTg FROM calls_settings_users WHERE user_id = $1',
        [userId]
      )

      const status = 'Активировано'

      // Отправляем сообщение о статусе
      bot.sendMessage(chatId, `Ваш статус: ${status}`)
      return // Завершить выполнение
    } catch (error) {
      console.error('Ошибка при обработке команды:', error)
      bot.sendMessage(chatId, 'Произошла ошибка при выполнении команды.')
      return // Завершить выполнение
    }
  }
  // *******

  // Деактивация уведомлений о напоминаниях.
  if (userMessage === '/reminders_calls_off') {
    try {
      // Получаем user_id по chat_id
      const userResult = await dbPool.query(
        'SELECT user_id FROM telegramm_registrations_chat WHERE chat_id = $1',
        [chatId]
      )

      if (userResult.rows.length === 0) {
        return bot.sendMessage(chatId, 'Пользователь не найден.')
      }

      const userId = userResult.rows[0].user_id

      // Обновляем поле showRemindersCalls в таблице calls_settings_users
      await dbPool.query(
        'UPDATE calls_settings_users SET showRemindersCalls = $1 WHERE user_id = $2',
        [false, userId]
      )

      // Отправляем сообщение о статусе
      bot.sendMessage(chatId, 'Уведомления о напоминаниях деактивированы.')
      return // Завершить выполнение
    } catch (error) {
      console.error('Ошибка при обработке команды:', error)
      bot.sendMessage(chatId, 'Произошла ошибка при выполнении команды.')
      return // Завершить выполнение
    }
  }

  // Активация уведомлений о напоминаниях.
  if (userMessage === '/reminders_calls_on') {
    try {
      // Получаем user_id по chat_id
      const userResult = await dbPool.query(
        'SELECT user_id FROM telegramm_registrations_chat WHERE chat_id = $1',
        [chatId]
      )

      if (userResult.rows.length === 0) {
        return bot.sendMessage(chatId, 'Пользователь не найден.')
      }

      const userId = userResult.rows[0].user_id

      // Обновляем поле showRemindersCalls в таблице calls_settings_users
      await dbPool.query(
        'UPDATE calls_settings_users SET showRemindersCalls = $1 WHERE user_id = $2',
        [true, userId]
      )

      // Отправляем сообщение о статусе
      bot.sendMessage(
        chatId,
        'Уведомления о напоминаниях для звонков активированы.'
      )
      return // Завершить выполнение
    } catch (error) {
      console.error('Ошибка при обработке команды:', error)
      bot.sendMessage(chatId, 'Произошла ошибка при выполнении команды.')
      return // Завершить выполнение
    }
  }

  // Ответ на нераспознанные команды можно вынести в отдельный блок
  if (!validCommands.includes(userMessage)) {
    bot.sendMessage(chatId, 'Команда: "' + msg.text + '" не найдена')
  }
}

module.exports = {
  handleRegisteredUserMessage,
}
