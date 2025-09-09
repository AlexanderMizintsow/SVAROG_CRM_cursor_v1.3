const net = require('net')
const iconv = require('iconv-lite')
const dbPool = require('../../database/db')
const { createReminder } = require('../../helpers/api')
const ConnectionPool = require('../../helpers/connectionPool')

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

// Функция для выполнения задачи с периодическим освобождением event loop
async function runWithEventLoopRelease(task, name) {
  const startTime = Date.now()
  const maxExecutionTime = 90 * 1000 // 90 секунд максимум
  const checkInterval = 1000 // Проверяем каждую секунду

  return new Promise(async (resolve, reject) => {
    let isCompleted = false
    let taskPromise

    try {
      taskPromise = task()
      const checkTimer = setInterval(() => {
        if (isCompleted) {
          clearInterval(checkTimer)
          return
        }
        const elapsed = Date.now() - startTime
        if (elapsed > maxExecutionTime) {
          clearInterval(checkTimer)
          isCompleted = true
          reject(
            new Error(
              `Задача ${name} превысила максимальное время выполнения (${maxExecutionTime}ms)`
            )
          )
          return
        }
        // Принудительно освобождаем event loop
        setImmediate(() => {})
      }, checkInterval)
      const result = await taskPromise
      isCompleted = true
      clearInterval(checkTimer)
      resolve(result)
    } catch (error) {
      isCompleted = true
      reject(error)
    }
  })
}

// Инициализация пула соединений
let connectionPool = null

function getConnectionPool() {
  if (!connectionPool) {
    connectionPool = new ConnectionPool({
      host: '192.168.57.77',
      port: 8240,
      maxConnections: 3,
      connectionTimeout: 10000,
      responseTimeout: 30000,
    })
  }
  return connectionPool
}

// Функция для получения заказов 1С (оптимизированная версия)
async function getOrders1C(sScan, testMode = false) {
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

  console.log('Начало обработки запроса заказов 1С', { scan: sScan })

  try {
    const message = `Q11\x01EB35000999\x02\t${sScan}\r`
    const response = await getConnectionPool().executeRequest(message, sScan)
    return await processOrdersServerResponse(response, sScan)
  } catch (err) {
    console.error(`[CONNECTION_POOL] Ошибка получения заказов 1С: ${err.message}`)
    throw err
  }
}

// Обработка ответа сервера для заказов 1С
async function processOrdersServerResponse(responseData, sScan) {
  try {
    console.log('Начало обработки ответа сервера заказов 1С', { scan: sScan })

    // Нормализация данных
    const cleanData = responseData.split('q11\x01')[0].trim()
    const lines = cleanData
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('q11'))

    if (lines.length === 0) {
      console.log('Нет данных для обработки заказов 1С', { scan: sScan })
      return []
    }

    // Парсинг данных заказов
    const orders = parseOrdersData(cleanData)
    console.log(`Успешно обработано заказов: ${orders.length}`)
    return orders
  } catch (err) {
    console.log('Ошибка обработки ответа сервера заказов 1С', {
      scan: sScan,
      error: err.message,
      stack: err.stack,
    })
    throw new Error('❌ Ошибка обработки данных заказов от сервера')
  }
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
  const taskId = `V0O_${Date.now()}`
  const startTime = Date.now()

  try {
    console.log(`[TASK_START][${taskId}] V0O - Начало обработки заказов 1С...`)

    // Получение заказов
    console.log(`[TASK_PROGRESS][${taskId}] V0O - Запрос данных из 1С...`)
    const orders = await getOrders1C('V0O', false) // true для тестового режима
    console.log(`[TASK_PROGRESS][${taskId}] V0O - Получено заказов: ${orders.length}`)

    if (orders.length === 0) {
      console.log(`[TASK_SUCCESS][${taskId}] V0O - Нет заказов для обработки`)
      return
    }

    // Фильтрация по дате (только заказы на второй день)
    console.log(`[TASK_PROGRESS][${taskId}] V0O - Фильтрация заказов по дате...`)
    const filteredOrders = filterOrdersByDate(orders)
    console.log(`[TASK_PROGRESS][${taskId}] V0O - Заказов на второй день: ${filteredOrders.length}`)

    if (filteredOrders.length === 0) {
      console.log(`[TASK_SUCCESS][${taskId}] V0O - Нет заказов на второй день`)
      return
    }

    // Проверка существующих заказов
    console.log(`[TASK_PROGRESS][${taskId}] V0O - Проверка существующих заказов в БД...`)
    const newOrders = await checkExistingOrders(filteredOrders)
    console.log(`[TASK_PROGRESS][${taskId}] V0O - Новых/измененных заказов: ${newOrders.length}`)

    if (newOrders.length === 0) {
      console.log(`[TASK_SUCCESS][${taskId}] V0O - Нет новых заказов для отправки`)
      return
    }

    // Сохранение в БД
    console.log(`[TASK_PROGRESS][${taskId}] V0O - Сохранение заказов в БД...`)
    await saveOrdersToDatabase(newOrders)
    console.log(`[TASK_PROGRESS][${taskId}] V0O - Заказы сохранены в БД`)

    // Отправка уведомлений
    console.log(`[TASK_PROGRESS][${taskId}] V0O - Отправка уведомлений дилерам...`)
    const results = await sendOrderNotifications(bot, newOrders)

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    const executionTime = Date.now() - startTime

    console.log(`[TASK_SUCCESS][${taskId}] V0O - Задача завершена успешно`)
    console.log(
      `[TASK_RESULT][${taskId}] V0O - Итоговый отчет: ${successful}/${newOrders.length} отправлено успешно, ${failed} ошибок`
    )
    console.log(`[TASK_RESULT][${taskId}] V0O - Время выполнения: ${executionTime}ms`)
    console.log(`[TASK_DETAILS][${taskId}] V0O - Детали обработки:`, results)
  } catch (error) {
    const executionTime = Date.now() - startTime
    console.error(`[TASK_ERROR][${taskId}] V0O - Критическая ошибка выполнения задачи`)
    console.error(`[TASK_ERROR][${taskId}] V0O - Ошибка: ${error.message}`)
    console.error(`[TASK_ERROR][${taskId}] V0O - Время до ошибки: ${executionTime}ms`)
    console.error(`[TASK_ERROR][${taskId}] V0O - Stack trace:`, error.stack)
    throw error
  }
}

