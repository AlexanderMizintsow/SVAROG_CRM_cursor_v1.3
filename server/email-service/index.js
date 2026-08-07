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
const { getCorsOrigins } = require('./config')
const app = express()

const REGISTER_URL = process.env.REGISTER_URL || 'http://localhost:5000'

// Интервал опроса новых писем (мс). По умолчанию 30 с — быстрее чем 5 мин, без лавины как при 10 с + полной перекачке.
const EMAIL_POLL_INTERVAL_MS = Math.max(
  5000,
  parseInt(process.env.EMAIL_POLL_INTERVAL_MS || '30000', 10) || 30000
)

// Уже отправленные в register Message-ID (на пользователя), чтобы не дублировать при полном GET /get-unread-emails
const registerNotifiedMessageIds = {}

// Неактивные сессии без привязки к проектным отправителям удаляются из памяти (см. evictStaleUserSessions).
const SESSION_USER_TTL_MS = Math.max(
  600000,
  parseInt(process.env.SESSION_USER_TTL_MS || String(7 * 24 * 60 * 60 * 1000), 10) ||
    7 * 24 * 60 * 60 * 1000
)
const SESSION_EVICT_INTERVAL_MS = Math.max(
  60000,
  parseInt(process.env.SESSION_EVICT_INTERVAL_MS || '900000', 10) || 900000
)

function touchUserSession(userId) {
  const s = userSessions[String(userId)]
  if (s) s.lastActivityAt = Date.now()
}

function removeUserSessionEntry(userId) {
  const uid = String(userId)
  delete userSessions[uid]
  delete registerNotifiedMessageIds[uid]
}

function evictStaleUserSessions() {
  const now = Date.now()
  for (const uid of Object.keys(userSessions)) {
    const s = userSessions[uid]
    if (!s) continue
    if (s.pinned) continue
    const t = s.lastActivityAt
    if (t != null && now - t > SESSION_USER_TTL_MS) {
      removeUserSessionEntry(uid)
    }
  }
}

function postToRegister(path, bodyObj) {
  const url = new URL(path, REGISTER_URL)
  const data = JSON.stringify(bodyObj)
  const isHttps = url.protocol === 'https:'
  const lib = isHttps ? require('https') : require('http')
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let chunks = ''
        res.on('data', (c) => (chunks += c))
        res.on('end', () => resolve({ status: res.statusCode, body: chunks }))
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}
app.use(express.json())

app.use(
  cors({
    origin: getCorsOrigins(),
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
    origin: getCorsOrigins(),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
})

// Используем объект для хранения конфигураций каждого пользователя
const userSessions = {}

app.post('/emailAuth', [body('userId').isNumeric()], async (req, res) => {
  try {
    const userId = String(req.body.userId)
    const userQuery = `SELECT email, email_token FROM users WHERE id = $1`
    const userResult = await dbPool.query(userQuery, [userId])

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userEmail = userResult.rows[0].email
    const userEmailToken = userResult.rows[0].email_token
    const hasToken = userEmailToken != null && String(userEmailToken).trim() !== ''

    if (!hasToken) {
      removeUserSessionEntry(userId)
      return res.status(200).json({
        message: 'Токен почты не задан. Задайте токен в настройках — тогда будут доступны входящие и уведомления.',
      })
    }

    userSessions[userId] = {
      email: userEmail,
      emailToken: userEmailToken,
      imapConfig: await initializeImapConfig(userEmail, userEmailToken),
      smtpTransport: await initializeSmtpTransport(userEmail, userEmailToken),
      lastActivityAt: Date.now(),
      pinned: false,
    }

    res.status(200).json({ message: 'Код подтверждения отправлен' })
  } catch (error) {
    console.error('Ошибка при инициализации почты:', error.message)
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
    // На сервере IPv6 до Mail.ru часто недоступен (ENETUNREACH) — только IPv4
    family: 4,
    auth: {
      user: userEmail,
      pass: userEmailToken,
    },
  })
}

// Восстановление имени вложения из mojibake (UTF-8, ошибочно прочитанный как Latin-1)
function decodeAttachmentFilename(name) {
  if (!name || typeof name !== 'string') return name
  if (/[\u0400-\u04FF]/.test(name)) return name
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8')
    if (/[\u0400-\u04FF]/.test(decoded) || /[^\x00-\x7F]/.test(decoded)) return decoded
  } catch (_) {}
  return name
}

