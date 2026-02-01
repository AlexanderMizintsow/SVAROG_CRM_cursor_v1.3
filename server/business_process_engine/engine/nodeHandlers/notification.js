/**
 * Узел Уведомление: разрешить получателей, подстановки в тексте, in-app (reminder) и/или Telegram.
 */
function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

async function resolveRecipientUserIds(settings, context, registerClient) {
  const source = settings.recipientSource || 'users'
  if (source === 'users' && settings.userIds && settings.userIds.length) {
    return settings.userIds
  }
  if (source === 'department' && settings.departmentId) {
    const users = await registerClient.getUsers()
    return (users || []).filter((u) => u.department_id === settings.departmentId).map((u) => u.id)
  }
  if (source === 'role' && settings.roleId) {
    const users = await registerClient.getUsers()
    return (users || []).filter((u) => u.role_id === settings.roleId).map((u) => u.id)
  }
  if (source === 'initiator') {
    return context.initiator_id ? [context.initiator_id] : []
  }
  if (source === 'task_assignee' && settings.taskSourceNodeId && context.block_outputs) {
    const out = context.block_outputs[settings.taskSourceNodeId]
    if (!out || !out.task_id) return []
    const task = await registerClient.getTask(out.task_id)
    const assignees = (task && task.assignees) || []
    return assignees.map((a) => (typeof a === 'object' ? a.id : a))
  }
  return []
}

function substituteMessage(text, context, registerClient) {
  if (!text || typeof text !== 'string') return text
  let out = text
  if (context.initiator_id) {
    out = out.replace(/\{инициатор\}/gi, `Пользователь #${context.initiator_id}`)
  }
  if (context.last_task_id) {
    out = out.replace(/\{задача_id\}/gi, String(context.last_task_id))
  }
  return out
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg, telegramClient: tg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  const userIds = await resolveRecipientUserIds(settings, context, reg)
  if (userIds.length === 0) {
    // нет получателей — не ошибка, просто идём дальше
  } else {
    const messageText = substituteMessage(settings.messageText || '', context, reg)
    if (!messageText) {
      // пустой текст — всё равно идём дальше
    } else {
      const channels = settings.channels || {}
      if (channels.telegram && tg) {
        try {
          await tg.sendMessage(userIds, messageText)
        } catch (e) {
          console.warn('notification telegram sendMessage:', e.message)
        }
      }
      if (channels.inApp) {
        // in-app: пишем в таблицу BPE и показываем в AlertBanner как «БП»
        try {
          const title = settings.title || 'Уведомление (БП)'
          for (const uid of userIds) {
            await dbPool.query(
              `INSERT INTO bp_in_app_notifications (user_id, title, message, process_instance_id, node_id)
               VALUES ($1, $2, $3, $4, $5)`,
              [uid, title, messageText, instance.id, node.id]
            )
          }
        } catch (e) {
          console.warn('notification inApp insert:', e.message)
        }
      }
    }
  }

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) {
    return { fail: 'У узла Уведомление нет исходящего ребра' }
  }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }
