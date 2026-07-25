/**
 * Expo push для POZ-Staff с сервера register (веб + мобилка через BFF).
 * Таблица: mobile_staff_push_devices.
 * Не бросает наружу — ошибки только в лог.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const uniqueUserIds = (ids, excludeUserId) => {
  const exclude = Number(excludeUserId)
  return [
    ...new Set(
      (ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0 && id !== exclude)
    ),
  ]
}

const sendExpoPush = async ({ token, title, body, data }) => {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      sound: 'default',
      title: title || 'ПОЗ',
      body: body || '',
      data: data || {},
    }),
  })
  const json = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      (json && json.errors && json.errors[0] && json.errors[0].message) ||
        `Expo push HTTP ${response.status}`
    )
  }
  const ticket = Array.isArray(json?.data) ? json.data[0] : json?.data
  if (ticket?.status === 'error') {
    const errMsg = ticket.message || ticket.details?.error || 'Expo push error'
    const err = new Error(errMsg)
    err.code = ticket.details?.error
    throw err
  }
  return ticket
}

/**
 * @param {object} pool
 * @param {{ userIds: number[], title: string, body: string, data?: object, excludeUserId?: number }} args
 */
const notifyStaffDevices = async (
  pool,
  { userIds, title, body, data = {}, excludeUserId = null }
) => {
  const recipients = uniqueUserIds(userIds, excludeUserId)
  if (!pool || !recipients.length) return { sent: 0 }

  let devices
  try {
    devices = await pool.query(
      `SELECT user_id, expo_push_token
         FROM mobile_staff_push_devices
        WHERE user_id = ANY($1::int[]) AND is_active = TRUE`,
      [recipients]
    )
  } catch (error) {
    if (/mobile_staff_push_devices/i.test(error.message || '')) {
      return { sent: 0 }
    }
    console.warn('[staffMobilePush] devices', error.message)
    return { sent: 0 }
  }

  let sent = 0
  for (const row of devices.rows) {
    try {
      await sendExpoPush({
        token: row.expo_push_token,
        title,
        body,
        data: { ...data, userId: row.user_id },
      })
      sent += 1
    } catch (error) {
      console.warn('[staffMobilePush]', row.user_id, error.message)
      if (
        /DeviceNotRegistered|NotRegistered/i.test(error.message || '') ||
        error.code === 'DeviceNotRegistered'
      ) {
        try {
          await pool.query(
            `UPDATE mobile_staff_push_devices
                SET is_active = FALSE, updated_at = NOW()
              WHERE expo_push_token = $1`,
            [row.expo_push_token]
          )
        } catch (_) {}
      }
    }
  }
  return { sent }
}

/** Fire-and-forget обёртка */
const notifyStaffDevicesSafe = (pool, args) => {
  notifyStaffDevices(pool, args).catch((error) => {
    console.warn('[staffMobilePush] safe', error.message)
  })
}

const PROJECT_PUSH = {
  created: { title: 'Новый проект', body: (t) => t || 'Вас добавили в проект' },
  status: { title: 'Статус проекта', body: (t) => t || 'Изменён статус проекта' },
  deleted: { title: 'Проект удалён', body: (t) => t || 'Проект удалён' },
  deadline_set: { title: 'Срок проекта', body: (t) => t || 'Установлен срок проекта' },
  updated: { title: 'Проект обновлён', body: (t) => t || 'Проект обновлён' },
  responsiblesAdded: {
    title: 'Участники проекта',
    body: (t) => (t ? `Новые участники: ${t}` : 'Добавлены участники'),
  },
  participant_added: {
    title: 'Вас добавили в проект',
    body: (t) => t || 'Вас добавили в проект',
  },
  attachment: { title: 'Документ в проекте', body: (t) => t || 'Новое вложение' },
  subtask_added: { title: 'Подзадача в проекте', body: (t) => t || 'Добавлена подзадача' },
  progress_100: { title: 'Проект 100%', body: (t) => t || 'Проект выполнен на 100%' },
  final_solution_added: {
    title: 'Решение по проекту',
    body: (t) => t || 'Добавлено финальное решение',
  },
}

const notifyStaffProjectEvent = (pool, userIds, globalTaskId, reason, payload = {}) => {
  const conf = PROJECT_PUSH[reason] || {
    title: 'Проект',
    body: (t) => t || 'Обновление проекта',
  }
  const projectTitle = payload.title || null
  const exclude =
    payload.performedByUserId != null
      ? payload.performedByUserId
      : payload.authorId != null
        ? payload.authorId
        : null
  notifyStaffDevicesSafe(pool, {
    userIds,
    excludeUserId: exclude,
    title: conf.title,
    body: typeof conf.body === 'function' ? conf.body(projectTitle) : conf.body,
    data: {
      type: 'project',
      projectId: Number(globalTaskId),
      reason: reason || 'changed',
    },
  })
}

module.exports = {
  uniqueUserIds,
  notifyStaffDevices,
  notifyStaffDevicesSafe,
  notifyStaffProjectEvent,
}
