const dbPool = require('../../database/db')
const { createReminder, getMppByCompany } = require('../../helpers/api')

// Обработка подтверждения даты заказа
async function handleOrderConfirm(bot, chatId, callbackQuery, orderNumber, userSessions) {
  try {
    console.log(`[ORDER_CONFIRM] Подтверждение заказа ${orderNumber} от ${chatId}`)

    if (!orderNumber) {
      console.error(`[ORDER_CONFIRM] Отсутствует номер заказа`)
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Ошибка: отсутствует номер заказа',
        show_alert: true,
      })
      return
    }

    // Получаем информацию о компании
    const companyResult = await dbPool.query(
      `SELECT c.*, uctb.chat_id 
       FROM companies c 
       JOIN user_company_tg_bot uctb ON c.id = uctb.company_id 
       WHERE uctb.chat_id = $1`,
      [chatId]
    )

    if (companyResult.rows.length === 0) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Компания не найдена',
        show_alert: true,
      })
      return
    }

    const company = companyResult.rows[0]

    // Обновляем статус в БД
    await dbPool.query(
      `UPDATE orders_1c 
       SET dealer_response_received = TRUE, 
           dealer_response_at = NOW(),
           dealer_response_type = 'confirm'
       WHERE order_number = $1`,
      [orderNumber]
    )

    // Получаем userId для МПП
    let userId
    try {
      userId = await getMppByCompany(company.id)
    } catch (error) {
      console.error('Не удалось получить userId для МПП:', error.message)
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Ошибка: не удалось найти ответственного МПП',
        show_alert: true,
      })
      return
    }

    // Отправляем уведомление МПП
    await createReminder({
      newRecordId: -1,
      userId: userId,
      textCalc: `Дилер подтвердил дату отгрузки заказа №${orderNumber}`,
      typeReminders: 'orders_1c',
      priority: 'средний',
      title: `Подтверждение заказа *${company.name_companies}*. Заказ №${orderNumber}. Пользователь tg: (id:${chatId})`,
      tags: [
        { title: '✅ Подтверждено', color: '#28a745' },
        { title: 'Telegram', color: '#007bff' },
      ],
      links: [],
    })

    // Обновляем сообщение
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
      }
    )

    // Отправляем подтверждение
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '✅ Дата подтверждена! МПП уведомлен.',
      show_alert: false,
    })

    await bot.sendMessage(
      chatId,
      `✅ Заказ №${orderNumber} подтвержден!\n\n` + `МПП уведомлен о подтверждении.`
    )
  } catch (error) {
    console.error(`[ORDER_CONFIRM] Ошибка:`, error)
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Произошла ошибка при подтверждении',
      show_alert: true,
    })
  }
}

