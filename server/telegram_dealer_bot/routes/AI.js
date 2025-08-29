const axios = require('axios')

async function handleUserMessageAI(bot, chatId, msg) {
  try {
    // Проверяем, если сообщение равно "AI"

    // Отправка в n8n
    const n8nWebhookUrl =
      'http://localhost:5678/webhook-test/b75ccc77-ae91-4568-9cad-7eec40229cd0'
    await axios.post(n8nWebhookUrl, {
      chat_id: chatId,
      message: msg.text,
    })
    console.log(`Сообщение "AI"   ${msg.text}`)
    console.log(`Сообщение "AI" отправлено в n8n для чата ${chatId}`)
  } catch (error) {
    bot.sendMessage(chatId, error.message)
  }
}
module.exports = {
  handleUserMessageAI,
}
