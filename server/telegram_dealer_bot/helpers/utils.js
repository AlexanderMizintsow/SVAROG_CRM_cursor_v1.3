// utils.js

const { Markup } = require('telegraf')

const cancelButton = Markup.button.callback('❌ Отмена', '/cancel')

const keyboardCancel = Markup.inlineKeyboard([cancelButton])

// Удаление последнего сообщения
async function deleteLastMessage(bot, chatId, userSessions) {
  if (userSessions[chatId].lastMessageId) {
    try {
      await bot.deleteMessage(chatId, userSessions[chatId].lastMessageId)
      console.log(
        `Сообщение меню удаленных предыдущих вычислений с идентификатором: ${userSessions[chatId].lastMessageId}`
      )
    } catch (error) {
      console.error(`Не удалось удалить сообщение: ${error.message}`)
    }
  }
}

// Если сообщение слишком длинное то разбивается на несколько
// const maxLength = 4096
// const messages = splitMessage(response, maxLength).

function splitMessage(message, maxLength) {
  const messages = []
  let currentMessage = ''

  for (const line of message.split('\n')) {
    if ((currentMessage + line).length <= maxLength) {
      currentMessage += (currentMessage ? '\n' : '') + line
    } else {
      messages.push(currentMessage)
      currentMessage = line
    }
  }

  if (currentMessage) {
    messages.push(currentMessage) // Добавление последней части, если она есть
  }

  return messages
}

// Экспортируем клавиатуру
module.exports = {
  cancelButton,
  keyboardCancel,
  deleteLastMessage,
  splitMessage,
}
