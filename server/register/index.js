// index.js
require('dotenv').config()
const rateLimit = require('express-rate-limit')
const jwt = require('jsonwebtoken')
const helmet = require('helmet')
const express = require('express')
const bcrypt = require('bcrypt')
const { Pool } = require('pg')
const cors = require('cors')
const { body, validationResult } = require('express-validator')
const multer = require('multer')
const http = require('http') // Импортируйте http
const socketIo = require('socket.io')
const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const cron = require('node-cron')
const {
  registerUser,
  loginUser,
  changePassword,
  checkDbConnection,
} = require('./authController/authController') // Импорт функций
const {
  getPositions,
  createPosition,
  deletePosition,
} = require('./positionController/positionController') // Импорт контроллера должностей
const {
  getDepartments,
  createDepartment,
  assignHeadToDepartment,
  removeHeadFromDepartment,
  deleteDepartment,
} = require('./departmentController/departmentController')
const {
  getAnalyticsSummary,
  getAnalyticsDepartments,
  getAnalyticsEmployees,
  getBusinessProcessesList,
  getBusinessProcessNodes,
  getBusinessProcessEntities,
  getBottlenecksByParticipants,
  getBottlenecksByDepartments,
  getAnalyticsDetail,
} = require('./analyticsController/analyticsController')

const { getRoles, createRole, deleteRole } = require('./roleController/roleController')

// Задачи
const {
  createTask,
  getTaskById,
  addTaskAssignment,
  replaceTaskAssignment,
  addTaskApproval,
  addTaskVisibility,
  addTaskAttachment,
  getUserTasks,
  notifyTaskCreated,
  updateTaskStatus,
  updateTaskApproval,
  updateTaskAccept,
  getTaskComments,
  addTaskComment,
  postMessagesNotificationDealer,
  getMessagesNotificationDealer,
  sendTaskMessage,
  getTaskMessages,
  updateTaskMessage,
  deleteTaskMessage,
  markMessagesAsRead,
  createGlobalTask,
  getGlobalTasks,
  getGlobalTasksCompleted,
  updateGlobalTask,
  getSubtasksForGlobalTask,
  updateGlobalTaskProcess,
  setProjectDeadline,
  deleteGlobalTask,
  getGlobalTaskById,
  getAttachmentsByTaskId,
  addCommentToGlobalTask,
  addResponsiblesToGlobalTask,
  removeResponsibleFromGlobalTask,
  createFinalSolution,
  updateFinalSolution,
  deleteFinalSolution,
  createFirstSentEmailSolution,
  saveProjectSentEmail,
  createFinalSolutionFromEmailReply,
  appendThreadMessage,
  updateThreadMessage,
  publishFinalSolution,
  downloadEmailAttachment,
  addEmailAttachmentToProject,
  updateEmailThreadContent,
  setProjectApproval,
  updateGoals,
  updateAdditionalInfo,
  getChatMessages,
  sendChatMessage,
  updateChatMessage,
  deleteChatMessage,
  getGlobalTaskHistory,
  updateGlobalTaskHistory,
  getGlobalTaskTitle,
  updateTaskDescription,
  getTaskDescriptionHistory,
  createExtensionRequest,
  getPendingExtensionRequestsForCreator,
  rejectExtensionRequest,
  approveExtensionRequest,
  updateTaskDeadline,
  getUnreadNotifications,
  checkNotification,
  markNotificationAsRead,
  getTaskHierarchy,
  hasSubtasks,
  checkOverdueTasks,
  addChatFile,
  getChatFilesByTaskId,
} = require('./tasksController/tasksController')

// Подключение userController
const {
  getUsers,
  updateUser,
  deleteUser,
  createUser,
  updateUserStatus,
  uploadAvatar,
  getAvatar,
  getEmailSignature,
  updateEmailSignature,
  getUserPhones,
  addPhone,
  updatePhone,
  deletePhone,
  createUserStatus,
  updateUserAbsenceStatus,
  deleteUserAbsenceStatus,
  getUserStatusPermissions,
  getActiveUserAbsences,
  getUpcomingUserAbsences,
  getUserWorkloadSummary,
  postResolveAssignees,
  getMppIdByCompanyId,
  getMprIdByCompanyId,
  updateReminderUserNotification,
  getNokOrMppIdByCompanyId,
  getRemindersCalls,
  updateReminder,
  deleteTag,
  createTag,
  getTags,
  getUsersMobileStaffAccess,
  updateMobileStaffPassword,
} = require('./userController/userController')

const {
  saveParticipantVotes,
  getRangeGroups,
  getFixedGroups,
  createGroup,
  addParticipantsToGroup,
  updateWorkGroup,
  removeParticipantFromGroup,
  deleteGroup,
  getParticipantVotes,
  getGroupCountsByUserId,
  notifyWorkGroupStaffHandler,
} = require('./workGroupsController/workGroupsController')

const {
  getEmployeeHierarchy,
  getEmployeeSubordinate,
} = require('./hierarchyController/hierarchyController')

const {
  addOrUpdateReview,
  getReview,
  getAverageRating,
  getAllReviews,
  getIntroductionNewVersion,
  postVersionApp,
  showVersionApp,
  updateApp,
} = require('./footerCommand/footerCommand')

const { getDatabaseStructure } = require('./dbView/dbView')

const {
  getPermissions,
  getPermissionsByRole,
  postPermission,
  getComponents,
} = require('./permissions/permissionsController')

