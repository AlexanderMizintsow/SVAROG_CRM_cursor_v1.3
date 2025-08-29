// workGroupsController.js

const { body, validationResult } = require('express-validator')

// Функция для обновления информации о группе
const updateWorkGroup = (dbPool, io) => async (req, res) => {
  const { selected_date, start_date, end_date, create_type } = req.body
  const groupId = req.params.id

  // Проверка наличия необходимых данных
  if (!selected_date || !create_type) {
    return res.status(400).json({ error: 'Неверные данные запроса.' })
  }

  try {
    // Обновление данных группы в таблице work_groups
    await dbPool.query(
      'UPDATE work_groups SET selected_date = $1, start_date = $2, end_date = $3, create_type = $4 WHERE id = $5',
      [selected_date, start_date, end_date, create_type, groupId]
    )

    io.emit('groupCreated')

    res.status(200).json({ message: 'Информация о группе успешно обновлена.' })
  } catch (err) {
    console.error('Ошибка при обновлении группы:', err)
    res.status(500).json({ error: 'Ошибка при обновлении группы.' })
  }
}

// Функция для сохранения голосов участников
const saveParticipantVotes = (dbPool, io) => async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }

  const { group_id, participant, selected_dates } = req.body

  // Проверка наличия необходимых данных
  if (
    !group_id ||
    !participant ||
    !Array.isArray(selected_dates) ||
    selected_dates.length === 0
  ) {
    return res.status(400).json({ error: 'Неверные данные запроса.' })
  }

  try {
    // Удаление старых голосов участника для данной группы
    await dbPool.query(
      `
      DELETE FROM participant_votes
      WHERE group_id = $1 AND participant_id = $2
      `,
      [group_id, participant]
    )

    // Используем Promise для отслеживания вставок
    const promises = selected_dates.map(async (date) => {
      // Попытка вставить новую запись
      return await dbPool.query(
        `
        INSERT INTO participant_votes (group_id, participant_id, selected_date)
        VALUES ($1, $2, $3)
        `,
        [group_id, participant, date]
      )
    })

    await Promise.all(promises) // Ожидание завершения всех вставок
    // Эмитируем событие для всех клиентов
    io.emit('participantVotesUpdated', {
      group_id,
      participant,
      selected_dates,
    })

    res.status(201).json({ message: 'Выборы участников успешно сохранены.' })
    console.log('Полученные данные:', req.body)
  } catch (err) {
    console.error('Ошибка при сохранении выборов участников:', err)
    return res.status(500).json({
      error: 'Ошибка при сохранении голосов участников.',
      details: err.message,
    })
  }
}

module.exports = saveParticipantVotes

// Функция для получения групп с фиксированным типом создания и их участников
const getFixedGroups = (dbPool) => async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }

  try {
    const result = await dbPool.query(
      `SELECT wg.*, 
              u.first_name,
              u.last_name,
              u.middle_name,
              array_agg(u2.id) AS participant_ids,  -- Собираем ID участников в массив
              array_agg(CONCAT(u2.last_name, ' ', u2.first_name, ' ', u2.middle_name)) AS participants
       FROM work_groups wg
       LEFT JOIN group_participants p ON wg.id = p.work_groups_id
       LEFT JOIN users u ON wg.created_by = u.id  -- Получаем информацию о создателе группы
       LEFT JOIN users u2 ON p.user_id = u2.id  -- Получаем участников
       WHERE wg.create_type = 'fixed'
       GROUP BY wg.id, u.first_name, u.last_name, u.middle_name`
    )

    // Вместо возвращения 404, просто возвращаем пустой массив
    res.status(200).json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении фиксированных групп:', err)
    res.status(500).json({ error: 'Ошибка при получении групп' })
  }
}

// Функция для получения групп с range типом создания и их участников
const getRangeGroups = (dbPool) => async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }

  try {
    const result = await dbPool.query(
      `SELECT wg.*, 
              u.first_name,
              u.last_name,
              u.middle_name,
              u.id AS created_by_id, -- ID создателя группы
              json_agg(json_build_object(
                'id', u2.id, -- ID участника
                'full_name', CONCAT(u2.last_name, ' ', u2.first_name, ' ', u2.middle_name) -- Полное имя участника
              )) AS participants
       FROM work_groups wg
       LEFT JOIN group_participants p ON wg.id = p.work_groups_id
       LEFT JOIN users u ON wg.created_by = u.id  -- Получаем информацию о создателе группы
       LEFT JOIN users u2 ON p.user_id = u2.id  -- Получаем участников
       WHERE wg.create_type = 'range'
       GROUP BY wg.id, u.first_name, u.last_name, u.middle_name,u.id`
    )

    // Вместо возвращения 404, просто возвращаем пустой массив
    res.status(200).json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении фиксированных групп:', err)
    res.status(500).json({ error: 'Ошибка при получении групп' })
  }
}