// Загрузить сессии только для пользователей, которые отправляли письма из проектов
// (ответы приходят в их ящик). Это снижает нагрузку vs опроса всех с email_token.
async function ensureProjectEmailSenderSessions() {
  try {
    const res = await dbPool.query(
      `SELECT DISTINCT pse.user_id AS id
       FROM project_sent_emails pse
       JOIN users u ON u.id = pse.user_id
       WHERE u.email_token IS NOT NULL AND TRIM(u.email_token) != ''`
    )
    const pinnedIds = new Set((res.rows || []).map((r) => String(r.id)))
    for (const row of res.rows || []) {
      const uid = String(row.id)
      if (!userSessions[uid] || !userSessions[uid].smtpTransport) {
        await ensureUserSession(uid, { touch: false }).catch(() => {})
      }
      if (userSessions[uid]) userSessions[uid].pinned = true
    }
    for (const uid of Object.keys(userSessions)) {
      if (userSessions[uid]) userSessions[uid].pinned = pinnedIds.has(uid)
    }
  } catch (err) {
    console.error('ensureProjectEmailSenderSessions:', err?.message || err)
  }
}

// Подгрузить сессию из БД, если её ещё нет (после сохранения токена без перезахода)
// touch: false — фоновая подгрузка (ensureProjectEmailSenderSessions), не продлевает «жизнь» не-pinned сессии
async function ensureUserSession(userId, opts = {}) {
  const touch = opts.touch !== false
  if (userSessions[userId] && userSessions[userId].smtpTransport) {
    if (touch) touchUserSession(userId)
    return userSessions[userId]
  }
  const userQuery = `SELECT email, email_token FROM users WHERE id = $1`
  const userResult = await dbPool.query(userQuery, [userId])
  if (userResult.rows.length === 0) return null
  const userEmail = userResult.rows[0].email
  const userEmailToken = userResult.rows[0].email_token
  const hasToken = userEmailToken != null && String(userEmailToken).trim() !== ''
  if (!hasToken) return null
  userSessions[userId] = {
    email: userEmail,
    emailToken: userEmailToken,
    imapConfig: await initializeImapConfig(userEmail, userEmailToken),
    smtpTransport: await initializeSmtpTransport(userEmail, userEmailToken),
    lastActivityAt: Date.now(),
    pinned: false,
  }
  if (touch) touchUserSession(userId)
  return userSessions[userId]
}

function isAuthError(err) {
  return (
    (err && err.textCode === 'AUTHENTICATIONFAILED') ||
    (err && err.source === 'authentication') ||
    (err && err.message && /parol prilozheniya|application password|AUTHENTICATIONFAILED/i.test(err.message))
  )
}

