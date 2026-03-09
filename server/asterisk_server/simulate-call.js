/**
 * Скрипт для тестирования логики уведомлений о звонках.
 * Симулирует входящий звонок на указанный номер от тестового номера.
 *
 * Использование:
 *   node simulate-call.js              — звонок на 777 от 79001234567
 *   node simulate-call.js 100          — звонок на внутренний номер 100
 *   node simulate-call.js 777 79009999999  — звонок на 777 от указанного номера
 *
 * Важно: пользователь должен быть ЗАЛОГИНЕН в CRM в браузере,
 * а в user_phones должна быть запись с номером 777 для его user_id.
 */

require('dotenv').config()
const { Pool } = require('pg')
const { io } = require('socket.io-client')

const CRM_URL = process.env.CRM_SOCKET_URL || 'http://127.0.0.1:5004'
const TEST_CALLER = process.env.TEST_CALLER_NUMBER || '79001234567'
const DEFAULT_RECEIVER = '777'

// БД — те же настройки, что в Asterisk.js (или из .env)
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'Svarog',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
})

async function findUserByPhone(phoneNumber) {
  const query = `
    SELECT u.id, u.first_name, u.middle_name, u.last_name
    FROM users u
    JOIN user_phones up ON u.id = up.user_id
    WHERE up.phone_number = $1
  `
  const result = await pool.query(query, [phoneNumber])
  return result.rows[0] || null
}

function buildNotification(type, receiverUser, callerNumber, receiverNumber, extras = {}) {
  const receiverName = [
    receiverUser.last_name,
    receiverUser.first_name,
    receiverUser.middle_name || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  return {
    type,
    receiverUserId: receiverUser.id,
    receiverName,
    callerNumber,
    callerName: 'Тестовый звонок',
    callerType: 'unknown',
    receiverNumber,
    timestamp: new Date().toISOString(),
    channel: `Simulate-${Date.now()}`,
    ...extras,
  }
}

async function main() {
  const receiverNumber = process.argv[2] || DEFAULT_RECEIVER
  const callerNumber = process.argv[3] || TEST_CALLER

  console.log('========================================')
  console.log('Симуляция звонка')
  console.log(`  Звонящий: ${callerNumber}`)
  console.log(`  Получатель (номер): ${receiverNumber}`)
  console.log('========================================')

  let receiverUser
  try {
    receiverUser = await findUserByPhone(receiverNumber)
  } catch (err) {
    console.error('Ошибка при запросе к БД:', err.message)
    process.exit(1)
  }

  if (!receiverUser) {
    console.error(`\nОшибка: Пользователь с номером "${receiverNumber}" не найден в user_phones.`)
    console.error('Добавьте номер в карточку пользователя (Настройки → Пользователи).')
    process.exit(1)
  }

  console.log(`\nНайден получатель: ${receiverUser.last_name} ${receiverUser.first_name} (ID: ${receiverUser.id})`)
  console.log('\nПодключение к CRM серверу...')

  const socket = io(CRM_URL, {
    transports: ['websocket', 'polling'],
  })

  const simCallId = `sim-${Date.now()}`
  const channel = `Simulate-${simCallId}`

  return new Promise((resolve) => {
    socket.on('connect', async () => {
      console.log('Подключено к CRM серверу.')

      // 1. Входящий звонок
      const incomingData = buildNotification(
        'incoming_call',
        receiverUser,
        callerNumber,
        receiverNumber,
        { channel, callId: simCallId }
      )
      socket.emit('incoming_call', incomingData)
      console.log('Отправлено: incoming_call')

      // 2. Через 2 сек — начало разговора
      setTimeout(() => {
        const startedData = buildNotification(
          'call_started',
          receiverUser,
          callerNumber,
          receiverNumber,
          { callId: simCallId, channel }
        )
        socket.emit('call_started', startedData)
        console.log('Отправлено: call_started (активный разговор)')
      }, 2000)

      // 3. Через 5 сек — завершение звонка
      setTimeout(() => {
        const endedData = buildNotification(
          'call_ended',
          receiverUser,
          callerNumber,
          receiverNumber,
          { callId: simCallId, channel, duration: 3 }
        )
        socket.emit('call_ended', endedData)
        console.log('Отправлено: call_ended (звонок завершён)')
      }, 5000)

      // 4. Закрываем через 6 сек
      setTimeout(() => {
        console.log('\nТест завершён. Проверьте модальное окно в CRM.')
        socket.disconnect()
        pool.end()
        resolve()
      }, 6000)
    })

    socket.on('connect_error', (err) => {
      console.error('\nОшибка подключения к CRM:', err.message)
      console.error('Убедитесь, что CRM-сервер (порт 5004) запущен.')
      pool.end()
      process.exit(1)
    })
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
