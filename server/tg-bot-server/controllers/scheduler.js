// controllers/scheduler.js
const cron = require('node-cron')
const { sendGroupCreationNotification } = require('./notificationSender') // Импортируйте функции для отправки уведомлений

async function checkAndSendGroupNotifications(bot, dbPool) {
  const now = new Date()
  const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000)

  const groupsQuery = `
    SELECT * 
    FROM work_groups 
    WHERE selected_date <= $1 
      AND selected_date > $2
      AND notification_sent = FALSE
      AND create_type IN ('range', 'fixed')
  `

  const groupsResult = await dbPool.query(groupsQuery, [threeHoursLater, now])

  for (const group of groupsResult.rows) {
    const participantIdsQuery = `
      SELECT user_id 
      FROM group_participants 
      WHERE work_groups_id = $1
    `
    const participantIdsResult = await dbPool.query(participantIdsQuery, [
      group.id,
    ])
    const participantIds = participantIdsResult.rows.map((row) => row.user_id)

    await sendGroupCreationNotification(bot, dbPool, participantIds, group)

    // Обновляем флаг отправленного уведомления
    await dbPool.query(
      'UPDATE work_groups SET notification_sent = TRUE WHERE id = $1',
      [group.id]
    )
  }
}

// Выявление просроченных уведомлений
async function checkDeadLineNotification(bot, dbPool) {
  try {
    // Получаем текущее время
    const currentTime = new Date()

    // Выполняем запрос для обновления записей
    //  NOW() + INTERVAL '1 minute' - прибавить
    // только если запись была более 14 минут назад, все записии более 14 минут назад + INTERVAL '1 minute'
    const result = await dbPool.query(
      ` 
      UPDATE reminders
      SET date_time = NOW()  
      WHERE is_completed = FALSE 
      AND (type_reminders = 'calculation' OR type_reminders = 'delivery_order' OR type_reminders = 'finances' OR type_reminders = 'verificationFinancial')
      AND date_time < NOW() - INTERVAL '14 minutes' 
      RETURNING *;
      `
    )

    // Если записи обновлены, выводим их
    if (result.rows.length > 0) {
      console.log('Обновленные напоминания:', result.rows)
    } else {
      console.log('Нет напоминаний для обновления.')
    }
  } catch (error) {
    console.error('Ошибка при обновлении напоминаний:', error)
  }
}

// Функция для запуска планировщика *****************************************
function startScheduler(bot, dbPool) {
  // Планировщик для рабочей группы
  cron.schedule('*/30 * * * 1-5', async () => {
    const currentHour = new Date().getHours()
    if (currentHour >= 20 || currentHour < 7) {
      return
    }

    await checkAndSendGroupNotifications(bot, dbPool)
  })

  // Планировщик для просроченных уведомлений каждые 14 минут с 8:00 до 19:00   // 8-19 * *
  cron.schedule('*/7 8-19 * * 1-5', async () => {
    try {
      await checkDeadLineNotification(bot, dbPool)
    } catch (error) {
      console.error('Ошибка в планировщике:', error)
    }
  })
}

module.exports = {
  startScheduler,
}
