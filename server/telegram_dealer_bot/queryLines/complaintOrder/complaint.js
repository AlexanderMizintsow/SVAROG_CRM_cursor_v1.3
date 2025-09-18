const { displayHelpMenu } = require('../../helpers/helpMenu')
const {
  createReminder,
  getMppByCompany,
  getNokOrMppByCompany,
  getOrderItemsAW,
  sendRequest1C,
} = require('../../helpers/api')
const { keyboardCancel, deleteLastMessage } = require('../../helpers/utils.js')
const { getRandomColors } = require('../../helpers/getRandomColors')
const { handleCancel } = require('../../helpers/buttonCancel')

async function handleComplaint(bot, chatId, userSessions, companyInn) {
  userSessions[chatId] = userSessions[chatId] || {}
  // Удаляем предыдущее сообщение при выборе расчета
  await deleteLastMessage(bot, chatId, userSessions)

  const inlineKeyboard = [
    [
      {
        text: '🆘 Сообщить о проблеме без оформления рекламации',
        callback_data: '/complaint_report_problem',
      },
    ],
  ]
  // Если companyInn не пустой
  if (companyInn) {
    inlineKeyboard.splice(0, 0, [
      {
        text: '📄✍️ Оформить новую рекламацию',
        callback_data: '/complaint_new_arrange',
      },
    ])

    inlineKeyboard.splice(1, 0, [
      {
        text: '🔍📋 Информация о поданных рекламациях',
        callback_data: '/complaint_existing',
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
// ********************************************** Оформить новую рекламацию (complaint_new_arrange) ************************************************************************
async function handleComplaintNewArrange(bot, chatId, msg, userSessions, companyInn) {
  userSessions[chatId] = userSessions[chatId] || {}
  if (!userSessions[chatId].complaintDetails) {
    userSessions[chatId].complaintDetails = []
  }

  // ЭТАП 0 - ввод номера заказа *********************************************************************************************
  if (!userSessions[chatId].awaitingComplaintNewArrange) {
    userSessions[chatId].awaitingComplaintNewArrange = 0.5
    //await bot.sendMessage(chatId, 'Введите номер заказа 1С', keyboardCancel)

    if (!userSessions[chatId].selectedYear || userSessions[chatId].selectedYear != '2025') {
      // Устанавливаем год по умолчанию
      userSessions[chatId].selectedYear = 'bd_2025_years'.split('_')[1]
    }

    const message = await bot.sendMessage(
      chatId,
      `Введите номер заказа 1С (${userSessions[chatId].selectedYear}г.), либо выберите год заказа, если он был сделан ранее.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '2024', callback_data: 'bd_2024_years' },
              { text: '2023', callback_data: 'bd_2023_years' },
              { text: '2022', callback_data: 'bd_2022_years' },
              { text: '2021', callback_data: 'bd_2021_years' },
            ],
            [{ text: '❌ Отмена', callback_data: '/cancel' }],
          ],
        },
      }
    )
    userSessions[chatId].messageId = message.message_id

    return
  }

  if (userSessions[chatId].awaitingComplaintNewArrange === 0.5) {
    userSessions[chatId].awaitingComplaintNewArrange = 1

    // Проверяем, существует ли msg и можно ли его разбить
    if (msg && typeof msg === 'string' && msg.includes('_')) {
      const parts = msg.split('_')
      if (parts.length > 1) {
        userSessions[chatId].selectedYear = parts[1]
      } else {
        userSessions[chatId].selectedYear = 'bd_2025_years'.split('_')[1]
      }
    } else {
      userSessions[chatId].selectedYear = 'bd_2025_years'.split('_')[1]
    }

    const message = await bot.sendMessage(
      chatId,
      `Введите номер заказа 1С (${userSessions[chatId].selectedYear}г.)`,
      keyboardCancel
    )

    userSessions[chatId].messageId = message.message_id

    return
  }

  // ЭТАП 1 - проверка номера заказа и вывод изделий **************************************************************************
  if (userSessions[chatId].awaitingComplaintNewArrange === 1) {
    if (!userSessions[chatId].getOrderItems1C) {
      //const orderItems = await getOrderItems1C(msg.text);
      const orderItemsAW = await getOrderItemsAW(
        msg.text,
        companyInn,
        userSessions[chatId].selectedYear
      )
      userSessions[chatId].OrderNo = msg.text
      // Проверка на наличие изделий
      if (!orderItemsAW || !orderItemsAW.result || orderItemsAW.result.length === 0) {
        await bot.sendMessage(chatId, 'Не удалось найти изделия по данному номеру заказа.')
        await bot.deleteMessage(chatId, userSessions[chatId].messageId)
        handleCancel(bot, chatId, userSessions)
        return // Завершить процесс, если изделий нет
      }
      await bot.deleteMessage(chatId, userSessions[chatId].messageId)

      // Преобразуем результат в массив строк
      const itemNames = orderItemsAW.result.map((item) => item.NAME)

      console.log(itemNames)

      userSessions[chatId].complaintDetailsAllItem = itemNames
    }
    userSessions[chatId].getOrderItems1C = false

    const existingItems = userSessions[chatId].complaintDetails.map((detail) => detail.item)
    const availableItems = userSessions[chatId].complaintDetailsAllItem.filter(
      (item) => !existingItems.includes(item)
    )

    // Создание кнопок для каждого наименования заказа
    const keyboard = availableItems.map((item) => [{ text: item, callback_data: item }])
    const options = {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }

    const message = await bot.sendMessage(chatId, 'Выберите изделие из заказа:', options)
    userSessions[chatId].awaitingComplaintNewArrange = 2
    userSessions[chatId].messageId = message.message_id
  }

  // ЭТАП 2 получения наименования изделия от Дилера ***************************************************************************
  if (userSessions[chatId].awaitingComplaintNewArrange === 2) {
    const orderItems = userSessions[chatId].complaintDetailsAllItem || []

    if (orderItems.includes(msg)) {
      const itemWithIcon = `🔹 ${msg}`
      userSessions[chatId].complaintDetails.push({
        item: itemWithIcon, // Наименование изделия
        parts: [], // Изначально пустой массив для частей
      })
      /* await bot.sendMessage(
        chatId,
        `Изделие "${msg}" добавлено в список жалоб.`
      )*/
      // Удаляем сообщение с кнопками
      await bot.deleteMessage(chatId, userSessions[chatId].messageId)
      userSessions[chatId].awaitingComplaintNewArrange = 3
    }
  }

  // ЭТАП 3 - Суть обращения
  if (
    userSessions[chatId].awaitingComplaintNewArrange === 3 &&
    !userSessions[chatId].stageComplaint3
  ) {
    // тут надо добавить флаг, так как всегда даже после выбоора идет сюда
    userSessions[chatId].stageComplaint3 = true
    const partsMenu = [
      { text: 'Рама', callback_data: 'Рама' },
      { text: 'Створка', callback_data: 'Створка' },
      { text: 'Импост', callback_data: 'Импост' },
      { text: 'Заполнение', callback_data: 'Заполнение' },
      { text: 'Фурнитура', callback_data: 'Фурнитура' },
      { text: 'Комплектующие', callback_data: 'Комплектующие' }, // Логика для комплектующих
      { text: 'Доставка', callback_data: 'Доставка' },
    ]

    const keyboard = partsMenu.map((reason) => [reason])
    const options = {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }

    const message = await bot.sendMessage(chatId, 'Выберите суть обращения:', options)
    userSessions[chatId].messageId = message.message_id
    //   await bot.sendMessage(chatId, `Выбрано: ${msg}`)

    return
  }
  // ЭТАП 3, ЧАСТЬ 2
  const validParts = [
    'Рама',
    'Створка',
    'Импост',
    'Заполнение',
    'Фурнитура',
    'Комплектующие',
    'Доставка',
  ]
  if (
    userSessions[chatId].stageComplaint3 &&
    userSessions[chatId].awaitingComplaintNewArrange === 3 &&
    validParts.includes(msg)
  ) {
    const currentIndex = userSessions[chatId].complaintDetails.length - 1 // Получаем последний индекс добавленного изделия
    const currentComplaint = userSessions[chatId].complaintDetails[currentIndex]
    // Проверяем, существует ли часть
    const existingPart = currentComplaint.parts.find((part) => part.name === msg)
    if (!existingPart) {
      // Если части нет, добавляем новую с пустым массивом reasons
      currentComplaint.parts.push({ name: msg, reasons: [] })
      await bot.deleteMessage(chatId, userSessions[chatId].messageId)
      userSessions[chatId].awaitingComplaintNewArrange = 4
      userSessions[chatId].stageComplaint3 = false
      // await bot.sendMessage(chatId, `Часть "${msg}" добавлена.  `)
    }
  }

  // ЭТАП 4 - Суть обращения
  if (userSessions[chatId].awaitingComplaintNewArrange === 4) {
    let reasonsMenu = []
    const validReasons = [
      'Недовоз',
      'Некомплект',
      'Брак материала',
      'Опоздание',
      'Персонал',
      'Бой/скол/лопина',
      'Царапины/пузыри',
      'Разгерметизация/Запотевание',
      'Мусор/Герметик/Разводы',
      'Раскладка/Фальш',
      'Не соответствует формула',
      'Лопина/скол',
      'Царапина',
      'Щель',
      'Поломка',
    ]
    if (msg === 'Рама' || msg === 'Створка') {
      reasonsMenu = [
        { text: 'Лопина/скол', callback_data: 'Лопина/скол' },
        { text: 'Царапина', callback_data: 'Царапина' },
      ]
    } else if (msg === 'Импост') {
      reasonsMenu = [
        { text: 'Лопина/скол', callback_data: 'Лопина/скол' },
        { text: 'Царапина', callback_data: 'Царапина' },
        { text: 'Щель', callback_data: 'Щель' },
      ]
    } else if (msg === 'Фурнитура') {
      reasonsMenu = [
        { text: 'Недовоз', callback_data: 'Недовоз' },
        { text: 'Некомплект', callback_data: 'Некомплект' },
        { text: 'Поломка', callback_data: 'Поломка' },
      ]
    } else if (msg === 'Заполнение') {
      reasonsMenu = [
        { text: 'Бой/скол/лопина', callback_data: 'Бой/скол/лопина' },
        { text: 'Царапины/пузыри', callback_data: 'Царапины/пузыри' },
        { text: 'Недовоз', callback_data: 'Недовоз' },
        {
          text: 'Разгерметизация/Запотевание',
          callback_data: 'Разгерметизация/Запотевание',
        },
        {
          text: 'Мусор/Герметик/Разводы',
          callback_data: 'Мусор/Герметик/Разводы',
        },
        { text: 'Раскладка/Фальш', callback_data: 'Раскладка/Фальш' },
        {
          text: 'Не соответствует формула',
          callback_data: 'Не соответствует формула',
        },
      ]
    } else if (msg === 'Комплектующие') {
      reasonsMenu = [
        { text: 'Недовоз', callback_data: 'Недовоз' },
        { text: 'Некомплект', callback_data: 'Некомплект' },
        { text: 'Брак материала', callback_data: 'Брак материала' },
      ]
    } else if (msg === 'Доставка') {
      reasonsMenu = [
        { text: 'Опоздание', callback_data: 'Опоздание' },
        { text: 'Персонал', callback_data: 'Персонал' },
      ]
    }

    if (!userSessions[chatId].stageComplaint4) {
      const keyboard = reasonsMenu.map((reason) => [reason])
      const options = {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      }

      const messageReasons = await bot.sendMessage(
        chatId,
        'Выберите обнаруженный недостаток:',
        options
      )

      userSessions[chatId].messageId = messageReasons.message_id
      userSessions[chatId].stageComplaint4 = true
    }

    if (validReasons.includes(msg) && userSessions[chatId].stageComplaint4) {
      const lastComplaintDetail =
        userSessions[chatId].complaintDetails[userSessions[chatId].complaintDetails.length - 1]
      if (lastComplaintDetail) {
        const lastPart = lastComplaintDetail.parts[lastComplaintDetail.parts.length - 1]

        if (lastPart) {
          lastPart.reasons.push(msg)
          await bot.deleteMessage(chatId, userSessions[chatId].messageId)
          userSessions[chatId].stageComplaint4 = false
          // await bot.sendMessage(chatId, `Недостаток "${msg}" добавлен.`)
          userSessions[chatId].awaitingComplaintNewArrange = 5
        }
      }
    }

    console.log(
      'Части до добавления:',
      JSON.stringify(userSessions[chatId].complaintDetails, null, 2)
    )
  }

  // ЭТАП 5 - Поэтапное возвращения для добавления новых элементов в объект
  if (userSessions[chatId].awaitingComplaintNewArrange === 5) {
    // Отправляем информацию о жалобах
    if (!userSessions[chatId].stageComplaint5) {
      const complaintSummary = formatComplaintDetails(userSessions[chatId].complaintDetails)
      if (userSessions[chatId].lastComplaintSummaryMessageId) {
        try {
          await bot.deleteMessage(chatId, userSessions[chatId].lastComplaintSummaryMessageId)
        } catch (error) {
          console.error('Ошибка при удалении предыдущего сообщения:', error)
        }
      }
      const massageObject = await bot.sendMessage(chatId, complaintSummary)
      userSessions[chatId].lastComplaintSummaryMessageId = massageObject.message_id

      const stageMenu = [
        { text: '➕ Добавить недостаток', callback_data: 'add_reason' },
        {
          text: '➕ Добавить новый объект жалобы к изделию',
          callback_data: 'add_part',
        },
        { text: '➕ Добавить новое изделие', callback_data: 'add_item' },
        {
          text: '➡️ Завершить и продолжить ➡️',
          callback_data: 'complaint_next',
        },
        {
          text: '❌ Отмена',
          callback_data: '/cancel',
        },
      ]

      const keyboard = stageMenu.map((reason) => [reason])
      const options = {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      }

      const messageStageMenu = await bot.sendMessage(chatId, 'Дальнейшие действия:', options)
      userSessions[chatId].messageStageMenu = messageStageMenu.message_id
      userSessions[chatId].stageComplaint5 = true
    }

    switch (msg) {
      case 'add_reason':
        userSessions[chatId].awaitingComplaintNewArrange = 4
        userSessions[chatId].stageComplaint5 = false
        await bot.deleteMessage(chatId, userSessions[chatId].messageStageMenu)
        // Получаем последний объект из complaintDetails
        const lastComplaintDetail =
          userSessions[chatId].complaintDetails[userSessions[chatId].complaintDetails.length - 1]
        // Получаем последние добавленные части (если они существуют)
        const lastPart = lastComplaintDetail.parts[lastComplaintDetail.parts.length - 1]
        return handleComplaintNewArrange(
          bot,
          chatId,
          lastPart.name, // крайняя выбранная часть изделия
          userSessions,
          companyInn
        )
      case 'add_part':
        userSessions[chatId].awaitingComplaintNewArrange = 3
        userSessions[chatId].stageComplaint5 = false
        await bot.deleteMessage(chatId, userSessions[chatId].messageStageMenu)
        return handleComplaintNewArrange(bot, chatId, msg, userSessions, companyInn)

      case 'add_item':
        userSessions[chatId].awaitingComplaintNewArrange = 1
        userSessions[chatId].getOrderItems1C = true
        userSessions[chatId].stageComplaint5 = false
        await bot.deleteMessage(chatId, userSessions[chatId].messageStageMenu)
        return handleComplaintNewArrange(bot, chatId, msg, userSessions, companyInn)

      case 'complaint_next':
        await bot.deleteMessage(chatId, userSessions[chatId].lastComplaintSummaryMessageId)
        await bot.deleteMessage(chatId, userSessions[chatId].messageStageMenu)
        return handleComplaintReport(bot, chatId, userSessions)

      case '/cancel':
        await bot.deleteMessage(chatId, userSessions[chatId].lastComplaintSummaryMessageId)
        await bot.deleteMessage(chatId, userSessions[chatId].messageStageMenu)
        await handleCancel(bot, chatId, userSessions) // Вызов функции отмены
        break
    }
  }

  //*** */
  //*** */
  // Запрос в 1С *** принимает
  /* async function getOrderItems1C(msg) {
    if (msg) {
      userSessions[chatId].OrderNo = msg
      return ['Изделие-1', 'Изделие-2', 'Изделие-3']
    }
  }*/

  function formatComplaintDetails(complaintDetails) {
    let message = '✉️ Ваши жалобы:\n\n' // Начало сообщения

    complaintDetails.forEach((detail) => {
      message += ` 🛠️ Изделие: *${detail.item}*\n` // Используем курсив для названия изделия

      detail.parts.forEach((part) => {
        message += `    Объект жалобы: *${part.name}*\n`
        message += `      Недостаток:\n`
        part.reasons.forEach((reason) => {
          message += `      - ${reason}\n` // Добавление каждой причины
        })
      })

      message += '\n' // Разделение между изделиями
    })

    return message // Возвращение сформированного сообщения
  }
}

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Информация о поданных рекламациях (complaint_existing) ************************************************************************
async function handleComplaintInfo(bot, chatId, userSessions, companyInn) {
  userSessions[chatId] = userSessions[chatId] || {}

  const sScan = `V6R${companyInn}`
  const response = await sendRequest1C(sScan)

  if (response) {
    await bot.sendMessage(chatId, response)
    await handleCancel(bot, chatId, userSessions)
  } else {
    await bot.sendMessage(chatId, 'Нет данных для отображения.')
    await handleCancel(bot, chatId, userSessions)
  }
}

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Сообщить о проблеме без оформления рекламации (complaint_report_problem) ************************************************************************

// Начало, просьба ввести данные рекламации #1
async function handleComplaintReport(bot, chatId, userSessions) {
  userSessions[chatId] = userSessions[chatId] || {}
  userSessions[chatId].awaitingComplaint = true

  await bot.sendMessage(
    chatId,
    'Введите информацию о рекламации. Укажите что именно произошло, какие требования по рекламации?'
  )
}

// Отправка текста рекламации, фото или документа #2
async function handleAwaitingComplaint(bot, chatId, msg, userSessions) {
  userSessions[chatId] = userSessions[chatId] || {}

  if (!userSessions[chatId].associatedTexts) {
    userSessions[chatId].associatedTexts = []
  }
  if (!userSessions[chatId].fileIds) {
    userSessions[chatId].fileIds = []
  }
  if (!userSessions[chatId].photoIds) {
    userSessions[chatId].photoIds = []
  }

  if (msg.text) {
    if (msg.text.toLowerCase() === 'готово') {
      await finalizeCalculation(chatId, userSessions, bot)
      return
    }

    // Удаление предыдущего сообщения о сохраненном тексте, если оно есть
    if (userSessions[chatId].lastTextMessageId) {
      try {
        await bot.deleteMessage(chatId, userSessions[chatId].lastTextMessageId)
      } catch (error) {
        console.error(`Не удалось удалить предыдущее сообщение в тексте: ${error.message}`)
      }
    }

    // Сохранение текста и отправка нового сообщения
    userSessions[chatId].associatedTexts.push(msg.text)
    const message = await bot.sendMessage(
      chatId,
      'Текст сохранен! Если необходимо отправить дополнительную информацию, вы можете сделать это в настоящей сессии, либо закончите сессию, нажав кнопку - "ГОТОВО".',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'ГОТОВО', callback_data: 'finish_complaint_report' }, // Кнопка "ГОТОВО"
            ],
            [{ text: '❌ Отмена', callback_data: '/cancel' }],
          ],
        },
      }
    )

    // Сохраняем идентификатор нового сообщения о сохраненном тексте
    userSessions[chatId].lastTextMessageId = message.message_id
    return
  }

  // Обработка документа
  if (msg.document) {
    if (msg.caption) {
      const captionText = `Комментарий к документу: [${msg.caption}]`
      userSessions[chatId].associatedTexts.push(captionText)
    }

    userSessions[chatId].fileIds.push(msg.document.file_id)
    // Удаление предыдущего сообщения о полученном документе, если оно есть
    if (userSessions[chatId].lastDocumentMessageId) {
      try {
        await bot.deleteMessage(chatId, userSessions[chatId].lastDocumentMessageId)
      } catch (error) {
        console.error(`Не удалось удалить предыдущее сообщение о документе: ${error.message}`)
      }
    }

    const message = await bot.sendMessage(
      chatId,
      'Документ получен! Если необходимо отправить дополнительную информацию, вы можете сделать это в настоящей сессии, либо закончите сессию, нажав кнопку - "ГОТОВО".',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'ГОТОВО', callback_data: 'finish_complaint_report' }, // Кнопка "ГОТОВО"
            ],
          ],
        },
      }
    )

    // Сохраняем идентификатор нового сообщения о полученном документе
    userSessions[chatId].lastDocumentMessageId = message.message_id
    return
  }

  // Обработка фотографии
  if (msg.photo) {
    if (msg.caption) {
      const captionText = `Комментарий к изображению: [${msg.caption}]`
      userSessions[chatId].associatedTexts.push(captionText)
    }
    let maxPhoto = msg.photo.reduce((prev, current) =>
      prev.height > current.height ? prev : current
    )
    userSessions[chatId].photoIds.push(maxPhoto.file_id)
    // Удаление предыдущего сообщения о полученном фото, если оно есть
    if (userSessions[chatId].lastPhotoMessageId) {
      try {
        await bot.deleteMessage(chatId, userSessions[chatId].lastPhotoMessageId)
      } catch (error) {
        console.error(`Не удалось удалить предыдущее сообщение о фото: ${error.message}`)
      }
    }

    const message = await bot.sendMessage(
      chatId,
      'Фото получено! Если необходимо отправить дополнительную информацию, вы можете сделать это в настоящей сессии, либо закончите сессию, нажав кнопку - "ГОТОВО".',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'ГОТОВО', callback_data: 'finish_complaint_report' }, // Кнопка "ГОТОВО"
            ],
            [{ text: '❌ Отмена', callback_data: '/cancel' }],
          ],
        },
      }
    )

    // Сохраняем идентификатор нового сообщения о полученном фото
    userSessions[chatId].lastPhotoMessageId = message.message_id
    return
  }

  // Если ничего не подходит
  await bot.sendMessage(chatId, 'Пожалуйста, отправьте текст, документ или фото.')
}

// #3
async function handleComplaintReportProblem(chatId, userSessions, bot) {
  const sessionData = userSessions[chatId]
  let userId
  // Получаем userId, используя вынесенную функцию
  if (userSessions[chatId]?.awaitingComplaintNewArrange === 5) {
    const complaintDetails = userSessions[chatId].complaintDetails
    const OrderNo = userSessions[chatId].OrderNo
    userId = await getMppByCompany(sessionData.companyId)
    isRegistration = ''

    const formattedComplaintDetails = complaintDetails
      .map(({ item, parts }) => {
        const partsDetails = parts
          .map((part) => {
            const reasonsList = part.reasons.join(', ')
            return `  - ${part.name}: ${reasonsList}`
          })
          .join('\n')

        return `${item}:\n${partsDetails}`
      })
      .join('\n')

    textCalc =
      sessionData.associatedTexts.join('\n') +
      '\n' +
      'Заказ № ' +
      OrderNo +
      '\n' +
      formattedComplaintDetails
  } else {
    userId = await getNokOrMppByCompany(sessionData.companyId)
    textCalc = sessionData.associatedTexts.join('\n') // Сохраняем текст расчета
    isRegistration = 'без ее оформления'
  }

  const fileLinks = await Promise.all(
    sessionData.fileIds.map(async (fileId) => {
      const fileLink = await bot.getFile(fileId)
      return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`
    })
  )

  const photoLinks = await Promise.all(
    sessionData.photoIds.map(async (photoId) => {
      const fileLink = await bot.getFile(photoId)
      return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`
    })
  )

  const allLinks = [...fileLinks, ...photoLinks]
  tags = [
    { title: '🔴СРОЧНО', ...getRandomColors() },
    { title: 'Telegram', ...getRandomColors() },
  ]

  try {
    //  для создания напоминания НОК
    await createReminder({
      newRecordId: -1,
      userId,
      textCalc: textCalc,
      typeReminders: 'complaint_report_problem',
      priority: 'высокий',
      title: `Сообщение о рекламации ${isRegistration} *${
        userSessions[chatId].companyName
      }*. Пользователь tg: (id:${chatId}) ${sessionData.userName ? sessionData.userName : ''}`,
      tags: tags,
      links: allLinks,
    })

    await bot.sendMessage(chatId, '✅ Запрос отправлен и находится в обработке!')
    await bot.sendMessage(chatId, textCalc)
    handleCancel(bot, chatId, userSessions)
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

module.exports = {
  handleComplaint,
  handleComplaintReportProblem,
  handleComplaintReport,
  handleAwaitingComplaint,
  handleComplaintInfo,
  handleComplaintNewArrange,
}
