const startHandler = require('./start')
const endHandler = require('./end')
const createTaskHandler = require('./createTask')
const assignTaskHandler = require('./assignTask')
const notificationHandler = require('./notification')
const decisionHandler = require('./decision')
const additionalInfoHandler = require('./additionalInfo')
const gatewayHandler = require('./gateway')
const gatewayJoinHandler = require('./gatewayJoin')
const splitterHandler = require('./splitter')
const timerHandler = require('./timer')

const handlers = {
  start: startHandler,
  end: endHandler,
  create_task: createTaskHandler,
  assign_task: assignTaskHandler,
  notification: notificationHandler,
  decision: decisionHandler,
  additional_info: additionalInfoHandler,
  gateway: gatewayHandler,
  gateway_join: gatewayJoinHandler,
  splitter: splitterHandler,
  timer: timerHandler,
}

function getHandler(nodeType) {
  return handlers[nodeType] || null
}

module.exports = { getHandler, handlers }
