/**
 * Уведомления рабочих групп для POZ-Staff.
 * Только in-app (notifications) + Expo push. Telegram НЕ используется.
 */

const { notifyStaffUsers } = require('./staffPushService')
const { uniqueUserIds } = require('./staffNotifyHelpers')

const IMPORTANCE_LABELS = {
  low: 'низкая',
  medium: 'средняя',
  high: 'высокая',
}

const formatGroupDate = (dateString) => {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleString('ru-RU', {
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

const buildMessage = (createType, group, creatorName) => {
  const name = group.group_name || group.name || 'Рабочая группа'
  const description = group.description || ''
  const importance =
    IMPORTANCE_LABELS[group.importance] || group.importance || ''
  const when = formatGroupDate(group.selected_date)

  if (createType === 'range') {
    return [
      `Вас добавили в рабочую группу «${name}».`,
      description ? `Описание: ${description}` : null,
      `Создатель: ${creatorName}`,
      'Укажите даты, когда можете участвовать (раздел «Рабочая группа»).',
      importance ? `Важность: ${importance}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (createType === 'fixed') {
    return [
      `Назначена встреча рабочей группы «${name}».`,
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
      `Встреча рабочей группы «${name}» отменена.`,
      when ? `Была назначена на: ${when}` : null,
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
      description ? `Описание: ${description}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  }
  return `Рабочая группа «${name}»`
}

const pushTitleByType = (createType) => {
  if (createType === 'range') return 'Рабочая группа: голосование'
  if (createType === 'fixed') return 'Рабочая группа: дата назначена'
  if (createType === 'cancel') return 'Рабочая группа: отмена'
  if (createType === 'complect') return 'Рабочая группа: завершена'
  if (createType === 'reminder') return 'Рабочая группа: напоминание'
  return 'Рабочая группа'
}

const getCreatorName = async (pool, createdBy) => {
  if (!createdBy) return 'Неизвестный создатель'
  const result = await pool.query(
    `SELECT first_name, last_name, middle_name FROM users WHERE id = $1`,
    [createdBy]
  )
  if (!result.rows.length) return 'Неизвестный создатель'
  const { first_name, last_name, middle_name } = result.rows[0]
  return `${last_name || ''} ${first_name || ''} ${middle_name || ''}`.trim()
}

/**
 * In-app + push участникам. Без Telegram.
 * @param {object} opts
 * @param {number[]} opts.userIds
 * @param {object} opts.group — group_name, description, importance, selected_date, created_by, id
 * @param {string} opts.createType — range | fixed | cancel | complect | reminder
 * @param {number} [opts.excludeUserId]
 */
const notifyWorkGroupUsers = async (
  pool,
  { userIds, group, createType, excludeUserId }
) => {
  const recipients = uniqueUserIds(userIds, excludeUserId)
  if (!recipients.length || !group) return { inApp: 0, push: 0 }

  const creatorName = await getCreatorName(pool, group.created_by)
  const message = buildMessage(createType, group, creatorName)
  const eventType = `work_group_${createType}`
  const groupId = Number(group.id)
  const title = pushTitleByType(createType)
  const body = (group.group_name || 'Рабочая группа').slice(0, 120)

  let inApp = 0
  for (const userId of recipients) {
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, message, event_type, work_group_id, is_read, is_sent)
         VALUES ($1, NULL, $2, $3, $4, FALSE, FALSE)`,
        [userId, message, eventType, Number.isFinite(groupId) ? groupId : null]
      )
      inApp += 1
    } catch (error) {
      // fallback без work_group_id, если миграция ещё не применена
      if (/work_group_id/i.test(error.message || '')) {
        await pool.query(
          `INSERT INTO notifications (user_id, task_id, message, event_type, is_read, is_sent)
           VALUES ($1, NULL, $2, $3, FALSE, FALSE)`,
          [userId, message, eventType]
        )
        inApp += 1
      } else {
        console.warn('[workGroupNotify] in-app', error.message)
      }
    }
  }

  let push = { sent: 0 }
  try {
    push = await notifyStaffUsers(pool, {
      userIds: recipients,
      title,
      body,
      data: {
        type: eventType,
        workGroupId: Number.isFinite(groupId) ? groupId : undefined,
        createType,
      },
    })
  } catch (error) {
    console.warn('[workGroupNotify] push', error.message)
  }

  return { inApp, push: push.sent || 0 }
}

const getGroupParticipantIds = async (pool, groupId) => {
  const [groupRes, partsRes] = await Promise.all([
    pool.query(`SELECT * FROM work_groups WHERE id = $1`, [groupId]),
    pool.query(
      `SELECT user_id FROM group_participants WHERE work_groups_id = $1`,
      [groupId]
    ),
  ])
  if (!groupRes.rows.length) return { group: null, userIds: [] }
  const group = groupRes.rows[0]
  const userIds = [
    Number(group.created_by),
    ...partsRes.rows.map((r) => Number(r.user_id)),
  ]
  return { group, userIds: uniqueUserIds(userIds, null) }
}

module.exports = {
  notifyWorkGroupUsers,
  getGroupParticipantIds,
  formatGroupDate,
  IMPORTANCE_LABELS,
}