const {
  getLeafTypes,
  createLeafType,
  updateLeafType,
  deleteLeafType,
  getParameters,
  createParameter,
  updateParameter,
  deleteParameter,
  getParameterValues,
  createParameterValue,
  updateParameterValue,
  deleteParameterValue,
  getParameterValueCategories,
  createParameterValueCategory,
  updateParameterValueCategory,
  deleteParameterValueCategory,
  assignCategoryToValue,
  getHandles,
  createHandle,
  updateHandle,
  deleteHandle,
  getHandleRules,
  getHandleRuleById,
  createHandleRule,
  updateHandleRule,
  deleteHandleRule,
  findHandlesByParameters,
  findUncoveredCombinations,
  exportRules,
  importRules,
  getEditorData,
  getHandleHistory,
  getApprovalStatus,
  approveHandleData,
  getApprovalUsers,
  addApprovalUser,
  removeApprovalUser,
  getAllUsers,
  createSnapshot,
  getSnapshots,
  restoreFromSnapshot,
  deleteSnapshot,
  getEditorPermissions,
  getAllEditorPermissions,
  setEditorPermissions,
  deleteEditorPermissions
} = require('./handleController/handleController')

const { submitAppIdea, getAppIdeas, applyAppIdea } = require('./appIdeasController/appIdeasController')
const {
  getAndroidApkStatus,
  downloadAndroidApk,
  uploadAndroidApk,
  deleteAndroidApk,
} = require('./mobileAppDistributionController/mobileAppDistributionController')
const {
  getMyManager: getManagerRequestManager,
  listMine: listManagerRequestsMine,
  listInbox: listManagerRequestsInbox,
  getOne: getManagerRequestOne,
  createRequest: createManagerRequest,
  answerRequest: answerManagerRequest,
  closeRequest: closeManagerRequest,
  markConverted: markManagerRequestConverted,
  listMessages: listManagerRequestMessages,
  postMessage: postManagerRequestMessage,
} = require('./managerRequestsController/managerRequestsController')
const {
  getPermissions: getKnowledgePermissions,
  listDocuments: listKnowledgeDocuments,
  getDocument: getKnowledgeDocument,
  createDocument: createKnowledgeDocument,
  updateDocument: updateKnowledgeDocument,
  deleteDocument: deleteKnowledgeDocument,
  downloadDocument: downloadKnowledgeDocument,
  addDocumentFile: addKnowledgeDocumentFile,
  deleteDocumentFile: deleteKnowledgeDocumentFile,
  downloadDocumentFile: downloadKnowledgeDocumentFile,
  replaceDocumentFile: replaceKnowledgeDocumentFile,
  renameDocumentFile: renameKnowledgeDocumentFile,
  listFileVersions: listKnowledgeFileVersions,
  downloadFileVersion: downloadKnowledgeFileVersion,
  convertDocumentToFolder: convertKnowledgeDocumentToFolder,
  reindexDocuments: reindexKnowledgeDocuments,
  listVersions: listKnowledgeVersions,
  downloadVersion: downloadKnowledgeVersion,
  listEvents: listKnowledgeEvents,
  createCategory: createKnowledgeCategory,
  deleteCategory: deleteKnowledgeCategory,
  createTag: createKnowledgeTag,
  deleteTag: deleteKnowledgeTag,
  addFavoriteDocument: addKnowledgeFavoriteDocument,
  removeFavoriteDocument: removeKnowledgeFavoriteDocument,
} = require('./knowledgeBaseController/knowledgeBaseController')
const { getCorsOrigins } = require('./config')

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: getCorsOrigins(),
    methods: ['GET', 'POST'],
  },
})
app.set('io', io)
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json({ limit: '200mb' })) // Устанавливаем лимит на размер тела запроса
app.use(express.urlencoded({ limit: '200mb', extended: true })) // Устанавливаем лимит на размер тела запроса
const uploadsDir = path.join(__dirname, '..', '..', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Восстановление имени файла из mojibake (UTF-8, ошибочно прочитанный как Latin-1)
function decodeUtf8Filename(name) {
  if (!name || typeof name !== 'string') return name
  if (/[\u0400-\u04FF]/.test(name)) return name
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8')
    if (/[\u0400-\u04FF]/.test(decoded) || decoded.length !== name.length) return decoded
  } catch (_) {}
  return name
}

const storageFile = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const safeName = decodeUtf8Filename(file.originalname) || file.originalname
    cb(null, Date.now() + '-' + safeName)
  },
})
const uploadFile = multer({ storage: storageFile })

const mobileAppUploadsDir = path.join(uploadsDir, 'mobile-app')
if (!fs.existsSync(mobileAppUploadsDir)) {
  fs.mkdirSync(mobileAppUploadsDir, { recursive: true })
}
const storageMobileApk = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, mobileAppUploadsDir)
  },
  filename: (req, file, cb) => {
    cb(null, `upload-${Date.now()}.apk.tmp`)
  },
})
const uploadMobileApk = multer({
  storage: storageMobileApk,
  limits: { fileSize: 120 * 1024 * 1024 }, // 120 MB
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase()
    if (!name.endsWith('.apk')) {
      return cb(new Error('Разрешены только файлы .apk'))
    }
    cb(null, true)
  },
})

