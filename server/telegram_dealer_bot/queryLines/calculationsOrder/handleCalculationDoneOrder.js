const dbPool = require('../../database/db')
const {
  createReminder,
  getMppByCompany,
  getTotalPriceOrderAW,
} = require('../../helpers/api')
const { getRandomColors } = require('../../helpers/getRandomColors')
const { handleCancel } = require('../../helpers/buttonCancel')
const { keyboardCancel, deleteLastMessage } = require('../../helpers/utils.js')
const { displayHelpMenu } = require('../../helpers/helpMenu.js')

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Подтвердить в работу **************************************************************************
async function handleCalculationDoneOrder(
  bot,
  chatId,
  userSessions,
  msg,
  companyInn
) {
  userSessions[chatId] = userSessions[chatId] || {}
  if (!userSessions[chatId].calculationDoneOrder) {
    userSessions[chatId].calculationDoneOrder = []
  }

  // ЭТАП 0 - ввод номера заказа АВ *********************************************************************************************
  if (!userSessions[chatId].awaitingCalculationDoneOrder) {
    await deleteLastMessage(bot, chatId, userSessions)
    userSessions[chatId].awaitingCalculationDoneOrder = 1
    await bot.sendMessage(chatId, 'Введите номер расчета из Альтавина')
    return
  }

  // ЭТАП 1 - проверка номера заказа и вывод изделий **************************************************************************
  if (userSessions[chatId].awaitingCalculationDoneOrder === 1) {
    response = ''
    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '✅ Да',
            callback_data: `confirm_price_order_aw`, // Этап 3
          },
          {
            text: '❌ Нет',
            callback_data: `cancel_price_order_aw`, // Этап 2
          },
        ],
        [
          {
            text: '⛔️ Отмена', // Длинная кнопка отмены
            callback_data: `cancel`,
          },
        ],
      ],
    }

    try {
      if (msg.text) {
        text = msg.text
        isButton = false
      } else {
        text = msg
        isButton = true
      }

      const response = await getTotalPriceOrderAW(
        text.replace(/^0+/, ''),
        companyInn,
        isButton
      )

      if (Array.isArray(response) && response.length > 1) {
        console.log('Полученные заказы:\n', response) // Логируем список заказов

        // Создание кнопок для каждого заказа
        const orderButtons = response.map((order) => [
          {
            text: `Заказ номер: ${order.ORDERNO}, Цена: ${order.TOTALPRICE}р.`,
            callback_data: order.ORDERNO, // Полное наименование заказа в callback_data
          },
        ])
        const orderButtonss = response.map((order) => {
          console.log(
            'Полное наименование заказа в callback_data',
            order.ORDERNO
          )
        })

        const finalReplyMarkup = {
          inline_keyboard: [
            ...orderButtons, // Добавляем кнопки с заказами
            [
              {
                text: '⛔️ Отмена', // Длинная кнопка отмены
                callback_data: `cancel`,
              },
            ],
          ],
        }

        await bot.sendMessage(chatId, `Найдено несколько заказов:`, {
          reply_markup: finalReplyMarkup,
        })
        return
      } else {
        if (msg.text) {
          userSessions[chatId].msgOrerNo = msg.text
        } else {
          userSessions[chatId].msgOrerNo = msg
        }

        userSessions[chatId].orerPrice = response.totalPrice
        const message = `Цена заказа составляет: ${response.totalPrice}р. Подтвердить сумму?`
        const messageMarkup = await bot.sendMessage(chatId, message, {
          reply_markup: replyMarkup,
        })
        userSessions[chatId].messageId = messageMarkup.message_id
        userSessions[chatId].awaitingCalculationDoneOrder = 0
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.error('Ошибка: Заказ не найден!')
        bot.sendMessage(chatId, 'Ошибка: Заказ не найден!')
        handleCancel(bot, chatId, userSessions)
      } else {
        console.error('Ошибка:', error)
        handleCancel(bot, chatId, userSessions)
      }
    }

    return
  }

  // ЭТАП 3 - Кнопка - ДА Через команду **************************************************************************
  if (userSessions[chatId].awaitingCalculationDoneOrder === 3) {
    await bot.deleteMessage(chatId, userSessions[chatId].messageId)
    userSessions[chatId].awaitingCalculationDoneOrder = 4
    await bot.sendMessage(
      chatId,
      'Введите адрес (Регион, Город, Улица, Дом)',
      keyboardCancel
    )
    return
  }
  // ЭТАП 4 **************************************************************************
  if (userSessions[chatId].awaitingCalculationDoneOrder === 4) {
    userSessions[chatId].adress = msg.text
    userSessions[chatId].awaitingCalculationDoneOrder = 5
    await bot.sendMessage(
      chatId,
      'Введите контактный телефон для службы логистики ',
      keyboardCancel
    )
    return
  }

  // ЭТАП 5 **************************************************************************
  if (userSessions[chatId].awaitingCalculationDoneOrder === 5) {
    const sessionData = userSessions[chatId]
    userSessions[chatId].telephone = msg.text

    userId = await getMppByCompany(sessionData.companyId)
    const textCalc = `При проверки заказа ${userSessions[chatId].msgOrerNo} в Альтавине дилер подтверждает указанную сумму заказа ${userSessions[chatId].orerPrice} р и оставляет контактные данные.
    Телефон для связи: ${userSessions[chatId].telephone}.
    Адрес: ${userSessions[chatId].adress}.
    Необходимо связаться для определения свободной даты!`
    tags = [
      { title: '🔴СРОЧНО', ...getRandomColors() },
      { title: 'Telegram', ...getRandomColors() },
    ]

    try {
      //  для создания напоминания МПП
      await createReminder({
        newRecordId: -1,
        userId,
        textCalc: textCalc,
        typeReminders: 'calculation',
        priority: 'высокий',
        title: `Дилер *${
          userSessions[chatId].companyName
        }* ПОДТВЕРДИЛ СТОИМОСТЬ ЗАКАЗА. Пользователь tg: (id:${chatId}) ${
          sessionData.userName ? sessionData.userName : ''
        }`,
        tags: tags,
        links: [],
      })

      await bot.sendMessage(
        chatId,
        '✅ Запрос отправлен и находится в обработке!'
      )
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

  // ЭТАП 2 - Кнопка - НЕТ Через команду **************************************************************************
  if (userSessions[chatId].awaitingCalculationDoneOrder === 2) {
    await bot.deleteMessage(chatId, userSessions[chatId].messageId)
    const sessionData = userSessions[chatId]
    userId = await getMppByCompany(sessionData.companyId)
    const textCalc = `При проверки заказа ${userSessions[chatId].msgOrerNo} в Альтавине дилер не подтверждает указанную сумму заказа ${userSessions[chatId].orerPrice} р.`
    tags = [
      { title: '🔴СРОЧНО', ...getRandomColors() },
      { title: 'Telegram', ...getRandomColors() },
    ]

    try {
      //  для создания напоминания МПП
      await createReminder({
        newRecordId: -1,
        userId,
        textCalc: textCalc,
        typeReminders: 'calculation',
        priority: 'высокий',
        title: `Дилер *${
          userSessions[chatId].companyName
        }* НЕ ПОДТВЕРДИЛ СТОИМОСТЬ ЗАКАЗА. Пользователь tg: (id:${chatId}) ${
          sessionData.userName ? sessionData.userName : ''
        }`,
        tags: tags,
        links: [],
      })

      await bot.sendMessage(
        chatId,
        '✅ Запрос отправлен и находится в обработке!'
      )
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
}

module.exports = {
  handleCalculationDoneOrder,
}
