// index.js
const TelegramBot = require('node-telegram-bot-api')
const express = require('express')
require('dotenv').config()
const cors = require('cors')

const { Pool, Client } = require('pg')
const { handleRegistrationMessage } = require('./controllers/registration')
const {
  sendMissedCallNotifications,
  sendReminderNotifications,
  sendGroupCreationNotification,
} = require('./controllers/notificationSender')
const { handleRegisteredUserMessage } = require('./controllers/messageHandler')
const { startScheduler } = require('./controllers/scheduler')

const app = express()
const port = 5777
app.use(express.json())
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://192.168.57.112:5173',
      'http://172.26.32.1:5173',
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  })
)

const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: true })

const dbPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})

const userStates = {}

let lastNotificationTime = new Date() // Начальное время уведомления

// Подключение к базе данных для уведомлений
const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})

client.connect()

// Подписка на канал
client.query('LISTEN new_call_channel')

client.on('notification', async () => {
  lastNotificationTime = await sendMissedCallNotifications(
    bot,
    dbPool,
    client,
    lastNotificationTime
  )
})
setInterval(async () => {
  await sendReminderNotifications(bot, dbPool)
}, 120000)
// Обработчик всех текстовых сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id // Устанавливаем chatId для отправки сообщений

  try {
    const registrationResult = await dbPool.query(
      'SELECT registered FROM telegramm_registrations_chat WHERE chat_id = $1',
      [chatId]
    )

    if (registrationResult.rows[0]?.registered) {
      await handleRegisteredUserMessage(msg, bot, dbPool, userStates)
    } else {
      await handleRegistrationMessage(msg, bot, dbPool, userStates)
    }
  } catch (err) {
    console.error('Ошибка при запросе:', err)
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.')
  }
})

app.post('/api/create_group_notification', async (req, res) => {
  const { participants, groupData } = req.body // Извлекаем данные

  try {
    await sendGroupCreationNotification(bot, dbPool, participants, groupData)
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Ошибка при отправке уведомления о создании группы:', error)
    res.status(500).json({ success: false })
  }
})

// Запуск планировщика
startScheduler(bot, dbPool)

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`)
})
