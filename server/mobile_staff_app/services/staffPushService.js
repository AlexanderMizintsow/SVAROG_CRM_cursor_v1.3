/**
 * Push / in-app уведомления для POZ-Staff.
 *
 * ВАЖНО ДЛЯ РАЗРАБОТКИ:
 * При добавлении новых событий (задача создана, сообщение, согласование, дедлайн и т.д.)
 * подключайте уведомления здесь — см. notifyStaffUsers / enqueueStaffPush.
 * Не дублируйте отправку Expo Push в экранах клиента: источник истины — сервер.
 *
 * Цепочка:
 * 1) Запись в CRM `notifications` (уже делают контроллеры register) — список во вкладке.
 * 2) Socket `notification` → живое обновление списка (socketBridge).
 * 3) Вызов notifyStaffUsers(...) → Expo Push на устройства из mobile_staff_push_devices.
 *
 * Firebase: проект poz-mobile-push. Для Staff package = com.poz.staff
 * (НЕ менять android-app com.poz.mobile — это дилерский POZ).
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const isExpoPushToken = (token) =>
  /^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(String(token || ''))

const sendExpoPushMessage = async ({ token, title, body, data }) => {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }),
  })
  const responseJson = await response.json().catch(() => ({}))
  if (!response.ok || responseJson?.data?.status === 'error') {
    const message =
      responseJson?.data?.message ||
      responseJson?.errors?.[0]?.message ||
      `Expo push error: ${response.status}`
    throw new Error(message)
  }
  return responseJson
}

const registerStaffPushDevice = async (
  pool,
  { userId, token, platform, appVersion }
) => {
  if (!userId || !isExpoPushToken(token)) {
    throw new Error('Некорректный userId или Expo push token')
  }
  await pool.query(
    `INSERT INTO mobile_staff_push_devices
      (user_id, expo_push_token, platform, app_version, is_active, last_seen_at, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
     ON CONFLICT (user_id, expo_push_token)
     DO UPDATE SET
       platform = EXCLUDED.platform,
       app_version = EXCLUDED.app_version,
       is_active = TRUE,
       last_seen_at = NOW(),
       updated_at = NOW()`,
    [userId, token, platform || 'android', appVersion || null]
  )
}

/**
 * Отправить push сотрудникам.
 * @param {import('pg').Pool} pool
 * @param {object} opts
 * @param {number[]} opts.userIds — получатели (CRM users.id)
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {object} [opts.data] — payload для deep-link (type, taskId, projectId, ...)
 *
 * Типы data.type (соглашение для клиента):
 * - task_created | task_message | task_status | task_decision | task_extension
 * - project_changed | project_message | project_approval
 * - generic
 */
const notifyStaffUsers = async (pool, { userIds, title, body, data }) => {
  const ids = [...new Set((userIds || []).map(Number).filter((id) => id > 0))]
  if (!ids.length) return { sent: 0 }

  const devices = await pool.query(
    `SELECT user_id, expo_push_token
       FROM mobile_staff_push_devices
      WHERE user_id = ANY($1::int[]) AND is_active = TRUE`,
    [ids]
  )

  let sent = 0
  for (const row of devices.rows) {
    try {
      await sendExpoPushMessage({
        token: row.expo_push_token,
        title,
        body,
        data: {
          ...(data || {}),
          userId: row.user_id,
        },
      })
      sent += 1
    } catch (error) {
      console.warn('[mobile_staff_app][push] send failed', {
        userId: row.user_id,
        message: error.message,
      })
      if (/DeviceNotRegistered|NotRegistered/i.test(error.message || '')) {
        await pool.query(
          `UPDATE mobile_staff_push_devices
              SET is_active = FALSE, updated_at = NOW()
            WHERE expo_push_token = $1`,
          [row.expo_push_token]
        )
      }
    }
  }
  return { sent }
}

module.exports = {
  registerStaffPushDevice,
  notifyStaffUsers,
  isExpoPushToken,
}