const knowledgeUploadsDir = path.join(uploadsDir, 'knowledge')
if (!fs.existsSync(knowledgeUploadsDir)) {
  fs.mkdirSync(knowledgeUploadsDir, { recursive: true })
}
const storageKnowledge = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, knowledgeUploadsDir)
  },
  filename: (req, file, cb) => {
    const safeName = decodeUtf8Filename(file.originalname) || file.originalname
    cb(null, Date.now() + '-' + safeName)
  },
})
const uploadKnowledge = multer({
  storage: storageKnowledge,
  limits: { fileSize: 80 * 1024 * 1024 },
})

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const dbPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})
// Чтобы CURRENT_DATE и сравнение дедлайнов (просрочки) учитывали локальное время
const dbTimezone = process.env.DB_TIMEZONE || 'Europe/Moscow'
dbPool.on('connect', (client) => {
  client.query(`SET timezone = '${dbTimezone}'`).catch(() => {})
})

//const limiter = rateLimit({
//windowMs: 15 * 60 * 1000, // 15 минут
//max: 300, // ограничение каждого IP до 100 запросов за окно времени
//})
//app.use(limiter)

app.get('/', (req, res) => {
  res.status(200).send('Server is up and running')
})

/*************Авторизация**************/
// Регистрация
app.post(
  '/register',
  [
    body('username').isAlphanumeric(),
    body('password').isLength({ min: 5 }),
    body('email').isEmail(),
  ],
  registerUser(dbPool)
)

// Вход в приложение
app.post(
  '/login',
  [body('username').isAlphanumeric(), body('password').isLength({ min: 5 })],
  loginUser(dbPool)
)

// Путь для изменения пароля
app.put(
  '/api/users/:userId/change-password',
  [
    body('newPassword')
      .isLength({ min: 6 })
      .matches(/^[a-zA-Z]+$/),
  ],
  changePassword(dbPool)
)
/*******/
/*************Маршруты для работы с ДОЛЖНОСТЯМИ**************/
app.get('/api/positions', getPositions(dbPool))
app.post(
  '/api/positions/new',
  [body('name').notEmpty().withMessage('Название должности обязательно')],
  createPosition(dbPool)
)
app.delete('/api/positions/:id', deletePosition(dbPool))
/*******/
/*************Маршруты для работы с ОТДЕЛАМИ**************/
app.get('/api/departments', getDepartments(dbPool))
app.post(
  '/api/departments/new',
  [
    body('name').notEmpty().withMessage('Название отдела обязательно'),
    body('head_user_id').isInt().withMessage('ID руководителя отдела должен быть числом'),
  ],
  createDepartment(dbPool)
)
app.post('/api/departments/:id/assign-head', assignHeadToDepartment(dbPool))
app.post('/api/departments/:departmentId/remove-head', removeHeadFromDepartment(dbPool))
app.delete('/api/departments/:id', deleteDepartment(dbPool))
/*******/

/*************Аналитика / Мониторинг процессов**************/
app.get('/api/analytics/summary', getAnalyticsSummary(dbPool))
app.get('/api/analytics/departments', getAnalyticsDepartments(dbPool))
app.get('/api/analytics/employees', getAnalyticsEmployees(dbPool))
app.get('/api/analytics/business-processes/list', getBusinessProcessesList(dbPool))
app.get('/api/analytics/business-processes/:processId/nodes', getBusinessProcessNodes(dbPool))
app.get('/api/analytics/business-processes/:processId/entities', getBusinessProcessEntities(dbPool))
app.get('/api/analytics/bottlenecks/participants', getBottlenecksByParticipants(dbPool))
app.get('/api/analytics/bottlenecks/departments', getBottlenecksByDepartments(dbPool))
app.get('/api/analytics/detail', getAnalyticsDetail(dbPool))
/*******/

/*************Маршруты для работы с РОЛЯМИ**************/
// получения роли
app.get('/api/roles', getRoles(dbPool))

// создания новой роли
app.post(
  '/api/roles/new',
  [body('name').notEmpty().withMessage('Название роли обязательно')],
  createRole(dbPool)
)

// удаления роли
app.delete('/api/roles/:id', deleteRole(dbPool))
/*******/

// Время сервера (UTC) — для сверки с клиентом (только для отладки дедлайнов)
app.get('/api/server-time', (req, res) => {
  res.json({ serverTime: new Date().toISOString() })
})

/*************Маршруты для работы с СОТРУДНИКАМИ**************/
app.get('/api/users', getUsers(dbPool))
app.get('/api/users/mobile-staff-access', getUsersMobileStaffAccess(dbPool))
app.put('/api/users/mobile-staff-password/:id', updateMobileStaffPassword(dbPool))
app.get('/api/users/absences/active', getActiveUserAbsences(dbPool))
app.get('/api/users/absences/upcoming', getUpcomingUserAbsences(dbPool))
app.get('/api/users/:userId/workload-summary', getUserWorkloadSummary(dbPool))
app.post('/api/users/resolve-assignees', postResolveAssignees(dbPool))
app.put('/api/users/:id', updateUser(dbPool))
app.delete('/api/users/delete/:id', deleteUser(dbPool))
app.post('/api/users/new', createUser(dbPool))
app.post('/update-status', updateUserStatus(dbPool, io))
app.post('/api/users/:id/avatar', upload.single('avatar'), uploadAvatar(dbPool))
app.get('/api/users/:id/avatar', getAvatar(dbPool))
app.get('/api/users/:id/email-signature', getEmailSignature(dbPool))
app.put('/api/users/:id/email-signature', updateEmailSignature(dbPool))
app.get('/api/users/mpp/:id', getMppIdByCompanyId(dbPool))
app.get('/api/users/mpr/:id', getMprIdByCompanyId(dbPool))
app.get('/api/users/nok/:id', getNokOrMppIdByCompanyId(dbPool))

