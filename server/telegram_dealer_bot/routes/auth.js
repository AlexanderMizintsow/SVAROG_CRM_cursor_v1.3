const express = require('express')
const dbPool = require('../database/db')
const { handleCancel } = require('../helpers/buttonCancel')
const { displayHelpMenu } = require('../helpers/helpMenu')
const { handleRegistration } = require('../registration/registrationHandler')
const { handleChatCommand } = require('../helpers/chatCommandHandler')
const { removeAccess } = require('../accessRemoval/accessRemovalHandler')
const {
  //handleCalculations,
  // handleNewCalculation,
  // handleEditingCalculation,
  handleAwaitingCalculation,
  finalizeCalculation,
} = require('../queryLines/calculationsOrder/calculationsOrder')
const {
  handleCalculationDoneOrder,
} = require('../queryLines/calculationsOrder/handleCalculationDoneOrder')

const {
  handleVerificationOrdersStatus,
} = require('../queryLines/verificationOrder/verificationOrder')

// Консультация
const { handleConsultationCalculate } = require('../queryLines/consultation/consultation')

// Финансы
const {
  handleFinancesAccountingReconciliation,
  handleIssueInvoice,
  handleAddHolding,
} = require('../queryLines/finances/finances')

// Доставка
const {
  deliveryOrderTime,
  deliveryOrderDate,
  deliveryOrderToPoint,
  deliveryOrderToPointDate,
} = require('../queryLines/deliveryOrder/deliveryOrder')

// Рекламация
const {
  handleAwaitingComplaint,
  handleComplaintReportProblem,
  handleComplaintNewArrange,
} = require('../queryLines/complaintOrder/complaint')
const {
  initReclamationCron,
  initReconciliationCron,
  handleReclamationRating,
  handleRatingComment,
} = require('../helpers/api')

// Заказы 1С
const {
  handleOrderConfirm,
  handleOrderReschedule,
  handleDateSelection,
  handleRescheduleReason,
  handleCancelReschedule,
} = require('../queryLines/orders1c/orderHandlers')

//const { handleUserMessageAI } = require('../routes/AI')

const router = express.Router()
const userSessions = {}

async function checkUserAndCompanyAccess(chatId) {
  const query = `
      SELECT c.name_companies, uc.company_id, c.telegram_password, c.inn
      FROM user_company_tg_bot uc
      LEFT JOIN companies c ON uc.company_id = c.id
      WHERE uc.chat_id = $1
    `
  const result = await dbPool.query(query, [chatId])

  if (result.rowCount === 0) return { registered: false }

  const { name_companies, company_id, telegram_password, inn } = result.rows[0]

  if (!company_id) {
    throw new Error('Не удалось найти вашу компанию.')
  }

  if (!telegram_password || telegram_password === 'NOTACCES') {
    throw new Error('Доступ закрыт, обратитесь к вашему менеджеру!')
  }

  return {
    companyName: name_companies,
    registered: true,
    companyId: company_id,
    companyInn: inn,
  }
}

