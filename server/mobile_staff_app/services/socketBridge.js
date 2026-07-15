const { Server } = require('socket.io')
const { io: ioClient } = require('socket.io-client')
const jwt = require('jsonwebtoken')
const { REGISTER_URL } = require('./registerClient')

const RELAY_EVENTS = [
  'taskCreated',
  'newMessage',
  'taskAccept',
  'taskApproval',
  'taskUpdateTaskStatus',
  'updateStatusSubTasks',
  'updateDescriptionTasks',
  'extendDeadline',
  'taskAttachment',
  'notification',
  'globalTaskChanged',
  'newMessageGlobalTaskChat',
]

/**
 * Socket.IO для POZ-Staff: мобильный клиент → mobile_staff_app → register.
 * На каждое авторизованное подключение — uplink в комнату userId на register.
 */
const setupSocketBridge = (httpServer) => {
  const corsOrigin = process.env.CORS_ORIGIN || '*'
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
      methods: ['GET', 'POST'],
    },
  })

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth && socket.handshake.auth.token) ||
        socket.handshake.query?.token ||
        ''
      if (!token) {
        return next(new Error('Unauthorized'))
      }
      const payload = jwt.verify(String(token), process.env.JWT_ACCESS_SECRET)
      if (payload.role !== 'employee') {
        return next(new Error('Forbidden'))
      }
      socket.data.userId = payload.userId
      return next()
    } catch (error) {
      return next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.userId
    socket.join(String(userId))

    const uplink = ioClient(REGISTER_URL, {
      query: { userId: String(userId) },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 20,
    })

    RELAY_EVENTS.forEach((eventName) => {
      uplink.on(eventName, (...args) => {
        try {
          socket.emit(eventName, ...args)
        } catch (error) {
          console.error('[socketBridge] relay emit', eventName, error.message)
        }
      })
    })

    uplink.on('connect_error', (err) => {
      console.warn('[socketBridge] register uplink error:', err.message)
    })

    socket.on('disconnect', () => {
      try {
        uplink.removeAllListeners()
        uplink.disconnect()
      } catch (_) {}
    })
  })

  console.log('[socketBridge] ready, uplink →', REGISTER_URL)
  return io
}

module.exports = { setupSocketBridge, RELAY_EVENTS }
