const startHandler = require('./start')
const endHandler = require('./end')
const createTaskHandler = require('./createTask')
const assignTaskHandler = require('./assignTask')
const notificationHandler = require('./notification')
const decisionHandler = require('./decision')
const gatewayHandler = require('./gateway')
const gatewayJoinHandler = require('./gatewayJoin')
const timerHandler = require('./timer')

const handlers = {
  start: startHandler,
  end: endHandler,
  create_task: createTaskHandler,
  assign_task: assignTaskHandler,
  notification: notificationHandler,
  decision: decisionHandler,
  gateway: gatewayHandler,
  gateway_join: gatewayJoinHandler,
  timer: timerHandler,
}

function getHandler(nodeType) {
  return handlers[nodeType] || null
}

module.exports = { getHandler, handlers }
