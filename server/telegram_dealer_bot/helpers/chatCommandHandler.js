// В данном файле после нажатия кнопки из helpMenu.js команда передается сюда и ищется по case совпадение для
const { removeAccess } = require('../accessRemoval/accessRemovalHandler')
const { displayHelpMenu } = require('../helpers/helpMenu')
const { handleCancel } = require('../helpers/buttonCancel')
// Доставка
const {
  deliveryOrder,
  deliveryOrderTime,
  deliveryOrderDriverLocation,
  deliveryOrderDriverDelay,
  deliveryOrderDate,
  deliveryOrderToPoint,
  deliveryOrderToPointDate,
} = require('../queryLines/deliveryOrder/deliveryOrder')
// Рекламация
const {
  handleComplaint,
  handleComplaintNewArrange,
  handleComplaintReport,
  handleComplaintInfo,
} = require('../queryLines/complaintOrder/complaint')
// Сверка
const {
  handleVerification,
  handleVerificationFinancial,
  handleVerificationOrders,
  handleVerificationOrdersStatus,
} = require('../queryLines/verificationOrder/verificationOrder')
// Калькуляция
const {
  handleCalculationDoneOrder,
} = require('../queryLines/calculationsOrder/handleCalculationDoneOrder')

// Финансы
const {
  handleFinances,
  handleFinancesRemainder,
  handleFinancesAccountingReconciliation,
  handleIssueInvoice,
  handleAddHolding,
} = require('../queryLines/finances/finances')

// Консультация
const {
  handleConsultation,
  handleConsultationCalculate,
} = require('../queryLines/consultation/consultation')
const {
  handleCalculations,
  handleNewCalculation,
  handleEditingCalculation,
} = require('../queryLines/calculationsOrder/calculationsOrder')

async function handleChatCommand(
  bot,
  chatId,
  command,
  userSessions,
  msg,
  companyInn,
  companyName
) {
  switch (command) {
    case '/info':
      await bot.sendMessage(chatId, 'https://poz-sar.com/about/details/1/')
      await handleCancel(bot, chatId, userSessions)
      break
    case '/delete':
      await removeAccess(bot, chatId, userSessions, msg)
      break
    case '/help':
      await displayHelpMenu(bot, chatId, userSessions, msg)
      break
    // *** ********************************************* calculations (Расчет) calculationsOrder.js ****************************************************************
    case '/calculations': // Управление расчетами
      await handleCalculations(bot, chatId, userSessions, companyInn)
      break

    case '/new_calculation': // Новый расчет
      await handleNewCalculation(bot, chatId, userSessions)
      break

    case '/editing_calculation': // Изменения в расчете
      await handleEditingCalculation(bot, chatId, userSessions)
      break

    case '/editing_calculation_done_order': // Подтвердить в рабооту
      await handleCalculationDoneOrder(
        bot,
        chatId,
        userSessions,
        msg,
        companyInn
      )
      break

    // *** **************************************** /verification (Сверка) verificationOrder.js *************************************************************
    case '/verification':
      await handleVerification(bot, chatId, userSessions, companyInn)
      break
    case '/verification_orders':
      await handleVerificationOrders(bot, chatId, userSessions, companyInn) // Сверка по заказам
      break
    case '/verification_financial':
      await handleVerificationFinancial(bot, chatId, userSessions)
      break
    // Статус заказа
    case '/verification_status':
      await handleVerificationOrdersStatus(
        bot,
        chatId,
        userSessions,
        msg,
        companyInn
      )
      break

    // *** ************************************** /deliveryOrder (Доставка) deliveryOrder.js **************************************************************************
    case '/delivery_order':
      await deliveryOrder(bot, chatId, userSessions, companyInn)
      break
    case '/delivery_order_time':
      await deliveryOrderTime(bot, chatId, msg, userSessions, companyInn)
      break
    case '/delivery_order_driver_location':
      await deliveryOrderDriverLocation(bot, chatId, userSessions)
      break
    case '/delivery_order_driver_delay':
      await deliveryOrderDriverDelay(bot, chatId, userSessions)
      break
    case '/delivery_order_date':
      await deliveryOrderDate(bot, chatId, msg, userSessions, companyInn)
      break
    case '/delivery_order_to_point':
      await deliveryOrderToPoint(bot, chatId, msg, userSessions)
      break
    case '/delivery_order_to_point_date':
      await deliveryOrderToPointDate(bot, chatId, msg, userSessions, companyInn)
      break

    // *** ************************************** /complaint (Рекламация) complaint.js **************************************************************************
    case '/complaint':
      await handleComplaint(bot, chatId, userSessions, companyInn)
      break
    case '/complaint_new_arrange':
      await handleComplaintNewArrange(
        bot,
        chatId,
        msg,
        userSessions,
        companyInn
      )
      break
    case '/complaint_report_problem':
      await handleComplaintReport(bot, chatId, userSessions)
      break
    case '/complaint_existing':
      await handleComplaintInfo(bot, chatId, userSessions, companyInn)
      break

    // *** ************************************** /Finances (Финансы) finances.js **************************************************************************
    case '/finances':
      await handleFinances(bot, chatId, userSessions, companyInn) // Меню кнопок
      break
    case '/accounting_reconciliation':
      await handleFinancesAccountingReconciliation(
        bot,
        chatId,
        msg,
        userSessions
      ) // Заказать бухгалтерскую сверку
      break
    case '/finances_remainder':
      await handleFinancesRemainder(bot, chatId, userSessions, companyInn) // Узнать остаток на счете
      break
    case '/issue_invoice':
      await handleIssueInvoice(
        bot,
        chatId,
        msg,
        userSessions,
        companyInn,
        companyName
      ) // Выставить счет
      break
    case '/add_holding':
      await handleAddHolding(bot, chatId, msg, userSessions, companyInn) // Выставить счет
      break

    // *** ************************************** /Consultation (Консультация) consultation.js **************************************************************************
    case '/consultation':
      await handleConsultation(bot, chatId, userSessions) // Ассортимент
      break
    case '/consultation_how_calculate':
      await handleConsultationCalculate(bot, chatId, msg, userSessions) // Как считать?
      break

    // *** Cancel Отмена ********************************************************************************************************
    case '/cancel':
      await handleCancel(bot, chatId, userSessions) // Вызов функции из buttonCancel.js для выхода в основное меню
      break
    default:
      await displayHelpMenu(bot, chatId, userSessions)
      // delete userSessions[chatId]
      break
  }
}

module.exports = {
  handleChatCommand,
}
//1
