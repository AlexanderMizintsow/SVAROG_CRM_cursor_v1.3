//calculationsOrder.js
const dbPool = require('../../database/db')
const { displayHelpMenu } = require('../../helpers/helpMenu')
const { getRandomColors } = require('../../helpers/getRandomColors')
const {
  getMppByCompany,
  getMprByCompany,
  createReminder,
} = require('../../helpers/api')
const { keyboardCancel, deleteLastMessage } = require('../../helpers/utils.js')

async function handleCalculations(bot, chatId, userSessions, companyInn) {
  userSessions[chatId] = userSessions[chatId] || {}

  // Удаляем предыдущее сообщение при выборе расчета
  await deleteLastMessage(bot, chatId, userSessions)

  const inlineKeyboard = [
    [
      { text: '➕ Новый расчет', callback_data: '/new_calculation' },
      {
        text: '✏️ Изменения в расчете',
        callback_data: '/editing_calculation',
      },
    ],
  ]

  // Если companyInn не пустой, добавляем кнопку "Подтвердить в работу"
  if (companyInn) {
    inlineKeyboard.splice(2, 0, [
      {
        text: '✅ Подтвердить в работу',
        callback_data: '/editing_calculation_done_order',
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
//**************************************************************** Новый расчет *************************************************************************/
async function handleNewCalculation(bot, chatId, userSessions) {
  userSessions[chatId] = userSessions[chatId] || {}
  userSessions[chatId].awaitingCalculation = true
  await deleteLastMessage(bot, chatId, userSessions)

  const message = await bot.sendMessage(
    chatId,
    'Пожалуйста, введите текст расчета или отправьте документ (📁) / фото (📸).',
    keyboardCancel
  )

  userSessions[chatId].lastMessageId = message.message_id
}

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Редактирование расчета **************************************************************************
async function handleEditingCalculation(bot, chatId, userSessions) {
  userSessions[chatId] = userSessions[chatId] || {}
  userSessions[chatId].awaitingCalculationEdite = true
  await deleteLastMessage(bot, chatId, userSessions)
  await bot.sendMessage(chatId, 'Введите номер рассчета.', keyboardCancel)
}

async function handleAwaitingCalculation(bot, chatId, msg, userSessions) {
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

  if (userSessions[chatId].awaitingCalculationEdite) {
    if (msg.text) {
      userSessions[chatId].calculationNumber = msg.text // Сохраняем номер расчета
      userSessions[chatId].importance = 'hight'
      userSessions[chatId].awaitingCalculationEdite = false // Сбрасываем флаг ожидания редактирования
      await bot.sendMessage(
        chatId,
        `Номер расчета "${msg.text}" сохранен. Теперь отправьте текст, документ или фото.`,
        keyboardCancel
      )
      userSessions[chatId].awaitingCalculation = true // Устанавливаем ожидание для следующего ввода
      return
    }
  }

  if (msg.text) {
    if (msg.text.toLowerCase() === 'готово') {
      await deleteLastMessage(bot, chatId, userSessions)
      await finalizeCalculation(chatId, userSessions, bot)
      return
    }

    // Удаление предыдущего сообщения о сохраненном тексте, если оно есть
    if (userSessions[chatId].lastTextMessageId) {
      try {
        await bot.deleteMessage(chatId, userSessions[chatId].lastTextMessageId)
      } catch (error) {
        console.error(
          `Не удалось удалить предыдущее сообщение о тексте: ${error.message}`
        )
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
              { text: 'ГОТОВО', callback_data: 'finish_calc' }, // Кнопка "ГОТОВО"
            ],
            [{ text: '❌ Отмена', callback_data: '/cancel' }],
          ],
        },
      }
    )

    // Сохраняем идентификатор нового сообщения о сохраненном тексте
    userSessions[chatId].lastMessageId = message.message_id
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
        await bot.deleteMessage(
          chatId,
          userSessions[chatId].lastDocumentMessageId
        )
      } catch (error) {
        console.error(
          `Не удалось удалить предыдущее сообщение о документе: ${error.message}`
        )
      }
    }

    await bot.deleteMessage(chatId, userSessions[chatId].lastMessageId)

    const message = await bot.sendMessage(
      chatId,
      'Документ получен! Если необходимо отправить дополнительную информацию, вы можете сделать это в настоящей сессии, либо закончите сессию, нажав кнопку - "ГОТОВО".',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'ГОТОВО', callback_data: 'finish_calc' }, // Кнопка "ГОТОВО"
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
    //  console.log(msg.caption)

    let maxPhoto = msg.photo.reduce((prev, current) =>
      prev.height > current.height ? prev : current
    )
    userSessions[chatId].photoIds.push(maxPhoto.file_id)
    // Удаление предыдущего сообщения о полученном фото, если оно есть
    if (userSessions[chatId].lastPhotoMessageId) {
      try {
        await bot.deleteMessage(chatId, userSessions[chatId].lastPhotoMessageId)
      } catch (error) {
        console.error(
          `Не удалось удалить предыдущее сообщение о фото: ${error.message}`
        )
      }
    }

    const message = await bot.sendMessage(
      chatId,
      'Фото получено! Если необходимо отправить дополнительную информацию, вы можете сделать это в настоящей сессии, либо закончите сессию, нажав кнопку - "ГОТОВО".',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'ГОТОВО', callback_data: 'finish_calc' }, // Кнопка "ГОТОВО"
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
  await bot.sendMessage(
    chatId,
    'Пожалуйста, отправьте текст, документ или фото.'
  )
}

async function finalizeCalculation(chatId, userSessions, bot) {
  const sessionData = userSessions[chatId]
  console.log(sessionData)
  if (('sessionData', sessionData)) {
    try {
      // Получаем userId, используя вынесенную функцию
      const userId = await getMprByCompany(sessionData.companyId)

      // Вставляем данные в таблицу
      const {
        id: newRecordId,
        fileLinks,
        photoLinks,
      } = await insertCalculationData(
        chatId,
        sessionData.companyId,
        sessionData,
        bot
      )

      const textCalc = sessionData.associatedTexts.join('\n') // Сохраняем текст расчета
      const allLinks = [...fileLinks, ...photoLinks]
      calcNumber = ''
      priority = 'средний'
      tags = [{ title: 'Telegram', ...getRandomColors() }]

      if (userSessions[chatId].calculationNumber) {
        calcNumber = `по заказу ${userSessions[chatId].calculationNumber}`
        priority = 'высокий'
        tags = [
          { title: '🔴СРОЧНО', ...getRandomColors() },
          { title: 'Telegram', ...getRandomColors() },
        ]
      }
      const typeReminders = 'calculation'

      //  для создания напоминания
      await createReminder({
        newRecordId,
        userId,
        textCalc,
        typeReminders,
        priority,
        title: `Расчет заказа *${
          userSessions[chatId].companyName
        }* ${calcNumber}. Пользователь tg: (id:${chatId}) ${
          sessionData.userName ? sessionData.userName : ''
        }`,
        tags,
        links: allLinks,
      })

      // Завершаем сессию
      console.log(chatId)
      console.log(userSessions[chatId].userName)
      //console.log(userSessions[chatId].userName1)

      userSessions[chatId].importance = 'normal'
      userSessions[chatId].associatedTexts = ''
      userSessions[chatId].fileIds = []
      userSessions[chatId].photoIds = []
      userSessions[chatId].awaitingCalculation = false
      delete userSessions[chatId].calculationNumber
      // delete userSessions[chatId]
      await bot.sendMessage(
        chatId,
        '✅ Сессия завершена. Ваш расчет успешно сохранен!'
      )
      displayHelpMenu(bot, chatId, userSessions)

      return true
    } catch (error) {
      console.error(`Ошибка при добавлении записи: ${error.message}`)
      await bot.sendMessage(
        chatId,
        'Произошла ошибка при сохранении данных. Пожалуйста, попробуйте снова.'
      )
    }
  }
  return false
}

//Запись в таблицу полученных данны Расчета
async function insertCalculationData(chatId, companyId, sessionData, bot) {
  const query = `
    INSERT INTO calculations_bot_dealers (
      chat_id, 
      company_id, 
      calculation_number, 
      importance, 
      text_calc, 
      file_paths, 
      photo_paths, 
      file_links, 
      photo_links
    ) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;
  `

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
  //console.log(sessionData)
  const values = [
    chatId,
    companyId,
    sessionData.calculationNumber || null, // Номер расчета
    sessionData.importance || 'normal', // Важность по умолчанию
    sessionData.associatedTexts.join('\n'), // Объединяем текстовые данные
    null, // sessionData.fileIds.join(','), // Пути ко всем файлам
    null, //sessionData.photoIds.join(','), // Пути к фото
    fileLinks.join(','), // Ссылки на документы
    photoLinks.join(','), // Ссылки на фотографии
  ]

  const result = await dbPool.query(query, values)

  return { id: result.rows[0].id, fileLinks, photoLinks }
}

module.exports = {
  handleCalculations,
  handleNewCalculation,
  handleEditingCalculation,
  handleAwaitingCalculation,
  finalizeCalculation,
}
