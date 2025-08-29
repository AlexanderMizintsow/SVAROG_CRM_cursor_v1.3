// buttonCancel.js

const { displayHelpMenu } = require('../helpers/helpMenu')

async function handleCancel(bot, chatId, userSessions) {
  if (userSessions[chatId]) {
    // Устанавливаем статус ожидания в пустую строку
    userSessions[chatId].awaitingCalculation = ''
    userSessions[chatId].awaitingVerificationOrdersStatus = ''
    userSessions[chatId].awaitingVerificationFinancial = ''
    userSessions[chatId].associatedTexts = []
    userSessions[chatId].fileIds = []
    userSessions[chatId].photoIds = []

    // Оформить новую рекламацию
    userSessions[chatId].awaitingComplaint = ''
    userSessions[chatId].awaitingComplaintNewArrange = ''
    userSessions[chatId].getOrderItems1C = ''
    userSessions[chatId].stageComplaint3 = ''
    userSessions[chatId].stageComplaint4 = ''
    userSessions[chatId].stageComplaint5 = ''
    userSessions[chatId].complaintDetails = ''
    userSessions[chatId].complaintDetailsAllItem = ''
    userSessions[chatId].OrderNo = ''
    userSessions[chatId].selectedYear = 'bd_2025_years'.split('_')[1]
    // Доставка
    userSessions[chatId].awaitingDeliveryOrderTime = ''
    userSessions[chatId].awaitingDeliveryOrderDate = ''
    userSessions[chatId].awaitingOrderToPoint = ''

    // Расчет
    userSessions[chatId].awaitingCalculationDoneOrder = ''
    userSessions[chatId].calculationDoneOrder = ''
    userSessions[chatId].msgOrerNo = ''
    userSessions[chatId].orerPrice = ''
    userSessions[chatId].telephone = ''
    userSessions[chatId].adress = ''

    // Удаляем сообщение, если оно существует
    //   if (userSessions[chatId].messageId) {
    //     await bot.deleteMessage(chatId, userSessions[chatId].messageId)
    //   }

    // Финансы
    userSessions[chatId].awaitingFinancesAccountingReconciliation = ''
    userSessions[chatId].awaitingIssueInvoice = ''
    userSessions[chatId].counterparty = ''
    userSessions[chatId].counterpartyResponse = ''
    userSessions[chatId].addHolding = ''

    // Консультация
    userSessions[chatId].consultationVideo = ''

    if (userSessions[chatId].lastMessageId) {
      try {
        await bot.deleteMessage(chatId, userSessions[chatId].lastMessageId)
      } catch (error) {
        console.error(`Не удалось удалить сообщение: ${error.message}`)
      }
    } // Тут потом посмотреть логику что везде должна быть для удаления lastMessageId

    displayHelpMenu(bot, chatId, userSessions)
    // userSessions[chatId] = undefined; // Если хотите удалить сессию, вместо этого присвоение undefined
  }
}

module.exports = {
  handleCancel,
}

/*const { displayHelpMenu } = require('../helpers/helpMenu')
async function handleCancel(bot, chatId, userSessions) {
  if (userSessions[chatId]) {
    //&& userSessions[chatId].lastMessageId
    // Удаляем статус ожидания
    delete userSessions[chatId].awaitingCalculation
    delete userSessions[chatId].awaitingVerificationOrdersStatus
    delete userSessions[chatId].awaitingVerificationFinancial
    userSessions[chatId].associatedTexts = []
    userSessions[chatId].fileIds = []
    userSessions[chatId].photoIds = []

    // Оформить новую рекламацию
    delete userSessions[chatId].awaitingComplaint
    delete userSessions[chatId].awaitingComplaintNewArrange
    delete userSessions[chatId].getOrderItems1C
    delete userSessions[chatId].stageComplaint3
    delete userSessions[chatId].stageComplaint4
    delete userSessions[chatId].stageComplaint5
    delete userSessions[chatId].complaintDetails
    delete userSessions[chatId].complaintDetailsAllItem
    delete userSessions[chatId].OrderNo
    // Доставка
    delete userSessions[chatId].awaitingDeliveryOrderTime
    delete userSessions[chatId].awaitingDeliveryOrderDate
    delete userSessions[chatId].awaitingOrderToPoint

    // Расчет
    delete userSessions[chatId].awaitingCalculationDoneOrder
    delete userSessions[chatId].calculationDoneOrder
    delete userSessions[chatId].msgOrerNo
    delete userSessions[chatId].orerPrice
    delete userSessions[chatId].telephone
    delete userSessions[chatId].adress
    if (userSessions[chatId].messageId) {
      ;(await userSessions[chatId]?.messageId) &&
        bot.deleteMessage(chatId, userSessions[chatId]?.messageId)
    }
    // Финансы
    delete userSessions[chatId].awaitingFinancesAccountingReconciliation
    delete userSessions[chatId].awaitingIssueInvoice
    delete userSessions[chatId].counterparty
    delete userSessions[chatId].awaitingIssueInvoice
    delete userSessions[chatId].counterpartyResponse
    delete userSessions[chatId].addHolding
    // Консультация
    userSessions[chatId].consultationVideo

    if (userSessions[chatId].lastMessageId) {
      try {
        await bot.deleteMessage(chatId, userSessions[chatId].lastMessageId)
      } catch (error) {
        console.error(`Не удалось удалить сообщение: ${error.message}`)
      }
    } // Тут потом просмотерть логику что везде должна быть для удаления lastMessageId
    displayHelpMenu(bot, chatId, userSessions)
    // delete userSessions[chatId]
  }
}

module.exports = {
  handleCancel,
}
*/
