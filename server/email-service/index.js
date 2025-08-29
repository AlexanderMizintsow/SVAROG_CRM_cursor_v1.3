/* global Promise */
const express = require('express')
const nodemailer = require('nodemailer')
//const { simpleParser } = require('mailparser')
const imaps = require('imap-simple')
//const _ = require('lodash')
const http = require('http')
require('dotenv').config()
const { Server } = require('socket.io')
const cors = require('cors')
const multer = require('multer')
const { Pool } = require('pg')

const { body, validationResult } = require('express-validator')
const { processMessage } = require('./processMessage')
const app = express()
app.use(express.json())

app.use(
  cors({
    origin: [
      'http://localhost:5173', // Локальный адрес
      'http://192.168.57.112:5173', // Локальный IP-адрес
      'http://172.26.32.1:5173', // Альтернативный локальный IP-адрес
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  })
)

const upload = multer()

const dbPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173', // Локальный адрес
      'http://192.168.57.112:5173', // Локальный IP-адрес
      'http://172.26.32.1:5173', // Альтернативный локальный IP-адрес
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
})

// Используем объект для хранения конфигураций каждого пользователя
const userSessions = {}

app.post('/emailAuth', [body('userId').isNumeric()], async (req, res) => {
  try {
    const userId = req.body.userId
    console.log('Получен userId:', userId)

    const userQuery = `SELECT email, email_token FROM users WHERE id = $1`
    const userResult = await dbPool.query(userQuery, [userId])

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userEmail = userResult.rows[0].email
    const userEmailToken = userResult.rows[0].email_token
    console.log('Получен userEmail:', userEmail)
    console.log('Получен emailToken:', userEmailToken)

    // Инициализируем конфигурации для конкретного пользователя и сохраняем их в userSessions
    userSessions[userId] = {
      email: userEmail,
      emailToken: userEmailToken,
      imapConfig: await initializeImapConfig(userEmail, userEmailToken),
      smtpTransport: await initializeSmtpTransport(userEmail, userEmailToken),
    }

    res.status(200).json({ message: 'Код подтверждения отправлен' })
  } catch (error) {
    console.error('Ошибка при получении email:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/get-email-token', async (req, res) => {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' })
  }

  try {
    const query = 'SELECT email_token FROM users WHERE id = $1'
    const result = await dbPool.query(query, [userId])

    if (result.rows.length > 0 && result.rows[0].email_token) {
      res.json({ exists: true })
    } else {
      res.json({ exists: false })
    }
  } catch (error) {
    console.error('Error checking email token:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post(
  '/save-email-token',
  [body('userId').isNumeric(), body('emailToken').isString()],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { userId, emailToken } = req.body

    try {
      const updateQuery = `UPDATE users SET email_token = $1 WHERE id = $2`
      await dbPool.query(updateQuery, [emailToken, userId])
      res.status(200).json({ message: 'Email token saved successfully' })
    } catch (error) {
      console.error('Error saving email token:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// Функция для инициализации imapConfig
async function initializeImapConfig(userEmail, userEmailToken) {
  return {
    imap: {
      user: userEmail,
      password: userEmailToken,
      host: 'imap.mail.ru',
      port: 993,
      tls: true,
      authTimeout: 10000,
    },
  }
}

// Функция для инициализации smtpTransport
async function initializeSmtpTransport(userEmail, userEmailToken) {
  return nodemailer.createTransport({
    host: 'smtp.mail.ru',
    port: 465,
    secure: true,
    auth: {
      user: userEmail,
      pass: userEmailToken,
    },
  })
}

// Функция для подключения к IMAP с рекурсивной попыткой
async function connectWithRetry(userSession, retries = 5, delay = 3000) {
  let attempt = 0
  while (attempt < retries) {
    try {
      const connection = await imaps.connect(userSession.imapConfig)
      return connection
    } catch (error) {
      attempt++
      console.error(
        `Попытка подключения ${attempt} из ${retries} не удалась:`,
        error
      )
      if (attempt < retries) {
        // Задержка перед следующей попыткой
        await new Promise((resolve) => setTimeout(resolve, delay))
      } else {
        throw new Error(
          'Не удалось подключиться к IMAP-серверу после нескольких попыток.'
        )
      }
    }
  }
}

// Функция для получения всех писем для конкретного пользователя
async function getAllMails(userId) {
  const userSession = userSessions[userId]
  if (!userSession || !userSession.imapConfig) {
    console.error('Ошибка: imapConfig не инициализирован')
    return
  }

  let connection

  try {
    connection = await connectWithRetry(userSession) // Подключаемся с попытками
    await connection.openBox('INBOX')

    const searchCriteria = ['ALL']
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT'],
      markSeen: false,
    }

    const results = await connection.search(searchCriteria, fetchOptions)
    const messages = await Promise.all(results.map(processMessage))

    const filteredMessages = messages.filter((message) => message !== null)
    return filteredMessages
  } catch (error) {
    console.error('Ошибка при получении писем:', error)
    return [] // Возвращаем пустой массив в случае ошибки
  } finally {
    if (connection) {
      await connection.end() // Закрываем соединение, если оно было установлено
    }
  }
}

// Функция для получения непрочитанных писем для конкретного пользователя
async function getUnreadMails(userId) {
  const userSession = userSessions[userId]
  if (!userSession || !userSession.emailToken) {
    //  console.error('Ошибка: emailToken не инициализирован')
    return [] // Вернуть пустой массив вместо выброса ошибки
  }

  const connection = await imaps.connect(userSession.imapConfig)
  await connection.openBox('INBOX')

  const searchCriteria = ['UNSEEN']
  const fetchOptions = {
    bodies: ['HEADER', 'TEXT'],
    markSeen: false,
  }

  const results = await connection.search(searchCriteria, fetchOptions)
  const messages = await Promise.all(results.map(processMessage))

  const filteredMessages = messages.filter((message) => message !== null)
  await connection.end()
  return filteredMessages
}

app.get('/get-emails', async (req, res) => {
  const userId = req.query.userId // Предполагается, что userId передается как query parameter
  try {
    const messages = await getAllMails(userId)
    res.json(messages)
  } catch (error) {
    console.error('Ошибка при получении писем:', error)
    res.status(500).send('Ошибка сервера при получении писем')
  }
})

app.get('/get-unread-emails', async (req, res) => {
  const userId = req.query.userId // Предполагается, что userId передается как query parameter
  try {
    const messages = await getUnreadMails(userId)
    res.json(messages)
  } catch (error) {
    console.error('Ошибка при получении непрочитанных писем:', error)
    res.status(500).send('Ошибка сервера при получении писем')
  }
})

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId // Предполагается, что userId передается как query parameter
  if (userId) {
    console.log(userId)
    socket.join(userId)
    console.log(
      `Пользователь ${userId} подключился и присоединился к комнате ${userId}`
    )
  }

  socket.on('disconnect', () => {
    console.log(`Пользователь ${userId} отключился`)
  })
})

// Функция для отправки уведомления о новых письмах конкретному пользователю
async function notifyUserOfNewEmails(userId) {
  try {
    const unreadEmails = await getUnreadMails(userId)

    if (unreadEmails.length > 0) {
      io.to(userId).emit('new-emails', unreadEmails)
    }
  } catch (error) {
    // console.error(  `Ошибка при уведомлении пользователя ${userId} о новых письмах:`,  error  )
  }
}

// Прослушивание событий новых писем (можно выполнить после проверки почты или при срабатывании триггера)
setInterval(async () => {
  // Проходим по всем сессиям пользователей и уведомляем их о новых письмах
  for (const userId in userSessions) {
    await notifyUserOfNewEmails(userId)
  }
}, 10000)

app.post('/send-email', upload.array('attachments', 10), async (req, res) => {
  const { userId } = req.body
  const { to, subject, body } = req.body
  const attachments = req.files

  if (!to || !subject || !body) {
    return res
      .status(400)
      .send('Необходимо указать все поля: to, subject и body.')
  }

  // Получаем конфигурацию пользователя
  const userSession = userSessions[userId]
  if (!userSession || !userSession.smtpTransport) {
    return res.status(500).send('SMTP транспорт не инициализирован.')
  }

  const mailOptions = {
    from: userSession.email,
    to: to,
    subject: subject,
    text: body,
  }

  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments.map((attachment) => ({
      filename: attachment.originalname,
      content: attachment.buffer,
    }))
  }

  // Вызовите эту функцию после успешной отправки письма
  //await saveSentMessage(userSession, mailOptions)
  //listMailboxes(userSession)
  try {
    const info = await userSession.smtpTransport.sendMail(mailOptions)
    res.json({ message: 'Email sent', info })
  } catch (error) {
    console.error('Ошибка при отправке письма:', error)
    res.status(500).send('Не удалось отправить письмо: ' + error.message)
  }
})
async function saveSentMessage(userSession, mailOptions) {
  try {
    const connection = await imaps.connect(userSession.imapConfig)
    await connection.openBox('[Gmail]/Sent Mail') // Попробуйте через атрибут \Sent

    const rawMessage = `From: ${mailOptions.from}\r\nTo: ${mailOptions.to}\r\nSubject: ${mailOptions.subject}\r\n\r\n${mailOptions.text}`

    await connection.append('Отправленные', rawMessage, { flags: ['\\Seen'] })
    await connection.end()
  } catch (error) {
    console.error('Ошибка при сохранении отправленного письма:', error)
  }
}

async function listMailboxes(userSession) {
  try {
    const connection = await imaps.connect(userSession.imapConfig)
    const boxes = await connection.getBoxes()
    console.log('Доступные папки:', boxes)
    await connection.end()
  } catch (error) {
    console.error('Ошибка при получении списка папок:', error)
  }
}

// Вызов функции

server.listen(5001, '0.0.0.0', () => {
  console.log('Server is running on port 5001')
})