// Функция для создания новой группы
const createGroup = (dbPool, io) => async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }

  const {
    group_name,
    description,
    importance,
    create_type,
    start_date,
    end_date,
    selected_date,
    created_by,
  } = req.body

  try {
    const result = await dbPool.query(
      `INSERT INTO work_groups (group_name, description, importance, create_type, start_date, end_date, selected_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        group_name,
        description,
        importance,
        create_type,
        start_date,
        end_date,
        selected_date,
        created_by,
      ]
    )

    const groupId = result.rows[0].id

    io.emit('groupCreated')
    res.status(201).json({ id: groupId })
  } catch (err) {
    console.error('Ошибка при создании группы:', err)
    res.status(500).json({ error: 'Ошибка при создании группы' })
  }
}

// Функция для добавления участников в группу
const addParticipantsToGroup = (dbPool, io) => async (req, res) => {
  const { work_groups_id, user_id } = req.body

  try {
    await dbPool.query(
      `INSERT INTO group_participants (work_groups_id, user_id) VALUES ($1, $2)`,
      [work_groups_id, user_id]
    )

    const result = await dbPool.query(
      `SELECT group_name, created_by FROM work_groups WHERE id = $1`,
      [work_groups_id]
    )
    io.emit('groupCreated')
    res.status(201).json({ message: 'Участник добавлен в группу' })
  } catch (err) {
    console.error('Ошибка при добавлении участника в группу:', err)
    res.status(500).json({ error: 'Ошибка при добавлении участника в группу' })
  }
}

// Функция для удаления участника из группы
const removeParticipantFromGroup = (dbPool, io) => async (req, res) => {
  const { groupId, participantId } = req.params

  try {
    // Удаление участника из таблицы group_participants
    await dbPool.query(
      'DELETE FROM group_participants WHERE work_groups_id = $1 AND user_id = $2',
      [groupId, participantId]
    )
    io.emit('groupCreated')
    res.status(200).json({ message: 'Участник успешно удален.' })
  } catch (error) {
    console.error('Ошибка при удалении участника:', error)
    res.status(500).json({ error: 'Ошибка при удалении участника.' })
  }
}

// Функция для удаления группы
const deleteGroup = (dbPool, io) => async (req, res) => {
  const groupId = req.params.id

  try {
    await dbPool.query('DELETE FROM work_groups WHERE id = $1', [groupId])

    io.emit('groupCreated')
    res.status(200).json({ message: 'Группа успешно удалена.' })
  } catch (error) {
    console.error('Ошибка при удалении группы:', error)
    res.status(500).json({ error: 'Ошибка при удалении группы.' })
  }
}

const getParticipantVotes = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(
      `
      SELECT group_id, participant_id, array_agg(selected_date::date) AS selected_dates
      FROM participant_votes
      GROUP BY group_id, participant_id
      `
    )

    // Преобразование результата в желаемый формат
    const formattedResult = {}
    result.rows.forEach((row) => {
      const { group_id, participant_id, selected_dates } = row

      if (!formattedResult[group_id]) {
        formattedResult[group_id] = {}
      }
      formattedResult[group_id][participant_id] = selected_dates.map(
        (date) => date.toISOString().split('T')[0]
      )
    })

    res.status(200).json(formattedResult)
  } catch (err) {
    console.error('Ошибка при получении голосов участников:', err)
    res.status(500).json({ error: 'Ошибка при получении голосов.' })
  }
}

// Получить количество групп ля конкретного пользователя
const getGroupCountsByUserId = (dbPool) => async (req, res) => {
  const userId = req.params.userId

  try {
    const result = await dbPool.query(
      `
      SELECT create_type,gp.user_id, COUNT(*) AS count
      FROM work_groups wg
      JOIN group_participants gp ON wg.id = gp.work_groups_id
      WHERE gp.user_id = $1
      GROUP BY create_type, gp.user_id
    `,
      [userId]
    )

    const counts = result.rows.reduce(
      (acc, row) => {
        acc[row.create_type] = parseInt(row.count, 10)
        return acc
      },
      { fixed: 0, range: 0 }
    )
    //console.log(counts)
    res.status(200).json(counts)
  } catch (error) {
    console.error('Ошибка при получении количества групп:', error)
    res.status(500).json({ error: 'Ошибка при получении количества групп' })
  }
}
// Экспорт маршрутов
module.exports = {
  saveParticipantVotes,
  getRangeGroups,
  getFixedGroups,
  createGroup,
  addParticipantsToGroup,
  updateWorkGroup,
  removeParticipantFromGroup,
  deleteGroup,
  getParticipantVotes,
  getGroupCountsByUserId,
}