app.get('/api/tags', getTags(dbPool))
app.post('/api/tags', createTag(dbPool))
app.delete('/api/tags/:id', deleteTag(dbPool))

/* Напоминание  */
app.post('/api/update/reminder/notification', updateReminderUserNotification(dbPool))
app.get('/api/reminders/calls/:userId', getRemindersCalls(dbPool))
app.put('/api/reminders/calls/:id', updateReminder(dbPool))
/*******/

app.get('/api/users/:id/phones', getUserPhones(dbPool))
app.post('/api/users/:userId/phones', addPhone(dbPool))
app.put('/api/users/phones/update/:phoneId', updatePhone(dbPool))
app.delete('/api/phones/delete/:phoneId', deletePhone(dbPool))
/******/

app.post('/api/user-statuses', createUserStatus(dbPool))
app.get('/api/user-statuses/permissions', getUserStatusPermissions(dbPool))
app.put('/api/user-statuses/:id', updateUserAbsenceStatus(dbPool))
app.delete('/api/user-statuses/:id', deleteUserAbsenceStatus(dbPool))
/******/

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`)
})

/*************Маршруты для работы с РАБОЧЕЙ ГРУППОЙ *************************************/

// Маршрут для получения фиксированных групп
app.get('/api/fixed-groups', getFixedGroups(dbPool))
app.get('/api/range-groups', getRangeGroups(dbPool))

// Создание новой группы
app.post(
  '/api/work_groups',
  [
    body('group_name').notEmpty().withMessage('Название группы обязательно'),
    body('description').notEmpty().withMessage('Описание задачи обязательно'),
    body('importance').notEmpty().withMessage('Укажите важность'),
    body('create_type').notEmpty().withMessage('Укажите тип создания'),
  ],
  createGroup(dbPool, io)
)

// Добавление участников в группу
app.post('/api/group_participants', addParticipantsToGroup(dbPool, io))

// Сохранения голосов участников
app.post('/api/participant_votes', (req, res) => saveParticipantVotes(dbPool, io)(req, res))
app.get('/api/participant_votes', getParticipantVotes(dbPool))

app.patch('/api/updateWorkGroup/:id', updateWorkGroup(dbPool, io))
app.post(
  '/api/work_groups/:id/notify-staff',
  notifyWorkGroupStaffHandler(dbPool, io)
)

// Добавьте маршрут для удаления участников
app.delete(
  '/api/group_participants/:groupId/:participantId',
  removeParticipantFromGroup(dbPool, io)
)
app.get('/api/group-counts/:userId', getGroupCountsByUserId(dbPool))
app.delete('/api/work_groups/:id', deleteGroup(dbPool, io))

/****************************************************************************************/
//** Маршрут Иеархия сотрудников */
app.get('/api/employees/hierarchy', getEmployeeHierarchy(dbPool))
app.get('/api/employees/subordinate/:id', getEmployeeSubordinate(dbPool))

// Маршрут структуры базы данных
app.get('/api/database-structure', getDatabaseStructure(dbPool))

//**********Маршрут установки прав пользователя */

// ** Маршрут получения всех компонентов */
app.get('/api/components', getComponents(dbPool))

// ** Маршрут получения всех прав */
app.get('/api/permissions', getPermissions(dbPool))

// ** Маршрут получения прав по роли */
app.get('/api/permissions/:role_id', getPermissionsByRole(dbPool))

// ** Маршрут создания или обновления права доступа */
app.post('/api/permissions', postPermission(dbPool))

//** Маршрут Footer команды */
app.post('/api/employees/rating', addOrUpdateReview(dbPool))
app.get('/api/employees/rating/:userId', getReview(dbPool))
app.get('/api/reviews/average', getAverageRating(dbPool))
app.get('/api/reviews', getAllReviews(dbPool))

app.post('/api/app-ideas', uploadFile.single('file'), submitAppIdea(dbPool))
app.get('/api/app-ideas', getAppIdeas(dbPool))
app.patch('/api/app-ideas/:id', applyAppIdea(dbPool))

// Раздача мобильного APK (файл на диске uploads/mobile-app, не в git)
app.get('/api/mobile-app/android', getAndroidApkStatus(dbPool, uploadsDir))
app.get('/api/mobile-app/android/download', downloadAndroidApk(dbPool, uploadsDir))
app.post(
  '/api/mobile-app/android/upload',
  (req, res, next) => {
    uploadMobileApk.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' })
      }
      next()
    })
  },
  uploadAndroidApk(dbPool, uploadsDir)
)
app.delete('/api/mobile-app/android', deleteAndroidApk(dbPool, uploadsDir))

// Обращения к Директору
app.get('/api/manager-requests/manager', getManagerRequestManager(dbPool))
app.get('/api/manager-requests/mine', listManagerRequestsMine(dbPool))
app.get('/api/manager-requests/inbox', listManagerRequestsInbox(dbPool))
app.get('/api/manager-requests/:id/messages', listManagerRequestMessages(dbPool))
app.post('/api/manager-requests/:id/messages', postManagerRequestMessage(dbPool))
app.get('/api/manager-requests/:id', getManagerRequestOne(dbPool))
app.post('/api/manager-requests', createManagerRequest(dbPool))
app.post('/api/manager-requests/:id/answer', answerManagerRequest(dbPool))
app.post('/api/manager-requests/:id/close', closeManagerRequest(dbPool))
app.post('/api/manager-requests/:id/convert', markManagerRequestConverted(dbPool))

// База знаний отделов
app.get('/api/knowledge/permissions', getKnowledgePermissions(dbPool))
app.get('/api/knowledge/documents', listKnowledgeDocuments(dbPool))
app.get('/api/knowledge/documents/:id', getKnowledgeDocument(dbPool))
app.get(
  '/api/knowledge/documents/:id/download',
  downloadKnowledgeDocument(dbPool, uploadsDir)
)
app.post(
  '/api/knowledge/documents',
  uploadKnowledge.any(),
  createKnowledgeDocument(dbPool, io)
)
app.put(
  '/api/knowledge/documents/:id',
  uploadKnowledge.single('file'),
  updateKnowledgeDocument(dbPool, io)
)
app.delete('/api/knowledge/documents/:id', deleteKnowledgeDocument(dbPool))
app.post(
  '/api/knowledge/documents/:id/files',
  uploadKnowledge.any(),
  addKnowledgeDocumentFile(dbPool, io)
)
app.put(
  '/api/knowledge/documents/:id/files/:fileId',
  uploadKnowledge.any(),
  replaceKnowledgeDocumentFile(dbPool, io)
)
app.patch(
  '/api/knowledge/documents/:id/files/:fileId',
  renameKnowledgeDocumentFile(dbPool)
)
app.get(
  '/api/knowledge/documents/:id/files/:fileId/versions',
  listKnowledgeFileVersions(dbPool)
)
app.get(
  '/api/knowledge/documents/:id/files/:fileId/versions/:versionId/download',
  downloadKnowledgeFileVersion(dbPool, uploadsDir)
)
app.delete(
  '/api/knowledge/documents/:id/files/:fileId',
  deleteKnowledgeDocumentFile(dbPool)
)
app.get(
  '/api/knowledge/documents/:id/files/:fileId/download',
  downloadKnowledgeDocumentFile(dbPool, uploadsDir)
)
app.post(
  '/api/knowledge/documents/:id/convert-to-folder',
  convertKnowledgeDocumentToFolder(dbPool)
)
app.get('/api/knowledge/documents/:id/versions', listKnowledgeVersions(dbPool))
app.get(
  '/api/knowledge/documents/:id/versions/:versionId/download',
  downloadKnowledgeVersion(dbPool, uploadsDir)
)
app.get('/api/knowledge/documents/:id/events', listKnowledgeEvents(dbPool))
app.post('/api/knowledge/documents/:id/favorite', addKnowledgeFavoriteDocument(dbPool))
app.delete('/api/knowledge/documents/:id/favorite', removeKnowledgeFavoriteDocument(dbPool))
app.post(
  '/api/knowledge/reindex',
  reindexKnowledgeDocuments(dbPool, uploadsDir)
)
app.post('/api/knowledge/categories', createKnowledgeCategory(dbPool))
app.delete('/api/knowledge/categories/:id', deleteKnowledgeCategory(dbPool))
app.post('/api/knowledge/tags', createKnowledgeTag(dbPool))
app.delete('/api/knowledge/tags/:id', deleteKnowledgeTag(dbPool))

app.get('/api/introduction/version/:userId', getIntroductionNewVersion(dbPool))
app.post('/api/introduction/version', postVersionApp(dbPool))
app.delete('/api/introduction/show/version', showVersionApp(dbPool))
app.post('/api/update-app', updateApp(dbPool))

// API для проверки соединения с базой данных
app.get('/api/check-db-connection', checkDbConnection(dbPool))

/*************************************************************************************************************/
//** Маршрут Задачи Tasks */
app.post('/api/tasks/create', createTask(dbPool, io))
app.get('/api/tasks/:taskId', getTaskById(dbPool))
app.put('/api/tasks/:taskId/replace-assignee', replaceTaskAssignment(dbPool, io))
app.post('/api/tasks/assignment/add', addTaskAssignment(dbPool, io))
app.post('/api/tasks/approval/add', addTaskApproval(dbPool, io))
app.post('/api/tasks/visibility/add', addTaskVisibility(dbPool, io))
app.post('/api/tasks/attachment/add', addTaskAttachment(dbPool, io))
app.get('/api/tasks/user/:userId', getUserTasks(dbPool))
app.post('/api/tasks/socket', notifyTaskCreated(dbPool, io))
app.put('/api/tasks/:id/status', updateTaskStatus(dbPool, io))
app.put('/api/tasks/editing/description/:id', updateTaskDescription(dbPool, io))
app.get('/api/tasks/:id/history', getTaskDescriptionHistory(dbPool))
app.get('/api/tasks/:taskId/comments', getTaskComments(dbPool))
app.post('/api/tasks/:taskId/comments', addTaskComment(dbPool))
app.get('/api/tasks/:taskId/messages-chat-task', getTaskMessages(dbPool))
app.post('/api/tasks/:taskId/messages-chat-task', sendTaskMessage(dbPool, io))
app.patch('/api/tasks/:taskId/messages-chat-task/:messageId', updateTaskMessage(dbPool, io))
app.delete('/api/tasks/:taskId/messages-chat-task/:messageId', deleteTaskMessage(dbPool, io))
app.post('/api/tasks/:taskId/mark-messages-as-read', markMessagesAsRead(dbPool))
app.post('/api/chat-files/add', addChatFile(dbPool))
app.get('/api/chat-files/:taskId', getChatFilesByTaskId(dbPool))
app.get('/api/tasks/hierarchy/:taskId', getTaskHierarchy(dbPool))
app.get('/api/tasks/:taskId/has-subtasks', hasSubtasks(dbPool))

cron.schedule('*/30 * * * 1-6', () => {
  checkOverdueTasks(dbPool, io)
  // console.log('Cron работает! Проверка каждую минуту.')
})

// таблица уведомлений
app.get('/api/notifications/unread/:userId', getUnreadNotifications(dbPool))
app.get('/api/notifications/check`', checkNotification(dbPool))

