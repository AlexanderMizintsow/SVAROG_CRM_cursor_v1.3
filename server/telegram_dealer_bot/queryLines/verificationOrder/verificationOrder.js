const xlsx = require('xlsx') // Импортируем библиотеку xlsx
const fs = require('fs') // Не забудьте импортировать fs, если вы его используете
const { getMppByCompany, createReminder } = require('../../helpers/api')
const { displayHelpMenu } = require('../../helpers/helpMenu')
const { sendRequest1C } = require('../../helpers/api')
const { getRandomColors } = require('../../helpers/getRandomColors')
const { deleteLastMessage, splitMessage } = require('../../helpers/utils.js')
const { handleCancel } = require('../../helpers/buttonCancel')
const { sanitizeFilename } = require('../../helpers/fileUtils') // Импорт утилиты для работы с файлами
const {
  createCalendar,
  handleCalendarNavigation,
  extractSelectedDate,
} = require('../../helpers/calendar') // Импорт календаря

async function handleVerification(bot, chatId, userSessions, companyInn) {
  userSessions[chatId] = userSessions[chatId] || {}
  // Удаляем предыдущее сообщение при выборе расчета
  await deleteLastMessage(bot, chatId, userSessions)

  const inlineKeyboard = [
    [
      {
        text: '💰 Сверка финансовая',
        callback_data: '/verification_financial',
      },
    ],
  ]

  // Если companyInn не пустой, добавляем кнопки сверки по заказам
  if (companyInn) {
    inlineKeyboard.splice(
      1,
      0,
      [
        {
          text: '📑 Сверка по заказам',
          callback_data: '/verification_orders',
        },
        {
          text: '📅 Сверка по заказам (дата)',
          callback_data: '/verification_orders_by_date',
        },
      ],
      [
        {
          text: '📦 Статус заказа',
          callback_data: '/verification_status',
        },
      ]
    )
  }
  inlineKeyboard.push([{ text: '❌ Отмена', callback_data: '/cancel' }])
  const message = await bot.sendMessage(chatId, 'Выберите действие:', {
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  })

  // Сохраняем идентификатор сообщения о расчетах
  userSessions[chatId].lastMessageId = message.message_id

  return message
}

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Сверка финансовая ************************************************************************
async function handleVerificationFinancial(bot, chatId, userSessions) {
  const sessionData = userSessions[chatId]
  // Получаем userId, используя вынесенную функцию для поиска МПП
  const userId = await getMppByCompany(sessionData.companyId)
  console.error(`Данные ответа: ${userId}`)
  try {
    //  для создания напоминания
    await createReminder({
      newRecordId: -1,
      userId,
      textCalc: 'Финансовая сверка!',
      typeReminders: 'verificationFinancial',
      priority: 'средний',
      title: `Сверка финансовая *${
        userSessions[chatId].companyName
      }*. Пользователь tg: (id:${chatId}) ${sessionData.userName ? sessionData.userName : ''}`,
      tags: [{ title: 'Telegram', ...getRandomColors() }],
      links: [],
    })

    await bot.sendMessage(chatId, '✅ Запрос отправлен менеджеру и находится в обработке!')
    displayHelpMenu(bot, chatId, userSessions)
  } catch (error) {
    await bot.sendMessage(chatId, 'Произошла ошибка, попробуйте позже снова!')
    console.error(`Ошибка при добавлении записи: ${error.message}`)
    if (error.response) {
      console.error(`Данные ответа: ${JSON.stringify(error.response.data)}`)
    }
    await bot.sendMessage(
      chatId,
      'Произошла ошибка при сохранении данных. Пожалуйста, попробуйте снова.'
    )
  }
}
// ********************************************** ||| ************************************************************************
// **********************************************
// **********************************************
// **********************************************
// ********************************************** Сверка по заказам  handleVerificationOrders ************************************************************************
async function handleVerificationOrders(bot, chatId, userSessions, companyInn) {
  const verification = `INN${companyInn}`
  const response = await sendRequest1C(verification)
 
  console.log(verification)
  // Разбиение сообщения на части
  const maxLength = 4096
  const messages = splitMessage(response, maxLength)

  // Создание Excel файла
  const workbook = xlsx.utils.book_new()
  const worksheetData = []

  // Добавление заголовков
  worksheetData.push(['Номер заказа', 'Наименование', 'Сумма', 'Адрес', 'Дата отгрузки'])

  // Парсинг данных из response и добавление в worksheetData
  if (typeof response !== 'string') {
    console.warn('createExcelFile: response не является строкой')
    return
  }

  const results = response.split('\n').filter((line) => line.trim() !== '')
  results.forEach((line) => {
    // Разделение строки по запятым
    const parts = line.split(',').map((part) => part.trim())
    if (parts.length >= 5) {
      // Убираем слова из начала каждого элемента
      const orderNumber = parts[0].replace(/^Номер заказа:\s*/, '')
      const orderName = parts[1].replace(/^Наименование:\s*/, '')
      const sumStr = parts[2].replace(/^Сумма:\s*/, '').toString() // Сумма как строка

      // Обработка адреса, который может содержать запятые
      const address = parts
        .slice(3, parts.length - 1)
        .join(', ')
        .replace(/^Адрес:\s*/, '')
        .trim()

      const date = parts[parts.length - 1].replace(/^Дата:\s*/, '').trim()

      worksheetData.push([orderNumber, orderName, sumStr, address, date])
    }
  })

  // Создание рабочего листа
  const worksheet = xlsx.utils.aoa_to_sheet(worksheetData)
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Заказы')

  // Создаем безопасное имя файла
  const safeFilename = sanitizeFilename(`orders_${companyInn}.xlsx`)
  const filePath = safeFilename
  xlsx.writeFile(workbook, filePath)

  // Отправка файла в чат
  await bot.sendDocument(chatId, fs.createReadStream(filePath))

  // Удаление файла после отправки
  fs.unlinkSync(filePath)

  await handleCancel(bot, chatId, userSessions)
}
// Старая версия, просто текст в чате
/*async function handleVerificationOrders(bot, chatId, userSessions, companyInn) {
  const verification = `INN${companyInn}`
  const response = await sendRequest1C(verification)

  // Разбиение сообщения на части
  const maxLength = 4096
  const messages = splitMessage(response, maxLength)

  for (const message of messages) {
    await bot.sendMessage(chatId, message)
  }
  await handleCancel(bot, chatId, userSessions)
}*/

