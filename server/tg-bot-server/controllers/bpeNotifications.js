// controllers/bpeNotifications.js
// Endpoint для Бизнес-процессов: отправка Telegram уведомлений по user_id приложения.

async function resolveRegisteredChatIds(dbPool, userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) return []
  const cleanIds = userIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)

  if (cleanIds.length === 0) return []

  // Берём только зарегистрированных пользователей
  const res = await dbPool.query(
    `
    SELECT user_id, chat_id
    FROM telegramm_registrations_chat
    WHERE registered = true
      AND user_id = ANY($1::int[])
      AND chat_id IS NOT NULL
    `,
    [cleanIds]
  )
  return res.rows || []
}

function buildResultMap(userIds) {
  const m = new Map()
  ;(userIds || []).forEach((idRaw) => {
    const id = Number(idRaw)
    if (Number.isFinite(id) && id > 0) {
      m.set(id, { user_id: id, sent: false, reason: 'not_registered' })
    }
  })
  return m
}

function sendBpeMessage(bot, dbPool) {
  return async function (req, res) {
    const { user_ids: userIds, message } = req.body || {}

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'user_ids должен быть массивом и не пустым' })
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message должен быть непустой строкой' })
    }

    try {
      const resultMap = buildResultMap(userIds)
      const chatRows = await resolveRegisteredChatIds(dbPool, userIds)

      // Отправляем сообщения только тем, кто зарегистрирован
      await Promise.all(
        chatRows.map(async ({ user_id, chat_id }) => {
          try {
            await bot.sendMessage(chat_id, message.trim())
            resultMap.set(Number(user_id), { user_id: Number(user_id), sent: true })
          } catch (e) {
            resultMap.set(Number(user_id), {
              user_id: Number(user_id),
              sent: false,
              reason: 'send_failed',
              error: e?.message || String(e),
            })
          }
        })
      )

      const results = Array.from(resultMap.values())
      const sent = results.filter((r) => r.sent).length
      const notRegistered = results.filter((r) => !r.sent && r.reason === 'not_registered').length
      const failed = results.filter((r) => !r.sent && r.reason === 'send_failed').length

      return res.status(200).json({
        success: true,
        totals: { sent, not_registered: notRegistered, failed },
        results,
      })
    } catch (e) {
      console.error('bpeNotifications.sendBpeMessage:', e)
      return res.status(500).json({ error: 'Ошибка отправки Telegram уведомления (BPE)' })
    }
  }
}

module.exports = { sendBpeMessage }