// Функция для инициализации cron-задачи
function initOrders1CCron(bot, cronManager) {
  console.log('[CRON][INIT] Инициализация планировщика проверки заказов 1С...')

  const task = async () => {
    const timestamp = new Date().toISOString()
    const cronTaskId = `CRON_V0O_${Date.now()}`
    console.log(`[CRON_START][${cronTaskId}] V0O - Старт проверки заказов 1С...`)

    const TASK_TIMEOUT = 2 * 60 * 1000 // 2 минуты таймаут (уменьшено с 5 минут)

    try {
      await runWithTimeout(
        async () => {
          console.log(`[CRON_PROGRESS][${cronTaskId}] V0O - Запуск обработки заказов...`)
          await processOrders1C(bot)
          console.log(`[CRON_PROGRESS][${cronTaskId}] V0O - Обработка заказов завершена`)
        },
        TASK_TIMEOUT,
        'Orders 1C Check'
      )
      console.log(`[CRON_SUCCESS][${cronTaskId}] V0O - Cron-задача выполнена успешно`)
    } catch (error) {
      console.error(`[CRON_ERROR][${cronTaskId}] V0O - Ошибка выполнения cron-задачи`)
      console.error(`[CRON_ERROR][${cronTaskId}] V0O - Ошибка: ${error.message}`)
      console.error(`[CRON_ERROR][${cronTaskId}] V0O - Stack trace:`, error.stack)

      console.error(`[CRON_ERROR][${cronTaskId}] V0O - Задача завершилась с ошибкой:`, {
        error: error.message,
        stack: error.stack,
        timestamp: timestamp,
        taskId: cronTaskId,
      })

      throw error
    } finally {
      console.log(`[CRON_END][${cronTaskId}] V0O - Cron-задача завершена`)
    }
  }

  // Cron-задача для проверки поздних ответов (каждый час с 12:00  )
  const lateResponseTask = async () => {
    const timestamp = new Date().toISOString()
    const lateResponseTaskId = `CRON_LATE_RESPONSE_${Date.now()}`
    console.log(`[CRON_START][${lateResponseTaskId}] LATE_RESPONSE - Проверка поздних ответов...`)

    try {
      console.log(`[CRON_PROGRESS][${lateResponseTaskId}] LATE_RESPONSE - Запуск проверки...`)
      const { checkAndBlockLateResponses } = require('./orderHandlers')
      await checkAndBlockLateResponses(bot)
      console.log(
        `[CRON_SUCCESS][${lateResponseTaskId}] LATE_RESPONSE - Проверка завершена успешно`
      )
    } catch (error) {
      console.error(
        `[CRON_ERROR][${lateResponseTaskId}] LATE_RESPONSE - Ошибка выполнения проверки`
      )
      console.error(`[CRON_ERROR][${lateResponseTaskId}] LATE_RESPONSE - Ошибка: ${error.message}`)
      console.error(`[CRON_ERROR][${lateResponseTaskId}] LATE_RESPONSE - Stack trace:`, error.stack)
    } finally {
      console.log(`[CRON_END][${lateResponseTaskId}] LATE_RESPONSE - Cron-задача завершена`)
    }
  }

  if (cronManager) {
    const mainJob = cronManager.addJob('orders1c', '0 9 * * *', task) // Каждый день в 9:00 утра
    const lateResponseJob = cronManager.addJob(
      'orders1c_late_response',
      '10 12 * * *',
      lateResponseTask
    ) // Каждый день в 12:10 дня

    return { mainJob, lateResponseJob }
  } else {
    // Fallback к старому способу если CronManager не доступен
    const cron = require('node-cron')
    const mainJob = cron.schedule('0 9 * * *', task, {
      scheduled: true,
      timezone: 'Europe/Moscow',
    })

    const lateResponseJob = cron.schedule('10 12 * * *', lateResponseTask, {
      scheduled: true,
      timezone: 'Europe/Moscow',
    })

    mainJob.on('error', (error) => {
      console.error('[CRON_ERROR][FALLBACK] V0O - Ошибка в cron-задаче:', error)
    })

    lateResponseJob.on('error', (error) => {
      console.error('[CRON_ERROR][FALLBACK] LATE_RESPONSE - Ошибка в cron-задаче:', error)
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
  getConnectionPool,
}
