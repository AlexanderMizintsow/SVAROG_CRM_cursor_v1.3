const axios = require('axios')
const config = require('../../config')

const client = axios.create({
  baseURL: config.tgBotApiUrl,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

async function sendMessage(userIds, message) {
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return
  try {
    await client.post('/api/bpe/send-message', { user_ids: userIds, message })
  } catch (err) {
    console.error('telegramClient.sendMessage:', err.message)
    throw err
  }
}

module.exports = { sendMessage }