// Продление дедлайна
// Создание запроса на продление
app.post('/api/tasks/extension-request', createExtensionRequest(dbPool, io))
// Получение запросов по задаче
app.get(
  '/api/tasks/extension-requests/pending/:userId',
  getPendingExtensionRequestsForCreator(dbPool)
)
// Обработка запроса (утверждение/отклонение)
app.patch('/api/tasks/extension-requests/:requestId/reject', rejectExtensionRequest(dbPool, io))
app.patch('/api/tasks/extension-requests/:requestId/approve', approveExtensionRequest(dbPool, io))
app.patch('/api/tasks/:taskId/deadline', updateTaskDeadline(dbPool, io))

// Очитска уведомлений
app.patch('/api/notifications/:notificationId/read', markNotificationAsRead(dbPool))

//*** */
app.patch('/api/task/approv/:taskId/:userId/:approv', updateTaskApproval(dbPool, io))
app.patch('/api/task/accept/:taskId/:userId/:isDone', updateTaskAccept(dbPool, io))

// Сообщения в уведомлениях отправленные дилеру
app.get('/api/messages-notification-dealer', getMessagesNotificationDealer(dbPool))
app.post('/api/messages-notification-dealer', postMessagesNotificationDealer(dbPool))
// Проекты   **************************************************
app.get('/api/global-tasks/:globalTaskId/title', getGlobalTaskTitle(dbPool))
app.post('/api/create/global-tasks', createGlobalTask(dbPool, io))
app.get('/api/global-tasks-all', getGlobalTasks(dbPool))
app.get('/api/global-tasks-completed', getGlobalTasksCompleted(dbPool))
app.put('/api/update/global-tasks/:taskId', updateGlobalTask(dbPool, io))
app.get('/api/tasks/subtasks/:globalTaskId', getSubtasksForGlobalTask(dbPool))
app.delete('/api/global-tasks/delete/:taskId', deleteGlobalTask(dbPool, io))
app.get('/api/global-tasks/:taskId', getGlobalTaskById(dbPool))
app.put('/api/update/global-tasks/:taskId/status', updateGlobalTaskProcess(dbPool, io))
app.put('/api/global-tasks/:taskId/deadline', setProjectDeadline(dbPool, io))
app.get('/api/tasks/:id/attachments', getAttachmentsByTaskId(dbPool))
app.post('/api/global-tasks/:taskId/comments', addCommentToGlobalTask(dbPool))
app.post('/api/global-tasks/:taskId/responsibles-new', addResponsiblesToGlobalTask(dbPool, io))
app.delete('/api/global-tasks/:taskId/responsibles/:userId', removeResponsibleFromGlobalTask(dbPool, io))
app.post('/api/global-tasks/:taskId/approval', setProjectApproval(dbPool, io))
app.post('/api/global-tasks/:taskId/final-solutions', createFinalSolution(dbPool))
app.put('/api/global-tasks/:taskId/final-solutions/:solutionId', updateFinalSolution(dbPool))
app.delete('/api/global-tasks/:taskId/final-solutions/:solutionId', deleteFinalSolution(dbPool))
app.put('/api/global-tasks/:taskId/final-solutions/:solutionId/publish', publishFinalSolution(dbPool))
app.put('/api/global-tasks/:taskId/final-solutions/:solutionId/edit-email-thread', updateEmailThreadContent(dbPool))
app.post('/api/global-tasks/:taskId/final-solutions/:solutionId/thread-message', appendThreadMessage(dbPool))
app.patch('/api/global-tasks/:taskId/final-solutions/:solutionId/thread-messages/:messageIndex', updateThreadMessage(dbPool))
app.get('/api/global-tasks/:taskId/final-solutions/:solutionId/attachments/:attachmentId/download', downloadEmailAttachment(dbPool))
app.post('/api/global-tasks/:taskId/final-solutions/:solutionId/attachments/:attachmentId/add-to-project', addEmailAttachmentToProject(dbPool))
app.post('/api/global-tasks/:taskId/first-sent-email', createFirstSentEmailSolution(dbPool))
app.post('/api/project-sent-emails', saveProjectSentEmail(dbPool))
app.post('/api/project-reply-to-final-solution', createFinalSolutionFromEmailReply(dbPool))
app.put('/api/tasks/:id/update-goals', updateGoals(dbPool, io))
app.put('/api/tasks/:id/update-additional-info', updateAdditionalInfo(dbPool, io))
app.get('/api/global-tasks/chat/:globalTaskId', getChatMessages(dbPool))
app.post('/api/global-tasks/chat', sendChatMessage(dbPool, io))
app.patch(
  '/api/global-tasks/chat/:globalTaskId/:messageId',
  updateChatMessage(dbPool, io)
)
app.delete(
  '/api/global-tasks/chat/:globalTaskId/:messageId',
  deleteChatMessage(dbPool, io)
)

