//файл notificationSender.js
// Функция для уведомления руководителя
async function notifySupervisor(bot, dbPool, userId, reminder) {
  // Отправка уведомления руководителю отдела (жалуемся по полной)
  const supervisorResult = await dbPool.query(
    `SELECT d.head_user_id,
     CONCAT(current.first_name,' ', current.middle_name,' ', current.last_name) AS implementer 
     FROM users AS current
     JOIN departments AS d ON current.department_id = d.id
     WHERE current.id = $1`,
    [userId]
  )

  if (supervisorResult.rows.length > 0) {
    const headUserId = supervisorResult.rows[0].head_user_id
    const implementer = supervisorResult.rows[0].implementer

    const settingsHeadResult = await dbPool.query(
      'SELECT showOverdueImplementer FROM calls_settings_users WHERE user_id = $1',
      [headUserId]
    )
    const { showoverdueimplementer } = settingsHeadResult.rows[0]

    // Проверка на наличие chat_id для руководителя

    if (showoverdueimplementer) {
      const supervisorChatIdResult = await dbPool.query(
        'SELECT chat_id FROM telegramm_registrations_chat WHERE user_id = $1',
        [headUserId]
      )

      if (supervisorChatIdResult.rows.length > 0) {
        const supervisorChatId = supervisorChatIdResult.rows[0].chat_id

        let messageHeadUser = `⚠️🔔 *ВНИМАНИЕ: Просроченный запрос дилера!* Ожидание составляет более 15 минут! ⏰❌
        
        📋 *Уведомление:* ${reminder.title}
        💬 *Комментарий:* ${reminder.comment || 'Нет комментария'}
        👤 *Исполнитель:* ${implementer}
        
        Руководитель, обратите внимание – у ваших подчинённых есть невыполненные запросы дилеров. Пожалуйста, примите необходимые меры для скорейшего завершения по данному запросу.
        `

        // Отправляем уведомление руководителю
        await bot.sendMessage(supervisorChatId, messageHeadUser)
      }
    }
  }
}

async function sendMissedCallNotifications(
  bot,
  dbPool,
  client,
  lastNotificationTime
) {
  try {
    // Запрашиваем chatId и userId всех зарегистрированных пользователей
    const chatIdResult = await dbPool.query(
      'SELECT chat_id, user_id FROM telegramm_registrations_chat WHERE registered = $1',
      [true]
    )

    // Отправляем сообщение каждому зарегистрированному пользователю
    for (const row of chatIdResult.rows) {
      const { chat_id, user_id } = row

      // Запрашиваем настройки звонков для пользователя
      const settingsResult = await dbPool.query(
        'SELECT showCallMissedTg, showMissedCallsEmployee FROM calls_settings_users WHERE user_id = $1',
        [user_id]
      )

      if (settingsResult.rows.length === 0) {
        continue // Если настройки не найдены, переходим к следующему пользователю
      }

      const { showcallmissedtg, showmissedcallsemployee } =
        settingsResult.rows[0]

      // Устанавливаем значение n на основе showMissedCallsEmployee
      const n = showmissedcallsemployee

      // Запрос на получение общего количества пропущенных звонков
      const totalCountQuery = n
        ? 'SELECT COUNT(*) FROM calls WHERE status = $1'
        : 'SELECT COUNT(*) FROM calls WHERE status = $1 AND LENGTH(caller_number) > 3'

      const totalCountParams = n ? ['missed'] : ['missed']
      const totalCountResult = await client.query(
        totalCountQuery,
        totalCountParams
      )
      const totalCount = totalCountResult.rows[0].count

      // Запрос на получение всех пропущенных звонков, добавленных после последнего уведомления
      const resultQuery = n
        ? 'SELECT * FROM calls WHERE status = $1 AND accepted_at > $2'
        : 'SELECT * FROM calls WHERE status = $1 AND accepted_at > $2 AND LENGTH(caller_number) > 3'

      const resultParams = n
        ? ['missed', lastNotificationTime]
        : ['missed', lastNotificationTime]
      const result = await client.query(resultQuery, resultParams)

      let message = `🔔 Пропущенные звонки 📞\nКоличество пропущенных звонков: ${totalCount}\n`

      // Определяем validCalls перед добавлением в message
      const validCalls = result.rows.filter(
        (call) => call.caller_number !== null
      )

      if (validCalls.length > 0) {
        message += 'Новые пропущенные звонки:\n'

        validCalls.forEach((call) => {
          message += `
            ID: ${call.id}
            Номер звонящего: ${call.caller_number}
            Номер получателя: ${call.receiver_number || 'Не указано'}
            Дата звонка: ${new Date(call.accepted_at).toLocaleString('ru-RU')}
          `
        })
      }

      // Проверяем настройки перед отправкой сообщения
      if (validCalls.length > 0 && showcallmissedtg) {
        await bot.sendMessage(chat_id, message)
      }
    }

    // Обновляем время последнего уведомления
    return new Date()
  } catch (error) {
    console.error('Ошибка при отправке уведомления:', error)
  }
}