// Обработка запроса на перенос даты
async function handleOrderReschedule(bot, chatId, callbackQuery, orderNumber, userSessions) {
  try {
    console.log(`[ORDER_RESCHEDULE] Запрос переноса заказа ${orderNumber} от ${chatId}`)

    if (!orderNumber) {
      console.error(`[ORDER_RESCHEDULE] Отсутствует номер заказа`)
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Ошибка: отсутствует номер заказа',
        show_alert: true,
      })
      return
    }

    // Используем текущую дату как базовую для расчета
    const currentDate = new Date()

    // Функция для расчета ближайшей доступной даты (через 2 дня, пропуская воскресенье)
    function getNextAvailableDate(baseDate) {
      let targetDate = new Date(baseDate.getTime())

      // Добавляем дни по одному, пропуская воскресенье
      let daysAdded = 0
      while (daysAdded < 2) {
        targetDate.setDate(targetDate.getDate() + 1)

        // Если день не воскресенье, считаем его
        if (targetDate.getDay() !== 0) {
          daysAdded++
        }
      }

      return targetDate
    }

    const nearestAvailableDate = getNextAvailableDate(currentDate)

    // Генерируем кнопки с датами (не ранее текущей, не позднее +2 недели, исключая воскресенье)
    const dateButtons = generateDateButtons(currentDate)

    // Сохраняем состояние для выбора даты
    if (!userSessions[chatId]) userSessions[chatId] = {}
    userSessions[chatId].awaitingDateSelection = {
      orderNumber,
      type: 'reschedule',
    }

    console.log(`[ORDER_RESCHEDULE] Сохранено в сессии: orderNumber=${orderNumber}`)
    console.log(
      `[ORDER_RESCHEDULE] awaitingDateSelection:`,
      JSON.stringify(userSessions[chatId].awaitingDateSelection, null, 2)
    )
    console.log(`[ORDER_RESCHEDULE] Полная сессия:`, JSON.stringify(userSessions[chatId], null, 2))

    // Отправляем сообщение с выбором даты
    const dateSelectionMessage = await bot.editMessageText(
      `📅 *Выберите новую дату отгрузки для заказа №${orderNumber}:*\n\n` +
        `⚠️ **Ближайшая доступная дата:** ${nearestAvailableDate.toLocaleDateString('ru-RU')}\n\n` +
        `🔽 *Выберите дату из списка ниже:*`,
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: dateButtons,
        },
      }
    )

    // Сохраняем ID сообщения с выбором даты для последующего удаления
    if (!userSessions[chatId]) userSessions[chatId] = {}
    userSessions[chatId].dateSelectionMessageId = callbackQuery.message.message_id

    await bot.answerCallbackQuery(callbackQuery.id)
  } catch (error) {
    console.error(`[ORDER_RESCHEDULE] Ошибка:`, error)
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Произошла ошибка при запросе переноса',
      show_alert: true,
    })
  }
}

// Генерация кнопок с датами
function generateDateButtons(currentDate) {
  const buttons = []
  let currentRow = []

  // Функция для расчета ближайшей доступной даты (через 2 дня, пропуская воскресенье)
  function getNextAvailableDate(baseDate) {
    let targetDate = new Date(baseDate.getTime())

    // Добавляем дни по одному, пропуская воскресенье
    let daysAdded = 0
    while (daysAdded < 2) {
      targetDate.setDate(targetDate.getDate() + 1)

      // Если день не воскресенье, считаем его
      if (targetDate.getDay() !== 0) {
        daysAdded++
      }
    }

    return targetDate
  }

  // Получаем ближайшую доступную дату
  let startDate = getNextAvailableDate(currentDate)

  console.log(`[GENERATE_BUTTONS] Текущая дата: ${currentDate.toLocaleDateString('ru-RU')}`)
  console.log(
    `[GENERATE_BUTTONS] Ближайшая доступная дата: ${startDate.toLocaleDateString('ru-RU')}`
  )

  for (let i = 0; i <= 14; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)

    // Пропускаем воскресенье
    if (date.getDay() === 0) continue

    const dateStr = date.toLocaleDateString('ru-RU')
    const callbackData = `select_date_${date.toISOString().split('T')[0]}`

    console.log(`[GENERATE_BUTTONS] Создана кнопка: ${dateStr} -> ${callbackData}`)

    currentRow.push({
      text: dateStr,
      callback_data: callbackData,
    })

    // Группируем по 3 кнопки в ряд
    if (currentRow.length === 3) {
      buttons.push([...currentRow])
      currentRow = []
    }
  }

  // Добавляем оставшиеся кнопки
  if (currentRow.length > 0) {
    buttons.push(currentRow)
  }

  // Добавляем кнопку отмены
  buttons.push([{ text: '❌ Отмена', callback_data: 'cancel_reschedule' }])

  return buttons
}

