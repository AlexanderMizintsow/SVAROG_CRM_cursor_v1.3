const dbPool = require('../database/db')

async function removeAccess(bot, chatId, userSessions, msg) {
  userSessions[chatId] = userSessions[chatId] || {}
  if (!userSessions[chatId].awaitinRemoveAccess) {
    const inlineKeyboard = [
      [
        {
          text: '✅ Да',
          callback_data: '/remove_access_comfirm',
        },
      ],
      [
        {
          text: '❌ Нет',
          callback_data: '/cancel',
        },
      ],
    ]

    const message = await bot.sendMessage(
      chatId,
      'Вы уверены что хотите удалить доступ к боту?',
      {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      }
    )
    return message
  }

  if (userSessions[chatId].awaitinRemoveAccess) {
    try {
      userSessions[chatId].awaitinRemoveAccess = false
      const companyIdQuery =
        'SELECT company_id FROM user_company_tg_bot WHERE chat_id = $1'
      const companyIdResult = await dbPool.query(companyIdQuery, [chatId])

      if (companyIdResult.rowCount > 0) {
        const companyId = companyIdResult.rows[0].company_id

        const updatePasswordQuery =
          'UPDATE companies SET telegram_password = $1 WHERE id = $2'
        await dbPool.query(updatePasswordQuery, ['NOTACCES', companyId])

        // Удаление записи из user_company_tg_bot
        const deleteAccessQuery =
          'DELETE FROM user_company_tg_bot WHERE company_id = $1'
        await dbPool.query(deleteAccessQuery, [companyId])
        delete userSessions[chatId]
        return {
          success: true,
          message: 'Доступ к чату был закрыт по Вашей команде.',
        }
      } else {
        return {
          success: false,
          message: 'Ошибка: Не удалось найти вашу компанию.',
        }
      }
    } catch (error) {
      console.error('Ошибка при удалении доступа:', error)
      return { success: false, message: 'Ошибка при выполнении операции.' }
    }
  }
}

module.exports = {
  removeAccess,
}
