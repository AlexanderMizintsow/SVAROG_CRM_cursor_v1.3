const startHandler = require('./start')
const endHandler = require('./end')
const createTaskHandler = require('./createTask')
const assignTaskHandler = require('./assignTask')
const notificationHandler = require('./notification')
const gatewayHandler = require('./gateway')
const timerHandler = require('./timer')

const handlers = {
  start: startHandler,
  end: endHandler,
  create_task: createTaskHandler,
  assign_task: assignTaskHandler,
  notification: notificationHandler,
  gateway: gatewayHandler,
  timer: timerHandler,
}

function getHandler(nodeType) {
  return handlers[nodeType] || null
}

module.exports = { getHandler, handlers }
