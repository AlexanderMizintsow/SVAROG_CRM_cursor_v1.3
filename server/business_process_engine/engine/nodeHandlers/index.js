const startHandler = require('./start')
const endHandler = require('./end')
const createTaskHandler = require('./createTask')
const assignTaskHandler = require('./assignTask')
const notificationHandler = require('./notification')
const decisionHandler = require('./decision')
const additionalInfoHandler = require('./additionalInfo')
const createProjectHandler = require('./createProject')
const projectUpdateStatusHandler = require('./projectUpdateStatus')
const projectAddCommentHandler = require('./projectAddComment')
const projectPostChatMessageHandler = require('./projectPostChatMessage')
const projectAddResponsiblesHandler = require('./projectAddResponsibles')
const projectUpdateGoalsHandler = require('./projectUpdateGoals')
const projectUpdateAdditionalInfoHandler = require('./projectUpdateAdditionalInfo')
const projectAddAttachmentHandler = require('./projectAddAttachment')
const projectUpdateTaskStatusHandler = require('./projectUpdateTaskStatus')
const taskUpdateStatusHandler = require('./taskUpdateStatus')
const taskAddCommentHandler = require('./taskAddComment')
const taskAddAttachmentHandler = require('./taskAddAttachment')
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
  create_project: createProjectHandler,
  project_update_status: projectUpdateStatusHandler,
  project_add_comment: projectAddCommentHandler,
  project_post_chat: projectPostChatMessageHandler,
  project_add_responsibles: projectAddResponsiblesHandler,
  project_update_goals: projectUpdateGoalsHandler,
  project_update_additional_info: projectUpdateAdditionalInfoHandler,
  project_add_attachment: projectAddAttachmentHandler,
  project_update_task_status: projectUpdateTaskStatusHandler,
  task_update_status: taskUpdateStatusHandler,
  task_add_comment: taskAddCommentHandler,
  task_add_attachment: taskAddAttachmentHandler,
  gateway: gatewayHandler,
  gateway_join: gatewayJoinHandler,
  splitter: splitterHandler,
  timer: timerHandler,
}

function getHandler(nodeType) {
  return handlers[nodeType] || null
}

module.exports = { getHandler, handlers }