//*************************************************************************** */
async function sendReminderNotifications(bot, dbPool) {
  try {
    const now = new Date()
    const threeMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000) // 2 минуты назад
    const excludedTypes = [
      'calculation',
      'delivery_order',
      'finances',
      'verificationFinancial',
    ]
    // Запрашиваем все напоминания, которые еще не выполнены и время оповещение позднее 2 минут назад от настоящего времени
    // Это напоминание связано с компонентом поставить напоминание на определенную дату и время с комментарием из компонента пропущенные звонки
    // Так же ищет любые уведомления по типу type_reminders за период 2 минуты назад
    const remindersQuery = `
    SELECT * 
FROM reminders 
WHERE date_time <= $1 
AND date_time >= $2 
AND is_completed = FALSE  
AND (type_reminders = 'call' OR type_reminders = 'calculation' OR type_reminders = 'delivery_order' OR type_reminders = 'finances' OR type_reminders = 'verificationFinancial')
AND NOT (type_reminders IN ('calculation', 'delivery_order', 'finances', 'verificationFinancial') AND date_trunc('minute', created_at) = date_trunc('minute', date_time))
    `
    const remindersResult = await dbPool.query(remindersQuery, [
      now,
      threeMinutesAgo,
    ])

    // Группируем напоминания по user_id
    const remindersByUser = {}
    remindersResult.rows.forEach((reminder) => {
      if (!remindersByUser[reminder.user_id]) {
        remindersByUser[reminder.user_id] = []
      }
      remindersByUser[reminder.user_id].push(reminder)
    })

    // Отправляем сообщение каждому пользователю, имеющему актуальные напоминания type_reminders = 'call'
    for (const userId in remindersByUser) {
      const userReminders = remindersByUser[userId]

      const settingsResult = await dbPool.query(
        'SELECT showRemindersCalls, showOverdueNotification  FROM calls_settings_users WHERE user_id = $1',
        [userId]
      )

      //  if (settingsResult.rows.length === 0) {
      //    continue // Если настройки не найдены, переходим к следующему пользователю
      //   }

      const { showreminderscalls, showoverduenotification } =
        settingsResult.rows[0]

      const chatIdResult = await dbPool.query(
        'SELECT chat_id FROM telegramm_registrations_chat WHERE user_id = $1',
        [userId]
      )

      if (chatIdResult.rows.length > 0) {
        const chat_id = chatIdResult.rows[0].chat_id
        // Отправляем каждое напоминание отдельным сообщением
        for (const reminder of userReminders) {
          // Уведомления для напоминаний *******
          if (reminder.type_reminders === 'call') {
            if (!showreminderscalls) {
              continue
            }
            let message = `🗓️  ⚠️ *Напоминание:* ⚠️\n
            Необходимо выполнить: ${new Date(reminder.date_time).toLocaleString(
              'ru-RU'
            )} 
             Сообщение: ${reminder.comment || 'Нет комментария'} 
           `
            // Отправляем каждое сообщение
            await bot.sendMessage(chat_id, message)
          }

          // Уведомления для истекших сроков *******
          if (excludedTypes.includes(reminder.type_reminders)) {
            await notifySupervisor(bot, dbPool, userId, reminder)
            if (!showoverduenotification) {
              continue
            }

            let message = `⚠️ *Просроченный запрос дилера!* ⚠️
            Уведомление: ${reminder.title}
            Сообщение: ${reminder.comment || 'Нет комментария'}
            
            ⏰ *Важно:* Пожалуйста, примите меры для оперативного завершения запроса.
            `
            // Отправляем каждое сообщение
            await bot.sendMessage(chat_id, message)
          }
        }
      }
    }
  } catch (error) {
    console.error('Ошибка при отправке напоминаний:', error)
  }
}

