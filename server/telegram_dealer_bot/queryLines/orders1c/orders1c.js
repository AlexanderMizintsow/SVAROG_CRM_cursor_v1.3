const net = require('net')
const iconv = require('iconv-lite')
const dbPool = require('../../database/db')
const { createReminder } = require('../../helpers/api')

// Функция для выполнения задачи с таймаутом (аналогично api.js)
async function runWithTimeout(fn, timeoutMs, taskName) {
  let timeout
  let isCompleted = false

  try {
    const taskPromise = fn()
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        if (!isCompleted) {
          isCompleted = true
          reject(new Error(`Таймаут выполнения задачи ${taskName} (${timeoutMs}ms)`))
        }
      }, timeoutMs)
    })

    const result = await Promise.race([taskPromise, timeoutPromise])
    isCompleted = true
    return result
  } catch (error) {
    isCompleted = true
    throw error
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

// Функция для получения заказов 1С (тестовая версия)
async function getOrders1C(sScan, testMode = true) {
  if (testMode) {
    console.log('[TEST] Возвращаем тестовые данные для заказов 1С')
    return Promise.resolve([
      {
        orderNumber: '12531072383311',
        companyName: 'Абдуллина Д.И. ИП',
        inn: '7777777',
        shippingDate: '25.08.2025',
        address:
          '442585, Пензенская обл, Сосновоборский р-н, Индерка с, Революционная ул, дом № 48',
      },
      {
        orderNumber: '189533',
        companyName: 'Абдуллина Д.И. ИП',
        inn: '7777777',
        shippingDate: '27.08.2025',
        address:
          '442585, Пензенская обл, Сосновоборский р-н, Индерка с, Революционная ул, дом № 48',
      },
      {
        orderNumber: '3833050732833',
        companyName: 'Жевлаков Д.Е. ИП',
        inn: '7777777',
        shippingDate: '25.08.2025',
        address: '412310, Волгоградская обл, Волгоград г, им Николая Отрады ул, дом № 22, кв.127',
      },
    ])
  }

  // Настоящая функция для запроса к 1С (закомментирована)

  return new Promise((resolve, reject) => {
    const client = new net.Socket()

    // Устанавливаем таймаут
    client.setTimeout(10000) // 10 секунд

    client.connect(8240, '192.168.57.77', () => {
      console.log('Соединение установлено с сервером.')
      const message = `Q11\x01EB35000999\x02\t${sScan}\r`
      console.log('Отправляем сообщение:', message)
      console.log('Закодированное сообщение:', iconv.encode(message, 'windows-1251'))
      client.write(iconv.encode(message, 'windows-1251'))
    })

    client.on('data', (data) => {
      console.log('Получены данные от сервера!')
      console.log('Полученные сырые данные:', data)

      const decodedData = iconv.decode(data, 'windows-1251')
      console.log('Декодированные данные:', decodedData)

      // Парсинг данных
      const orders = parseOrdersData(decodedData)
      resolve(orders)
      client.destroy()
    })

    client.on('timeout', () => {
      console.log('Таймаут соединения - сервер не ответил')
      client.destroy()
      reject(new Error('Таймаут соединения'))
    })

    client.on('error', (err) => {
      console.error(`Произошла ошибка: ${err.message}`)
      reject(err)
    })

    client.on('close', (hadError) => {
      console.log('Соединение закрыто.', hadError ? 'С ошибкой' : 'Нормально')
    })

    client.on('end', () => {
      console.log('Сервер завершил соединение')
    })
  })
}

// Парсинг данных заказов из ответа 1С
function parseOrdersData(data) {
  const lines = data.split('\n').filter((line) => line.trim() !== '')
  const orders = []

  lines.forEach((line) => {
    if (line.startsWith('s;')) {
      const cleanLine = line.substring(2)
      const parts = cleanLine.split(':')

      if (parts.length >= 5) {
        const orderNumber = parts[0].trim()
        const companyName = parts[1].trim()
        const inn = parts[2].trim()
        const shippingDate = parts[3].trim()
        const address = parts.slice(4).join(':').trim()

        if (orderNumber && companyName && shippingDate) {
          orders.push({
            orderNumber,
            companyName,
            inn: inn === 'нет' ? null : inn,
            shippingDate,
            address: address || 'Не указан',
          })
        }
      }
    }
  })

  return orders
}

// Функция для фильтрации заказов по дате (только заказы на второй день)
function filterOrdersByDate(orders) {
  const today = new Date()
  const targetDate = new Date(today)
  targetDate.setDate(today.getDate() + 2)

  // Форматируем дату в формат DD.MM.YYYY для сравнения
  const targetDateStr = targetDate.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return orders.filter((order) => order.shippingDate === targetDateStr)
}

// Функция для проверки существующих заказов в БД
async function checkExistingOrders(orders) {
  const orderNumbers = orders.map((order) => order.orderNumber)

  try {
    const { rows } = await dbPool.query(
      `SELECT order_number, shipping_date, notification_sent 
       FROM orders_1c 
       WHERE order_number = ANY($1)`,
      [orderNumbers]
    )

    const existingOrders = new Map(rows.map((row) => [row.order_number, row]))

    return orders.filter((order) => {
      const existing = existingOrders.get(order.orderNumber)
      if (!existing) return true // Новый заказ

      // Проверяем, изменилась ли дата
      const existingDate = new Date(existing.shipping_date)
      const newDate = parseDate(order.shippingDate)

      if (existingDate.getTime() !== newDate.getTime()) {
        // Дата изменилась, нужно обновить и отправить заново
        return true
      }

      // Если уведомление уже отправлено, не отправляем повторно
      return !existing.notification_sent
    })
  } catch (error) {
    console.error('Ошибка при проверке существующих заказов:', error)
    return orders
  }
}

// Парсинг даты из формата DD.MM.YYYY
function parseDate(dateStr) {
  const [day, month, year] = dateStr.split('.')
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
}

// Сохранение заказов в БД
async function saveOrdersToDatabase(orders) {
  if (orders.length === 0) return

  for (const order of orders) {
    try {
      const parsedDate = parseDate(order.shippingDate)

      await dbPool.query(
        `INSERT INTO orders_1c (order_number, company_name, inn, shipping_date, address)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (order_number) 
         DO UPDATE SET 
           company_name = EXCLUDED.company_name,
           inn = EXCLUDED.inn,
           shipping_date = EXCLUDED.shipping_date,
           address = EXCLUDED.address,
           updated_at = NOW()`,
        [order.orderNumber, order.companyName, order.inn, parsedDate, order.address]
      )
    } catch (error) {
      console.error(`Ошибка сохранения заказа ${order.orderNumber}:`, error)
    }
  }
}

// Поиск компании по ИНН
async function findCompanyByINN(inn) {
  if (!inn) return null

  try {
    const { rows } = await dbPool.query('SELECT * FROM companies WHERE inn = $1 LIMIT 1', [inn])
    return rows[0] || null
  } catch (error) {
    console.error('Ошибка поиска компании по ИНН:', error)
    return null
  }
}

// Получение chat_id компании
async function getCompanyChatId(companyId) {
  try {
    const { rows } = await dbPool.query(
      'SELECT chat_id FROM user_company_tg_bot WHERE company_id = $1 LIMIT 1',
      [companyId]
    )
    return rows[0]?.chat_id || null
  } catch (error) {
    console.error('Ошибка получения chat_id компании:', error)
    return null
  }
}

// Форматирование сообщения о заказе
function formatOrderMessage(order) {
  return {
    text:
      `📦 *Заказ №${order.orderNumber}*\n\n` +
      `🏢 *Компания:* ${order.companyName}\n` +
      `📅 *Дата отгрузки:* ${order.shippingDate}\n` +
      `📍 *Адрес:* ${order.address}\n\n` +
      `⚠️ *Важно:* Ответьте до 12:00 дня!`,
    options: {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Подтвердить дату', callback_data: `confirm_order_${order.orderNumber}` },
            { text: '📅 Перенести дату', callback_data: `reschedule_order_${order.orderNumber}` },
          ],
        ],
      },
    },
  }
}

