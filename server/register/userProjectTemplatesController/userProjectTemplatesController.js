/**
 * Личные шаблоны формы создания проекта.
 * Срок хранится как смещение в днях от дня создания, не как фиксированная дата.
 * Файлы и уже выставленное согласование в шаблон не входят.
 */

const PRIORITIES = new Set(['low', 'medium', 'high'])

function normalizeGoals(value) {
  let list = value
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value)
    } catch {
      list = []
    }
  }
  if (!Array.isArray(list)) return []
  return list
    .map((item) => String(item || '').trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, 50)
}

function normalizeAdditionalInfo(value) {
  let source = value
  if (typeof value === 'string') {
    try {
      source = JSON.parse(value)
    } catch {
      source = {}
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  const result = {}
  Object.entries(source)
    .slice(0, 40)
    .forEach(([key, item]) => {
      const name = String(key || '').trim().slice(0, 200)
      if (!name) return
      result[name] = String(item ?? '').slice(0, 2000)
    })
  return result
}

function normalizeResponsibles(value) {
  let list = value
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value)
    } catch {
      list = []
    }
  }
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const result = []
  list.forEach((item) => {
    const userId = Number(item?.userId ?? item?.id)
    if (!Number.isInteger(userId) || userId <= 0 || seen.has(userId)) return
    seen.add(userId)
    result.push({
      userId,
      role: String(item?.role || '').trim().slice(0, 80),
      requiresApproval: item?.requiresApproval === true || item?.requires_approval === true,
    })
  })
  return result.slice(0, 50)
}

function normalizePayload(body) {
  const name = String(body.name || '').trim().slice(0, 255)
  const title = String(body.title || '').trim().slice(0, 500)
  const description = String(body.description || '').slice(0, 200000)
  const rawPriority = String(body.priority || '').trim()
  const priority = PRIORITIES.has(rawPriority) ? rawPriority : 'medium'
  let deadlineOffsetDays = body.deadlineOffsetDays
  if (deadlineOffsetDays === '' || deadlineOffsetDays == null) {
    deadlineOffsetDays = null
  } else {
    deadlineOffsetDays = Number(deadlineOffsetDays)
    if (!Number.isInteger(deadlineOffsetDays)) deadlineOffsetDays = null
    else if (deadlineOffsetDays < 0) deadlineOffsetDays = 0
    else if (deadlineOffsetDays > 3650) deadlineOffsetDays = 3650
  }
  let deadlineTime = body.deadlineTime
  if (deadlineTime == null || deadlineTime === '') deadlineTime = null
  else {
    deadlineTime = String(deadlineTime).slice(0, 5)
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(deadlineTime)) deadlineTime = null
  }
  return {
    name,
    title,
    description,
    priority,
    goals: normalizeGoals(body.goals),
    additionalInfo: normalizeAdditionalInfo(body.additionalInfo),
    responsibles: normalizeResponsibles(body.responsibles),
    deadlineOffsetDays,
    deadlineTime,
  }
}

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    title: row.title || '',
    description: row.description || '',
    priority: row.priority || 'medium',
    goals: row.goals || [],
    additionalInfo: row.additional_info || {},
    responsibles: row.responsibles || [],
    deadlineOffsetDays: row.deadline_offset_days,
    deadlineTime: row.deadline_time,
    updatedAt: row.updated_at,
  }
}

const RETURNING = `id, name, title, description, priority, goals, additional_info,
  responsibles, deadline_offset_days, deadline_time, updated_at`

function listUserProjectTemplates(dbPool) {
  return async (req, res) => {
    try {
      const userId = Number(req.query.userId)
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Укажите пользователя.' })
      }
      const result = await dbPool.query(
        `SELECT ${RETURNING}
         FROM user_project_templates
         WHERE owner_user_id = $1
         ORDER BY updated_at DESC, id DESC`,
        [userId]
      )
      res.json(result.rows.map(mapRow))
    } catch (err) {
      console.error('listUserProjectTemplates:', err)
      res.status(500).json({ error: 'Не удалось загрузить шаблоны.' })
    }
  }
}

function createUserProjectTemplate(dbPool) {
  return async (req, res) => {
    try {
      const userId = Number(req.body.userId)
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Укажите пользователя.' })
      }
      const payload = normalizePayload(req.body)
      if (!payload.name) {
        return res.status(400).json({ error: 'Укажите название шаблона.' })
      }
      const result = await dbPool.query(
        `INSERT INTO user_project_templates (
           owner_user_id, name, title, description, priority, goals,
           additional_info, responsibles, deadline_offset_days, deadline_time
         ) VALUES (
           $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10
         )
         RETURNING ${RETURNING}`,
        [
          userId,
          payload.name,
          payload.title,
          payload.description,
          payload.priority,
          JSON.stringify(payload.goals),
          JSON.stringify(payload.additionalInfo),
          JSON.stringify(payload.responsibles),
          payload.deadlineOffsetDays,
          payload.deadlineTime,
        ]
      )
      res.status(201).json(mapRow(result.rows[0]))
    } catch (err) {
      console.error('createUserProjectTemplate:', err)
      res.status(500).json({ error: 'Не удалось сохранить шаблон.' })
    }
  }
}

function updateUserProjectTemplate(dbPool) {
  return async (req, res) => {
    try {
      const id = Number(req.params.id)
      const userId = Number(req.body.userId)
      if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Некорректный шаблон.' })
      }
      const payload = normalizePayload(req.body)
      if (!payload.name) {
        return res.status(400).json({ error: 'Укажите название шаблона.' })
      }
      const result = await dbPool.query(
        `UPDATE user_project_templates
         SET name = $3,
             title = $4,
             description = $5,
             priority = $6,
             goals = $7::jsonb,
             additional_info = $8::jsonb,
             responsibles = $9::jsonb,
             deadline_offset_days = $10,
             deadline_time = $11,
             updated_at = NOW()
         WHERE id = $1 AND owner_user_id = $2
         RETURNING ${RETURNING}`,
        [
          id,
          userId,
          payload.name,
          payload.title,
          payload.description,
          payload.priority,
          JSON.stringify(payload.goals),
          JSON.stringify(payload.additionalInfo),
          JSON.stringify(payload.responsibles),
          payload.deadlineOffsetDays,
          payload.deadlineTime,
        ]
      )
      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Шаблон не найден.' })
      }
      res.json(mapRow(result.rows[0]))
    } catch (err) {
      console.error('updateUserProjectTemplate:', err)
      res.status(500).json({ error: 'Не удалось обновить шаблон.' })
    }
  }
}

function deleteUserProjectTemplate(dbPool) {
  return async (req, res) => {
    try {
      const id = Number(req.params.id)
      const userId = Number(req.query.userId)
      if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Некорректный шаблон.' })
      }
      const result = await dbPool.query(
        `DELETE FROM user_project_templates
         WHERE id = $1 AND owner_user_id = $2
         RETURNING id`,
        [id, userId]
      )
      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Шаблон не найден.' })
      }
      res.json({ ok: true })
    } catch (err) {
      console.error('deleteUserProjectTemplate:', err)
      res.status(500).json({ error: 'Не удалось удалить шаблон.' })
    }
  }
}

module.exports = {
  listUserProjectTemplates,
  createUserProjectTemplate,
  updateUserProjectTemplate,
  deleteUserProjectTemplate,
}