// Быстрые уведомления при создании
async function sendGroupCreationNotification(
  bot,
  dbPool,
  participantIds,
  groupData
) {
  try {
    const promises = participantIds.map(async (userId) => {
      const userChatIdResult = await dbPool.query(
        'SELECT chat_id FROM telegramm_registrations_chat WHERE user_id = $1',
        [userId]
      )

      const formatDate = (dateString) => {
        const date = new Date(dateString)
        return date.toLocaleString('ru-RU', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      }

      // Запрос для получения данных создателя группы
      const creatorResult = await dbPool.query(
        'SELECT first_name, last_name, middle_name FROM users WHERE id = $1',
        [groupData.created_by]
      )

      let creatorName = 'Неизвестный создатель'
      if (creatorResult.rows.length > 0) {
        const { first_name, last_name, middle_name } = creatorResult.rows[0]
        creatorName = `${last_name} ${first_name} ${middle_name || ''}`.trim()
      }

      if (userChatIdResult.rows.length > 0) {
        const chatId = userChatIdResult.rows[0].chat_id
        if (groupData.create_type === 'range') {
          rangeMes = `
        📣 **Уведомление!**
        Вы были добавлены в рабочую группу "${groupData.group_name}". 
        Описание: ${groupData.description} 
        Создатель: ${creatorName}
        Необходимо указать даты, в которые вы можете присутствовать.
        Это можно сделать в приложении BPM, вкладка "Рабочие группы"
        Важность: ${groupData.importance} 
      `
        }
        if (groupData.create_type === 'fixed') {
          rangeMes = `
        📣 **Уведомление!**
        Вы являетесь участником рабочей группы "${groupData.group_name}". 
        Описание: ${groupData.description} 
        Создатель: ${creatorName}
        Необходимо принять участие в назначенную дату:
        ${formatDate(groupData.selected_date)}  
        Важность: ${groupData.importance} 
      `
        }
        if (groupData.create_type === 'cancel') {
          rangeMes = `
        📣 **Уведомление об ОТМЕНЕ совещания!**
        Вы являетесь участником рабочей группы "${groupData.group_name}". 
        Описание: ${groupData.description} 
        Создатель: ${creatorName}
        Встреча по данной группе на ${formatDate(groupData.selected_date)}  
        была **ОТМЕНЕНА**! ❌  
      `
        }

        if (groupData.create_type === 'complect') {
          rangeMes = `
        📣 **Уведомление!**
        Вы были участником рабочей группы "${groupData.group_name}". 
        Описание: ${groupData.description} 
        Создатель: ${creatorName}
        С данного момента деятельность рабочей группы считается завершенной! ✅  
      `
        }

        const message = rangeMes

        await bot.sendMessage(chatId, message)
      }
    })

    await Promise.all(promises)
  } catch (error) {
    console.error('Ошибка при отправке уведомления о создании группы:', error)
  }
}

module.exports = {
  sendMissedCallNotifications,
  sendReminderNotifications,
  sendGroupCreationNotification,
}