async function handleUserMessage(bot, chatId, msg) {
  try {
    //  userSessions[chatId] = userSessions[chatId] || {}
    const { companyName, registered, companyId, companyInn } = await checkUserAndCompanyAccess(
      chatId
    )

    // await handleUserMessageAI(bot, chatId, msg)

    if (registered) {
      userSessions[chatId] = userSessions[chatId] || {
        companyId: companyId,
        companyName: companyName,
        companyInn: companyInn,
        awaitingCalculation: false,
        associatedTexts: [], // Для текста
        fileIds: [], // Для документов
        photoIds: [], // Для фотографий
        userId: msg.from.id,
        userName: msg.from.username || msg.from.first_name,
      }

      const session = userSessions[chatId]

      // Обработка комментария к оценке ************************************
      if (userSessions[chatId]?.awaitingRatingComment && msg.text !== '/cancel') {
        await handleRatingComment(bot, chatId, msg.text, userSessions)
        return
      }

      // Обработка причины переноса заказа 1С ************************************
      if (userSessions[chatId]?.awaitingRescheduleReason && msg.text !== '/cancel') {
        await handleRescheduleReason(bot, chatId, msg.text, userSessions)
        return
      }

      // *** Логика обработки Финансы
      if (userSessions[chatId].awaitingFinancesAccountingReconciliation === 1) {
        await handleFinancesAccountingReconciliation(bot, chatId, msg, userSessions)

        return
      }

      if (userSessions[chatId].awaitingIssueInvoice === 2) {
        await handleIssueInvoice(bot, chatId, msg, userSessions, companyInn, companyName)
        return
      }

      if (userSessions[chatId].addHolding >= 1 && userSessions[chatId].addHolding <= 19) {
        await handleAddHolding(bot, chatId, msg, userSessions, companyInn)
        return
      }

      // *** Логика обработки Сверка - номер заказа
      if (userSessions[chatId] && userSessions[chatId].awaitingVerificationOrdersStatus) {
        await handleVerificationOrdersStatus(bot, chatId, userSessions, msg, companyInn)
        return
      }

      // *** Логика обработки Рекламация - оповещение без оформления
      if (userSessions[chatId].awaitingComplaint) {
        await handleAwaitingComplaint(bot, chatId, msg, userSessions)
        return
      }

      if (userSessions[chatId].awaitingComplaintNewArrange === 0.5) {
        userSessions[chatId].awaitingComplaintNewArrange = 1
        await handleComplaintNewArrange(bot, chatId, msg, userSessions, companyInn)
        return
      }

      if (userSessions[chatId].awaitingComplaintNewArrange === 1) {
        await handleComplaintNewArrange(bot, chatId, msg, userSessions, companyInn)
        return
      }
      // *** Логика обработки Доставка
      if (userSessions[chatId].awaitingDeliveryOrderTime === 1) {
        await deliveryOrderTime(bot, chatId, msg, userSessions, companyInn)
        return
      }
      if (userSessions[chatId].awaitingDeliveryOrderDate === 1) {
        await deliveryOrderDate(bot, chatId, msg, userSessions, companyInn)
        return
      }
      if (userSessions[chatId].awaitingOrderToPoint === 1) {
        await deliveryOrderToPoint(bot, chatId, msg, userSessions)
        return
      }

      // *** Логика обработки РАСЧЕТ

      if (
        userSessions[chatId].awaitingCalculationDoneOrder === 1 ||
        userSessions[chatId].awaitingCalculationDoneOrder === 4 ||
        userSessions[chatId].awaitingCalculationDoneOrder === 5
      ) {
        await handleCalculationDoneOrder(bot, chatId, userSessions, msg, companyInn)
        return
      }

      if (
        userSessions[chatId].awaitingCalculation ||
        userSessions[chatId].awaitingCalculationEdite
      ) {
        await handleAwaitingCalculation(bot, chatId, msg, userSessions)
        return
      } // Обработка других сообщений, если не ожидаем расчет
      else {
        displayHelpMenu(bot, chatId, userSessions)
      }
    }
    // Если не зарегистрирован
    else {
      if (!userSessions[chatId]) {
        userSessions[chatId] = { step: 1 }
        await bot.sendMessage(
          chatId,
          'Начинаем процесс регистрации. Пожалуйста, введите наименование вашей компании:'
        )
      } else {
        await handleRegistration(bot, chatId, msg, userSessions)
      }
    }
  } catch (error) {
    bot.sendMessage(chatId, error.message)
    handleCancel(bot, chatId, userSessions)
  }
}