// Отправка уведомлений дилерам
async function sendOrderNotifications(bot, orders) {
  const results = []

  for (const order of orders) {
    try {
      // Поиск компании по ИНН
      let company = null
      if (order.inn) {
        company = await findCompanyByINN(order.inn)
      }

      if (!company) {
        console.log(`Компания не найдена для заказа ${order.orderNumber} (ИНН: ${order.inn})`)
        results.push({
          orderNumber: order.orderNumber,
          success: false,
          error: 'Company not found',
        })
        continue
      }

      // Получение chat_id
      const chatId = await getCompanyChatId(company.id)
      if (!chatId) {
        console.log(`Нет chat_id для компании ${company.name_companies}`)
        results.push({
          orderNumber: order.orderNumber,
          success: false,
          error: 'No chat_id',
        })
        continue
      }

      // Отправка сообщения
      const messageData = formatOrderMessage(order)
      const sentMessage = await bot.sendMessage(chatId, messageData.text, messageData.options)

      // Обновление статуса в БД
      await dbPool.query(
        `UPDATE orders_1c 
         SET notification_sent = TRUE, notification_sent_at = NOW()
         WHERE order_number = $1`,
        [order.orderNumber]
      )

      console.log(`Уведомление отправлено: заказ ${order.orderNumber} → ${company.name_companies}`)
      results.push({
        orderNumber: order.orderNumber,
        success: true,
        chatId: chatId,
      })
    } catch (error) {
      console.error(`Ошибка отправки уведомления для заказа ${order.orderNumber}:`, error)
      results.push({
        orderNumber: order.orderNumber,
        success: false,
        error: error.message,
      })
    }
  }

  return results
}

