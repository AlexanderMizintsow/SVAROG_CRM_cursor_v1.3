const WebSocket = require('ws')

let newsWss = null
let heartbeatTimer = null
const WS_HEARTBEAT_INTERVAL_MS = 25000

const getClientsCount = () => (newsWss ? newsWss.clients.size : 0)

const logWs = (message, extra = null) => {
  if (extra == null) {
    console.log(`[mobile_app][ws][news] ${message}`)
    return
  }
  console.log(`[mobile_app][ws][news] ${message}`, extra)
}

const initNewsEventsWs = (httpServer) => {
  newsWss = new WebSocket.Server({
    server: httpServer,
    path: '/ws/news',
  })
  logWs('server initialized')

  newsWss.on('connection', (socket) => {
    socket.isAlive = true
    const remoteIp = socket?._socket?.remoteAddress || ''
    logWs('client connected', { clients: getClientsCount(), remoteIp })
    socket.on('pong', () => {
      socket.isAlive = true
    })
    socket.on('close', (code, reasonBuffer) => {
      const reason = reasonBuffer ? String(reasonBuffer) : ''
      logWs('client disconnected', { clients: getClientsCount(), code, reason, remoteIp })
    })
    socket.on('error', (error) => {
      logWs('client socket error', { message: error?.message || 'Unknown WS error', remoteIp })
    })
  })

  heartbeatTimer = setInterval(() => {
    if (!newsWss) return
    newsWss.clients.forEach((socket) => {
      if (socket.isAlive === false) {
        logWs('heartbeat timeout -> terminate client')
        socket.terminate()
        return
      }
      socket.isAlive = false
      socket.ping()
    })
  }, WS_HEARTBEAT_INTERVAL_MS)

  newsWss.on('close', () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  })
}

const broadcastNewsEvent = (payload) => {
  if (!newsWss) return

  const message = JSON.stringify({
    type: String(payload?.type || ''),
    newsId: Number(payload?.newsId) || null,
    timestamp: Date.now(),
  })
  logWs('broadcast event', { type: payload?.type || '', newsId: Number(payload?.newsId) || null, clients: getClientsCount() })

  newsWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

module.exports = {
  initNewsEventsWs,
  broadcastNewsEvent,
}

