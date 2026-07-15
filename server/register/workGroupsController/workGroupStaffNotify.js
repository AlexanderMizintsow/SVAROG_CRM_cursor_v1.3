/**
 * Единый notify рабочих групп для Staff (веб + мобилка).
 * Источник истины — сервер register после мутаций.
 * Telegram НЕ вызывается.
 *
 * 1) INSERT notifications (in-app)
 * 2) io.emit('notification') + groupCreated
 * 3) Expo push на mobile_staff_push_devices
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const IMPORTANCE_LABELS = {
  low: 'низкая',
  medium: 'средняя',
  high: 'высокая',
}

const formatGroupDate = (dateString) => {
  if (!dateString) return ''
  try {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(dateString)
  }
}

const uniqueIds = (ids, excludeUserId) => {
  const exclude = Number(excludeUserId)
  return [
    ...new Set(
      (ids || [])
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0 && id !== exclude)
    ),
  ]
}

const buildMessage = (createType, group, creatorName) => {
  const name = group.group_name || 'Рабочая группа'
  const description = group.description || ''
  const importance =
    IMPORTANCE_LABELS[group.importance] || group.importance || ''
  const when = formatGroupDate(group.selected_date)

  if (createType === 'range') {
    return [
      `Вас добавили в рабочую группу «${name}».`,
      description ? `Описание: ${description}` : null,
      `Создатель: ${creatorName}`,
      'Укажите даты участия во вкладке «Рабочие группы» / в приложении.',
      importance ? `Важность: ${importance}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (createType === 'fixed') {
    return [
      `Назначена встреча «${name}».`,
      description ? `Описание: ${description}` : null,
      `Создатель: ${creatorName}`,
      when ? `Дата: ${when}` : null,
      importance ? `Важность: ${importance}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (createType === 'cancel') {
    return [
      `Встреча «${name}» отменена.`,
      when ? `Была на: ${when}` : null,
      `Создатель: ${creatorName}`,
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (createType === 'complect') {
    return [
      `Рабочая группа «${name}» завершена.`,
      `Создатель: ${creatorName}`,
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (createType === 'reminder') {
    return [
      `Напоминание: скоро встреча «${name}».`,
      when ? `Дата: ${when}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  }
  return `Рабочая группа «${name}»`
}

const pushTitle = (createType) => {
  if (createType === 'range') return 'Рабочая группа: голосование'
  if (createType === 'fixed') return 'Рабочая группа: дата'
  if (createType === 'cancel') return 'Рабочая группа: отмена'
  if (createType === 'complect') return 'Рабочая группа: завершена'
  if (createType === 'reminder') return 'Рабочая группа: напоминание'
  return 'Рабочая группа'
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
      title,
      body,
      data: data || {},
    }),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json?.data?.status === 'error') {
    const message =
      json?.data?.message || json?.errors?.[0]?.message || `push ${response.status}`
    throw new Error(message)
  }
}

/**
 * @param {import('pg').Pool} dbPool
 * @param {import('socket.io').Server|null} io
 * @param {{ groupId: number, createType: string, excludeUserId?: number|null, groupOverride?: object }} opts
 */
const notifyWorkGroupStaff = async (
  dbPool,
  io,
  { groupId, createType, excludeUserId = null, groupOverride = null }
) => {
  const id = Number(groupId)
  if (!id || !createType) return { inApp: 0, push: 0 }

  const groupRes = await dbPool.query(`SELECT * FROM work_groups WHERE id = $1`, [
    id,
  ])
  if (!groupRes.rows.length) return { inApp: 0, push: 0 }

  const group = { ...groupRes.rows[0], ...(groupOverride || {}) }
  const partsRes = await dbPool.query(
    `SELECT user_id FROM group_participants WHERE work_groups_id = $1`,
    [id]
  )
  const userIds = uniqueIds(
    [group.created_by, ...partsRes.rows.map((r) => r.user_id)],
    excludeUserId
  )
  if (!userIds.length) return { inApp: 0, push: 0 }

  let creatorName = 'Неизвестный создатель'
  const creatorRes = await dbPool.query(
    `SELECT first_name, last_name, middle_name FROM users WHERE id = $1`,
    [group.created_by]
  )
  if (creatorRes.rows.length) {
    const { first_name, last_name, middle_name } = creatorRes.rows[0]
    creatorName = `${last_name || ''} ${first_name || ''} ${middle_name || ''}`.trim()
  }

  const message = buildMessage(createType, group, creatorName)
  const eventType = `work_group_${createType}`
  const title = pushTitle(createType)
  const body = String(group.group_name || 'Рабочая группа').slice(0, 120)

  let inApp = 0
  for (const userId of userIds) {
    try {
      await dbPool.query(
        `INSERT INTO notifications (user_id, task_id, message, event_type, work_group_id, is_read, is_sent)
         VALUES ($1, NULL, $2, $3, $4, FALSE, FALSE)`,
        [userId, message, eventType, id]
      )
      inApp += 1
    } catch (error) {
      if (/work_group_id/i.test(error.message || '')) {
        await dbPool.query(
          `INSERT INTO notifications (user_id, task_id, message, event_type, is_read, is_sent)
           VALUES ($1, NULL, $2, $3, FALSE, FALSE)`,
          [userId, message, eventType]
        )
        inApp += 1
      } else {
        console.warn('[workGroupStaffNotify] in-app', error.message)
      }
    }

    if (io) {
      try {
        io.emit('notification', {
          type: eventType,
          userId,
          workGroupId: id,
          message,
          title: group.group_name,
        })
      } catch (_) {}
    }
  }

  let pushSent = 0
  try {
    const devices = await dbPool.query(
      `SELECT user_id, expo_push_token
         FROM mobile_staff_push_devices
        WHERE user_id = ANY($1::int[]) AND is_active = TRUE`,
      [userIds]
    )
    for (const row of devices.rows) {
      try {
        await sendExpoPush({
          token: row.expo_push_token,
          title,
          body,
          data: {
            type: eventType,
            workGroupId: id,
            createType,
            userId: row.user_id,
          },
        })
        pushSent += 1
      } catch (error) {
        console.warn('[workGroupStaffNotify] push', row.user_id, error.message)
        if (/DeviceNotRegistered|NotRegistered/i.test(error.message || '')) {
          await dbPool.query(
            `UPDATE mobile_staff_push_devices
                SET is_active = FALSE, updated_at = NOW()
              WHERE expo_push_token = $1`,
            [row.expo_push_token]
          )
        }
      }
    }
  } catch (error) {
    // таблицы push может не быть — не ломаем ответ API
    if (!/mobile_staff_push_devices/i.test(error.message || '')) {
      console.warn('[workGroupStaffNotify] devices', error.message)
    }
  }

  if (io) {
    try {
      io.emit('groupCreated')
    } catch (_) {}
  }

  return { inApp, push: pushSent }
}

module.exports = {
  notifyWorkGroupStaff,
}