// Основная функция обработки заказов
async function processOrders1C(bot) {
  try {
    console.log('[ORDERS_1C] Начало обработки заказов 1С...')

    // Получение заказов
    const orders = await getOrders1C('V0O', false) // true для тестового режима
    console.log(`[ORDERS_1C] Получено заказов: ${orders.length}`)

    if (orders.length === 0) {
      console.log('[ORDERS_1C] Нет заказов для обработки')
      return
    }

    // Фильтрация по дате (только заказы на второй день)
    const filteredOrders = filterOrdersByDate(orders)
    console.log(`[ORDERS_1C] Заказов на второй день: ${filteredOrders.length}`)

    if (filteredOrders.length === 0) {
      console.log('[ORDERS_1C] Нет заказов на второй день')
      return
    }

    // Проверка существующих заказов
    const newOrders = await checkExistingOrders(filteredOrders)
    console.log(`[ORDERS_1C] Новых/измененных заказов: ${newOrders.length}`)

    if (newOrders.length === 0) {
      console.log('[ORDERS_1C] Нет новых заказов для отправки')
      return
    }

    // Сохранение в БД
    await saveOrdersToDatabase(newOrders)
    console.log('[ORDERS_1C] Заказы сохранены в БД')

    // Отправка уведомлений
    const results = await sendOrderNotifications(bot, newOrders)

    const successful = results.filter((r) => r.success).length
    console.log(`[ORDERS_1C] Итоговый отчет: ${successful}/${newOrders.length} отправлено успешно`)
    console.log('[ORDERS_1C] Детали обработки:', results)
  } catch (error) {
    console.error('[ORDERS_1C] Критическая ошибка:', error)
  }
}

// Функция для инициализации cron-задачи
function initOrders1CCron(bot, cronManager) {
  console.log('[CRON][INIT] Инициализация планировщика проверки заказов 1С...')

  const task = async () => {
    const timestamp = new Date().toISOString()
    console.log(`[CRON][V0O][${timestamp}] Старт проверки заказов 1С...`)

    const TASK_TIMEOUT = 5 * 60 * 1000 // 5 минут таймаут

    try {
      await runWithTimeout(
        async () => {
          console.log('[CRON][V0O] Обработка заказов...')
          await processOrders1C(bot)
          console.log('[CRON][V0O] Обработка завершена')
        },
        TASK_TIMEOUT,
        'Orders 1C Check'
      )
    } catch (error) {
      console.error(`[CRON][V0O][ERROR] ${error.message}`)
      console.error(error.stack)

      console.error(`[CRON][V0O][${timestamp}] Задача завершилась с ошибкой:`, {
        error: error.message,
        stack: error.stack,
        timestamp: timestamp,
      })

      throw error
    } finally {
      console.log(`[CRON][V0O][${timestamp}] Завершено`)
    }
  }

  // Cron-задача для проверки поздних ответов (каждый час с 12:00  )
  const lateResponseTask = async () => {
    const timestamp = new Date().toISOString()
    console.log(`[CRON][LATE_RESPONSE][${timestamp}] Проверка поздних ответов...`)

    try {
      const { checkAndBlockLateResponses } = require('./orderHandlers')
      await checkAndBlockLateResponses(bot)
      console.log('[CRON][LATE_RESPONSE] Проверка завершена')
    } catch (error) {
      console.error(`[CRON][LATE_RESPONSE][ERROR] ${error.message}`)
    } finally {
      console.log(`[CRON][LATE_RESPONSE][${timestamp}] Завершено`)
    }
  }

  if (cronManager) {
    const mainJob = cronManager.addJob('orders1c', '0 9 * * *', task) // Каждый день в 9:00 утра
    const lateResponseJob = cronManager.addJob(
      'orders1c_late_response',
      '0 12 * * *',
      lateResponseTask
    ) // Каждый день в 12:00 дня

    return { mainJob, lateResponseJob }
  } else {
    // Fallback к старому способу если CronManager не доступен
    const cron = require('node-cron')
    const mainJob = cron.schedule('0 9 * * *', task, {
      scheduled: true,
      timezone: 'Europe/Moscow',
    })

    const lateResponseJob = cron.schedule('0 12 * * *', lateResponseTask, {
      scheduled: true,
      timezone: 'Europe/Moscow',
    })

    mainJob.on('error', (error) => {
      console.error('[CRON][V0O][CRON_ERROR] Ошибка в cron-задаче:', error)
    })

    lateResponseJob.on('error', (error) => {
      console.error('[CRON][LATE_RESPONSE][CRON_ERROR] Ошибка в cron-задаче:', error)
    })

    return { mainJob, lateResponseJob }
  }
}

module.exports = {
  getOrders1C,
  processOrders1C,
  initOrders1CCron,
  filterOrdersByDate,
  checkExistingOrders,
  saveOrdersToDatabase,
  sendOrderNotifications,
  parseOrdersData,
  parseDate,
}
