const {
  getMppByCompany,
  createReminder,
  sendRequest1C,
} = require('../../helpers/api')
const { handleCancel } = require('../../helpers/buttonCancel')
const { displayHelpMenu } = require('../../helpers/helpMenu')
const { getRandomColors } = require('../../helpers/getRandomColors')
const { keyboardCancel, deleteLastMessage } = require('../../helpers/utils.js')

async function deliveryOrder(bot, chatId, userSessions, companyInn) {
  userSessions[chatId] = userSessions[chatId] || {}
  // Удаляем предыдущее сообщение при выборе расчета
  await deleteLastMessage(bot, chatId, userSessions)

  const inlineKeyboard = [
    [
      {
        text: '🚚🗺️ Уточнить местонахождение водителя',
        callback_data: '/delivery_order_driver_location',
      },
    ],
    [
      {
        text: '🚚📬 Сколько стоит доставка до....? ',
        callback_data: '/delivery_order_to_point',
      },
    ],
    /* [
      {
        text: '🚚📅 На какую дату принимаете? (В разработке!) ',
        callback_data: 'disabled', //'/delivery_order_to_point_date',
      },
    ],*/
    [
      {
        text: '🕒🚫 Сообщить об опоздании',
        callback_data: '/delivery_order_driver_delay',
      },
    ],
  ]
  // Если companyInn не пустой, добавляем кнопку "Подтвердить в работу"
  if (companyInn) {
    inlineKeyboard.splice(0, 0, [
      {
        text: '🕒✅ Уточнить время доставки',
        callback_data: '/delivery_order_time',
      },

      {
        text: '🚚📅 Уточнить дату доставки',
        callback_data: '/delivery_order_date',
      },
    ])
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
// ********************************************** На какую дату принимаете?  ************************************************************************
async function deliveryOrderToPointDate(
  bot,
  chatId,
  msg,
  userSessions,
  companyInn
) {
  userSessions[chatId] = userSessions[chatId] || {}
  // Удаляем предыдущее сообщение при выборе расчета
  await deleteLastMessage(bot, chatId, userSessions)

  // ЭТАП 0 - ввод направления *********************************************************************************************
  if (!userSessions[chatId].awaitingOrderToPointDate) {
    userSessions[chatId].awaitingOrderToPointDate = 1

    const inlineKeyboardCity = [
      [
        {
          text: 'Балаково',
          callback_data: 'Балаково',
        },
        {
          text: 'Балашов',
          callback_data: 'Балашов,',
        },
        {
          text: 'Белгород',
          callback_data: 'Белгород',
        },
        {
          text: 'Борисоглебск',
          callback_data: 'Борисоглебск',
        },
      ],

      [
        {
          text: 'Волгоград',
          callback_data: 'Волгоград',
        },
        {
          text: 'Вольск',
          callback_data: 'Вольск',
        },
      ],
      [
        {
          text: 'Елань',
          callback_data: 'Елань',
        },
        {
          text: 'Ершов',
          callback_data: 'Ершов',
        },
      ],
      [
        {
          text: 'Жирновск',
          callback_data: 'Жирновск',
        },
      ],
      [
        {
          text: 'Каменка',
          callback_data: 'Каменка',
        },
        {
          text: 'Камышин',
          callback_data: 'Камышин',
        },
        {
          text: 'Краснодар',
          callback_data: 'Краснодар',
        },
        {
          text: 'Кузнецк',
          callback_data: 'Кузнецк',
        },
      ],
      [
        {
          text: 'Мариуполь',
          callback_data: 'Мариуполь',
        },
        {
          text: 'Маркс',
          callback_data: 'Маркс',
        },
        {
          text: 'Михайловка',
          callback_data: 'Михайловка',
        },
        {
          text: 'Москва',
          callback_data: 'Москва',
        },
      ],
      [
        {
          text: 'Никольск',
          callback_data: 'Никольск',
        },
        {
          text: 'Новоузенск',
          callback_data: 'Новоузенск',
        },
      ],
      [
        {
          text: 'Павловка',
          callback_data: 'Павловка',
        },
        {
          text: 'Палласовка',
          callback_data: 'Палласовка',
        },
        {
          text: 'Пенза',
          callback_data: 'Пенза',
        },
      ],
      [
        {
          text: 'Петровск',
          callback_data: 'Петровск',
        },
        {
          text: 'Полтавка',
          callback_data: 'Полтавка',
        },
        {
          text: 'Пугачев',
          callback_data: 'Пугачев',
        },
      ],
      [
        {
          text: 'Самара',
          callback_data: 'Самара',
        },
        {
          text: 'Саранск',
          callback_data: 'Саранск',
        },
        {
          text: 'Саратов',
          callback_data: 'Саратов',
        },
        {
          text: 'Сердобск',
          callback_data: 'Сердобск',
        },
        {
          text: 'Сызрань',
          callback_data: 'Сызрань',
        },
      ],
      [
        {
          text: 'Тамбов',
          callback_data: 'Тамбов',
        },
        {
          text: 'Тольятти',
          callback_data: 'Тольятти',
        },
      ],
      [
        {
          text: 'Ульяновск',
          callback_data: 'Ульяновск',
        },
        {
          text: 'Урюпинск',
          callback_data: 'Урюпинск',
        },
      ],
      [
        {
          text: 'Отдельная машина',
          callback_data: 'Отдельная машина',
        },
      ],
      [
        {
          text: 'Самовывоз',
          callback_data: 'Самовывоз',
        },
      ],
    ]

    inlineKeyboardCity.push([{ text: '❌ Отмена', callback_data: '/cancel' }])
    const message = await bot.sendMessage(chatId, 'Укажите направление:', {
      reply_markup: {
        inline_keyboard: inlineKeyboardCity,
      },
    })
    userSessions[chatId].lastMessageId = message.message_id
    return
  }

  // ЭТАП 1 - ввод типа изделия *********************************************************************************************
  if (userSessions[chatId].awaitingOrderToPointDate === 1) {
    userSessions[chatId].awaitingOrderToPointDate = 2
    userSessions[chatId].city = msg

    await deleteLastMessage(bot, chatId, userSessions)

    const inlineKeyboardType = [
      [
        {
          text: 'Окно/балконная дверь',
          callback_data: 'Окно/балконная дверь',
        },
      ],
      [
        {
          text: 'Арка/трапеция/треугольник',
          callback_data: 'Арка/трапеция/треугольник',
        },
      ],
      [
        {
          text: 'Дверь/межкомнатная дверь',
          callback_data: 'Дверь/межкомнатная дверь',
        },
      ],
      [
        {
          text: 'Изделие с двухсторонней ручкой',
          callback_data: 'Изделие с двухсторонней ручкой',
        },
      ],
      [
        {
          text: 'Москитная сетка',
          callback_data: 'Москитная сетка',
        },
      ],
    ]

    inlineKeyboardType.push([{ text: '❌ Отмена', callback_data: '/cancel' }])
    const message = await bot.sendMessage(chatId, 'Укажите тип изделия:', {
      reply_markup: {
        inline_keyboard: inlineKeyboardType,
      },
    })

    // Сохраняем идентификатор сообщения о расчетах
    userSessions[chatId].lastMessageId = message.message_id
    return
  }

  // ЭТАП 2 - ввод материала *********************************************************************************************
  if (userSessions[chatId].awaitingOrderToPointDate === 2) {
    userSessions[chatId].awaitingOrderToPointDate = 3
    userSessions[chatId].type = msg

    await deleteLastMessage(bot, chatId, userSessions)

    const inlineKeyboardType = [
      [
        {
          text: 'ПВХ',
          callback_data: 'ПВХ',
        },
        {
          text: 'Алюминий',
          callback_data: 'Алюминий',
        },
      ],
      [
        {
          text: 'Ламинация ПВХ',
          callback_data: 'Ламинация ПВХ',
        },
      ],
    ]

    inlineKeyboardType.push([{ text: '❌ Отмена', callback_data: '/cancel' }])
    const message = await bot.sendMessage(chatId, 'Укажите материал:', {
      reply_markup: {
        inline_keyboard: inlineKeyboardType,
      },
    })

    // Сохраняем идентификатор сообщения о расчетах
    userSessions[chatId].lastMessageId = message.message_id
    return
  }

  // ЭТАП 3 - Рассчет по формуле *********************************************************************************************
  if (userSessions[chatId].awaitingOrderToPointDate === 3) {
    userSessions[chatId].material = msg
    await bot.sendMessage(chatId, 'Ветка в разработке!!!')
    return
  }
}

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Сколько стоит доставка до....?  ************************************************************************
async function deliveryOrderToPoint(bot, chatId, msg, userSessions) {
  // ЭТАП 0 - ввод название населенного пункта *********************************************************************************************
  if (!userSessions[chatId].awaitingOrderToPoint) {
    userSessions[chatId].awaitingOrderToPoint = 1
    await bot.sendMessage(
      chatId,
      'Введите название населенного пункта. (Регион!, н.п.)',
      keyboardCancel
    )
    return
  }

  // ЭТАП 1 - населенного пункта *********************************************************************************************
  if (userSessions[chatId].awaitingOrderToPoint === 1) {
    userSessions[chatId].adress = msg.text
    const deliveryMenu = [
      {
        text: 'Попутная машина',
        callback_data: 'passing_car',
      },
      {
        text: 'Сборная машина',
        callback_data: 'assembly_car',
      },
      {
        text: 'Отдельная машина',
        callback_data: 'separate_car',
      },
      { text: '❌ Отмена', callback_data: '/cancel' },
    ]

    const keyboard = deliveryMenu.map((option) => [option])
    const options = {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }

    const message = await bot.sendMessage(
      chatId,
      'Выберите вариант доставки:',
      options
    )
    userSessions[chatId].messageId = message.message_id
  }

  // ЭТАП 2 - После выбора машины *********************************************************************************************
  if (userSessions[chatId].awaitingOrderToPoint === 2) {
    await bot.deleteMessage(chatId, userSessions[chatId].messageId)
    const sessionData = userSessions[chatId]
    let carType = ''
    if (msg === 'passing_car') carType = 'Попутная машина'
    if (msg === 'assembly_car') carType = 'Сборная машина'
    if (msg === 'separate_car') carType = 'Отдельная машина'

    userId = await getMppByCompany(sessionData.companyId)

    try {
      //  для создания напоминания
      await createReminder({
        newRecordId: -2,
        userId,
        textCalc: `Уточнить стоимость доставки для типа доставки "${carType}", по адресу: ${userSessions[chatId].adress}`,
        typeReminders: 'delivery_order',
        priority: 'высокий',
        title: `Уточнить стоимость доставки для *${
          userSessions[chatId].companyName
        }*. Пользователь tg: (id:${chatId}) ${
          sessionData.userName ? sessionData.userName : ''
        }`,
        tags: [
          { title: '🔴СРОЧНО', ...getRandomColors() },
          { title: 'Telegram', ...getRandomColors() },
        ],
        links: [],
      })

      await bot.sendMessage(
        chatId,
        '✅ Запрос отправлен менеджеру и находится в обработке!'
      )
      carType = ''
      handleCancel(bot, chatId, userSessions)
      // displayHelpMenu(bot, chatId, userSessions)
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

    return
  }
}

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Уточнить время доставки ************************************************************************
async function deliveryOrderTime(bot, chatId, msg, userSessions, companyInn) {
  if (!userSessions[chatId].awaitingDeliveryOrderTime) {
    userSessions[chatId].awaitingDeliveryOrderTime = 1
    await bot.sendMessage(chatId, 'Введите номер заказа 1С', keyboardCancel)
    return
  }
  if (userSessions[chatId].awaitingDeliveryOrderTime === 1) {
    const sScan = `V3R${msg.text}INN${companyInn}`

    const response = await sendRequest1C(sScan)

    if (!response) {
      await bot.sendMessage(chatId, `Заказ ${msg.text} не обнаружен`)
      delete userSessions[chatId].awaitingDeliveryOrderTime
      handleCancel(bot, chatId, userSessions)
      return
    }

    const timeMatch = response.match(/\d{1,2}:\d{2}:\d{2}/)
    if (timeMatch) {
      const time = timeMatch[0] // Получаем найденное время
      await bot.sendMessage(chatId, time)
    } else {
      await bot.sendMessage(
        chatId,
        `Не удалось извлечь время из ответа: "${response}"`
      )
    }

    delete userSessions[chatId].awaitingDeliveryOrderTime
    handleCancel(bot, chatId, userSessions)
    return
  }
}

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Уточнить дату доставки ************************************************************************
async function deliveryOrderDate(bot, chatId, msg, userSessions, companyInn) {
  if (!userSessions[chatId].awaitingDeliveryOrderDate) {
    userSessions[chatId].awaitingDeliveryOrderDate = 1
    await bot.sendMessage(chatId, 'Введите номер заказа 1С', keyboardCancel)
    return
  }
  if (userSessions[chatId].awaitingDeliveryOrderDate === 1) {
    const sScan = `V4R${msg.text}INN${companyInn}` // Возможно стоит оставить V3R, дата та же и обработка на 4 я не делал
    const response = await sendRequest1C(sScan)

    if (!response) {
      await bot.sendMessage(chatId, `Заказ ${msg.text} не обнаружен`)
      delete userSessions[chatId].awaitingDeliveryOrderDate
      handleCancel(bot, chatId, userSessions)
      return
    }

    const date = response.split(' ')[0] // Берем первую часть строки, содержащую дату 27.01.2025 10:10:11
    await bot.sendMessage(chatId, date)

    delete userSessions[chatId].awaitingDeliveryOrderDate
    handleCancel(bot, chatId, userSessions)
  }
}

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Уточнить местонахождение водителя ************************************************************************
async function deliveryOrderDriverLocation(bot, chatId, userSessions) {
  const sessionData = userSessions[chatId]

  // Получаем userId, используя вынесенную функцию
  const userId = await getMppByCompany(sessionData.companyId)

  try {
    //  для создания напоминания
    await createReminder({
      newRecordId: -2,
      userId,
      textCalc: 'Уточнить местонахождение водителя',
      typeReminders: 'delivery_order',
      priority: 'высокий',
      title: `Уточнить местонахождение водителя для *${
        userSessions[chatId].companyName
      }*. Пользователь tg: (id:${chatId}) ${
        sessionData.userName ? sessionData.userName : ''
      }`,
      tags: [
        { title: '🔴СРОЧНО', ...getRandomColors() },
        { title: 'Telegram', ...getRandomColors() },
      ],
      links: [],
    })

    await bot.sendMessage(
      chatId,
      '✅ Запрос отправлен менеджеру и находится в обработке!'
    )
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

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Сообщить об опоздании ************************************************************************
async function deliveryOrderDriverDelay(bot, chatId, userSessions) {
  const sessionData = userSessions[chatId]

  // Получаем userId, используя вынесенную функцию
  const userId = await getMppByCompany(sessionData.companyId)

  try {
    //  для создания напоминания
    await createReminder({
      newRecordId: -2,
      userId,
      textCalc: 'Сообщение об опоздании!',
      typeReminders: 'delivery_order',
      priority: 'высокий',
      title: `Сообщение об опоздании от *${
        userSessions[chatId].companyName
      }*. Пользователь tg: (id:${chatId}) ${
        sessionData.userName ? sessionData.userName : ''
      }`,
      tags: [
        { title: '🔴СРОЧНО', ...getRandomColors() },
        { title: 'Telegram', ...getRandomColors() },
      ],
      links: [],
    })

    await bot.sendMessage(
      chatId,
      '✅ Сообщение об опоздании отправлено менеджеру и находится в обработке!'
    )
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

module.exports = {
  deliveryOrder,
  deliveryOrderTime,
  deliveryOrderDriverDelay,
  deliveryOrderDriverLocation,
  deliveryOrderDate,
  deliveryOrderToPoint,
  deliveryOrderToPointDate,
}