// ********************************************** ||| ************************************************************************

// **********************************************
// **********************************************
// **********************************************
// ********************************************** СВЕРКА ПО ЗАКАЗАМ (по дате) handleVerificationOrdersByDate ************************************************************************
async function handleVerificationOrdersByDate(bot, chatId, userSessions, companyInn) {
  userSessions[chatId] = userSessions[chatId] || {}
  
  // Если дата еще не выбрана ИЛИ это новый вызов (не продолжение после выбора даты), показываем календарь
  // Проверяем, что это не продолжение логики после выбора даты
  const isNewCall = !userSessions[chatId].selectedVerificationDate && !userSessions[chatId].awaitingVerificationDate
  
  if (isNewCall) {
    // Очищаем все флаги, связанные с выбором даты, для нового вызова
    delete userSessions[chatId].selectedVerificationDate
    delete userSessions[chatId].awaitingVerificationDate
    delete userSessions[chatId].verificationCompanyInn
    
    userSessions[chatId].awaitingVerificationDate = true
    userSessions[chatId].verificationCompanyInn = companyInn
    
    // Удаляем предыдущее сообщение
    await deleteLastMessage(bot, chatId, userSessions)
    
    const calendarButtons = createCalendar(new Date(), 'verification_date_')
    const message = await bot.sendMessage(chatId, '📅 Выберите дату для сверки по заказам:', {
      reply_markup: {
        inline_keyboard: calendarButtons,
      },
    })
    
    userSessions[chatId].lastMessageId = message.message_id
    return
  }
  
  // Если дата выбрана, продолжаем логику
  const selectedDate = userSessions[chatId].selectedVerificationDate
  console.log(`[VERIFICATION_DATE] Выбранная дата для сверки: ${selectedDate}`)
  
  // Форматируем дату для запроса (нужно понять формат, который ожидает 1С)
  // Предполагаю формат DD.MM.YYYY для запроса
  let formattedDate = null
  if (selectedDate) {
    const dateParts = selectedDate.split('-')
    formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` // DD.MM.YYYY
    console.log(`[VERIFICATION_DATE] Форматированная дата для запроса: ${formattedDate}`) //07.11.2025
  }
  
  // Формируем запрос с датой (нужно уточнить формат запроса к 1С)
  // Пока используем тот же формат, что и без даты, но добавляем дату в запрос, если она есть
  const verification = `INN${companyInn}`
  const filterDate = selectedDate
  console.log(`[VERIFICATION_DATE] Строка запроса: ${verification} c датой ${formattedDate}`)
  const response = await sendRequest1C(verification, formattedDate)
  
 
  
  // Очищаем выбранную дату и связанные данные после использования
  delete userSessions[chatId].selectedVerificationDate
  delete userSessions[chatId].awaitingVerificationDate
  delete userSessions[chatId].verificationCompanyInn

  // Разбиение сообщения на части
  const maxLength = 4096
  const messages = splitMessage(response, maxLength)

  // Создание Excel файла
  const workbook = xlsx.utils.book_new()
  const worksheetData = []

  // Добавление заголовков
  worksheetData.push(['Номер заказа', 'Наименование', 'Сумма', 'Адрес', 'Дата отгрузки'])

  // Парсинг данных из response и добавление в worksheetData
  if (typeof response !== 'string') {
    console.warn('createExcelFile: response не является строкой')
    return
  }

  const results = response.split('\n').filter((line) => line.trim() !== '')
  results.forEach((line) => {
    // Разделение строки по запятым
    const parts = line.split(',').map((part) => part.trim())
    if (parts.length >= 5) {
      // Убираем слова из начала каждого элемента
      const orderNumber = parts[0].replace(/^Номер заказа:\s*/, '')
      const orderName = parts[1].replace(/^Наименование:\s*/, '')
      const sumStr = parts[2].replace(/^Сумма:\s*/, '').toString() // Сумма как строка

      // Обработка адреса, который может содержать запятые
      const address = parts
        .slice(3, parts.length - 1)
        .join(', ')
        .replace(/^Адрес:\s*/, '')
        .trim()

      const date = parts[parts.length - 1].replace(/^Дата:\s*/, '').trim()

      // Если выбрана конкретная дата, фильтруем результаты по этой дате
      if (filterDate) {
        // Преобразуем дату из формата ответа (DD.MM.YYYY) в формат для сравнения
        const dateParts = date.split('.')
        if (dateParts.length === 3) {
          const orderDateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` // YYYY-MM-DD
          // Сравниваем только дату без времени
          if (orderDateStr !== filterDate) {
            return // Пропускаем этот заказ, если дата не совпадает
          }
        }
      }

      worksheetData.push([orderNumber, orderName, sumStr, address, date])
    }
  })

  // Создание рабочего листа
  const worksheet = xlsx.utils.aoa_to_sheet(worksheetData)
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Заказы')

  // Создаем безопасное имя файла
  const safeFilename = sanitizeFilename(`orders_${companyInn}.xlsx`)
  const filePath = safeFilename
  xlsx.writeFile(workbook, filePath)

  // Отправка файла в чат
  await bot.sendDocument(chatId, fs.createReadStream(filePath))

  // Удаление файла после отправки
  fs.unlinkSync(filePath)

  await handleCancel(bot, chatId, userSessions)
}
// ********************************************** ||| ************************************************************************

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Статус заказа handleVerificationOrdersStatus ************************************************************************
async function handleVerificationOrdersStatus(bot, chatId, userSessions, msg, companyInn) {
  if (!userSessions[chatId].awaitingVerificationOrdersStatus) {
    await bot.sendMessage(chatId, 'Введите номер заказа 1С...')
    userSessions[chatId].awaitingVerificationOrdersStatus = true
    return
  }

  if (userSessions[chatId].awaitingVerificationOrdersStatus) {
    const sScan = `V2R${msg.text}INN${companyInn}`

    const response = await sendRequest1C(sScan)

    if (!response) {
      await bot.sendMessage(chatId, `Заказ ${msg.text} не обнаружен`)
      userSessions[chatId].awaitingVerificationOrdersStatus = false
      await handleCancel(bot, chatId, userSessions)
      return
    }

    await bot.sendMessage(chatId, response)

    userSessions[chatId].awaitingVerificationOrdersStatus = false
    await handleCancel(bot, chatId, userSessions)
    return
  }
}
// ********************************************** ||| ************************************************************************

