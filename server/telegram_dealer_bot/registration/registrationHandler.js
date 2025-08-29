const dbPool = require('../database/db')
const { handleCancel } = require('../helpers/buttonCancel')

async function handleRegistration(bot, chatId, msg, userSessions) {
  let step = userSessions[chatId]?.step || 1 // Защита от ошибок доступа к несуществующим свойствам

  // Шаг 1: Запрос наименование компании
  if (step === 1) {
    const companyName = msg.text
    const companyQuery = 'SELECT * FROM companies WHERE name_companies = $1'
    const result = await dbPool.query(companyQuery, [companyName])
    console.log(companyName)
    if (result.rowCount > 0) {
      userSessions[chatId].companyId = result.rows[0].id // Сохраняем companyId
      userSessions[chatId].companyName = result.rows[0].name_companies // Сохраняем name_companies
      userSessions[chatId].step = 2 // Переход к следующему шагу
      await bot.sendMessage(chatId, 'Введите пароль:')
    } else {
      await bot.sendMessage(
        chatId,
        `Компания не обнаружена. Начинаем процесс регистрации. Пожалуйста, введите наименование вашей компании:`
      )
      // userSessions[chatId].step = 1
    }
  }

  // Шаг 2: Запрос на ввод пароля
  else if (step === 2) {
    const companyId = userSessions[chatId].companyId // Получаем companyId из сессии
    const passwordQuery =
      'SELECT telegram_password FROM companies WHERE id = $1'
    const result = await dbPool.query(passwordQuery, [companyId])

    if (result.rowCount > 0) {
      const company = result.rows[0]

      // Проверка на "NOTACCES"
      if (company.telegram_password === 'NOTACCES') {
        await bot.sendMessage(
          chatId,
          'Доступ закрыт, обратитесь к вашему менеджеру!'
        )
        return
      } else if (company.telegram_password === msg.text) {
        // Сохранить chatId в таблице user_company_tg_bot
        await dbPool.query(
          'INSERT INTO user_company_tg_bot (chat_id, company_id) VALUES ($1, $2)',
          [chatId, companyId]
        )

        await bot.sendMessage(chatId, 'Вы успешно зарегистрированы!')
        handleCancel(bot, chatId, userSessions)
        // delete userSessions[chatId] // Удаляем сессию только после успешной регистрации
      } else {
        await bot.sendMessage(
          chatId,
          'Пароль введен неверно! Попробуйте снова:'
        )
      }
    } else {
      await bot.sendMessage(
        chatId,
        'Не удалось найти компанию. Пожалуйста, попробуйте снова.'
      )
    }
  }
  return
}

module.exports = {
  handleRegistration,
}