app.get('/api/global-task/:globalTaskId/history', getGlobalTaskHistory(dbPool))
app.post('/api/global-task/:globalTaskId/history', updateGlobalTaskHistory(dbPool))

// Эндпоинт для загрузки файла **************************************************Задачи**************
app.post('/api/upload', uploadFile.array('files'), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Файлы не были загружены.' })
    }

    // Список запрещенных типов файлов
    const forbiddenTypes = [
      'application/x-msdownload', // .exe
      'application/x-sh', // .sh
      'application/x-bat', // .bat
      'application/x-csh', // .csh
      'application/x-java-archive', // .jar
      'application/x-msdos-program', // .com
      'application/x-php', // .php
      'application/x-python-code', // .py
      'application/x-shellscript', // .sh
      'application/x-perl', // .pl
      'application/x-ruby', // .rb
      'application/x-javascript', // .js
      'application/x-httpd-php', // .php
      'application/x-httpd-php-source', // .php
    ]
    const explicitlyAllowedExtensions = ['.awds', '.awos', '.awoo']

    // Максимальный размер файла (250 МБ)
    const maxSize = 250 * 1024 * 1024

    const fileUrls = []

    // Проверка каждого файла
    req.files.forEach((file) => {
      const ext = path.extname(file.originalname || '').toLowerCase()
      const isExplicitlyAllowed = explicitlyAllowedExtensions.includes(ext)

      if (!isExplicitlyAllowed && forbiddenTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: `Тип файла ${file.originalname} запрещен.` })
      }

      // Проверка размера файла
      if (file.size > maxSize) {
        return res.status(400).json({ error: `Файл ${file.originalname} слишком большой.` })
      }

      const fileUrl = `/uploads/${file.filename}`
      fileUrls.push(fileUrl)
    })

    res.json({
      message: 'Файлы успешно загружены.',
      fileUrls, // Возвращаем URL'ы файлов
    })
  } catch (error) {
    console.error('Ошибка при загрузке файлов:', error)
    res.status(500).json({ error: 'Произошла ошибка при загрузке файлов.' })
  }
})

