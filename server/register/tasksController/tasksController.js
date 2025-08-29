// tasksController.js
const { DateTime } = require('luxon')

// Функция для форматирования даты
function formatDeadline(dateString) {
  try {
    // Просто форматируем исходную дату без изменения времени
    const date = new Date(dateString)

    if (isNaN(date.getTime())) {
      return 'дата не определена'
    }

    // Форматируем как есть (без изменения часового пояса)
    return date
      .toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace(',', '')
  } catch (e) {
    console.error('Ошибка форматирования даты:', e)
    return 'дата не определена'
  }
}

// Функция для получения задачи по taskId
function getTaskById(dbPool) {
  return async function (req, res) {
    const { taskId } = req.params // Получаем taskId из параметров запроса

    try {
      // Формируем SQL-запрос для получения задачи по taskId
      const result = await dbPool.query('SELECT * FROM tasks WHERE id = $1', [taskId])

      if (result.rows.length === 0) {
        return res.status(404).send('Задача не найдена') // Обработка случая, когда задача не найдена
      }

      res.json(result.rows[0]) // Возвращаем найденную задачу в формате JSON
    } catch (error) {
      console.error('Ошибка при получении задачи:', error)
      res.status(500).send('Ошибка сервера') // Обрабатываем ошибки
    }
  }
}

