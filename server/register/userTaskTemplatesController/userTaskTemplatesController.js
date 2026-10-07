/**
 * Личные шаблоны формы создания задачи.
 * Срок хранится как смещение в днях от дня создания, не как фиксированная дата.
 */

const PRIORITIES = new Set(['низкий', 'средний', 'высокий'])

function normalizeIdList(value) {
  let list = value
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value)
    } catch {
      list = []
    }
  }
  if (!Array.isArray(list)) return []
  const ids = []
  const seen = new Set()
  for (const item of list) {
    const n = Number(item)
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue
    seen.add(n)
    ids.push(n)
  }
  return ids
}

function normalizePayload(body) {
  const name = String(body.name || '').trim()
  const title = String(body.title || '').trim().slice(0, 500)
  const description = String(body.description || '').slice(0, 200000)
  const rawPriority = String(body.priority || '').trim()
  const priority = PRIORITIES.has(rawPriority) ? rawPriority : 'низкий'
  const tags = String(body.tags || '').slice(0, 20000)
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
    tags,
    implementerIds: normalizeIdList(body.implementerIds),
    approverIds: normalizeIdList(body.approverIds),
    viewerIds: normalizeIdList(body.viewerIds),
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
    priority: row.priority || 'низкий',
    tags: row.tags || '',
    implementerIds: row.implementer_ids || [],
    approverIds: row.approver_ids || [],
    viewerIds: row.viewer_ids || [],
    deadlineOffsetDays: row.deadline_offset_days,
    deadlineTime: row.deadline_time,
    updatedAt: row.updated_at,
  }
}

function listUserTaskTemplates(dbPool) {
  return async (req, res) => {
    try {
      const userId = Number(req.query.userId)
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Укажите пользователя.' })
      }
      const result = await dbPool.query(
        `SELECT id, name, title, description, priority, tags,
                implementer_ids, approver_ids, viewer_ids,
                deadline_offset_days, deadline_time, updated_at
         FROM user_task_templates
         WHERE owner_user_id = $1
         ORDER BY updated_at DESC, id DESC`,
        [userId]
      )
      res.json(result.rows.map(mapRow))
    } catch (err) {
      console.error('listUserTaskTemplates:', err)
      res.status(500).json({ error: 'Не удалось загрузить шаблоны.' })
    }
  }
}

function createUserTaskTemplate(dbPool) {
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
        `INSERT INTO user_task_templates (
           owner_user_id, name, title, description, priority, tags,
           implementer_ids, approver_ids, viewer_ids,
           deadline_offset_days, deadline_time
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11
         )
         RETURNING id, name, title, description, priority, tags,
                   implementer_ids, approver_ids, viewer_ids,
                   deadline_offset_days, deadline_time, updated_at`,
        [
          userId,
          payload.name,
          payload.title,
          payload.description,
          payload.priority,
          payload.tags,
          JSON.stringify(payload.implementerIds),
          JSON.stringify(payload.approverIds),
          JSON.stringify(payload.viewerIds),
          payload.deadlineOffsetDays,
          payload.deadlineTime,
        ]
      )
      res.status(201).json(mapRow(result.rows[0]))
    } catch (err) {
      console.error('createUserTaskTemplate:', err)
      res.status(500).json({ error: 'Не удалось сохранить шаблон.' })
    }
  }
}

function updateUserTaskTemplate(dbPool) {
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
        `UPDATE user_task_templates
         SET name = $3,
             title = $4,
             description = $5,
             priority = $6,
             tags = $7,
             implementer_ids = $8::jsonb,
             approver_ids = $9::jsonb,
             viewer_ids = $10::jsonb,
             deadline_offset_days = $11,
             deadline_time = $12,
             updated_at = NOW()
         WHERE id = $1 AND owner_user_id = $2
         RETURNING id, name, title, description, priority, tags,
                   implementer_ids, approver_ids, viewer_ids,
                   deadline_offset_days, deadline_time, updated_at`,
        [
          id,
          userId,
          payload.name,
          payload.title,
          payload.description,
          payload.priority,
          payload.tags,
          JSON.stringify(payload.implementerIds),
          JSON.stringify(payload.approverIds),
          JSON.stringify(payload.viewerIds),
          payload.deadlineOffsetDays,
          payload.deadlineTime,
        ]
      )
      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Шаблон не найден.' })
      }
      res.json(mapRow(result.rows[0]))
    } catch (err) {
      console.error('updateUserTaskTemplate:', err)
      res.status(500).json({ error: 'Не удалось обновить шаблон.' })
    }
  }
}

function deleteUserTaskTemplate(dbPool) {
  return async (req, res) => {
    try {
      const id = Number(req.params.id)
      const userId = Number(req.query.userId)
      if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Некорректный шаблон.' })
      }
      const result = await dbPool.query(
        `DELETE FROM user_task_templates
         WHERE id = $1 AND owner_user_id = $2
         RETURNING id`,
        [id, userId]
      )
      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Шаблон не найден.' })
      }
      res.json({ ok: true })
    } catch (err) {
      console.error('deleteUserTaskTemplate:', err)
      res.status(500).json({ error: 'Не удалось удалить шаблон.' })
    }
  }
}

module.exports = {
  listUserTaskTemplates,
  createUserTaskTemplate,
  updateUserTaskTemplate,
  deleteUserTaskTemplate,
}