async function connectWithRetry(userSession, retries = 2, delay = 2000) {
  let attempt = 0
  let lastError
  while (attempt < retries) {
    try {
      const connection = await imaps.connect(userSession.imapConfig)
      return connection
    } catch (error) {
      lastError = error
      attempt++
      if (isAuthError(error)) {
        break
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

async function getAllMails(userId) {
  const userSession = userSessions[userId]
  if (!userSession || !userSession.emailToken) {
    return []
  }

  let connection
  try {
    connection = await connectWithRetry(userSession)
    await connection.openBox('INBOX')
    const searchCriteria = ['ALL']
    const fetchOptions = { bodies: [''], markSeen: false }
    const results = await connection.search(searchCriteria, fetchOptions)
    const messages = await Promise.all(results.map(processMessage))
    const list = messages.filter((message) => message !== null)
    notifyRegisterAboutReplies(list, userId)
    return list
  } catch (error) {
    if (isAuthError(error)) {
      removeUserSessionEntry(userId)
    }
    return []
  } finally {
    if (connection) {
      try {
        await connection.end()
      } catch (_) {}
    }
  }
}

function formatFrom(from) {
  if (typeof from === 'string') return from.trim()
  if (from && typeof from === 'object' && (from.text || from.address)) return (from.text || from.address).trim()
  return ''
}

function extractEmail(from) {
  const s = formatFrom(from)
  const match = s.match(/<([^>]+)>/)
  if (match) return match[1].trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s
  return ''
}

function notifyRegisterAboutReplies(messages, userId) {
  if (!Array.isArray(messages)) return
  const uid = userId != null ? String(userId) : ''
  const seen = uid ? registerNotifiedMessageIds[uid] || (registerNotifiedMessageIds[uid] = new Set()) : null
  for (const msg of messages) {
    if (!msg || !msg.inReplyTo || !msg.body) continue
    const mid = msg.messageId ? String(msg.messageId).trim() : ''
    if (mid && seen && seen.has(mid)) continue
    if (mid && seen) {
      seen.add(mid)
      if (seen.size > 8000) {
        let n = 0
        for (const k of seen) {
          seen.delete(k)
          if (++n >= 2000) break
        }
      }
    }
    const author = formatFrom(msg.from)
    const attachments = (msg.attachments || []).slice(0, 10).map((a) => {
      const buf = a.content && Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content || '')
      if (buf.length > 5 * 1024 * 1024) return null
      return {
        filename: a.filename || 'file',
        content_type: a.contentType || 'application/octet-stream',
        content_base64: buf.toString('base64'),
      }
    }).filter(Boolean)
    postToRegister('/api/project-reply-to-final-solution', {
      in_reply_to_message_id: msg.inReplyTo,
      reply_message_id: msg.messageId || '',
      content: String(msg.body).slice(0, 50000),
      author_display_name: author.slice(0, 500),
      from_email: extractEmail(msg.from),
      attachments,
    }).catch((err) => console.error('Ошибка уведомления register об ответе:', err))
  }
}

// количество дней назад для поиска новых писем
function getSinceDate(daysBack = 1) {
  const d = new Date()
  d.setDate(d.getDate() - daysBack)
  return d
}

function updateImapInboxState(userSession, box, results) {
  if (!userSession) return
  const state = userSession.imapInboxState || { uidValidity: null, lastUid: 0 }
  if (box && box.uidvalidity != null) {
    if (state.uidValidity != null && state.uidValidity !== box.uidvalidity) {
      state.lastUid = 0
    }
    state.uidValidity = box.uidvalidity
  }
  if (results.length > 0) {
    const max = Math.max(...results.map((r) => r.attributes?.uid || 0))
    state.lastUid = Math.max(state.lastUid || 0, max)
  } else if (box && box.uidnext != null) {
    // Нет писем по критерию — выравниваем lastUid по ящику, чтобы инкрементальный опрос не крутил SINCE зря
    const hi = box.uidnext > 1 ? box.uidnext - 1 : 0
    state.lastUid = Math.max(state.lastUid || 0, hi)
  }
  userSession.imapInboxState = state
}

/**
 * @param {string} userId
 * @param {{ incremental?: boolean }} [options]
 * incremental: true — только UID выше последнего успешного опроса (для сокета), без повторной перекачки «за 2 дня».
 * incremental: false — полный список за SINCE (для GET /get-unread-emails при открытии UI).
 */
async function getUnreadMails(userId, options = {}) {
  const incremental = options.incremental === true
  const userSession = userSessions[userId]
  if (!userSession || !userSession.emailToken) {
    return []
  }

  let connection
  try {
    connection = await connectWithRetry(userSession)
    const box = await connection.openBox('INBOX')
    const state = userSession.imapInboxState || { uidValidity: null, lastUid: 0 }
    if (box && box.uidvalidity != null && state.uidValidity != null && state.uidValidity !== box.uidvalidity) {
      state.lastUid = 0
      userSession.imapInboxState = state
    }

    // SINCE 2 дня — включаем прочитанные, иначе ответ не попадёт в карточку если открыли в почте до опроса.
    // При incremental после первой синхронизации — только новые UID (без повторной загрузки тел старых писем).
    let searchCriteria
    const last = userSession.imapInboxState?.lastUid
    if (incremental && last != null && last > 0) {
      searchCriteria = [['UID', `${last + 1}:*`]]
    } else {
      searchCriteria = [['SINCE', getSinceDate(2)]]
    }

    const fetchOptions = { bodies: [''], markSeen: false }
    const results = await connection.search(searchCriteria, fetchOptions)
    const list = []
    for (const res of results) {
      const message = await processMessage(res)
      if (message !== null) list.push(message)
    }
    notifyRegisterAboutReplies(list, userId)
    updateImapInboxState(userSession, box, results)
    return list
  } catch (error) {
    if (isAuthError(error)) {
      removeUserSessionEntry(userId)
    }
    return []
  } finally {
    if (connection) {
      try {
        await connection.end()
      } catch (_) {}
    }
  }
}

app.get('/get-emails', async (req, res) => {
  const userId = req.query.userId
  try {
    await ensureUserSession(userId)
    const messages = (await getAllMails(userId)) || []
    res.json(messages)
  } catch (error) {
    res.json([])
  }
})

app.get('/get-unread-emails', async (req, res) => {
  const userId = req.query.userId
  try {
    await ensureUserSession(userId)
    const messages = (await getUnreadMails(userId)) || []
    res.json(messages)
  } catch (error) {
    res.json([])
  }
})

// Пометить письмо прочитанным в ящике (при просмотре ответа в карточке проекта)
app.post(
  '/mark-email-read',
  [body('userId').isNumeric(), body('messageId').isString()],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Нужны userId и messageId' })
    }
    const { userId, messageId } = req.body
    const raw = String(messageId).trim().replace(/^<|>$/g, '')
    if (!raw) return res.status(400).json({ error: 'Некорректный messageId' })
    const userSession = await ensureUserSession(userId)
    if (!userSession || !userSession.imapConfig) {
      return res.status(400).json({ error: 'Нет доступа к почте пользователя' })
    }
    let connection
    try {
      connection = await connectWithRetry(userSession)
      await connection.openBox('INBOX', false)
      const msgIdVariants = raw.startsWith('<') ? [raw] : [raw, `<${raw}>`]
      let results = []
      for (const msgId of msgIdVariants) {
        if (!msgId) continue
        try {
          results = await connection.search([['HEADER', 'Message-ID', msgId]], { struct: true })
          if (results.length > 0) break
        } catch (_) {
          continue
        }
      }
      if (results.length === 0) {
        return res.status(200).json({ marked: false, reason: 'not_found' })
      }
      const uid = results[0].attributes?.uid
      if (uid) {
        await connection.addFlags(uid, '\\Seen')
      }
      res.json({ marked: true })
    } catch (err) {
      console.error('mark-email-read:', err?.message || err)
      res.status(500).json({ error: err?.message || 'Ошибка пометки письма' })
    } finally {
      if (connection) {
        try {
          await connection.end()
        } catch (_) {}
      }
    }
  }
)

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId // Предполагается, что userId передается как query parameter
  if (userId) {
    touchUserSession(userId)
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
    const unreadEmails = await getUnreadMails(userId, { incremental: true })

    if (unreadEmails.length > 0) {
      io.to(userId).emit('new-emails', unreadEmails)
    }
  } catch (error) {
    // console.error(  `Ошибка при уведомлении пользователя ${userId} о новых письмах:`,  error  )
  }
}