function createTask(dbPool, io) {
  return async function (req, res) {
    const {
      title,
      description,
      created_by,
      deadline,
      priority,
      tags,
      status,
      global_task_id,
      parent_id,
      root_id,
    } = req.body

    const deadlineValue = deadline === '' ? null : deadline

    const tagsValue =
      typeof tags === 'object' ? '[{"title":"Без тэга","bg":"#cffafe","text":"#0891b2"}]' : tags

    try {
      // Определяем root_id: если он не передан, используем parent_id или null
      const finalRootId = root_id || parent_id || null

      console.log(root_id)
      console.log(parent_id)

      const result = await dbPool.query(
        `INSERT INTO tasks (
          title, description, created_by, deadline, priority, 
          tags, status, global_task_id, parent_id, root_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          title,
          description,
          created_by,
          deadlineValue,
          priority,
          JSON.stringify(tagsValue),
          status,
          global_task_id,
          parent_id || null, // parent_id может быть null
          finalRootId, // root_id
        ]
      )
      const task = result.rows[0]
      task.tags = JSON.parse(task.tags)

      res.status(201).json(task)

      if (global_task_id) {
        await insertTaskHistory(
          dbPool,
          global_task_id,
          'подзадача',
          `Подзадача создана: ${title}`,
          created_by,
          null
        )
      }
    } catch (error) {
      console.error('Ошибка при создании задачи:', error)
      res.status(500).json({ error: 'Ошибка при создании задачи.' })
    }
  }
}

// Маршрут для замены исполнителя задачи **********************************************
function replaceTaskAssignment(dbPool, io) {
  return async function (req, res) {
    const { task_id, old_user_id, new_user_id } = req.body

    if (!task_id || !old_user_id || !new_user_id) {
      return res.status(400).json({
        error: 'Необходимо указать task_id, old_user_id и new_user_id',
        received: { task_id, old_user_id, new_user_id },
      })
    }

    try {
      // 1. Получаем информацию о задаче и пользователях
      const taskInfo = await dbPool.query(
        `SELECT t.title, 
          CONCAT(u1.first_name, ' ', u1.last_name) as old_user_name, 
          CONCAT(u2.first_name, ' ', u2.last_name) as new_user_name, 
          t.created_by
   FROM tasks t
   LEFT JOIN users u1 ON u1.id = \$2
   LEFT JOIN users u2 ON u2.id = \$3
   WHERE t.id = \$1`,
        [task_id, old_user_id, new_user_id]
      )

      if (taskInfo.rows.length === 0) {
        return res.status(404).json({ error: 'Задача не найдена' })
      }

      const { title, old_user_name, new_user_name, created_by } = taskInfo.rows[0]

      // 2. Обновляем исполнителя в одной операции
      const updateResult = await dbPool.query(
        `UPDATE task_assignments 
         SET user_id = \$1 
         WHERE task_id = \$2   
         RETURNING *`,
        [new_user_id, task_id]
      )

      if (updateResult.rowCount === 0) {
        return res.status(404).json({ error: 'Связь задачи с исполнителем не найдена' })
      }

      // 4. Обновляем статус задачи на 'backlog'
      await dbPool.query(`UPDATE tasks SET status = 'backlog' WHERE id = \$1`, [task_id])

      // 4. Создаем уведомления в БД
      // Для старого исполнителя
      await dbPool.query(
        `INSERT INTO notifications (
          user_id, task_id, message, event_type, is_sent
        ) VALUES (\$1, \$2, \$3, \$4, \$5)`,
        [
          old_user_id,
          task_id,
          `Вы больше не являетесь исполнителем задачи "${title}". Новый исполнитель: ${new_user_name}`,
          'taskAssigneeChanged',
          false,
        ]
      )

      // Для нового исполнителя
      await dbPool.query(
        `INSERT INTO notifications (
          user_id, task_id, message, event_type, is_sent
        ) VALUES (\$1, \$2, \$3, \$4, \$5)`,
        [
          new_user_id,
          task_id,
          `Вы назначены исполнителем задачи "${title}". Предыдущий исполнитель: ${old_user_name}`,
          'taskAssigneeChanged',
          false,
        ]
      )

      // 5. Отправляем события через сокет
      io.emit('notification', {
        type: 'taskAssigneeChanged',
        taskId: task_id,
        title: title,
        oldUserId: old_user_id,
        oldUserName: old_user_name,
        newUserId: new_user_id,
        newUserName: new_user_name,
        createdBy: created_by,
        message: `Исполнитель задачи "${title}" изменен`,
      })

      res.status(200).json({
        message: 'Исполнитель задачи успешно заменен',
      })
    } catch (error) {
      console.error('Ошибка при замене исполнителя:', error)
      res.status(500).json({
        error: 'Ошибка при замене исполнителя',
        details: error.message,
      })
    }
  }
}

// Запись исполнителя
function addTaskAssignment(dbPool, io) {
  return async function (req, res) {
    const { task_id, user_id } = req.body

    if (!task_id || !user_id) {
      return res.status(400).json({ error: 'Необходимо указать task_id и user_id' })
    }

    try {
      const userIds = Array.isArray(user_id) ? user_id : [user_id]

      for (const userId of userIds) {
        await dbPool.query(`INSERT INTO task_assignments (task_id, user_id) VALUES ( $1,  $2)`, [
          task_id,
          userId,
        ])
      }

      res.status(201).json({
        message: 'Исполнитель добавлен к задаче',
      })
    } catch (error) {
      console.error('Ошибка при добавлении исполнителя(ей):', error)
      res.status(500).json({ error: 'Ошибка при добавлении исполнителя(ей)' })
    }
  }
}

function addTaskApproval(dbPool) {
  return async function (req, res) {
    const { task_id, approver_id } = req.body

    if (!task_id || !approver_id) {
      return res.status(400).json({ error: 'Необходимо указать task_id и approver_id' })
    }

    try {
      const approverIds = Array.isArray(approver_id) ? approver_id : [approver_id]

      for (const approverId of approverIds) {
        await dbPool.query(`INSERT INTO task_approvals (task_id, approver_id) VALUES ($1, $2)`, [
          task_id,
          approverId,
        ])
      }

      res.status(201).json({
        message: 'Утверждающий добавлен к задаче',
      })
    } catch (error) {
      console.error('Ошибка при добавлении утверждающего(их):', error)
      res.status(500).json({ error: 'Ошибка при добавлении утверждающего(их)' })
    }
  }
}

function addTaskVisibility(dbPool) {
  return async function (req, res) {
    const { task_id, user_id } = req.body

    if (!task_id || !user_id) {
      return res.status(400).json({ error: 'Необходимо указать task_id и user_id' })
    }

    try {
      const userIds = Array.isArray(user_id) ? user_id : [user_id]

      for (const userId of userIds) {
        await dbPool.query(`INSERT INTO task_visibility (task_id, user_id) VALUES ($1, $2)`, [
          task_id,
          userId,
        ])
      }

      res.status(201).json({
        message: 'Наблюдатель добавлен',
      })
    } catch (error) {
      console.error('Ошибка при добавлении зрителя(ей):', error)
      res.status(500).json({ error: 'Ошибка при добавлении зрителя(ей)' })
    }
  }
}

function addTaskAttachment(dbPool, io) {
  return async function (req, res) {
    const {
      task_id,
      file_url,
      file_type,
      uploaded_by,
      comment_file,
      name_file,
      tableType, // параметр для выбора таблицы: 'local' или 'global'
    } = req.body

    // Проверка обязательных полей
    if (!task_id || !file_url || !file_type || !uploaded_by || !name_file) {
      return res.status(400).json({
        error: 'Некорректные или отсутствующие обязательные параметры',
      })
    }

    // Проверка допустимых значений tableType
    const allowedTableTypes = ['local', 'global']
    const tableTypeNormalized =
      tableType && allowedTableTypes.includes(tableType) ? tableType : 'local'

    // Определяем имя таблицы безопасным способом
    const tableName =
      tableTypeNormalized === 'global' ? 'task_attachments_global_tasks' : 'task_attachments'

    // Можно дополнительно проверить существование task_id в соответствующей таблице
    try {
      const checkTableQuery = `
        SELECT id FROM ${tableName === 'task_attachments_global_tasks' ? 'global_tasks' : 'tasks'}
        WHERE id = $1
      `
      const checkRes = await dbPool.query(checkTableQuery, [task_id])
      if (checkRes.rows.length === 0) {
        return res.status(400).json({ error: 'Задача с таким ID не найдена в выбранной таблице' })
      }
    } catch (err) {
      console.error('Ошибка проверки существования задачи:', err)
      return res.status(500).json({ error: 'Ошибка проверки задачи' })
    }

    // Выполняем вставку в выбранную таблицу
    const insertQuery = `
      INSERT INTO ${tableName} (task_id, file_url, file_type, uploaded_by, comment_file, name_file)
      VALUES ($1, $2, $3, $4, $5, $6)
    `

    try {
      await dbPool.query(insertQuery, [
        task_id,
        file_url,
        file_type,
        uploaded_by,
        comment_file,
        name_file,
      ])
      io.emit('taskAttachment') // оповещаем клиентов
      res.status(201).json({ message: 'Вложение добавлено к задаче' })
    } catch (error) {
      console.error('Ошибка при добавлении вложения:', error)
      res.status(500).json({ error: 'Ошибка при добавлении вложения' })
    }
  }
}

// Получить все задачи для КанБан доски
function getUserTasks(dbPool) {
  return async function (req, res) {
    const { userId } = req.params // Получаем userId из параметров запроса
    const { filter, is_completed } = req.query

    // Разрешенные значения для filter
    const allowedFilters = ['my_tasks', 'tasks_manager', 'completed_tasks']
    if (!allowedFilters.includes(filter)) {
      return res.status(400).json({ error: 'Недопустимое значение filter' })
    }

    // Проверка значения is_completed
    const isCompleted = is_completed === 'true' // Преобразуем строку в boolean

    if (!userId) {
      return res.status(400).json({ error: 'Не указан userId' })
    }

    try {
      let whereClause = ''

      if (filter === 'my_tasks') {
        // Условие для отображения на канбане доске исполнителя
        whereClause = 'ta.user_id = $1'
      } else if (filter === 'tasks_manager') {
        // Условие для отображения по ролям
        whereClause = '(tv.user_id = $1 OR t.created_by = $1 OR ua.approver_id = $1)'
      } else if (filter === 'completed_tasks') {
        // Условие для завершенных задач ta.user_id - исполнитеь
        whereClause = `
          (tv.user_id = $1 OR t.created_by = $1 OR ua.approver_id = $1 OR ta.user_id =  $1) 
          AND t.is_completed = true`
      }

      // Добавляем условие по is_completed, если оно необходимо
      if (filter !== 'completed_tasks') {
        whereClause += ` AND t.is_completed = ${isCompleted}`
      }

      const result = await dbPool.query(
        `WITH unique_approvals AS (
          SELECT DISTINCT 
              tap.task_id,
              tap.approver_id,
              tap.is_approved
          FROM task_approvals tap
        ), unique_attachments AS (
          SELECT DISTINCT 
              tat.task_id,
              tat.file_url,
              tat.file_type,
              tat.uploaded_by, 
              tat.name_file,
              tat.comment_file
          FROM task_attachments tat
        ),
unique_comments AS (
    SELECT 
        tc.task_id,
        tc.comment,
        tc.created_at
    FROM task_comments_redo tc
)
        SELECT
          t.id AS task_id,
          t.created_at,
          t.title,
          t.description,
          t.created_by,
          t.deadline,
          t.priority,
          t.tags,
          t.status,
          t.global_task_id,
          t.parent_id,   
          t.root_id,   
          ARRAY_AGG(DISTINCT ta.user_id) AS assigned_user_ids,
          -- Используем подзапросы для агрегации approvals
          (SELECT JSON_AGG(JSON_BUILD_OBJECT('approver_id', a.approver_id, 'is_approved', a.is_approved))
           FROM unique_approvals a WHERE a.task_id = t.id
          ) AS approver_user_ids,
          ARRAY_AGG(DISTINCT tv.user_id) AS visibility_user_ids,
          -- Аггрегация вложений без дублей
          (SELECT JSON_AGG(JSON_BUILD_OBJECT(
              'file_url', a.file_url,
              'file_type', a.file_type,
              'uploaded_by', a.uploaded_by, 
              'name_file', a.name_file, 
              'comment_file', a.comment_file
            )) FROM unique_attachments a WHERE a.task_id = t.id
          ) AS attachments,
            (SELECT JSON_AGG(JSON_BUILD_OBJECT(
            'comment_redo', c.comment,
            'created_at_redo', c.created_at
            )) FROM unique_comments c WHERE c.task_id = t.id
            ) AS comments_redo 
        FROM tasks t
        LEFT JOIN task_assignments ta ON t.id = ta.task_id
        LEFT JOIN task_visibility tv ON t.id = tv.task_id
        LEFT JOIN unique_approvals ua ON t.id = ua.task_id
        WHERE ${whereClause}  
        GROUP BY t.id, t.title, t.description, t.created_by, t.deadline, t.priority, t.tags, t.status, t.global_task_id, t.parent_id, t.root_id`,
        [userId]
      )

      const tasks = result.rows

      res.status(200).json(tasks)
    } catch (error) {
      console.error('Ошибка при получении задач пользователя:', error)
      res.status(500).json({ error: 'Ошибка при получении задач пользователя' })
    }
  }
}

// Для оповещения клиента о создании задачи
function notifyTaskCreated(dbPool, io) {
  return async function (req, res) {
    const { id, createdBy, assignedUsers, approvers, viewers } = req.body
    try {
      // Создаем массив всех пользователей, которых нужно уведомить
      const usersToNotify = [
        createdBy, // Создатель задачи
        ...assignedUsers, // Исполнители
        ...approvers, // Утверждающие
        ...viewers, // Наблюдатели
      ]

      // Убираем дубликаты (если пользователь в нескольких ролях)
      const uniqueUsers = [...new Set(usersToNotify)]

      // Отправляем событие в комнаты каждого пользователя
      uniqueUsers.forEach((userId) => {
        io.to(userId).emit('taskCreated', {
          taskId: id,
          createdBy: createdBy,
          assignedUsers: assignedUsers,
          approvers: approvers,
          viewers: viewers,
        })
        console.log(`Событие отправлено в комнату ${userId}`)
      })

      res.status(200).json({ message: 'Уведомление отправлено' })
    } catch (error) {
      console.error('Ошибка при отправке уведомления:', error)
      res.status(500).json({ error: 'Ошибка при отправке уведомления' })
    }
  }
}

// Функция для обновления статуса задачи
function updateTaskStatus(dbPool, io) {
  return async function (req, res) {
    const { id } = req.params // ID задачи
    const { status } = req.body // Новый статус

    try {
      const query = 'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *'
      const values = [status, id]
      const result = await dbPool.query(query, values)

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Задача не найдена' })
      }

      if (status === 'done') {
        const updatedTask = result.rows[0]
        console.log(status)

        if (updatedTask.is_completed === false) {
          io.emit('taskUpdateTaskStatus', {
            taskId: updatedTask.id,
            status: updatedTask.status,
            createdBy: updatedTask.created_by,
            title: updatedTask.title,
          })
        }
      }

      res.json(result.rows[0])
    } catch (error) {
      console.error('Ошибка при обновлении статуса задачи:', error)
      res.status(500).json({ message: 'Ошибка сервера' })
    }
  }
}

function updateTaskApproval(dbPool, io) {
  return async function (req, res) {
    const { taskId, userId, approv } = req.params

    try {
      await dbPool.query(
        `
        UPDATE task_approvals
        SET is_approved = $1
        WHERE task_id = $2 AND approver_id = $3
      `,
        [approv, taskId, userId]
      )

      io.emit('taskApproval')
    } catch (error) {
      console.error('Ошибка при обновлении утверждения задачи:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

// Подтверждение выполнение задачи заказчиком
function updateTaskAccept(dbPool, io) {
  return async function (req, res) {
    const { taskId, userId, isDone } = req.params
    const { comment } = req.body

    try {
      if (isDone === 'false') {
        const tagsRedo = '[{"title":"ДОРАБОТКА ЗАДАЧИ","bg":"#ffb3b3","text":"#000000"}]'

        // Если isDone равно false, выполняем запрос
        await dbPool.query(
          `
            UPDATE tasks
            SET status = 'todo',
                tags = $1
            WHERE id = $2 AND created_by = $3; 
          `,
          [JSON.stringify(tagsRedo), taskId, userId]
        )

        // Если комментарий передан, добавляем его в таблицу комментариев
        if (comment) {
          await dbPool.query(
            `
              INSERT INTO task_comments_redo (task_id, comment)
              VALUES ($1, $2);
            `,
            [taskId, comment]
          )
        }
      } else {
        // Если isDone не равно false, выполняем исходный запрос
        await dbPool.query(
          `
            UPDATE tasks
            SET is_completed =  $1
            WHERE id = $2 AND created_by =  $3; 
          `,
          [isDone, taskId, userId]
        )

        const taskResult = await dbPool.query(
          `
          SELECT t.global_task_id, t.title, ta.user_id
          FROM tasks t
          JOIN task_assignments ta ON t.id = ta.task_id
          WHERE t.id = $1;
        `,
          [taskId]
        )

        if (taskResult.rows.length === 0) {
          return res.status(404).json({ error: 'Задача не найдена' })
        }

        const { global_task_id, title, user_id } = taskResult.rows[0]

        await insertTaskHistory(
          dbPool,
          global_task_id, // добавляем айди глобальной задачи
          'завершение подзадачи',
          `Подзадача выполнена: ${title}`, // добавляем title
          user_id, // добавляем айди исполнителя
          null
        )
      }

      io.emit('taskAccept')

      // Добавления истории для подзадач

      res.status(200).json({ message: 'Задача обновлена успешно' })
    } catch (error) {
      console.error('Ошибка при обновлении утверждения задачи:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

// Получение своего комментария к задаче
function getTaskComments(dbPool) {
  return async function (req, res) {
    const { taskId } = req.params

    try {
      const result = await dbPool.query(
        `
        SELECT * FROM task_comments
        WHERE task_id =  $1
        ORDER BY created_at DESC;
      `,
        [taskId]
      )

      res.json(result.rows)
    } catch (error) {
      console.error('Ошибка при получении комментариев:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

// Записать свой комментарий к задаче
function addTaskComment(dbPool) {
  return async function (req, res) {
    const { taskId } = req.params
    const { userId, comment } = req.body

    if (!userId || !comment) {
      return res.status(400).json({ error: 'Необходимо указать userId и comment' })
    }

    try {
      const result = await dbPool.query(
        `
        INSERT INTO task_comments (task_id, user_id, comment, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *;
      `,
        [taskId, userId, comment]
      )

      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error('Ошибка при добавлении комментария:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

//****************************************Уведомления********************************************* */

// Получение отправленных дилеру сообщений
function getMessagesNotificationDealer(dbPool) {
  return async function (req, res) {
    const { reminders_id } = req.query

    try {
      const result = await dbPool.query(
        `
        SELECT * FROM sent_messages_notifications
        WHERE reminders_id =  $1
        ORDER BY sent_at DESC;
      `,
        [reminders_id]
      )

      res.json(result.rows)
    } catch (error) {
      console.error('Ошибка при получении данных об отправленных сообщениях:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

// Сохранение отправленных дилеру сообщений
function postMessagesNotificationDealer(dbPool) {
  return async function (req, res) {
    const { reminders_id, sent_text, sent_files } = req.body

    try {
      // Проверяем, нет ли уже такого же сообщения для этого напоминания
      const checkDuplicate = await dbPool.query(
        `
        SELECT id FROM sent_messages_notifications 
        WHERE reminders_id = $1 
        AND sent_text = $2 
        AND sent_files = $3
        AND sent_at > NOW() - INTERVAL '1 minute'
        LIMIT 1
        `,
        [reminders_id, sent_text, sent_files]
      )

      if (checkDuplicate.rows.length > 0) {
        console.log('Обнаружено дублирующееся сообщение, пропускаем сохранение:', {
          reminders_id,
          sent_text,
          sent_files,
        })
        return res.status(200).json({
          message: 'Сообщение уже существует',
          existing_id: checkDuplicate.rows[0].id,
        })
      }

      const result = await dbPool.query(
        `
        INSERT INTO sent_messages_notifications (reminders_id, sent_text, sent_files)
        VALUES ( $1, $2, $3)
        RETURNING *;
      `,
        [reminders_id, sent_text, sent_files]
      )

      res.json(result.rows[0])
    } catch (error) {
      console.error('Ошибка при добавлении записи об отправленных сообщениях:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

// ЧАТ***********
// Получение сообщений для задачи
function getTaskMessages(dbPool) {
  return async function (req, res) {
    const taskId = req.params.taskId
    const userId = req.user?.userId

    if (!taskId) {
      return res.status(400).json({ error: 'Необходимо указать taskId' })
    }

    try {
      const result = await dbPool.query(
        `
        SELECT 
          m.id, 
          m.text, 
          m.timestamp, 
          m.task_author_id, 
          m.sender_id, 
          m.read_status,
          m.replied_to_message_id,
          CONCAT(LEFT(u.first_name, 1), '. ', u.last_name) AS sender_name,
          CONCAT(LEFT(a.first_name, 1), '. ', a.last_name) AS author_name,
          rm.text AS replied_message_text,
          rm.sender_id AS replied_message_sender_id,
          CONCAT(LEFT(ru.first_name, 1), '. ', ru.last_name) AS replied_message_sender_name
        FROM messages_task m
        JOIN users u ON m.sender_id = u.id
        JOIN users a ON m.task_author_id = a.id 
        LEFT JOIN messages_task rm ON m.replied_to_message_id = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE m.task_id = $1
        ORDER BY m.timestamp ASC;
        `,
        [taskId]
      )

      // Форматируем ответ, чтобы включить информацию о replied_message
      const formattedMessages = result.rows.map((message) => ({
        ...message,
        replied_message: message.replied_to_message_id
          ? {
              id: message.replied_to_message_id,
              text: message.replied_message_text,
              sender_id: message.replied_message_sender_id,
              sender_name: message.replied_message_sender_name,
            }
          : null,
      }))

      res.status(200).json(formattedMessages)
    } catch (error) {
      console.error('Ошибка при загрузке сообщений:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

// Отправка нового сообщения
function sendTaskMessage(dbPool, io) {
  return async function (req, res) {
    const { taskId } = req.params
    const { senderId, text, taskAuthorId, title, repliedToMessageId } = req.body
    if (!senderId || !text || !taskAuthorId || !title) {
      return res.status(400).json({
        error: 'Необходимо указать senderId, text, title и taskAuthorId',
      })
    }

    try {
      // Вставка нового сообщения
      const result = await dbPool.query(
        `
        INSERT INTO messages_task 
          (task_id, sender_id, text, task_author_id, read_status, timestamp, replied_to_message_id)
        VALUES ($1, $2, $3, $4, FALSE, NOW(), $5)
        RETURNING *;
        `,
        [taskId, senderId, text, taskAuthorId, repliedToMessageId || null]
      )

      const message = result.rows[0]

      // Если есть replied_to_message_id, получаем информацию о сообщении
      let repliedMessage = null
      if (message.replied_to_message_id) {
        const repliedResult = await dbPool.query(
          `SELECT id, text, sender_id FROM messages_task WHERE id = $1`,
          [message.replied_to_message_id]
        )
        repliedMessage = repliedResult.rows[0]
      }

      // Получение user_id из таблицы task_assignments
      const assignmentResult = await dbPool.query(
        `SELECT user_id FROM task_assignments WHERE task_id = $1;`,
        [taskId]
      )

      const assignedUser = assignmentResult.rows[0]?.user_id || null

      const responseMessage = {
        ...message,
        replied_message: repliedMessage, // Добавляем информацию о сообщении, на которое отвечаем
        assigned_user: assignedUser,
        task_ids: taskId,
        title,
      }

      io.emit('newMessage', responseMessage)
      res.status(201).json(responseMessage)
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

// Обновление статуса прочтения сообщения
function markMessagesAsRead(dbPool) {
  return async function (req, res) {
    const { messageIds, userId } = req.body

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ error: 'Необходимо указать messageIds' })
    }

    try {
      await dbPool.query(
        `
        UPDATE messages_task
        SET read_status = TRUE
        WHERE id = ANY( $1::int[])
        AND sender_id !=  $2;  -- Обновляем статус для всех, кроме отправителя
        `,
        [messageIds, userId]
      )

      res.status(200).json({ message: 'Статус прочтения обновлен' })
    } catch (error) {
      console.error('Ошибка при обновлении статуса прочтения:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

//  ******************************************************************************************************
//  ******************************************************************************************************
//  ******************************************************************************************************
// Создание глобальной задачи - Проекта
function createGlobalTask(dbPool) {
  return async function (req, res) {
    const {
      title,
      description,
      goals, // Массив строк
      deadline, // Дата или строка даты
      priority = 'medium', // Устанавливаем значение по умолчанию на бэкенде, если не передано
      additionalInfo = {}, // Объект
      responsibles, // Массив объектов { id: ..., role: ... }
      created_by, // ID пользователя, создающего задачу
    } = req.body

    // 2. Валидация данных (базовая)
    if (!title || !created_by) {
      return res.status(400).json({
        error: 'Необходимо указать заголовок задачи (title) и ID создателя (created_by).',
      })
    }

    // Валидация приоритета
    const validPriorities = ['high', 'medium', 'low']
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        error: `Недопустимое значение приоритета. Допустимые значения: ${validPriorities.join(
          ', '
        )}.`,
      })
    }

    // Валидация ответственных (проверяем, что это массив объектов с id)
    if (responsibles && !Array.isArray(responsibles)) {
      return res.status(400).json({ error: 'Ответственные должны быть массивом.' })
    }
    if (responsibles && responsibles.some((r) => !r.id)) {
      return res.status(400).json({ error: 'Каждый ответственный должен иметь ID.' })
    }

    // 3. Подготовка данных для запроса
    // Преобразуем goals и additionalInfo в JSONB строки
    const goalsJson = goals ? JSON.stringify(goals) : null
    const additionalInfoJson = additionalInfo ? JSON.stringify(additionalInfo) : null

    // Преобразуем дату дедлайна, если она есть
    const deadlineTimestamp = deadline ? new Date(deadline) : null

    // Устанавливаем начальный статус
    const initialStatus = 'Новая' // Или другой статус по умолчанию

    // 4. Выполнение SQL-запроса
    // const client = await dbPool.connect() // Получаем клиента из пула

    try {
      await dbPool.query('BEGIN') // Начинаем транзакцию

      // Вставляем основную запись в таблицу global_tasks
      const result = await dbPool.query(
        `
        INSERT INTO global_tasks (title, description, goals, deadline, priority, status, created_by, additional_info)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id; -- Возвращаем ID созданной задачи
        `,
        [
          title,
          description,
          goalsJson,
          deadlineTimestamp,
          priority,
          initialStatus,
          created_by,
          additionalInfoJson,
        ]
      )

      const newTaskId = result.rows[0].id // Получаем ID новой задачи

      // Вставляем запись в историю создания задачи
      await insertTaskHistory(dbPool, newTaskId, 'создание', 'Проект создан', created_by, null)

      // Если есть ответственные, вставляем их в связующую таблицу global_task_responsibles
      if (responsibles && responsibles.length > 0) {
        const responsibleValues = responsibles
          .map(
            (resp) => `(${newTaskId}, ${resp.id}, '${resp.role || 'Исполнитель'}')` // Указываем ID задачи, ID пользователя и роль (по умолчанию 'Исполнитель', если не указана)
          )
          .join(', ') // Объединяем строки для вставки

        await dbPool.query(
          `
          INSERT INTO global_task_responsibles (global_task_id, user_id, role)
          VALUES ${responsibleValues};
          `
        )
      }

      await dbPool.query('COMMIT') // Подтверждаем транзакцию

      // 5. Отправка успешного ответа
      res.status(201).json({
        message: 'Глобальная задача успешно создана',
        taskId: newTaskId,
      })
    } catch (error) {
      await dbPool.query('ROLLBACK') // Откатываем транзакцию в случае ошибки
      console.error('Ошибка при создании глобальной задачи:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера при создании задачи' })
    }
  }
}

// Загрузить все глобальные задачи
function getGlobalTasks(dbPool) {
  return async function (req, res) {
    const userIdParam = req.query.userId
    const userId = userIdParam ? parseInt(userIdParam, 10) : null

    if (!userId) {
      return res.status(400).json({ error: 'Недостаточно параметров' })
    }

    try {
      const result = await dbPool.query(
        `
       SELECT
    gt.id,
    gt.title,
    gt.description,
    COALESCE(gt.goals, '[]'::jsonb) as goals,
    gt.deadline,
    gt.priority,
    gt.status,
    gt.progress,
    gt.created_at,
    json_build_object('id', cu.id, 'name', TRIM(CONCAT(cu.first_name, ' ', cu.last_name))) as created_by,
    COALESCE(gt.additional_info, '{}'::jsonb) as additional_info,
    COALESCE(json_agg(json_build_object(
        'id', u.id,
        'name', TRIM(CONCAT(u.first_name, ' ', u.last_name)),
        'role', gtr.role,
        'initials', LEFT(u.first_name, 1) || LEFT(u.last_name, 1),
        'color', CASE
            WHEN u.id % 4 = 0 THEN 'blue'
            WHEN u.id % 4 = 1 THEN 'purple'
            WHEN u.id % 4 = 2 THEN 'green'
            WHEN u.id % 4 = 3 THEN 'orange'
            ELSE 'default'
        END
    )) FILTER (WHERE u.id IS NOT NULL)::jsonb, '[]'::jsonb) as responsibles,
    COALESCE(
        (SELECT 
            ROUND(100.0 * SUM(CASE WHEN t.is_completed THEN 1 ELSE 0 END) / COUNT(*), 2)
         FROM tasks t
         WHERE t.global_task_id = gt.id
        ), 0) as completion_percentage
FROM
    global_tasks gt
LEFT JOIN global_task_responsibles gtr ON gt.id = gtr.global_task_id
LEFT JOIN users u ON gtr.user_id = u.id
LEFT JOIN users cu ON gt.created_by = cu.id
WHERE
  gt.status <> 'Завершено' AND
  gt.status <> 'Провал' AND
  (
    gt.created_by = $1 -- создатель
    OR
    EXISTS (
      SELECT 1 FROM global_task_responsibles gtr2
      WHERE gtr2.global_task_id = gt.id AND gtr2.user_id = $1
    ) 
  )
        GROUP BY
          gt.id, cu.id, cu.first_name, cu.last_name
        ORDER BY
          gt.created_at DESC;
        `,
        [userId]
      )

      /*WHERE gt.status <> 'Завершено' and gt.status <> 'Провал'    
GROUP BY
    gt.id, cu.id, cu.first_name, cu.last_name
ORDER BY
    gt.created_at DESC;
*/

      /*WHERE
  gt.status <> 'Завершено' AND
  gt.status <> 'Провал' AND
  (
    gt.created_by = $1 -- создатель
    OR
    EXISTS (
      SELECT 1 FROM global_task_responsibles gtr2
      WHERE gtr2.global_task_id = gt.id AND gtr2.user_id = $1
    ) 
  )
        GROUP BY
          gt.id, cu.id, cu.first_name, cu.last_name
        ORDER BY
          gt.created_at DESC;
        `,
        [userId]
      )*/

      const globalTasks = result.rows

      res.status(200).json(globalTasks)
    } catch (error) {
      console.error('Ошибка при получении глобальных задач:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера при загрузке задач' })
    }
  }
}