app.get('/api/task/download/:filename', (req, res) => {
  const filename = req.params.filename

  // Ищем файл в различных возможных местах
  const possiblePaths = [
    path.join(uploadsDir, filename), // Основная папка uploads
    path.join(__dirname, '..', '..', 'uploads', filename), // Корневая папка uploads
    path.join(__dirname, '..', '..', '..', 'uploads', filename), // Папка uploads на уровень выше
    path.join(__dirname, '..', '..', '..', '..', 'uploads', filename), // Папка uploads на два уровня выше
    path.join(__dirname, 'uploads', filename), // Локальная папка uploads
  ]

  let filePath = null
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      filePath = possiblePath
      console.log(`Файл "${filename}" найден по пути: ${filePath}`)
      break
    }
  }

  // Проверка существования файла
  if (!filePath) {
    console.warn(`Файл "${filename}" не найден ни в одном из возможных мест`)
    return res.status(404).json({ error: 'Файл не найден.' })
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Ошибка при скачивании файла:', err)
      res.status(500).json({ error: 'Произошла ошибка при скачивании файла.' })
    }
  })
})

// Новый эндпоинт для получения информации о файле
app.get('/api/task/file-info/:filename', (req, res) => {
  const filename = req.params.filename

  // Ищем файл в различных возможных местах
  const possiblePaths = [
    path.join(uploadsDir, filename), // Основная папка uploads
    path.join(__dirname, '..', '..', 'uploads', filename), // Корневая папка uploads
    path.join(__dirname, '..', '..', '..', 'uploads', filename), // Папка uploads на уровень выше
    path.join(__dirname, '..', '..', '..', '..', 'uploads', filename), // Папка uploads на два уровня выше
    path.join(__dirname, 'uploads', filename), // Локальная папка uploads
  ]

  let filePath = null
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      filePath = possiblePath
      console.log(`Файл "${filename}" найден для получения информации по пути: ${filePath}`)
      break
    }
  }

  // Проверка существования файла
  if (!filePath) {
    console.warn(
      `Файл "${filename}" не найден для получения информации ни в одном из возможных мест`
    )
    return res.status(404).json({ error: 'Файл не найден.' })
  }

  try {
    const stats = fs.statSync(filePath)
    const fileInfo = {
      filename: filename,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      created: stats.birthtime.toISOString(),
      mimetype: getMimeType(filename),
      path: filePath, // Добавляем путь для отладки
    }

    res.json(fileInfo)
  } catch (error) {
    console.error('Ошибка при получении информации о файле:', error)
    res.status(500).json({ error: 'Произошла ошибка при получении информации о файле.' })
  }
})

// Функция для определения MIME типа файла
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.odt': 'application/vnd.oasis.opendocument.text',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.odp': 'application/vnd.oasis.opendocument.presentation',
    '.awds': 'application/octet-stream',
    '.awos': 'application/octet-stream',
    '.awoo': 'application/octet-stream',
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