// Подгружаем сессии отправителей проектных писем (ответы приходят в их ящик).
// Интервал 2 мин — новые сессии после перезапуска подтянутся без лишней нагрузки.
ensureProjectEmailSenderSessions()
setInterval(ensureProjectEmailSenderSessions, 120000)

evictStaleUserSessions()
setInterval(evictStaleUserSessions, SESSION_EVICT_INTERVAL_MS)

let isPolling = false
setInterval(async () => {
  if (isPolling) return
  isPolling = true
  try {
    for (const userId in userSessions) {
      if (userSessions[userId] && userSessions[userId].emailToken) {
        await notifyUserOfNewEmails(userId)
      }
    }
  } finally {
    isPolling = false
  }
}, EMAIL_POLL_INTERVAL_MS)

app.post('/send-email', upload.array('attachments', 10), async (req, res) => {
  const { userId, globalTaskId, finalSolutionId, inReplyTo } = req.body
  const finalSolId = req.body.finalSolutionId != null ? req.body.finalSolutionId : finalSolutionId
  const { to, subject, body, bodyHtml } = req.body
  const attachments = req.files

  if (!userId) {
    return res.status(400).send('Не указан пользователь (userId).')
  }
  if (!to || !subject || !body) {
    return res
      .status(400)
      .send('Необходимо указать все поля: to, subject и body.')
  }

  const userSession = await ensureUserSession(userId)
  if (!userSession || !userSession.smtpTransport) {
    return res
      .status(400)
      .send('Задайте токен почты в настройках (иконка почты в меню пользователя или в разделе «Почта»). После сохранения токена отправка заработает без перезахода.')
  }

  const messageId = `<${Date.now()}.${userId}.${Math.random().toString(36).slice(2)}@mail.ru>`
  const headers = {
    'X-Mailer': 'SVAROG CRM',
    'Reply-To': userSession.email,
  }
  if (inReplyTo && String(inReplyTo).trim()) {
    headers['In-Reply-To'] = String(inReplyTo).trim()
    headers['References'] = String(inReplyTo).trim()
  }
  const mailOptions = {
    from: userSession.email,
    to: to,
    subject: subject,
    text: body,
    ...(bodyHtml && String(bodyHtml).trim() ? { html: String(bodyHtml).trim() } : {}),
    messageId,
    headers,
  }

  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments.map((attachment) => ({
      filename: decodeAttachmentFilename(attachment.originalname),
      content: attachment.buffer,
    }))
  }

  try {
    const info = await userSession.smtpTransport.sendMail(mailOptions)
    saveSentMessage(userSession, mailOptions).catch((err) =>
      console.error('Ошибка сохранения в «Отправленные»:', err?.message || err)
    )
    if (globalTaskId) {
      const normalizedId = messageId.replace(/^<|>$/g, '').trim()
      const payload = {
        message_id: normalizedId,
        global_task_id: globalTaskId,
        user_id: userId,
      }
      if (finalSolId) payload.final_solution_id = finalSolId
      postToRegister('/api/project-sent-emails', payload).catch((err) =>
        console.error('Ошибка сохранения project_sent_emails:', err)
      )
    }
    res.json({ message: 'Email sent', messageId: messageId.replace(/^<|>$/g, '').trim(), info })
  } catch (error) {
    console.error('Ошибка при отправке письма:', error)
    res.status(500).send('Не удалось отправить письмо: ' + error.message)
  }
})
async function saveSentMessage(userSession, mailOptions) {
  if (!userSession?.imapConfig) return
  const MailComposer = require('nodemailer/lib/mail-composer')
  let rawBuffer
  try {
    const mail = new MailComposer(mailOptions)
    rawBuffer = await new Promise((resolve, reject) => {
      mail.compile().build((err, msg) => (err ? reject(err) : resolve(msg)))
    })
  } catch (err) {
    console.error('Ошибка сборки письма для Sent:', err?.message || err)
    return
  }
  const rawMessage =
    Buffer.isBuffer(rawBuffer) ? rawBuffer.toString('binary') : String(rawBuffer)
  let connection
  try {
    connection = await imaps.connect(userSession.imapConfig)
    const sentFolder = 'Отправленные'
    await connection.append(rawMessage, { mailbox: sentFolder, flags: ['\\Seen'] })
  } catch (error) {
    throw error
  } finally {
    if (connection) {
      try {
        await connection.end()
      } catch (_) {}
    }
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