async function handleCallbackQuery(bot, chatId, callbackQuery) {
  const command = callbackQuery.data
  const msg = callbackQuery.message

  try {
    const { companyName, registered, companyId, companyInn } = await checkUserAndCompanyAccess(
      chatId
    )
    console.log('companyName', companyName)
    if (registered) {
      userSessions[chatId] = userSessions[chatId] || {
        companyId: companyId,
        companyName: companyName,
        companyInn: companyInn,
        awaitingCalculation: false,
        associatedTexts: [],
        fileIds: [],
        photoIds: [],
        userId: callbackQuery.from.id,
        userName: callbackQuery.from.username || callbackQuery.from.first_name,
      }

      // Обработка оценки рекламации ***************************************************************
      if (command.startsWith('rate_')) {
        const parts = command.split('_')
        const requestNumber = parts[1]
        const rating = parseInt(parts[2])

        await handleReclamationRating(
          bot,
          chatId,
          callbackQuery,
          requestNumber,
          rating,
          userSessions
        )
        return
      }

      // Обработка заказов 1С ***************************************************************
      if (command.startsWith('confirm_order_')) {
        const orderNumber = command.replace('confirm_order_', '')
        await handleOrderConfirm(bot, chatId, callbackQuery, orderNumber, userSessions)
        return
      }

      if (command.startsWith('reschedule_order_')) {
        const orderNumber = command.replace('reschedule_order_', '')
        await handleOrderReschedule(bot, chatId, callbackQuery, orderNumber, userSessions)
        return
      }

      if (command.startsWith('select_date_')) {
        const selectedDate = command.replace('select_date_', '')
        await handleDateSelection(bot, chatId, callbackQuery, selectedDate, userSessions)
        return
      }

      if (command === 'cancel_reschedule') {
        await handleCancelReschedule(bot, chatId, callbackQuery, userSessions)
        return
      }

      // место команд
      if (command === 'finish_calc') {
        await finalizeCalculation(chatId, userSessions, bot) // Вызываем метод завершения расчета
        return
      }
      if (command === 'finish_complaint_report') {
        await handleComplaintReportProblem(chatId, userSessions, bot)
        return
      }

      if (command === '/remove_access_comfirm') {
        userSessions[chatId].awaitinRemoveAccess = true
        const removalResult = await removeAccess(bot, chatId, userSessions, msg)
        await bot.sendMessage(chatId, removalResult.message)
        return
      }

      // Консультация
      if (command === '/consultation_how_calculate' || userSessions[chatId].consultationVideo) {
        handleConsultationCalculate(bot, chatId, command, userSessions)
        return
      }

      // Доставка
      if (['passing_car', 'assembly_car', 'separate_car'].includes(command)) {
        userSessions[chatId].awaitingOrderToPoint = 2
        await deliveryOrderToPoint(bot, chatId, command, userSessions)
        return
      }

      if (userSessions[chatId].awaitingComplaintNewArrange === 0.5) {
        await handleComplaintNewArrange(bot, chatId, command, userSessions, companyInn)
        return
      }

      if (
        userSessions[chatId].awaitingOrderToPointDate === 1 ||
        userSessions[chatId].awaitingOrderToPointDate === 2 ||
        userSessions[chatId].awaitingOrderToPointDate === 3
      ) {
        await deliveryOrderToPointDate(bot, chatId, command, userSessions, companyInn)
        return
      }

      // Финансы
      if (userSessions[chatId].awaitingIssueInvoice === 1) {
        const isCounterpartyName = userSessions[chatId].counterparty.some((counterparty) => {
          const shortName =
            counterparty.name.length > 15 ? counterparty.name.substring(0, 15) : counterparty.name
          return shortName === command // Сравниваем сокращенные имена
        })

        if (isCounterpartyName) {
          userSessions[chatId].awaitingOrderToPoint = 2
          await handleIssueInvoice(bot, chatId, command, userSessions, companyInn, companyName)
          return
        }
      }

      if (userSessions[chatId].addHolding >= 20 && userSessions[chatId].addHolding <= 30) {
        await handleAddHolding(bot, chatId, command, userSessions, companyInn) //Отправить реквизиты на проверку
        return
      }

      // Расчет

      if (
        ['cancel_price_order_aw', 'confirm_price_order_aw'].includes(command) ||
        userSessions[chatId].awaitingCalculationDoneOrder === 1
      ) {
        if (userSessions[chatId].awaitingCalculationDoneOrder !== 1) {
          userSessions[chatId].awaitingCalculationDoneOrder =
            command === 'cancel_price_order_aw' ? 2 : 3
        }

        console.log(userSessions[chatId].awaitingCalculationDoneOrder)
        await handleCalculationDoneOrder(bot, chatId, userSessions, command, companyInn)
        return
      }

      // Комплектация
      //  userSessions[chatId].awaitingComplaintNewArrange = 3
      if (
        userSessions[chatId].awaitingComplaintNewArrange === 2 ||
        userSessions[chatId].awaitingComplaintNewArrange === 3 ||
        userSessions[chatId].awaitingComplaintNewArrange === 4 ||
        userSessions[chatId].awaitingComplaintNewArrange === 5
      ) {
        await handleComplaintNewArrange(bot, chatId, command, userSessions, companyInn)
        return
      }

      // Отмена
      if (command === 'cancel') {
        handleCancel(bot, chatId, userSessions)
        return
      }

      if (command === '/cancel' && userSessions[chatId]?.awaitingRatingComment) {
        delete userSessions[chatId].awaitingRatingComment
        await bot.sendMessage(chatId, 'Комментарий не будет сохранен.')
        return
      }

      if (command === '/cancel' && userSessions[chatId]?.awaitingRescheduleReason) {
        delete userSessions[chatId].awaitingRescheduleReason
        delete userSessions[chatId].awaitingDateSelection
        delete userSessions[chatId].selectedNewDate
        await bot.sendMessage(chatId, 'Перенос даты отменен.')
        return
      }

      await handleChatCommand(bot, chatId, command, userSessions, msg, companyInn, companyName)
      //delete userSessions[chatId].awaitingCalculation // Очистка состояния
    } else {
      if (!userSessions[chatId]) {
        userSessions[chatId] = { step: 1 }
        await bot.sendMessage(
          chatId,
          'Начинаем процесс регистрации. Пожалуйста, введите наименование вашей компании:'
        )
      } else {
        await handleRegistration(bot, chatId, msg, userSessions)
      }
    }
  } catch (error) {
    bot.sendMessage(chatId, error.message)
    handleCancel(bot, chatId, userSessions)
  } finally {
    bot.answerCallbackQuery(callbackQuery.id)
  }
}

//************************************************************ */
module.exports = (bot) => {
  // 1. Инициализация cron-задачи при старте модуля
  // initReconciliationCron(bot)
  // initReclamationCron(bot)

  // Обработчики сообщений и callback-запросов
  bot.on('message', (msg) => {
    const chatId = msg.chat.id
    handleUserMessage(bot, chatId, msg)
  })

  bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id
    handleCallbackQuery(bot, chatId, callbackQuery)
  })

  return router
}