module.exports = {
  handleVerification,
  handleVerificationFinancial,
  handleVerificationOrders,
  handleVerificationOrdersByDate,
  handleVerificationOrdersStatus,
}

/*
const ole = require('node-ole');

async function getDataFrom1C() {
    // Создаем объект OLE для подключения к 1С
    const oleApp = ole('V83.Application');

    // Параметры подключения
    const параметры = 'Srvr="serv5";Ref="2025";Usr="tgBot";Pwd="@#$951";';

    try {
        // Подключаемся к нужной базе данных 1С
        oleApp.Connect(параметры);

        // Запрос для извлечения данных
        const query = `
            ВЫБРАТЬ 
                рег.сделка.номер, 
                рег.сделка.номерСчетаВСуперокнах,
                рег.суммаВзаиморасчетовОстаток,
                рег.сделка.точкаДоставки 
            ИЗ 
                регистрНакопления.расчетыСКонтрагентами.остатки КАК рег
            ГДЕ 
                рег.контрагент.инн = "361703385105"
        `;

        // Выполняем запрос
        const result = oleApp.NewQuery(query);

        // Обработка результата
        const data = [];
        for (let i = 0; i < result.Count; i++) {
            const item = result.Item(i);
            data.push({
                номер: item.Get('номер'),
                номерСчета: item.Get('номерСчетаВСуперокнах'),
                суммаВзаиморасчетовОстаток: item.Get('суммаВзаиморасчетовОстаток'),
                точкаДоставки: item.Get('точкаДоставки')
            });
        }

        // Вывод данных на экран
        console.log(data);
    } catch (error) {
        console.error('Ошибка при подключении к 1С:', error);
    } finally {
        try {
            oleApp.Disconnect(); // Закрываем соединение
        } catch (error) {
            console.error('Ошибка при отключении:', error);
        }
    }
}

// Вызов функции
getDataFrom1C();

*/