app.get('/api/task/uploads/:filename', (req, res) => {
  const filename = req.params.filename

  // Ищем файл в различных возможных местах
  const possiblePaths = [
    path.join(uploadsDir, filename), // Основная папка uploads
    path.join(__dirname, '..', '..', 'uploads', filename), // Корневая папка uploads
    path.join(__dirname, '..', '..', '..', 'uploads', filename), // Папка uploads на уровень выше
    path.join(__dirname, '..', '..', '..', '..', 'uploads', filename), // Папка uploads на два уровня выше
    path.join(__dirname, 'uploads', filename), // Локальная папка uploads
  ]

  let filePath = null
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      filePath = possiblePath
      console.log(`Файл "${filename}" найден для просмотра по пути: ${filePath}`)
      break
    }
  }

  if (!filePath) {
    console.warn(`Файл "${filename}" не найден для просмотра ни в одном из возможных мест`)
    return res.status(404).json({ error: 'Файл не найден.' })
  }

  const mimeType = mime.lookup(filePath)
  res.type(mimeType)
  res.sendFile(filePath)
})

// ==================== EDITOR HANDLE - РЕДАКТОР РУЧЕК ====================

// Получение всех данных для редактора
app.get('/api/editor-handle/data', getEditorData(dbPool))

// Типы створок
app.get('/api/editor-handle/leaf-types', getLeafTypes(dbPool))
app.post('/api/editor-handle/leaf-types', createLeafType(dbPool))
app.put('/api/editor-handle/leaf-types/:id', updateLeafType(dbPool))
app.delete('/api/editor-handle/leaf-types/:id', deleteLeafType(dbPool))

// Параметры
app.get('/api/editor-handle/parameters', getParameters(dbPool))
app.post('/api/editor-handle/parameters', createParameter(dbPool))
app.put('/api/editor-handle/parameters/:id', updateParameter(dbPool))
app.delete('/api/editor-handle/parameters/:id', deleteParameter(dbPool))

// Значения параметров
app.get('/api/editor-handle/parameters/:parameterId/values', getParameterValues(dbPool))
app.post('/api/editor-handle/parameters/:parameterId/values', createParameterValue(dbPool))
app.put('/api/editor-handle/parameter-values/:id', updateParameterValue(dbPool))
app.delete('/api/editor-handle/parameter-values/:id', deleteParameterValue(dbPool))

// Категории значений параметров
app.get('/api/editor-handle/categories', getParameterValueCategories(dbPool))
app.post('/api/editor-handle/categories', createParameterValueCategory(dbPool))
app.put('/api/editor-handle/categories/:id', updateParameterValueCategory(dbPool))
app.delete('/api/editor-handle/categories/:id', deleteParameterValueCategory(dbPool))
app.put('/api/editor-handle/parameter-values/:valueId/category', assignCategoryToValue(dbPool))

// Ручки
app.get('/api/editor-handle/handles', getHandles(dbPool))
app.post('/api/editor-handle/handles', createHandle(dbPool))
app.put('/api/editor-handle/handles/:id', updateHandle(dbPool))
app.delete('/api/editor-handle/handles/:id', deleteHandle(dbPool))

// Правила
app.get('/api/editor-handle/rules', getHandleRules(dbPool))
app.get('/api/editor-handle/rules/:id', getHandleRuleById(dbPool))
app.post('/api/editor-handle/rules', createHandleRule(dbPool))
app.put('/api/editor-handle/rules/:id', updateHandleRule(dbPool))
app.delete('/api/editor-handle/rules/:id', deleteHandleRule(dbPool))

// Подбор ручек по параметрам
app.post('/api/editor-handle/find-handles', findHandlesByParameters(dbPool))
app.post('/api/editor-handle/find-uncovered', findUncoveredCombinations(dbPool))

// Экспорт/Импорт
app.get('/api/editor-handle/export', exportRules(dbPool))
app.post('/api/editor-handle/import', importRules(dbPool))

// История изменений
app.get('/api/editor-handle/history', getHandleHistory(dbPool))

// Подтверждение эталонности
app.get('/api/editor-handle/approval-status', getApprovalStatus(dbPool))
app.post('/api/editor-handle/approve', approveHandleData(dbPool))
app.get('/api/editor-handle/approval-users', getApprovalUsers(dbPool))
app.post('/api/editor-handle/approval-users', addApprovalUser(dbPool))
app.delete('/api/editor-handle/approval-users/:id', removeApprovalUser(dbPool))
app.get('/api/editor-handle/all-users', getAllUsers(dbPool))

// Снапшоты и откат
app.post('/api/editor-handle/snapshots', createSnapshot(dbPool))
app.get('/api/editor-handle/snapshots', getSnapshots(dbPool))
app.post('/api/editor-handle/restore', restoreFromSnapshot(dbPool))
app.delete('/api/editor-handle/snapshots/:id', deleteSnapshot(dbPool))

// Права доступа к редактору ручек
app.get('/api/editor-handle/permissions', getEditorPermissions(dbPool))
app.get('/api/editor-handle/permissions/all', getAllEditorPermissions(dbPool))
app.post('/api/editor-handle/permissions', setEditorPermissions(dbPool))
app.delete('/api/editor-handle/permissions/:id', deleteEditorPermissions(dbPool))

// ==================== КОНЕЦ EDITOR HANDLE ====================

// Комнаты соккет
io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId // Получаем userId из запроса

  if (userId) {
    socket.join(String(userId)) // Комната по userId (строка), чтобы io.to(String(uid)).emit доходил
  }

  socket.on('disconnect', () => {})
})