function updateGlobalTask(dbPool) {
  return async function (req, res) {
    const taskId = req.params.taskId // Получаем ID задачи из параметров URL
    const updatedData = req.body // Получаем обновленные данные из тела запроса

    // Проверка на наличие ID задачи и данных для обновления
    if (!taskId) {
      return res.status(400).json({ error: 'Не указан ID задачи.' })
    }
    if (!updatedData || Object.keys(updatedData).length === 0) {
      return res.status(400).json({ error: 'Не переданы данные для обновления.' })
    }

    // Начинаем транзакцию для атомарности операций (особенно важно для ответственных)
    const client = await dbPool.connect()
    try {
      await client.query('BEGIN') // Начать транзакцию

      // --- Обновление основных полей задачи ---
      // Динамически строим SET часть SQL-запроса
      const updateFields = []
      const queryParams = [taskId] // Первым параметром всегда будет ID задачи
      let paramIndex = 2 // Индекс для параметров SQL-запроса (начинается с 2, т.к. $1 уже занят taskId)

      // Поля, которые можно обновлять напрямую в таблице global_tasks
      const allowedFields = [
        'title',
        'description',
        'goals',
        'deadline',
        'priority',
        'status',
        'progress',
        'additional_info',
      ]

      allowedFields.forEach((field) => {
        // Проверяем, есть ли это поле в полученных данных для обновления
        if (updatedData.hasOwnProperty(field)) {
          // Добавляем поле в список для обновления и соответствующий параметр
          updateFields.push(`${field} = $${paramIndex}`)
          // Преобразуем дату, если это поле deadline
          if (field === 'deadline' && updatedData[field] !== null) {
            queryParams.push(new Date(updatedData[field]).toISOString())
          } else {
            queryParams.push(updatedData[field])
          }
          paramIndex++
        }
      })

      // Если есть поля для обновления, выполняем запрос
      if (updateFields.length > 0) {
        const updateQuery = `
          UPDATE global_tasks
          SET ${updateFields.join(', ')}
          WHERE id = $1;
        `
        await client.query(updateQuery, queryParams)
      }

      // --- Обновление ответственных (это более сложная логика) ---
      // Если в updatedData есть поле 'responsibles', обрабатываем его
      if (updatedData.hasOwnProperty('responsibles')) {
        // Простая логика: Удалить всех текущих ответственных для этой задачи
        // и вставить новых из полученного массива.
        // Это может быть неоптимально для больших списков, но просто в реализации.
        // Более сложная логика: сравнить текущих и новых ответственных
        // и выполнить только необходимые INSERT и DELETE.

        await client.query('DELETE FROM global_task_responsibles WHERE global_task_id = $1', [
          taskId,
        ])

        // Вставляем новых ответственных
        if (updatedData.responsibles && Array.isArray(updatedData.responsibles)) {
          for (const responsible of updatedData.responsibles) {
            // Убедитесь, что у объекта ответственного есть хотя бы user_id
            if (responsible.id) {
              await client.query(
                'INSERT INTO global_task_responsibles (global_task_id, user_id, role) VALUES ($1, $2, $3)',
                [taskId, responsible.id, responsible.role || 'Исполнитель'] // 'Исполнитель' по умолчанию, если роль не указана
              )
            }
          }
        }
      }

      // --- Завершение транзакции ---
      await client.query('COMMIT') // Зафиксировать изменения

      // После успешного обновления, можно вернуть обновленную задачу или просто статус успеха
      // Для простоты, давайте вернем статус успеха и, возможно, ID обновленной задачи
      // Или, как более удобно для фронтенда, повторно получить и вернуть полную задачу
      // чтобы фронтенд сразу имел актуальные данные (включая ответственных и т.д.)

      const result = await client.query(
        `
        SELECT
            gt.id,
            gt.title,
            gt.description,
            COALESCE(gt.goals, '[]'::jsonb) as goals,
            gt.deadline,
            gt.priority,
            gt.status,
            gt.progress,
            gt.created_at,
            json_build_object('id', cu.id, 'name', TRIM(CONCAT(cu.first_name, ' ', cu.last_name))) as created_by,
            COALESCE(gt.additional_info, '{}'::jsonb) as additional_info,
            COALESCE(json_agg(json_build_object(
                'id', u.id,
                'name', TRIM(CONCAT(u.first_name, ' ', u.last_name)),
                'role', gtr.role,
                'initials', LEFT(u.first_name, 1) || LEFT(u.last_name, 1),
                'color', CASE
                    WHEN u.id % 4 = 0 THEN 'blue'
                    WHEN u.id % 4 = 1 THEN 'purple'
                    WHEN u.id % 4 = 2 THEN 'green'
                    WHEN u.id % 4 = 3 THEN 'orange'
                    ELSE 'default'
                END
            )) FILTER (WHERE u.id IS NOT NULL)::jsonb, '[]'::jsonb) as responsibles
        FROM
            global_tasks gt
        LEFT JOIN
            global_task_responsibles gtr ON gt.id = gtr.global_task_id
        LEFT JOIN
            users u ON gtr.user_id = u.id
        LEFT JOIN
            users cu ON gt.created_by = cu.id
        WHERE gt.id = $1 -- Выбираем только обновленную задачу
        GROUP BY
            gt.id, cu.id, cu.first_name, cu.last_name;
        `,
        [taskId]
      )

      if (result.rows.length > 0) {
        res.status(200).json(result.rows[0]) // Возвращаем обновленную задачу
      } else {
        // Задача не найдена после обновления (что маловероятно, если обновление прошло успешно)
        res.status(404).json({ error: 'Задача не найдена после обновления.' })
      }
    } catch (error) {
      await client.query('ROLLBACK') // Откатить изменения в случае ошибки
      console.error('Ошибка при обновлении глобальной задачи:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера при обновлении задачи.' })
    }
  }
}

