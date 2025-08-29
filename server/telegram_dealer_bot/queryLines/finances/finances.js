const {
  createReminder,
  getMppByCompany,
  sendRequest1C,
  getCompanyDataEGRUL,
} = require('../../helpers/api')
const { keyboardCancel, deleteLastMessage } = require('../../helpers/utils.js')
const { getRandomColors } = require('../../helpers/getRandomColors')
const { handleCancel } = require('../../helpers/buttonCancel')

async function handleFinances(bot, chatId, userSessions, companyInn) {
  userSessions[chatId] = userSessions[chatId] || {}
  // Удаляем предыдущее сообщение при выборе расчета
  await deleteLastMessage(bot, chatId, userSessions)

  const message = await bot.sendMessage(chatId, 'Выберите действие:', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🧾 Заказать бухгалтерскую сверку',
            callback_data: '/accounting_reconciliation',
          },
        ],
        [
          {
            text: '📈🔍 Узнать остаток на счете',
            callback_data: '/finances_remainder',
          },
        ],
        ...(companyInn
          ? [[{ text: '📝⏳ Выставить счет', callback_data: '/issue_invoice' }]]
          : []),
        /*   [
          {
            text: '📄📧 Отправить реквизиты на проверку',
            callback_data: '/add_holding',
          },
        ],*/
        [{ text: '❌ Отмена', callback_data: '/cancel' }],
      ],
    },
  })

  // Сохраняем идентификатор сообщения о расчетах
  userSessions[chatId] = userSessions[chatId] || {}
  userSessions[chatId].lastMessageId = message.message_id

  return message
}

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Отправить реквизиты на проверку (handleAddHolding) ************************************************************************
async function handleAddHolding(bot, chatId, msg, userSessions, companyInn) {
  userSessions[chatId] = userSessions[chatId] || {}
  userSessions[chatId].egrul || {}

  // Этап 0
  if (!userSessions[chatId].addHolding) {
    await bot.deleteMessage(chatId, userSessions[chatId].lastMessageId)
    userSessions[chatId].addHolding = 1
    const buttons = [[{ text: '❌ Отмена', callback_data: '/cancel' }]]
    const options = {
      reply_markup: {
        inline_keyboard: buttons,
      },
    }

    const message = await bot.sendMessage(
      chatId,
      'Введите ИНН добавляемого холдинга',
      options
    )

    userSessions[chatId].lastMessageId = message.message_id
    return
  }

  // Этап 1 Запрос по API, запрос КПП
  if (userSessions[chatId].addHolding === 1) {
    await bot.deleteMessage(chatId, userSessions[chatId]?.lastMessageId)
    //732104669694
    try {
      await getCompanyDataEGRUL(msg.text).then((data) => {
        userSessions[chatId].egrul = data
        console.log(userSessions[chatId].egrul.kpp)
      })
    } catch {
      await bot.sendMessage(chatId, 'Введен неверный ИНН')
      handleCancel(bot, chatId, userSessions)
    }

    if (userSessions[chatId].egrul.kpp === 'Не указано') {
      await bot.sendMessage(chatId, 'Введите КПП добавляемого холдинга')
    }
    userSessions[chatId].addHolding = 2
    return
  }

  // Этап 2 запрос расчетный счет(банк)
  if (userSessions[chatId].addHolding === 2) {
    userSessions[chatId].addHolding = 3
    userSessions[chatId].egrul.kpp = msg.text
    await bot.sendMessage(chatId, 'Введите расчетный счет(банк)')
    return
  }

  // Этап 3 запрос БИК
  if (userSessions[chatId].addHolding === 3) {
    userSessions[chatId].addHolding = 4
    userSessions[chatId].egrul.payment = msg.text
    await bot.sendMessage(chatId, 'Введите БИК')
    return
  }

  // Этап 4 запрос К/с
  if (userSessions[chatId].addHolding === 4) {
    userSessions[chatId].addHolding = 5
    userSessions[chatId].egrul.bic = msg.text
    await bot.sendMessage(chatId, 'Введите К/с')
    return
  }

  // Этап 5 запрос Главный бухгалтер
  if (userSessions[chatId].addHolding === 5) {
    userSessions[chatId].addHolding = 6
    userSessions[chatId].egrul.kc = msg.text
    await bot.sendMessage(chatId, 'Введите ФИО главного бухгалтера')
    return
  }

  // Этап 6 запрос Количество директоров за весь период
  if (userSessions[chatId].addHolding === 6) {
    userSessions[chatId].addHolding = 7
    userSessions[chatId].egrul.fullNameAccountant = msg.text
    await bot.sendMessage(
      chatId,
      'Введите количество директоров за весь период'
    )
    return
  }

  // Этап 7 запрос Цель приобретения окон
  if (userSessions[chatId].addHolding === 7) {
    userSessions[chatId].addHolding = 20
    userSessions[chatId].egrul.countDirectors = msg.text
    const buttons = [
      [
        { text: 'Перепродажа', callback_data: 'Перепродажа' },
        { text: 'Личное пользование', callback_data: 'Личное пользование' },
      ],
      [{ text: '❌ Отмена', callback_data: '/cancel' }],
    ]
    const options = {
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
    await bot.sendMessage(chatId, 'Цель приобретения окон?', options)
    return
  }

  // Этап 20 запрос ЭДО
  if (userSessions[chatId].addHolding === 20) {
    console.log(msg)
    if (msg === 'Сбис' || msg === 'Контур Диадок') {
      // ГОСТ (год) или ТУ
      userSessions[chatId].egrul.edo = msg
      await bot.sendMessage(chatId, 'Введите ГОСТ (год) или ТУ')
      userSessions[chatId].addHolding = 9
      return
    }
    if (msg === 'Другое') {
      await bot.sendMessage(chatId, 'Введите значение')

      userSessions[chatId].addHolding = 8
      return
    }

    userSessions[chatId].egrul.goal = msg
    const buttons = [
      [
        { text: 'Сбис', callback_data: 'Сбис' },
        { text: 'Контур Диадок', callback_data: 'Контур Диадок' },
        { text: 'Другое', callback_data: 'Другое' },
      ],
      [{ text: '❌ Отмена', callback_data: '/cancel' }],
    ]
    const options = {
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
    await bot.sendMessage(chatId, 'ЭДО', options)
    return
  }

  // Этап 8 запрос ГОСТ после выбора - Другое
  if (userSessions[chatId].addHolding === 8) {
    userSessions[chatId].egrul.edo = msg.text
    userSessions[chatId].addHolding = 9
    await bot.sendMessage(chatId, 'Введите ГОСТ (год) или ТУ')
    return
  }

  // Этап 9 запрос ГОСТ после выбора - Сбис Контур
  if (userSessions[chatId].addHolding === 9) {
    userSessions[chatId].addHolding = 21
    userSessions[chatId].egrul.gost = msg.text
    const buttons = [
      [
        { text: 'Да', callback_data: 'Да' },
        { text: 'Нет', callback_data: 'Нет' },
      ],
      [{ text: '❌ Отмена', callback_data: '/cancel' }],
    ]
    const options = {
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
    await bot.sendMessage(chatId, 'Нужен ли паспорт качества?', options)
    return
  }

  // Этап 21 Наличие доверенности
  if (userSessions[chatId].addHolding === 21) {
    userSessions[chatId].addHolding = 22
    userSessions[chatId].egrul.passport = msg
    const buttons = [
      [
        { text: 'Да', callback_data: 'Да' },
        { text: 'Нет', callback_data: 'Нет' },
      ],
      [{ text: '❌ Отмена', callback_data: '/cancel' }],
    ]
    const options = {
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
    await bot.sendMessage(
      chatId,
      'Наличие доверенности на директора дилера для подписания документов?',
      options
    )
    return
  }

  // Этап 22 Способ подписания
  if (userSessions[chatId].addHolding === 22) {
    userSessions[chatId].addHolding = 23
    userSessions[chatId].egrul.attorney = msg
    const buttons = [
      [
        { text: 'Почта РФ', callback_data: 'Почта РФ' },
        { text: 'ЭДО', callback_data: 'ЭДО' },
        { text: 'При доставке', callback_data: 'При доставке' },
      ],
      [{ text: '❌ Отмена', callback_data: '/cancel' }],
    ]
    const options = {
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
    await bot.sendMessage(chatId, 'Способ подписания?', options)
    return
  }

  // Этап 23 Дата отгрузки
  if (userSessions[chatId].addHolding === 23) {
    userSessions[chatId].addHolding = 10
    userSessions[chatId].egrul.signingMethod = msg

    await bot.sendMessage(chatId, 'Дата отгрузки?')
    return
  }

  // Этап 24 Контактное лицо холдинга
  if (userSessions[chatId].addHolding === 10) {
    userSessions[chatId].addHolding = 11
    userSessions[chatId].egrul.dateShipment = msg.text

    await bot.sendMessage(
      chatId,
      'Контактное лицо холдинга для подписания документов? (потча, телефон)'
    )
    return
  }

  // Этап 25 Сумма договора
  if (userSessions[chatId].addHolding === 11) {
    userSessions[chatId].addHolding = 12
    userSessions[chatId].egrul.contactPerson = msg.text

    await bot.sendMessage(chatId, 'Сумма договора')
    return
  }

  // Этап 26 Сумма заказа/расчета
  if (userSessions[chatId].addHolding === 12) {
    userSessions[chatId].addHolding = 13
    userSessions[chatId].egrul.amountAgreement = msg.text

    await bot.sendMessage(chatId, 'Сумма заказа/расчета')
    return
  }

  // Этап 26 Договор дилерский/Договор поставки
  if (userSessions[chatId].addHolding === 13) {
    userSessions[chatId].addHolding = 24
    userSessions[chatId].egrul.orderCalculation = msg.text
    const buttons = [
      [
        { text: 'Договор дилерский', callback_data: 'Договор дилерский' },
        { text: 'Договор поставки', callback_data: 'Договор поставки' },
      ],
      [{ text: '❌ Отмена', callback_data: '/cancel' }],
    ]
    const options = {
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
    await bot.sendMessage(chatId, 'Договор дилерский/Договор поставки', options)
    return
  }

  // Этап 27
  if (userSessions[chatId].addHolding === 24) {
    userSessions[chatId].addHolding = 14
    userSessions[chatId].egrul.contractType = msg

    await bot.sendMessage(chatId, 'Особые условия отгрузки')
    return
  }

  // Этап 28
  if (userSessions[chatId].addHolding === 14) {
    userSessions[chatId].addHolding = 15
    userSessions[chatId].egrul.termsShipment = msg.text

    await bot.sendMessage(chatId, 'особые условия оплаты')
    return
  }

  // Этап 29
  if (userSessions[chatId].addHolding === 15) {
    userSessions[chatId].addHolding = 16
    userSessions[chatId].egrul.termsPayment = msg.text

    await bot.sendMessage(chatId, 'особые условия заказа')
    return
  }

  // Этап 30
  if (userSessions[chatId].addHolding === 16) {
    userSessions[chatId].addHolding = 17
    userSessions[chatId].egrul.termsOrder = msg.text

    await bot.sendMessage(chatId, 'Комментарий')
    return
  }

  // Этап FINAL
  if (userSessions[chatId].addHolding === 17) {
    userSessions[chatId].egrul.comment = msg.text

    // await bot.deleteMessage(chatId, userSessions[chatId]?.lastMessageId)
    const sessionData = userSessions[chatId]
    //  console.log(userSessions[chatId].egrul)
    const egrulData = userSessions[chatId].egrul

    const textCalc = `Регистрация холдинга:
- **Юридический адрес:** ${egrulData.legalAddress}
- **Полный адрес:** ${egrulData.fullAddress}
- **ИНН:** ${egrulData.inn}
- **КПП:** ${egrulData.kpp}
- **ОГРН:** ${egrulData.ogrn}
- **Краткое наименование:** ${egrulData.shortName}
- **Дата регистрации:** ${egrulData.registrationDate}
- **Расчетный счет:** ${egrulData.payment}
- **БИК:** ${egrulData.bic}
- **Корреспондентский счет:** ${egrulData.kc}
- **ФИО главного бухгалтера:** ${egrulData.fullNameAccountant}
- **Количество директоров:** ${egrulData.countDirectors}
- **Цель приобретаемых окон:** ${egrulData.goal}
- **ЭДО:** ${egrulData.edo}
- **ГОСТ (год) или ТУ:** ${egrulData.gost}
- **Нужен ли паспорт качества:** ${egrulData.passport}
- **Наличие доверенности:** ${egrulData.attorney}
- **Способ подписания:** ${egrulData.signingMethod}
- **Дата отгрузки:** ${egrulData.dateShipment}
- **Контактное лицо для подписания документов:** ${egrulData.contactPerson}
- **Сумма по договору:** ${egrulData.amountAgreement}
- **Номер расчета:** ${egrulData.orderCalculation}
- **Тип договора:** ${egrulData.contractType}
- **Условия отгрузки:** ${egrulData.termsShipment}
- **Условия оплаты:** ${egrulData.termsPayment}
- **Условия заказа:** ${egrulData.termsOrder}
- **Комментарий:** ${egrulData.comment}
`
    userId = await getMppByCompany(sessionData.companyId)

    try {
      //  для создания напоминания МПП
      await createReminder({
        newRecordId: -1,
        userId,
        textCalc: textCalc,
        typeReminders: 'finances',
        priority: 'высокий',
        title: `Регистрация холдинга для *${
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
    return
  }
}

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Выставить счет (handleIssueInvoice) ************************************************************************
async function handleIssueInvoice(
  bot,
  chatId,
  msg,
  userSessions,
  companyInn,
  companyName
) {
  userSessions[chatId] = userSessions[chatId] || {}

  // Этап 0
  if (!userSessions[chatId].awaitingIssueInvoice) {
    await bot.deleteMessage(chatId, userSessions[chatId].lastMessageId)
    userSessions[chatId].awaitingIssueInvoice = 1
    const sScan = `V7R${companyInn}`
    const response = await sendRequest1C(sScan)
    userSessions[chatId].counterparty = response

    // Создание объекта из companyName
    const companyNameObject = {
      name: companyName,
      address: '',
      full: companyName,
    }

    // Добавляем объект компании в начало массива counterparty
    userSessions[chatId].counterparty.unshift(companyNameObject)

    // Формирование кнопок из названий контрагентов
    const buttons = userSessions[chatId].counterparty.map((counterparty) => {
      const shortName =
        counterparty.name.length > 15
          ? counterparty.name.substring(0, 15)
          : counterparty.name
      return [{ text: counterparty.name, callback_data: shortName }]
    })

    buttons.push([
      { text: '➕ Добавить холдинг', callback_data: '/add_holding' },
      { text: '❌ Отмена', callback_data: '/cancel' },
    ])

    const options = {
      reply_markup: {
        inline_keyboard: buttons,
      },
    }

    const message = await bot.sendMessage(
      chatId,
      'Выберите наименование контрагента',
      options
    )
    userSessions[chatId].lastMessageId = message.message_id
    return
  }

  // Этап 1
  if (userSessions[chatId].awaitingIssueInvoice === 1) {
    userSessions[chatId].awaitingIssueInvoice = 2
    userSessions[chatId].counterpartyResponse = msg
    await bot.deleteMessage(chatId, userSessions[chatId].lastMessageId)

    const options = {
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Отмена', callback_data: '/cancel' }]],
      },
    }

    const message = await bot.sendMessage(chatId, 'Введите сумму', options)
    userSessions[chatId].lastMessageId = message.message_id
    return
  }

  // Этап 2
  if (userSessions[chatId].awaitingIssueInvoice === 2) {
    bot.sendMessage(chatId, 'Отправлено для обработки')

    const sessionData = userSessions[chatId]
    userId = await getMppByCompany(sessionData.companyId)

    // Поиск контрагента с учетом первых 15 символов
    const filteredCounterparty = userSessions[chatId].counterparty.find(
      (counterparty) => {
        const shortName =
          counterparty.name.length > 15
            ? counterparty.name.substring(0, 15)
            : counterparty.name
        return (
          shortName ===
          userSessions[chatId].counterpartyResponse.substring(0, 15)
        ) // Сравниваем с обрезанным ответом
      }
    )

    try {
      //  для создания напоминания МПП
      await createReminder({
        newRecordId: -1,
        userId,
        textCalc: `Выставить счет на сумму: ${msg.text}р., контрагент: ${filteredCounterparty.full}`,
        typeReminders: 'finances',
        priority: 'высокий',
        title: `Выставить счет *${
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

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Заказать бухгалтерскую сверку (handleFinancesAccountingReconciliation) ************************************************************************
async function handleFinancesAccountingReconciliation(
  bot,
  chatId,
  msg,
  userSessions
) {
  userSessions[chatId] = userSessions[chatId] || {}
  console.log(0)
  // Этап 0
  if (!userSessions[chatId].awaitingFinancesAccountingReconciliation) {
    userSessions[chatId].awaitingFinancesAccountingReconciliation = 1
    await bot.sendMessage(chatId, 'Укажите контрагента', keyboardCancel)

    return
  }

  // Этап 1
  if (userSessions[chatId].awaitingFinancesAccountingReconciliation === 1) {
    const sessionData = userSessions[chatId]
    userId = await getMppByCompany(sessionData.companyId)

    try {
      //  для создания напоминания МПП
      await createReminder({
        newRecordId: -1,
        userId,
        textCalc: `Запрос на бухгалтерскую сверку, контрагент: ${msg.text}`,
        typeReminders: 'finances',
        priority: 'высокий',
        title: `Заказать бухгалтерскую сверку *${
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

// **********************************************
// **********************************************
// **********************************************
// ********************************************** Узнать остаток на счете (handleFinancesRemainder) ************************************************************************
async function handleFinancesRemainder(bot, chatId, userSessions, companyInn) {
  const sessionData = userSessions[chatId]
  const userId = await getMppByCompany(sessionData.companyId)

  try {
    //  для создания напоминания МПП
    await createReminder({
      newRecordId: -1,
      userId,
      textCalc: `Дилер запрашивает информацию об остатке на счете. ИНН: ${companyInn}`,
      typeReminders: 'finances',
      priority: 'высокий',
      title: `Узнать остаток на счете *${
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
    return
  }
}

module.exports = {
  handleFinances,
  handleFinancesAccountingReconciliation,
  handleFinancesRemainder,
  handleIssueInvoice,
  handleAddHolding,
}
