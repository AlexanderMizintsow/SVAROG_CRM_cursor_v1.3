// helperMenu.js
const menuHelp = {
  /* help: {
    description: '🆘 Показать это меню помощи',
    usage: '/help',
  },*/
  info: {
    description: 'ℹ️ Получить информацию о компании',
    usage: '/info',
  },
  contact: {
    description: '❌ Удалить доступ к чату',
    usage: '/delete',
  },
  calculations: {
    description: '📊 Управление расчетами',
    usage: '/calculations',
  },
  verification: {
    description: '🧾 Сверка',
    usage: '/verification',
  },
  delivery: {
    description: '🚚 Доставка',
    usage: '/delivery_order',
  },
  finances: {
    description: '💰 Финансы',
    usage: '/finances',
  },
  complaint: {
    description: '⚠️📄❗ Рекламация',
    usage: '/complaint',
  },
  consultation: {
    description: '💬💡 Консультация',
    usage: '/consultation',
  },
}

async function displayHelpMenu(bot, chatId, userSessions) {
  // Инициализация userSessions[chatId]
  userSessions[chatId] = userSessions[chatId] || {}

  // Удаляем предыдущее сообщение
  if (userSessions[chatId].lastMessageId) {
    try {
      await bot.deleteMessage(chatId, userSessions[chatId].lastMessageId)
      console.log(
        `Deleted previous help menu message with ID: ${userSessions[chatId].lastMessageId}`
      )
    } catch (error) {
      console.error(`Failed to delete message: ${error.message}`)
    }
  }

  // Создаем клавиатуру с кнопками для меню помощи
  const keyboard = Object.values(menuHelp).map((value) => [
    { text: value.description, callback_data: value.usage },
  ])

  const options = {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  }

  // Отправляем новое сообщение с меню помощи и сохраняем его ID
  const message = await bot.sendMessage(chatId, 'Доступные команды:', options)

  // Обновление lastMessageId
  userSessions[chatId].lastMessageId = message.message_id
}

module.exports = {
  menuHelp,
  displayHelpMenu,
}