// Возвращает все подзадачи проекта
function getSubtasksForGlobalTask(dbPool) {
  return async function (req, res) {
    const { globalTaskId } = req.params

    try {
      // Запрос к базе данных для получения подзадач
      const result = await dbPool.query(
        `
        SELECT
            t.id,
            t.title,
            t.description,
            t.created_at,
            t.deadline,
            t.priority,
            t.status,
            t.is_completed, 
            u.id AS responsible_id,
            u.first_name AS responsible_first_name,
            u.middle_name AS responsible_middle_name,
            u.last_name AS responsible_last_name
            -- Добавляем поля color и initials, как вы их формируете в getGlobalTasks
            -- Если они не хранятся напрямую в таблице users, формируем их здесь
        FROM tasks t
        LEFT JOIN task_assignments ta ON t.id = ta.task_id
        LEFT JOIN users u ON ta.user_id = u.id
        WHERE t.global_task_id = $1
        ORDER BY t.created_at DESC; -- Опционально: сортировка
        `,
        [globalTaskId]
      )

      // Обработка результата запроса для формирования нужной структуры
      const subtasks = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        created_at: row.created_at,
        deadline: row.deadline,
        priority: row.priority,
        status: row.status,
        is_completed: row.is_completed,
        responsible: row.responsible_id
          ? {
              id: row.responsible_id,
              name: `${row.responsible_last_name || ''} ${row.responsible_first_name || ''} ${
                row.middle_name || ''
              }`.trim(),
              // Формируем color и initials так же, как в getGlobalTasks
              initials: `${(row.responsible_first_name || '')[0]}${
                (row.responsible_last_name || '')[0]
              }`.toUpperCase(),
              color: (() => {
                if (!row.responsible_id) return 'default'
                switch (row.responsible_id % 4) {
                  case 0:
                    return 'blue'
                  case 1:
                    return 'purple'
                  case 2:
                    return 'green'
                  case 3:
                    return 'orange'
                  default:
                    return 'default'
                }
              })(),
            }
          : null,
        // tags и notification_status не включаем, так как они не нужны для отображения в этом компоненте
      }))

      res.status(200).json(subtasks)
    } catch (err) {
      console.error(`Ошибка при получении подзадач для globalTaskId ${globalTaskId}:`, err)
      res.status(500).json({ error: 'Внутренняя ошибка сервера при получении подзадач' })
    }
  }
}