// Обработка выбора новой даты
async function handleDateSelection(bot, chatId, callbackQuery, selectedDate, userSessions) {
  try {
    console.log(
      `[DATE_SELECTION] Входные параметры: chatId=${chatId}, selectedDate=${selectedDate}`
    )
    console.log(`[DATE_SELECTION] Callback data: ${callbackQuery.data}`)

    const sessionData = userSessions[chatId]
    console.log(
      `[DATE_SELECTION] Полная сессия для ${chatId}:`,
      JSON.stringify(sessionData, null, 2)
    )

    if (!sessionData?.awaitingDateSelection) {
      console.error(`[DATE_SELECTION] Нет awaitingDateSelection в сессии для ${chatId}`)
      return
    }

    const { orderNumber } = sessionData.awaitingDateSelection
    console.log(`[DATE_SELECTION] Извлечен orderNumber: ${orderNumber}`)
    console.log(`[DATE_SELECTION] Выбрана дата ${selectedDate} для заказа ${orderNumber}`)

    // Сохраняем выбранную дату
    sessionData.selectedNewDate = selectedDate
    sessionData.awaitingRescheduleReason = true

    console.log(`[DATE_SELECTION] После сохранения данных:`, JSON.stringify(sessionData, null, 2))

    // Запрашиваем причину переноса - отправляем новое сообщение для лучшей видимости
    const reasonRequestMessage = await bot.sendMessage(
      chatId,
      `📝 *Укажите причину переноса даты отгрузки заказа №${orderNumber}:*\n\n` +
        `📅 **Новая дата:** ${new Date(selectedDate).toLocaleDateString('ru-RU')}\n\n` +
        `💬 **Отправьте текст** с объяснением причины переноса\n\n` +
        `⚠️ *Внимание:* Это сообщение требует вашего ответа!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'cancel_reschedule' }]],
        },
      }
    )

    // Сохраняем ID сообщения с запросом причины для последующего удаления
    sessionData.reasonRequestMessageId = reasonRequestMessage.message_id

    await bot.answerCallbackQuery(callbackQuery.id)
  } catch (error) {
    console.error(`[DATE_SELECTION] Ошибка:`, error)
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Произошла ошибка при выборе даты',
      show_alert: true,
    })
  }
}

// Обработка причины переноса
async function handleRescheduleReason(bot, chatId, text, userSessions) {
  try {
    const sessionData = userSessions[chatId]
    console.log(
      `[RESCHEDULE_REASON] Полная сессия для ${chatId}:`,
      JSON.stringify(sessionData, null, 2)
    )

    if (!sessionData?.awaitingRescheduleReason) {
      console.error(`[RESCHEDULE_REASON] Нет awaitingRescheduleReason в сессии для ${chatId}`)
      return
    }

    // Извлекаем orderNumber из awaitingDateSelection, а selectedNewDate из корня сессии
    const orderNumber = sessionData.awaitingDateSelection?.orderNumber
    const selectedNewDate = sessionData.selectedNewDate

    console.log(
      `[RESCHEDULE_REASON] Извлечены данные: orderNumber=${orderNumber}, selectedNewDate=${selectedNewDate}`
    )

    if (!orderNumber || !selectedNewDate) {
      console.error(
        `[RESCHEDULE_REASON] Отсутствуют данные: orderNumber=${orderNumber}, selectedNewDate=${selectedNewDate}`
      )
      console.error(`[RESCHEDULE_REASON] awaitingDateSelection:`, sessionData.awaitingDateSelection)
      await bot.sendMessage(chatId, 'Ошибка: неполные данные для переноса даты')
      return
    }

    // Получаем информацию о компании
    const companyResult = await dbPool.query(
      `SELECT c.*, uctb.chat_id 
       FROM companies c 
       JOIN user_company_tg_bot uctb ON c.id = uctb.company_id 
       WHERE uctb.chat_id = $1`,
      [chatId]
    )

    if (companyResult.rows.length === 0) {
      await bot.sendMessage(chatId, 'Компания не найдена')
      return
    }

    const company = companyResult.rows[0]

    // Обновляем заказ в БД
    await dbPool.query(
      `UPDATE orders_1c 
       SET dealer_response_received = TRUE, 
           dealer_response_at = NOW(),
           dealer_response_type = 'reschedule',
           new_shipping_date = $1,
           reschedule_reason = $2
       WHERE order_number = $3`,
      [selectedNewDate, text, orderNumber]
    )

    // Получаем userId для МПП
    let userId
    try {
      userId = await getMppByCompany(company.id)
    } catch (error) {
      console.error('Не удалось получить userId для МПП:', error.message)
      await bot.sendMessage(chatId, 'Ошибка: не удалось найти ответственного МПП')
      return
    }

    // Отправляем уведомление МПП
    await createReminder({
      newRecordId: -1,
      userId: userId,
      textCalc: `Дилер запросил перенос даты отгрузки заказа №${orderNumber} на ${new Date(
        selectedNewDate
      ).toLocaleDateString('ru-RU')}. Причина: ${text}`,
      typeReminders: 'orders_1c',
      priority: 'высокий',
      title: `Перенос даты заказа *${company.name_companies}*. Заказ №${orderNumber}. Пользователь tg: (id:${chatId})`,
      tags: [
        { title: '📅 Перенос', color: '#ffc107' },
        { title: 'Telegram', color: '#007bff' },
      ],
      links: [],
    })

    // Очищаем состояние
    delete sessionData.awaitingDateSelection
    delete sessionData.selectedNewDate
    delete sessionData.awaitingRescheduleReason

    // Удаляем сообщение с выбором даты (если есть messageId в сессии)
    if (sessionData.dateSelectionMessageId) {
      try {
        await bot.deleteMessage(chatId, sessionData.dateSelectionMessageId)
        console.log(
          `[RESCHEDULE_REASON] Удалено сообщение с выбором даты: ${sessionData.dateSelectionMessageId}`
        )
      } catch (error) {
        console.log(
          `[RESCHEDULE_REASON] Не удалось удалить сообщение с выбором даты: ${error.message}`
        )
      }
      delete sessionData.dateSelectionMessageId
    }

    // Удаляем сообщение с запросом причины (если есть messageId в сессии)
    if (sessionData.reasonRequestMessageId) {
      try {
        await bot.deleteMessage(chatId, sessionData.reasonRequestMessageId)
        console.log(
          `[RESCHEDULE_REASON] Удалено сообщение с запросом причины: ${sessionData.reasonRequestMessageId}`
        )
      } catch (error) {
        console.log(
          `[RESCHEDULE_REASON] Не удалось удалить сообщение с запросом причины: ${error.message}`
        )
      }
      delete sessionData.reasonRequestMessageId
    }

    // Отправляем подтверждение
    await bot.sendMessage(
      chatId,
      `✅ Запрос на перенос даты отправлен!\n\n` +
        `📦 Заказ №${orderNumber}\n` +
        `📅 Новая дата: ${new Date(selectedNewDate).toLocaleDateString('ru-RU')}\n` +
        `📝 Причина: ${text}\n\n` +
        `МПП уведомлен о запросе переноса.`
    )
  } catch (error) {
    console.error(`[RESCHEDULE_REASON] Ошибка:`, error)
    await bot.sendMessage(chatId, 'Произошла ошибка при обработке запроса')
  }
}

// Обработка отмены переноса
async function handleCancelReschedule(bot, chatId, callbackQuery, userSessions) {
  try {
    const sessionData = userSessions[chatId]
    if (sessionData) {
      // Удаляем сообщение с выбором даты (если есть)
      if (sessionData.dateSelectionMessageId) {
        try {
          await bot.deleteMessage(chatId, sessionData.dateSelectionMessageId)
          console.log(
            `[CANCEL_RESCHEDULE] Удалено сообщение с выбором даты: ${sessionData.dateSelectionMessageId}`
          )
        } catch (error) {
          console.log(
            `[CANCEL_RESCHEDULE] Не удалось удалить сообщение с выбором даты: ${error.message}`
          )
        }
        delete sessionData.dateSelectionMessageId
      }

      // Удаляем сообщение с запросом причины (если есть)
      if (sessionData.reasonRequestMessageId) {
        try {
          await bot.deleteMessage(chatId, sessionData.reasonRequestMessageId)
          console.log(
            `[CANCEL_RESCHEDULE] Удалено сообщение с запросом причины: ${sessionData.reasonRequestMessageId}`
          )
        } catch (error) {
          console.log(
            `[CANCEL_RESCHEDULE] Не удалось удалить сообщение с запросом причины: ${error.message}`
          )
        }
        delete sessionData.reasonRequestMessageId
      }

      // Очищаем состояние
      delete sessionData.awaitingDateSelection
      delete sessionData.selectedNewDate
      delete sessionData.awaitingRescheduleReason
    }

    await bot.editMessageText('❌ Перенос даты отменен', {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
    })

    await bot.answerCallbackQuery(callbackQuery.id)
  } catch (error) {
    console.error(`[CANCEL_RESCHEDULE] Ошибка:`, error)
  }
}

// Проверка времени ответа (должен быть до 12:00)
function isResponseTimeValid() {
  const now = new Date()
  const currentHour = now.getHours()
  return currentHour < 12
}

// Функция для блокировки ответов после 12:00
async function checkAndBlockLateResponses(bot) {
  try {
    if (isResponseTimeValid()) return // Еще не 12:00

    // Получаем все заказы, на которые не получен ответ
    const { rows } = await dbPool.query(
      `SELECT o.*, c.name_companies, c.id as company_id, uctb.chat_id
       FROM orders_1c o
       JOIN companies c ON o.inn = c.inn
       JOIN user_company_tg_bot uctb ON c.id = uctb.company_id
       WHERE o.notification_sent = TRUE 
         AND o.dealer_response_received = FALSE
         AND o.mpp_notified = FALSE
         AND DATE(o.notification_sent_at) = CURRENT_DATE`
    )

    for (const order of rows) {
      try {
        // Получаем userId для МПП
        let userId
        try {
          userId = await getMppByCompany(order.company_id)
        } catch (error) {
          console.error(
            `Не удалось получить userId для МПП компании ${order.name_companies}:`,
            error.message
          )
          continue
        }

        // Отправляем уведомление МПП
        await createReminder({
          newRecordId: -1,
          userId: userId,
          textCalc: `Дилер не дал ответа, необходимо уточнить самостоятельно! Заказ №${order.order_number}`,
          typeReminders: 'orders_1c',
          priority: 'высокий',
          title: `Нет ответа дилера *${order.name_companies}*. Заказ №${
            order.order_number
          }. Пользователь tg: (id:${order.chat_id || 'неизвестен'})`,
          tags: [
            { title: '⏰ Просрочено', color: '#dc3545' },
            { title: 'Telegram', color: '#007bff' },
          ],
          links: [],
        })

        // Обновляем статус в БД
        await dbPool.query(
          `UPDATE orders_1c 
           SET mpp_notified = TRUE, mpp_notified_at = NOW()
           WHERE order_number = $1`,
          [order.order_number]
        )

        console.log(`[LATE_RESPONSE] МПП уведомлен о заказе ${order.order_number}`)
      } catch (error) {
        console.error(
          `[LATE_RESPONSE] Ошибка уведомления МПП для заказа ${order.order_number}:`,
          error
        )
      }
    }
  } catch (error) {
    console.error('[LATE_RESPONSE] Ошибка проверки поздних ответов:', error)
  }
}

module.exports = {
  handleOrderConfirm,
  handleOrderReschedule,
  handleDateSelection,
  handleRescheduleReason,
  handleCancelReschedule,
  checkAndBlockLateResponses,
  isResponseTimeValid,
  generateDateButtons,
}
