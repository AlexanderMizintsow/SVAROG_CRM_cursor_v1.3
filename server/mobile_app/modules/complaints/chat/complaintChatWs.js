const WebSocket = require('ws')
const jwt = require('jsonwebtoken')
const {
  getThreadByDraft,
  getThreadByReminder,
  verifyReminderManager,
} = require('./complaintChatService')

let wss = null
const threadSockets = new Map()

const addToThread = (threadId, socket) => {
  const key = String(threadId)
  if (!threadSockets.has(key)) threadSockets.set(key, new Set())
  threadSockets.get(key).add(socket)
  socket.__complaintThreadId = key
}

const removeFromThread = (socket) => {
  const key = socket.__complaintThreadId
  if (!key) return
  const set = threadSockets.get(key)
  if (set) {
    set.delete(socket)
    if (set.size === 0) threadSockets.delete(key)
  }
  socket.__complaintThreadId = null
}

const broadcastComplaintChat = (threadId, payload) => {
  if (!wss) return
  const key = String(threadId)
  const set = threadSockets.get(key)
  if (!set) return
  const data = JSON.stringify({
    type: 'complaint_chat_message',
    threadId: Number(threadId),
    payload,
  })
  set.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data)
  })
}

const broadcastComplaintChatThread = (threadId, eventType, payload) => {
  if (!wss) return
  const key = String(threadId)
  const set = threadSockets.get(key)
  if (!set) return
  const data = JSON.stringify({
    type: eventType,
    threadId: Number(threadId),
    payload,
  })
  set.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data)
  })
}

const initComplaintChatWs = ({ pool }) => {
  wss = new WebSocket.Server({
    noServer: true,
    path: '/ws/complaint-chat',
    perMessageDeflate: false,
  })

  wss.on('connection', (socket) => {
    let authed = false
    const authTimer = setTimeout(() => {
      if (!authed) {
        socket.close(4001, 'auth timeout')
      }
    }, 12000)

    socket.on('close', () => {
      clearTimeout(authTimer)
      removeFromThread(socket)
    })

    socket.on('message', async (raw) => {
      let msg
      try {
        msg = JSON.parse(String(raw || ''))
      } catch (e) {
        return
      }

      if (!authed) {
        if (msg.type === 'auth_dealer') {
          try {
            const token = String(msg.token || '')
            const draftId = Number(msg.draftId)
            const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
            if (payload.role !== 'dealer' || !payload.companyId) {
              socket.close(4002, 'invalid token')
              return
            }
            const thread = await getThreadByDraft(pool, payload.companyId, draftId)
            if (!thread) {
              socket.close(4003, 'no thread')
              return
            }
            authed = true
            clearTimeout(authTimer)
            addToThread(thread.id, socket)
            socket.send(JSON.stringify({ type: 'auth_ok', threadId: thread.id }))
          } catch (e) {
            socket.close(4002, 'invalid token')
          }
          return
        }

        if (msg.type === 'auth_manager') {
          const expected = String(process.env.COMPLAINT_MANAGER_CHAT_SECRET || '').trim()
          const secret = String(msg.secret || '')
          const managerUserId = Number(msg.managerUserId)
          const reminderId = Number(msg.reminderId)
          if (!expected || secret !== expected || !Number.isFinite(managerUserId) || !Number.isFinite(reminderId)) {
            socket.close(4002, 'invalid manager auth')
            return
          }
          const ok = await verifyReminderManager(pool, reminderId, managerUserId)
          if (!ok) {
            socket.close(4003, 'reminder denied')
            return
          }
          const thread = await getThreadByReminder(pool, reminderId, managerUserId)
          if (!thread) {
            socket.close(4004, 'no thread')
            return
          }
          authed = true
          clearTimeout(authTimer)
          addToThread(thread.id, socket)
          socket.send(JSON.stringify({ type: 'auth_ok', threadId: thread.id }))
          return
        }

        socket.close(4002, 'auth required')
        return
      }

      if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', t: Date.now() }))
      }
    })
  })
}

const handleComplaintChatWebSocketUpgrade = (req, socket, head) => {
  if (!wss) return
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
}

module.exports = {
  initComplaintChatWs,
  handleComplaintChatWebSocketUpgrade,
  broadcastComplaintChat,
  broadcastComplaintChatThread,
}