// Обновить статус глобальной задачи
function updateGlobalTaskProcess(dbPool, io) {
  return async function (req, res) {
    try {
      const taskId = req.params.taskId // Получаем ID задачи из параметров URL

      const { status, userId } = req.body
      if (!status) {
        return res.status(400).json({ error: 'Статус не передан' })
      }

      const queryText = `
        UPDATE global_tasks
        SET status = $1
        WHERE id = $2
        RETURNING *
      `
      const values = [status, taskId]

      const result = await dbPool.query(queryText, values)

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Задача не найдена' })
      }

      // История изменений ч1
      let statusHistory = 'Проект завершен'
      if (status === 'Провал') {
        statusHistory = 'Проект завершен с провалом'

        const commentResult = await dbPool.query(
          `
          SELECT comment FROM action_global_task_comment WHERE global_task_id = $1 ORDER BY created_at DESC LIMIT 1
          `,
          [taskId]
        )

        if (commentResult.rows.length > 0) {
          const comment = commentResult.rows[0].comment
          statusHistory += `. Комментарий: ${comment}`
        }
      }

      //Если Пауза
      if (status === 'Пауза') {
        statusHistory = 'Проект в статусе "Пауза"'

        const commentResult = await dbPool.query(
          `
          SELECT comment FROM action_global_task_comment WHERE global_task_id = $1 ORDER BY created_at DESC LIMIT 1
          `,
          [taskId]
        )

        if (commentResult.rows.length > 0) {
          const comment = commentResult.rows[0].comment
          statusHistory += `. Комментарий: ${comment}`
        }

        const subTtaskIds = await fetchTaskIdsByGlobalId(dbPool, taskId)
        const taskIds = subTtaskIds.flatMap((item) => item.task_ids)

        await dbPool.query('UPDATE tasks SET status = $1 WHERE id = ANY($2::int[])', [
          'pause',
          taskIds,
        ])

        io.emit('updateStatusSubTasks', subTtaskIds, 'pause')
      }

      //Если Продолжить
      if (status === 'Продолжить') {
        statusHistory = 'Работа над проектом возобновлена'

        const commentResult = await dbPool.query(
          `
          SELECT comment FROM action_global_task_comment WHERE global_task_id = $1 ORDER BY created_at DESC LIMIT 1
          `,
          [taskId]
        )

        if (commentResult.rows.length > 0) {
          const comment = commentResult.rows[0].comment
          statusHistory += `. Комментарий: ${comment}`
        }

        const subTtaskIds = await fetchTaskIdsByGlobalId(dbPool, taskId)
        const taskIds = subTtaskIds.flatMap((item) => item.task_ids)

        await dbPool.query('UPDATE tasks SET status = $1 WHERE id = ANY($2::int[])', [
          'backlog',
          taskIds,
        ])

        io.emit('updateStatusSubTasks', subTtaskIds, 'backlog')
      }

      // История изменений ч2
      await insertTaskHistory(dbPool, taskId, status, statusHistory, userId, null)

      try {
        await updateGlobalTaskDeadline(dbPool, taskId)
      } catch (error) {
        console.error('Ошибка при обновлении deadline:', error)
        return res.status(500).json({ error: 'Ошибка обновления deadline' })
      }

      res.json({ message: 'Статус обновлен', task: result.rows[0] })
    } catch (error) {
      console.error('Ошибка при обновлении задачи:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

// Удаление Проекта и подзадач
function deleteGlobalTask(dbPool) {
  return async function (req, res) {
    const { taskId } = req.params

    try {
      // Начинаем транзакцию
      await dbPool.query('BEGIN')

      // 1. Удаляем подзадачи, связанные с глобальной задачей
      await dbPool.query('DELETE FROM tasks WHERE global_task_id = $1', [taskId])

      // 2. Удаляем глобальную задачу
      const deleteResult = await dbPool.query(
        'DELETE FROM global_tasks WHERE id = $1 RETURNING *',
        [taskId]
      )

      if (deleteResult.rowCount === 0) {
        await dbPool.query('ROLLBACK')
        return res.status(404).json({ error: 'Глобальная задача не найдена' })
      }

      // 3. Подтверждаем транзакцию
      await dbPool.query('COMMIT')

      res.json({ message: 'Глобальная задача и подзадачи успешно удалены' })
    } catch (error) {
      await dbPool.query('ROLLBACK')
      console.error('Ошибка при удалении глобальной задачи:', error)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  }
}

// Получение информации о конкретной глобальной задаче по id
function getGlobalTaskById(dbPool) {
  return async function (req, res) {
    const { taskId } = req.params
    try {
      const resid = await dbPool.query(
        `
        SELECT
          gt.id 
        FROM global_tasks gt
        WHERE gt.id = $1
        `,
        [taskId]
      )

      if (resid.rowCount === 0) {
        return
      }

      const result = await dbPool.query(
        `
      SELECT
        gt.id,
        gt.title,
        gt.description,
        COALESCE(gt.goals, '[]'::jsonb) as goals,
        gt.deadline,
        gt.priority,
        gt.status,
        gt.progress,
        gt.created_at,
        json_build_object('id', cu.id, 'name', TRIM(CONCAT(cu.first_name, ' ', cu.last_name))) as created_by,
        COALESCE(gt.additional_info, '{}'::jsonb) as additional_info,
        COALESCE(json_agg(json_build_object(
            'id', u.id,
            'name', TRIM(CONCAT(u.first_name, ' ', u.last_name)),
            'role', gtr.role,
            'initials', LEFT(u.first_name, 1) || LEFT(u.last_name, 1),
            'color', CASE
                WHEN u.id % 4 = 0 THEN 'blue'
                WHEN u.id % 4 = 1 THEN 'purple'
                WHEN u.id % 4 = 2 THEN 'green'
                WHEN u.id % 4 = 3 THEN 'orange'
                ELSE 'default'
            END
        )) FILTER (WHERE u.id IS NOT NULL)::jsonb, '[]'::jsonb) as responsibles,
        COALESCE(
            (SELECT 
                ROUND(100.0 * SUM(CASE WHEN t.is_completed THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2)
             FROM tasks t
             WHERE t.global_task_id = gt.id
            ), 0) as completion_percentage
    FROM
        global_tasks gt
    LEFT JOIN global_task_responsibles gtr ON gt.id = gtr.global_task_id
    LEFT JOIN users u ON gtr.user_id = u.id
    LEFT JOIN users cu ON gt.created_by = cu.id
    WHERE
        gt.status <> 'Завершено' and gt.status <> 'Провал'
        AND gt.id = $1
    GROUP BY
        gt.id, cu.id, cu.first_name, cu.last_name
        `,
        [taskId]
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Задача не найдена' })
      }

      const task = result.rows[0]

      // Можно дополнительно запросить подзадачи или другие связанные данные
      // например, getSubtasksForGlobalTask(dbPool)(req, res) — если нужно

      res.status(200).json(task)
    } catch (err) {
      console.error(`Ошибка при получении задачи ${taskId}:`, err)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

// Получить название проекта по id глобальной задачи облегченная версия для компонента задачи
function getGlobalTaskTitle(dbPool) {
  return async function (req, res) {
    const { globalTaskId } = req.params

    try {
      const result = await dbPool.query(
        `
        SELECT title, status FROM global_tasks WHERE id = $1
        `,
        [globalTaskId]
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Глобальная задача не найдена' })
      }

      res.json({ title: result.rows[0].title, status: result.rows[0].status })
    } catch (err) {
      console.error('Ошибка при получении названия глобальной задачи:', err)
      res.status(500).json({ error: 'Ошибка получения названия глобальной задачи' })
    }
  }
}

// Получение всех файлов, прикрепленных к глобальной задаче по id
function getAttachmentsByTaskId(dbPool) {
  return async function (req, res) {
    const { id } = req.params
    try {
      const result = await dbPool.query(
        `
        SELECT
          id,
          task_id,
          file_url,
          file_type,
          uploaded_by,
          comment_file,
          name_file,
          created_at
        FROM
          task_attachments_global_tasks
        WHERE
          task_id = $1
        ORDER BY created_at DESC
        `,
        [id]
      )

      if (result.rows.length === 0) {
        return res.status(200).json({ attachments: [] })
      }

      res.status(200).json({ attachments: result.rows })
    } catch (err) {
      console.error(`Ошибка при получении файлов для задачи ${id}:`, err)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

// Добавление комментария к глобальной задаче по ID
function addCommentToGlobalTask(dbPool) {
  return async function (req, res) {
    const { taskId } = req.params
    const { user_id, comment } = req.body

    try {
      const result = await dbPool.query(
        `
        INSERT INTO action_global_task_comment (global_task_id, user_id, comment) 
        VALUES ($1, $2, $3) RETURNING *
        `,
        [taskId, user_id, comment]
      )

      res.status(201).json(result.rows[0]) // Возвращаем добавленный комментарий
    } catch (error) {
      console.error('Ошибка при добавлении комментария:', error)
      res.status(500).json({ error: 'Ошибка при добавлении комментария' })
    }
  }
}

// Добавление ответственных к глобальной задаче по ID
function addResponsiblesToGlobalTask(dbPool) {
  return async function (req, res) {
    const { taskId } = req.params
    const { responsibles, userId } = req.body

    if (!responsibles || !Array.isArray(responsibles) || responsibles.length === 0) {
      return res.status(400).json({ error: 'Нет ответственных для добавления.' })
    }

    try {
      await dbPool.query('BEGIN')

      // Получить имена и фамилии для каждого ответственного по id
      const userIds = responsibles.map((resp) => resp.id)

      // Запрос для получения информации о пользователях
      const usersQuery = `
         SELECT id, first_name, last_name
         FROM users
         WHERE id = ANY($1)
       `
      const usersResult = await dbPool.query(usersQuery, [userIds])

      // Создаем отображение id -> имя + фамилия
      const userNamesMap = {}
      usersResult.rows.forEach((user) => {
        userNamesMap[user.id] = `${user.first_name} ${user.last_name}`
      })

      // Формируем строку с именами и фамилиями добавляемых ответственных
      const responsibleNamesStr = responsibles
        .map((resp) => userNamesMap[resp.id] || 'Имя не найдено')
        .join(', ')

      // Формируем массив значений для вставки
      const insertValues = responsibles.map((resp) => [taskId, resp.id, resp.role])

      // Выполняем массовое вставление
      const insertQuery = `
        INSERT INTO global_task_responsibles (global_task_id, user_id, role)
        VALUES ${insertValues
          .map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`)
          .join(', ')}
        RETURNING *;
      `

      const flatValues = insertValues.flat()

      const result = await dbPool.query(insertQuery, flatValues)

      await dbPool.query('COMMIT')

      // История изменений ответственных
      await insertTaskHistory(
        dbPool,
        taskId,
        'обновление',
        `Добавление ответственного(ых): ${responsibleNamesStr}`,
        userId,
        null
      )

      res.status(201).json(result.rows)
    } catch (error) {
      await dbPool.query('ROLLBACK')
      console.error('Ошибка при добавлении ответственных:', error)
      res.status(500).json({ error: 'Ошибка при добавлении ответственных' })
    }
  }
}

// Обновление целей задачи по ID
function updateGoals(dbPool) {
  return async function (req, res) {
    const { id } = req.params
    const { goals, userId } = req.body // ожидается массив целей

    try {
      await dbPool.query(
        `
          UPDATE global_tasks SET goals = $1 WHERE id = $2
          `,
        [JSON.stringify(goals), id]
      )

      // Формируем строку целей для истории
      //  const goalsString = goals.filter((goal) => goal.trim() !== '').join(', ')

      // История изменений ответственных
      //   await insertTaskHistory(
      //    dbPool,
      //     id,
      //   'обновление',
      //     `Новые цели: ${goalsString}`,
      //      userId,
      //    null
      //    )

      res.json({ message: 'Цели обновлены' })
    } catch (err) {
      console.error('Ошибка при обновлении целей:', err)
      res.status(500).json({ error: 'Ошибка обновления целей' })
    }
  }
}

// Обновление дополнительной информации по ID
function updateAdditionalInfo(dbPool) {
  return async function (req, res) {
    const { id } = req.params
    const { additional_info } = req.body // ожидается объект

    try {
      await dbPool.query(
        `
        UPDATE global_tasks SET additional_info = $1 WHERE id = $2
        `,
        [additional_info, id]
      )

      res.json({ message: 'Дополнительная информация обновлена' })
    } catch (err) {
      console.error('Ошибка при обновлении доп. инфо:', err)
      res.status(500).json({ error: 'Ошибка обновления доп. инфо' })
    }
  }
}

// Чат глобальных задач ***

// Получить сообщения для глобальной задачи
function getChatMessages(dbPool) {
  return async function (req, res) {
    const { globalTaskId } = req.params

    try {
      const result = await dbPool.query(
        `
        SELECT 
          m.*,
          u.first_name,
          u.last_name,
          u.avatar_url,
          replied_msg.id as replied_id,
          replied_msg.text as replied_text,
          replied_msg.timestamp as replied_timestamp,
          replied_user.first_name as replied_first_name,
          replied_user.last_name as replied_last_name,
          replied_user.avatar_url as replied_avatar_url
        FROM global_task_chat_messages m
        JOIN users u ON m.user_id = u.id
        LEFT JOIN global_task_chat_messages replied_msg 
          ON m.replied_to_message_id = replied_msg.id
        LEFT JOIN users replied_user 
          ON replied_msg.user_id = replied_user.id
        WHERE m.global_task_id =  $1
        ORDER BY m.timestamp ASC
      `,
        [globalTaskId]
      )

      res.json(result.rows)
    } catch (err) {
      console.error('Ошибка при получении сообщений:', err)
      res.status(500).json({ error: 'Ошибка получения сообщений' })
    }
  }
}

// Отправить сообщение
function sendChatMessage(dbPool, io) {
  return async function (req, res) {
    const { globalTaskId, userId, text, title, repliedToMessageId } = req.body

    try {
      const result = await dbPool.query(
        `
        INSERT INTO global_task_chat_messages 
          (global_task_id, user_id, text, replied_to_message_id) 
        VALUES ($1, $2, $3, $4) 
        RETURNING *
        `,
        [globalTaskId, userId, text, repliedToMessageId || null]
      )

      // Получаем ID всех ответственных пользователей по глобальной задаче
      const respResult = await dbPool.query(
        `
        SELECT user_id
        FROM global_task_responsibles
        WHERE global_task_id = $1
        `,
        [globalTaskId]
      )

      // Получаем ID создателя задачи
      const creatorResult = await dbPool.query(
        `
        SELECT created_by
        FROM global_tasks
        WHERE id = $1
        `,
        [globalTaskId]
      )

      const userIds = respResult.rows.map((row) => row.user_id)
      // Добавляем текущего пользователя в массив userIds
      //  userIds.push(userId)
      const creatorId = creatorResult.rows[0]?.created_by

      // Добавляем создателя в список, если его там еще нет
      if (creatorId && !userIds.includes(creatorId)) {
        userIds.push(creatorId)
      }

      res.json(result.rows[0])

      io.emit('newMessageGlobalTaskChat', globalTaskId, userIds, title, userId) // еще айди пользователей к этой задаче
    } catch (err) {
      console.error('Ошибка при отправке сообщения:', err)
      res.status(500).json({ error: 'Ошибка отправки сообщения' })
    }
  }
}

function updateGlobalTaskHistory(dbPool) {
  return async function (req, res) {
    const { globalTaskId } = req.params
    const {
      eventType,
      description,
      createdBy,
      data, // опционально
    } = req.body

    try {
      await insertTaskHistory(dbPool, globalTaskId, eventType, description, createdBy, data)
      res.json({ message: 'Запись истории успешно добавлена' })
    } catch (err) {
      console.error('Ошибка при добавлении записи в историю:', err)
      res.status(500).json({ error: 'Ошибка при добавлении записи в историю' })
    }
  }
}

// Получить историю изменений для глобальной задачи
function getGlobalTaskHistory(dbPool) {
  return async function (req, res) {
    const { globalTaskId } = req.params

    try {
      const result = await dbPool.query(
        `
        SELECT 
          h.*,
          u.first_name,
          u.last_name
        FROM global_task_history h
        LEFT JOIN users u ON h.created_by = u.id
        WHERE h.global_task_id = $1
        ORDER BY h.created_at DESC
        `,
        [globalTaskId]
      )
      res.json(result.rows)
    } catch (err) {
      console.error('Ошибка при получении истории задач:', err)
      res.status(500).json({ error: 'Ошибка получения истории задач' })
    }
  }
}

/**
 * Вставляет запись в таблицу истории создания задачи.
 * @param {Object} dbPool - Объект подключения к базе данных.
 * @param {String|Number} globalTaskId - ID задачи.
 * @param {String} eventType - Тип события (например, 'создание').
 * @param {String} description - Описание события.
 * @param {String} createdBy - Кто создал запись.
 * @param {Object|null} data - Дополнительные данные, которые нужно сериализовать.
 * @returns {Promise<void>}
 */
async function insertTaskHistory(
  dbPool,
  globalTaskId,
  eventType,
  description,
  createdBy,
  data = null
) {
  await dbPool.query(
    `
    INSERT INTO global_task_history (
      global_task_id,
      event_type,
      description,
      created_by,
      data
    ) VALUES ($1, $2, $3, $4, $5)
    `,
    [globalTaskId, eventType, description, createdBy, JSON.stringify(data)]
  )
}

// Получение всех задач, связанных с конкретной глобальной задачей по global_task_id. Функция внутри сервера без вызова из клиента
// Функция для получения задач по глобальному ID, без req/res
async function fetchTaskIdsByGlobalId(dbPool, globalTaskId) {
  try {
    const result = await dbPool.query(
      `
      SELECT 
        ta.user_id,
        json_agg(t.id) AS task_ids
      FROM tasks t
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      WHERE t.global_task_id = $1
      GROUP BY ta.user_id
      `,
      [globalTaskId]
    )

    // Возвращаем массив объектов с user_id и массивом task_ids
    return result.rows.map((row) => ({
      user_id: row.user_id,
      task_ids: row.task_ids || [], // На случай, если задач нет
    }))
  } catch (error) {
    console.error('Ошибка при получении задач и исполнителей по глобальной задаче:', error)
    throw error
  }
}

async function updateGlobalTaskDeadline(dbPool, globalTaskId) {
  let timeDifference

  // 1. Получаем разницу во времени между последней паузой и последним продолжением
  const timeDiffQuery = `
    WITH last_pause AS (
        SELECT created_at
        FROM global_task_history
        WHERE global_task_id = $1 AND event_type = 'Пауза'
        ORDER BY created_at DESC
        LIMIT 1
    ),
    last_resume AS (
        SELECT created_at
        FROM global_task_history
        WHERE global_task_id = $1 AND event_type = 'Продолжить'
        ORDER BY created_at DESC
        LIMIT 1
    )
    SELECT EXTRACT(EPOCH FROM (lr.created_at - lp.created_at)) AS seconds_between
    FROM last_pause lp
    JOIN last_resume lr ON lp.created_at IS NOT NULL AND lr.created_at IS NOT NULL;
  `

  try {
    const timeDiffResult = await dbPool.query(timeDiffQuery, [globalTaskId])
    timeDifference = timeDiffResult.rows[0]?.seconds_between || 0 // Если нет разницы, устанавливаем 0
  } catch (err) {
    console.error('Ошибка при получении разницы во времени:', err)
    throw new Error('Ошибка получения разницы во времени')
  }

  // 2. Обновляем deadline в таблице global_tasks
  const updateGlobalTaskQuery = `
    UPDATE global_tasks
    SET deadline = 
        CASE
            WHEN deadline IS NOT NULL THEN
                deadline + INTERVAL '1 second' * $1
            ELSE
                deadline
        END
    WHERE id = $2;
  `

  try {
    await dbPool.query(updateGlobalTaskQuery, [timeDifference, globalTaskId])
    console.log(`Deadline обновлен для глобальной задачи с ID: ${globalTaskId}`)
  } catch (err) {
    console.error('Ошибка при обновлении deadline глобальной задачи:', err)
    throw new Error('Ошибка обновления deadline глобальной задачи')
  }

  // 3. Обновляем deadline в таблице tasks
  const updateSubTasksQuery = `
    UPDATE tasks
    SET deadline = 
        CASE
            WHEN deadline IS NOT NULL THEN
                deadline + INTERVAL '1 second' * $1
            ELSE
                deadline
        END
    WHERE global_task_id = $2;
  `

  try {
    await dbPool.query(updateSubTasksQuery, [timeDifference, globalTaskId])
    console.log(`Deadline обновлен для подзадач глобальной задачи с ID: ${globalTaskId}`)
  } catch (err) {
    console.error('Ошибка при обновлении deadline подзадач:', err)
    throw new Error('Ошибка обновления deadline подзадач')
  }
}

// Редактирование описания задачи
function updateTaskDescription(dbPool, io) {
  return async function (req, res) {
    const taskId = req.params.id
    const { newDescription, assignedUserIds } = req.body

    try {
      // Логика обновления описания задачи
      const currentTaskResult = await dbPool.query(
        'SELECT title, description FROM tasks WHERE id = $1',
        [taskId]
      )

      const currentDescription = currentTaskResult.rows[0]?.description
      const taskTitle = currentTaskResult.rows[0]?.title

      if (currentDescription) {
        await dbPool.query(
          'INSERT INTO task_description_history (task_id, previous_description) VALUES ($1, $2)',
          [taskId, currentDescription]
        )
      }

      await dbPool.query('UPDATE tasks SET description = $1 WHERE id = $2', [
        newDescription,
        taskId,
      ])

      io.emit('updateDescriptionTasks', taskId, assignedUserIds, taskTitle)
      res.status(200).json({ message: 'Описание задачи обновлено успешно.' })
    } catch (error) {
      console.error('Ошибка при обновлении описания задачи:', error)
      res.status(500).json({ error: 'Ошибка при обновлении описания задачи.' })
    }
  }
}

// Получение истории изменений описания задачи
function getTaskDescriptionHistory(dbPool) {
  return async function (req, res) {
    const taskId = req.params.id

    try {
      const result = await dbPool.query(
        'SELECT previous_description, updated_at FROM task_description_history WHERE task_id = $1 ORDER BY updated_at DESC',
        [taskId]
      )

      res.status(200).json(result.rows)
    } catch (error) {
      console.error('Ошибка при получении истории изменений описания задачи:', error)
      res.status(500).json({
        error: 'Ошибка при получении истории изменений описания задачи.',
      })
    }
  }
}

//*************************** Продление дедлайна на задачи **************************************************************************/

// Функция для создания запроса на продление срока
function createExtensionRequest(dbPool, io) {
  return async function (req, res) {
    const { task_id, requester_id, created_by, reason, new_proposed_deadline } = req.body

    try {
      // Проверяем существование задачи
      const taskResult = await dbPool.query(
        `SELECT 
          t.title, 
          t.deadline, 
          t.status, 
          t.priority,
          u.first_name,
          u.middle_name,
          u.last_name
        FROM tasks t
        LEFT JOIN task_assignments ta ON t.id = ta.task_id
        LEFT JOIN users u ON ta.user_id = u.id
        WHERE t.id = $1`,
        [task_id]
      )

      if (taskResult.rows.length === 0) {
        return res.status(404).send('Задача не найдена')
      }

      const taskData = taskResult.rows[0]
      const executorFullName = `${taskData.last_name} ${taskData.first_name} ${taskData.middle_name}`

      // Создаем запрос на продление
      const insertResult = await dbPool.query(
        `INSERT INTO task_deadline_extension_requests 
         (task_id, requester_id, reason, new_proposed_deadline) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [task_id, requester_id, reason, new_proposed_deadline]
      )

      // Здесь должна быть логика отправки уведомления автору задачи
      io.emit('extendDeadline', {
        task_id,
        requester_id,
        created_by,
        reason,
        new_proposed_deadline,
        task_title: taskData.title,
        task_deadline: taskData.deadline,
        task_status: taskData.status,
        task_priority: taskData.priority,
        executor_full_name: executorFullName.trim(), // Убираем возможные лишние пробелы
      })

      res.status(201).json(insertResult.rows[0])
    } catch (error) {
      console.error('Ошибка при создании запроса на продление:', error)
      res.status(500).send('Ошибка сервера')
    }
  }
}

// Функция для получения запросов на продление по создателю задачи
function getPendingExtensionRequestsForCreator(dbPool) {
  return async function (req, res) {
    const { userId } = req.params

    try {
      const result = await dbPool.query(
        `SELECT r.*, t.title as task_title, t.deadline,
                u.first_name as requester_first_name,
                u.last_name as requester_last_name
         FROM task_deadline_extension_requests r
         JOIN tasks t ON r.task_id = t.id
         JOIN users u ON r.requester_id = u.id
         WHERE t.created_by = $1 AND r.status = 'pending'
         ORDER BY r.request_date DESC`,
        [userId]
      )

      res.json(result.rows)
    } catch (error) {
      console.error('Ошибка при получении запросов на продление:', error)
      res.status(500).send('Ошибка сервера')
    }
  }
}

// Функция для обработки запроса (отклонение)
const rejectExtensionRequest = (dbPool, io) => async (req, res) => {
  try {
    const { requestId } = req.params
    const { responder_id, response_comment } = req.body

    // 1. Проверяем существование запроса
    const requestQuery = await dbPool.query(
      `SELECT r.*, t.title AS task_title, u.id AS requester_id
       FROM task_deadline_extension_requests r
       JOIN tasks t ON r.task_id = t.id
       JOIN users u ON r.requester_id = u.id
       WHERE r.id = $1 AND r.status = 'pending'`,
      [requestId]
    )

    if (!requestQuery.rows.length) {
      return res.status(404).json({ error: 'Запрос не найден или уже обработан' })
    }

    const request = requestQuery.rows[0]

    // 2. Обновляем статус запроса (без сохранения комментария в этой таблице)
    await dbPool.query(
      `UPDATE task_deadline_extension_requests 
       SET status = 'rejected', 
           response_date = CURRENT_TIMESTAMP,
           responder_id = $1
       WHERE id = $2`,
      [responder_id, requestId]
    )

    // 3. Создаем уведомление с учетом пустого комментария
    const notificationMessage = response_comment
      ? `Ваш запрос на продление срока для задачи "${request.task_title}" отклонен. Причина: ${response_comment}`
      : `Ваш запрос на продление срока для задачи "${request.task_title}" отклонен. Необходимо выполнить задачу в запланированный срок!`

    const notification = await dbPool.query(
      `INSERT INTO notifications 
       (user_id, task_id, message, event_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [request.requester_id, request.task_id, notificationMessage, 'extension_request_rejected']
    )

    // 4. Отправка WebSocket уведомления
    io.emit('notification', {
      id: notification.rows[0].id,
      message: notificationMessage,
      type: 'extension_request_rejected',
      taskId: request.task_id,
      userId: request.requester_id,
    })

    res.json({ success: true, message: 'Запрос отклонен' })
  } catch (error) {
    console.error('Ошибка при отклонении запроса:', error)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
}

// Функция для обработки запроса (утверждено)
const approveExtensionRequest = (dbPool, io) => async (req, res) => {
  try {
    const { requestId } = req.params
    const { responder_id, response_comment, new_deadline } = req.body

    // Преобразуем дату к локальному времени (без учета часового пояса)
    const localDeadline = new Date(new_deadline)
    const formattedDeadline = new Date(
      localDeadline.getFullYear(),
      localDeadline.getMonth(),
      localDeadline.getDate(),
      localDeadline.getHours(),
      localDeadline.getMinutes(),
      localDeadline.getSeconds()
    ).toISOString()

    // 1. Проверяем существование запроса
    const requestQuery = await dbPool.query(
      `SELECT r.*, t.title AS task_title, t.deadline AS current_deadline, 
              u.id AS requester_id 
       FROM task_deadline_extension_requests r
       JOIN tasks t ON r.task_id = t.id
       JOIN users u ON r.requester_id = u.id
       WHERE r.id = $1 AND r.status = 'pending'`,
      [requestId]
    )

    if (!requestQuery.rows.length) {
      return res.status(404).json({ error: 'Запрос не найден или уже обработан' })
    }

    const request = requestQuery.rows[0]

    // 3. Обновляем срок задачи  status = 'doing'
    await dbPool.query(
      `UPDATE tasks 
       SET deadline = $1   
       WHERE id = $2`,
      [formattedDeadline, request.task_id]
    )

    // 4. Обновляем статус запроса
    await dbPool.query(
      `UPDATE task_deadline_extension_requests 
       SET status = 'approved', 
           response_date = CURRENT_TIMESTAMP,
           responder_id = $1,
           response_comment = $2
       WHERE id = $3`,
      [responder_id, response_comment, requestId]
    )

    // 5. Создаем уведомление
    const notificationMessage = response_comment
      ? `Ваш запрос на продление срока для задачи "${
          request.task_title
        }" одобрен. Новый срок: ${new Date(
          new_deadline
        ).toLocaleString()}. Комментарий: ${response_comment}`
      : `Ваш запрос на продление срока для задачи "${
          request.task_title
        }" одобрен. Новый срок: ${new Date(new_deadline).toLocaleString()}`

    const notification = await dbPool.query(
      `INSERT INTO notifications 
       (user_id, task_id, message, event_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [request.requester_id, request.task_id, notificationMessage, 'extension_request_approved']
    )

    // 7. Отправка WebSocket уведомления
    io.emit('notification', {
      id: notification.rows[0].id,
      message: notificationMessage,
      type: 'extension_request_approved',
      taskId: request.task_id,
      userId: request.requester_id,
      newDeadline: new_deadline,
    })

    res.json({
      success: true,
      message: 'Запрос одобрен',
      newDeadline: new_deadline,
    })
  } catch (error) {
    console.error('Ошибка при одобрении запроса:', error)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
}

// Изменения срока исполнения задачи ***************************************************************************************
const updateTaskDeadline = (dbPool, io) => async (req, res) => {
  try {
    const { taskId } = req.params
    const { responder_id, response_comment, new_deadline, assigned_user_ids } = req.body

    // Преобразуем дату к локальному времени
    const localDeadline = new Date(new_deadline)
    const formattedDeadline = new Date(
      localDeadline.getFullYear(),
      localDeadline.getMonth(),
      localDeadline.getDate(),
      localDeadline.getHours(),
      localDeadline.getMinutes(),
      localDeadline.getSeconds()
    ).toISOString()

    // 1. Получаем данные задачи и автора
    const taskQuery = await dbPool.query(
      `SELECT t.*, u.id AS author_id, 
              CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name) AS author_name
       FROM tasks t
       JOIN users u ON t.created_by = u.id
       WHERE t.id = \$1`,
      [taskId]
    )

    if (!taskQuery.rows.length) {
      return res.status(404).json({ error: 'Задача не найдена' })
    }

    const task = taskQuery.rows[0]

    // 2. Получаем список исполнителей задачи
    const assigneesQuery = await dbPool.query(
      `SELECT user_id FROM task_assignments WHERE task_id = \$1`,
      [taskId]
    )

    const assignees = assigneesQuery.rows.map((row) => row.user_id)

    // Если переданы assigned_user_ids, используем их, иначе берем из БД
    const recipients =
      assigned_user_ids && assigned_user_ids.length > 0 ? assigned_user_ids : assignees

    // 3. Обновляем срок задачи
    await dbPool.query(
      `UPDATE tasks 
       SET deadline = \$1
       WHERE id = \$2`,
      [formattedDeadline, taskId]
    )

    // 4. Создаем уведомления для всех исполнителей
    const notificationMessage = response_comment
      ? `Срок выполнения задачи "${task.title}" изменен. Новый срок: ${new Date(
          new_deadline
        ).toLocaleString()}. Комментарий: ${response_comment}`
      : `Срок выполнения задачи "${task.title}" изменен. Новый срок: ${new Date(
          new_deadline
        ).toLocaleString()}`

    // Добавляем уведомления для каждого исполнителя
    const notifications = []
    for (const userId of recipients) {
      const notification = await dbPool.query(
        `INSERT INTO notifications 
         (user_id, task_id, message, event_type)
         VALUES (\$1, \$2, \$3, \$4)
         RETURNING *`,
        [userId, taskId, notificationMessage, 'task_deadline_updated']
      )

      notifications.push(notification.rows[0])

      // Отправка WebSocket уведомления каждому исполнителю
      io.emit('notification', {
        id: notification.rows[0].id,
        message: notificationMessage,
        type: 'task_deadline_updated',
        taskId: taskId,
        userId: userId,
        newDeadline: formattedDeadline,
      })
    }

    // Также отправляем уведомление автору (если он не исполнитель)
    /* if (!recipients.includes(task.author_id)) {
      const authorNotification = await dbPool.query(
        `INSERT INTO notifications 
         (user_id, task_id, message, event_type)
         VALUES (\$1, \$2, \$3, \$4)
         RETURNING *`,
        [task.author_id, taskId, notificationMessage, 'task_deadline_updated']
      )*/

    /*   io.to(`user_${task.author_id}`).emit('notification', {
        id: authorNotification.rows[0].id,
        message: notificationMessage,
        type: 'task_deadline_updated',
        taskId: taskId,
        userId: task.author_id,
        newDeadline: formattedDeadline,
      })
    }*/

    res.json({
      success: true,
      message: 'Срок задачи обновлен',
      newDeadline: formattedDeadline,
      notifications: notifications.length,
    })
  } catch (error) {
    console.error('Ошибка при обновлении срока задачи:', error)
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      details: error.message,
    })
  }
}

// проверка перед отправкой уведомления о сроках
const checkNotification = (dbPool) => async (req, res) => {
  try {
    const { userId, taskId, eventType } = req.query

    const result = await dbPool.query(
      `SELECT EXISTS (
        SELECT 1 FROM notifications 
        WHERE user_id = \$1 
          AND task_id = \$2 
          AND event_type = \$3
          AND is_read = false
      ) AS has_unread`,
      [userId, taskId, eventType]
    )

    // Отправляем уведомление только если нет непрочитанных дубликатов
    res.json({ shouldSend: !result.rows[0].has_unread })
  } catch (error) {
    console.error('Error checking notification:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Запрашивает все уведомление у которых id = получателю и is_read = false не прочитанные
const getUnreadNotifications = (dbPool) => async (req, res) => {
  try {
    const userId = req.params.userId

    const result = await dbPool.query(
      `SELECT 
         n.id, 
         n.user_id, 
         n.task_id, 
         n.message, 
         n.event_type, 
         n.created_at,
         t.title AS task_title
       FROM notifications n
       LEFT JOIN tasks t ON n.task_id = t.id
       WHERE n.user_id = $1 AND n.is_read = false
       ORDER BY n.created_at DESC`,
      [userId]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching unread notifications:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Функция для очистки уведомления
const markNotificationAsRead = (dbPool) => async (req, res) => {
  try {
    const { notificationId } = req.params

    // Проверяем существование уведомления
    const checkResult = await dbPool.query('SELECT id FROM notifications WHERE id = $1', [
      notificationId,
    ])

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Уведомление не найдено' })
    }

    // Обновляем статус уведомления
    const updateResult = await dbPool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *',
      [notificationId]
    )

    res.status(200).json(updateResult.rows[0])
  } catch (error) {
    console.error('Ошибка при пометке уведомления как прочитанного:', error)
    res.status(500).json({
      message: 'Внутренняя ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    })
  }
}

// Получить иерархию подзадачи по id задачи (нужно упростить, убрать визуал)
function getTaskHierarchy(dbPool) {
  return async function (req, res) {
    const { taskId } = req.params // Получаем taskId из параметров запроса

    try {
      const query = `
        WITH RECURSIVE task_hierarchy AS (
          SELECT 
            t.id, 
            t.title, 
            t.description,
            t.parent_id, 
            t.root_id,
            t.status,
            t.is_completed,
            t.created_at,
            t.deadline,
            t.priority,
            t.created_by,
            u.username AS author_name,
            0 AS level,
            ARRAY[t.id] AS path,
            t.title::TEXT AS hierarchy_path_display,
             (SELECT array_agg(ta.user_id ORDER BY ta.user_id) 
             FROM task_assignments ta 
             JOIN users u ON ta.user_id = u.id 
             WHERE ta.task_id = t.id) AS assignees
          FROM tasks t
          LEFT JOIN users u ON t.created_by = u.id
          WHERE t.id = $1
          
          UNION ALL
          
          SELECT 
            t.id, 
            t.title, 
            t.description,
            t.parent_id, 
            t.root_id,
            t.status,
            t.is_completed,
            t.created_at,
            t.deadline,
            t.priority,
            t.created_by,
            u.username AS author_name,
            th.level + 1,
            th.path || t.id,
            (th.hierarchy_path_display || ' → ' || t.title)::TEXT,
             (SELECT array_agg(ta.user_id ORDER BY ta.user_id)
             FROM task_assignments ta 
             JOIN users u ON ta.user_id = u.id 
             WHERE ta.task_id = t.id) AS assignees
          FROM tasks t
          JOIN task_hierarchy th ON t.parent_id = th.id
          LEFT JOIN users u ON t.created_by = u.id
        )
        SELECT * FROM task_hierarchy
        ORDER BY path;
      `

      const result = await dbPool.query(query, [taskId])

      if (result.rows.length === 0) {
        return res.status(404).send('Иерархия задач не найдена')
      }

      res.json(result.rows)
    } catch (error) {
      console.error('Ошибка при получении иерархии задач:', error)
      res.status(500).send('Ошибка сервера')
    }
  }
}

// Для отображения иконки иерархии
function hasSubtasks(dbPool) {
  return async function (req, res) {
    const { taskId } = req.params

    try {
      const query = `
    SELECT 
  EXISTS(
    SELECT 1 FROM tasks WHERE parent_id = $1
  ) as has_subtasks,
  CASE 
    WHEN EXISTS(SELECT 1 FROM tasks WHERE parent_id = $1) THEN
      NOT EXISTS(
        SELECT 1 FROM tasks 
        WHERE parent_id = $1 
        AND is_completed = false
        AND id != $1  -- Исключаем саму родительскую задачу
      )
    ELSE false
  END as all_completed;
      `

      const result = await dbPool.query(query, [taskId])
      res.json(result.rows[0])
    } catch (error) {
      console.error('Error checking subtasks:', error)
      res.status(500).send('Server error')
    }
  }
}

// Функция проверки просроченных задач по сроку исполнения *******************************
async function checkOverdueTasks(dbPool, io) {
  try {
    console.log('[Cron] Проверка просроченных задач...')

    // Получаем задачи + всех исполнителей сразу
    const overdueTasks = await dbPool.query(`
      SELECT 
        t.id,
        t.title,
        t.deadline,
        t.created_by,
        json_agg(ta.user_id) as assignees  -- Собираем ID исполнителей в массив
      FROM tasks t
      JOIN task_assignments ta ON t.id = ta.task_id
      WHERE t.deadline IS NOT NULL
        AND t.deadline <= NOW()
        AND t.is_completed = FALSE
        AND t.status != 'done'
      GROUP BY t.id  -- Группируем по задачам
    `)

    if (overdueTasks.rows.length === 0) {
      console.log('[Cron] Нет просроченных задач.')
      return
    }

    for (const task of overdueTasks.rows) {
      await sendOverdueNotification(
        {
          ...task,
          assignees: task.assignees || [], // Передаём массив исполнителей
        },
        dbPool,
        io
      )
    }

    console.log(`[Cron] Обработано ${overdueTasks.rows.length} просроченных задач.`)
  } catch (error) {
    console.error('[Cron] Ошибка при проверке задач:', error)
  }
}

//  Функция уведомления просроченных задач по сроку исполнения
/*async function sendOverdueNotification(task, dbPool, io) {
  const { id, title, deadline, created_by, assignees } = task

  if (assignees.length === 0) {
    console.log(`[Notification] У задачи ${id} нет исполнителей.`)
    return
  }

  // Получаем данные автора задачи
  const authorQuery = await dbPool.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [
    created_by,
  ])
  const author = authorQuery.rows[0]
  const authorName = author ? `${author.last_name} ${author.first_name}` : 'Неизвестный автор'

  for (const user_id of assignees) {
    // Получаем данные исполнителя
    const assigneeQuery = await dbPool.query(
      `SELECT first_name, last_name FROM users WHERE id = $1`,
      [user_id]
    )
    const assignee = assigneeQuery.rows[0]
    const assigneeName = assignee
      ? `${assignee.last_name} ${assignee.first_name}`
      : 'Неизвестный исполнитель'

    const existingNotification = await dbPool.query(
      `SELECT id, is_read FROM notifications 
       WHERE task_id = $1 AND user_id = $2 AND event_type = 'taskDeadlineOverdue'
       ORDER BY created_at DESC
       LIMIT 1`,
      [id, user_id]
    )

    if (existingNotification.rows.length > 0 && !existingNotification.rows[0].is_read) {
      console.log(
        `[Notification] Непрочитанное уведомление для задачи ${id} (исполнитель ${user_id}) уже существует.`
      )
      continue
    }
    
    // Уведомление для исполнителя
    await dbPool.query(
      `INSERT INTO notifications (
        user_id, task_id, message, event_type, is_sent
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        user_id,
        id,
        `Задача "${title}". Сроки исполнения были нарушены! Автор задачи: ${authorName}. Срок исполнения истек ${formatDeadline(
          deadline
        )}`,
        'taskDeadlineOverdue',
        false,
      ]
    )

    // Уведомление для автора
    await dbPool.query(
      `INSERT INTO notifications (
        user_id, task_id, message, event_type, is_sent
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        created_by,
        id,
        `Задача "${title}". Сроки исполнения были нарушены! Исполнитель: ${assigneeName}. Срок исполнения истек ${formatDeadline(
          deadline
        )}`,
        'taskDeadlineOverdue',
        false,
      ]
    )

    // Отправка события через сокет
    io.emit('notification', {
      type: 'taskDeadlineOverdue',
      message: `"${title}"`,
      taskId: id,
      userId: user_id,
      createdBy: created_by,
      deadline: deadline,
      authorName: authorName,
      assigneeName: assigneeName,
    })
  }
}*/
async function sendOverdueNotification(task, dbPool, io) {
  const { id, title, deadline, created_by, assignees } = task

  // Если нет исполнителей - пропускаем задачу
  if (assignees.length === 0) {
    console.log(`[Notification] У задачи ${id} нет исполнителей. Уведомления не отправлены.`)
    return
  }

  // Получаем данные автора задачи
  const authorQuery = await dbPool.query(`SELECT first_name, last_name FROM users WHERE id = \$1`, [
    created_by,
  ])
  const author = authorQuery.rows[0]
  const authorName = author ? `${author.last_name} ${author.first_name}` : 'Неизвестный автор'

  // Убираем дубликаты ID исполнителей (на случай ошибок в данных)
  const uniqueAssigneeIds = [...new Set(assignees)]
  const assigneeNames = []

  // Отправляем уведомления исполнителям
  for (const user_id of uniqueAssigneeIds) {
    // Пропускаем автора, если он есть среди исполнителей (ему будет отдельное уведомление)
    if (user_id === created_by) continue

    // Получаем имя исполнителя
    const assigneeQuery = await dbPool.query(
      `SELECT first_name, last_name FROM users WHERE id = \$1`,
      [user_id]
    )
    const assignee = assigneeQuery.rows[0]
    const assigneeName = assignee
      ? `${assignee.last_name} ${assignee.first_name}`
      : 'Неизвестный исполнитель'
    assigneeNames.push(assigneeName)

    // Проверяем, есть ли уже непрочитанное уведомление
    const existingNotification = await dbPool.query(
      `SELECT id FROM notifications 
       WHERE task_id = \$1 AND user_id = \$2 AND event_type = 'taskDeadlineOverdue' AND NOT is_read
       LIMIT 1`,
      [id, user_id]
    )

    // Если уведомление уже есть - пропускаем
    if (existingNotification.rows.length > 0) {
      console.log(
        `[Notification] У исполнителя ${user_id} уже есть непрочитанное уведомление по задаче ${id}`
      )
      continue
    }

    // Создаем новое уведомление для исполнителя
    await dbPool.query(
      `INSERT INTO notifications (user_id, task_id, message, event_type, is_sent) 
       VALUES (\$1, \$2, \$3, \$4, \$5)`,
      [
        user_id,
        id,
        `Задача "${title}" просрочена. Автор: ${authorName}. Срок истек ${formatDeadline(
          deadline
        )}`,
        'taskDeadlineOverdue',
        false,
      ]
    )

    // Отправляем событие через сокет
    io.emit('notification', {
      type: 'taskDeadlineOverdue',
      message: `Задача "${title}" просрочена`,
      taskId: id,
      userId: user_id,
    })
  }

  // Отправляем ОДНО уведомление автору (если есть исполнители)
  if (assigneeNames.length > 0) {
    // Проверяем, есть ли уже непрочитанное уведомление у автора
    const existingAuthorNotification = await dbPool.query(
      `SELECT id FROM notifications 
       WHERE task_id = \$1 AND user_id = \$2 AND event_type = 'taskDeadlineOverdue' AND NOT is_read
       LIMIT 1`,
      [id, created_by]
    )

    // Если у автора нет непрочитанного уведомления - создаем
    if (existingAuthorNotification.rows.length === 0) {
      await dbPool.query(
        `INSERT INTO notifications (user_id, task_id, message, event_type, is_sent) 
         VALUES (\$1, \$2, \$3, \$4, \$5)`,
        [
          created_by,
          id,
          `Ваша задача "${title}" просрочена. Исполнители: ${assigneeNames.join(
            ', '
          )}. Срок истек ${formatDeadline(deadline)}`,
          'taskDeadlineOverdue',
          false,
        ]
      )

      // Отправляем событие через сокет
      io.emit('notification', {
        type: 'taskDeadlineOverdue',
        message: `Задача "${title}" просрочена`,
        taskId: id,
        userId: created_by,
      })
    } else {
      console.log(
        `[Notification] У автора ${created_by} уже есть непрочитанное уведомление по задаче ${id}`
      )
    }
  }
}

// Функция для добавления файла в таблицу chat_files
function addChatFile(dbPool) {
  return async function (req, res) {
    const {
      message_id,
      task_id,
      original_name,
      server_filename,
      file_path,
      file_size,
      file_type,
      is_image,
      sender_id,
      sender_name,
    } = req.body

    try {
      const result = await dbPool.query(
        `INSERT INTO chat_files (
          message_id, task_id, original_name, server_filename, 
          file_path, file_size, file_type, is_image, sender_id, sender_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          message_id,
          task_id,
          original_name,
          server_filename,
          file_path,
          file_size,
          file_type,
          is_image,
          sender_id,
          sender_name,
        ]
      )

      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error('Ошибка при добавлении файла в chat_files:', error)
      res.status(500).json({ error: 'Ошибка сервера при добавлении файла' })
    }
  }
}

// Функция для получения файлов по ID задачи
function getChatFilesByTaskId(dbPool) {
  return async function (req, res) {
    const { taskId } = req.params

    try {
      const result = await dbPool.query(
        `SELECT * FROM chat_files WHERE task_id = $1 ORDER BY created_at DESC`,
        [taskId]
      )

      res.json({ files: result.rows })
    } catch (error) {
      console.error('Ошибка при получении файлов:', error)
      res.status(500).json({ error: 'Ошибка сервера при получении файлов' })
    }
  }
}

module.exports = {
  createTask,
  addTaskAssignment,
  addTaskApproval,
  addTaskVisibility,
  addTaskAttachment,
  replaceTaskAssignment,
  getUserTasks,
  notifyTaskCreated,
  updateTaskStatus,
  updateTaskApproval,
  updateTaskAccept,
  getTaskComments,
  addTaskComment,
  getMessagesNotificationDealer,
  postMessagesNotificationDealer,
  getTaskMessages,
  sendTaskMessage,
  markMessagesAsRead,
  createGlobalTask,
  getGlobalTasks,
  updateGlobalTask,
  getSubtasksForGlobalTask,
  updateGlobalTaskProcess,
  deleteGlobalTask,
  getGlobalTaskById,
  getAttachmentsByTaskId,
  addCommentToGlobalTask,
  addResponsiblesToGlobalTask,
  updateGoals,
  updateAdditionalInfo,
  getChatMessages,
  sendChatMessage,
  getGlobalTaskHistory,
  updateGlobalTaskHistory,
  getGlobalTaskTitle,
  updateTaskDescription,
  getTaskDescriptionHistory,
  getTaskById,
  createExtensionRequest,
  getPendingExtensionRequestsForCreator,
  rejectExtensionRequest,
  getUnreadNotifications,
  markNotificationAsRead,
  approveExtensionRequest,
  getTaskHierarchy,
  hasSubtasks,
  checkOverdueTasks,
  updateTaskDeadline,
  checkNotification,
  addChatFile,
  getChatFilesByTaskId,
}
