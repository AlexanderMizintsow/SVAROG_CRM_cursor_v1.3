async function getTaskTemplates(dbPool, req, res) {
  try {
    const activeOnly = req.query.active !== 'false'
    const query = activeOnly
      ? "SELECT * FROM bp_task_templates WHERE is_active = true ORDER BY name"
      : "SELECT * FROM bp_task_templates ORDER BY name"
    const result = await dbPool.query(query)
    res.json(result.rows)
  } catch (err) {
    console.error('getTaskTemplates:', err)
    res.status(500).json({ error: 'Ошибка при получении шаблонов' })
  }
}

async function getTaskTemplateById(dbPool, req, res) {
  try {
    const { id } = req.params
    const result = await dbPool.query('SELECT * FROM bp_task_templates WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Шаблон не найден' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('getTaskTemplateById:', err)
    res.status(500).json({ error: 'Ошибка при получении шаблона' })
  }
}

async function createTaskTemplate(dbPool, req, res) {
  try {
    const { name, description, priority_default, tags_default, deadline_offset_days, created_by } = req.body
    if (!name) {
      return res.status(400).json({ error: 'Не указано name' })
    }
    const result = await dbPool.query(
      `INSERT INTO bp_task_templates (name, description, priority_default, tags_default, deadline_offset_days, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name,
        description || null,
        priority_default || 'низкий',
        tags_default ? JSON.stringify(tags_default) : '[]',
        deadline_offset_days != null ? deadline_offset_days : null,
        created_by || null,
      ]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('createTaskTemplate:', err)
    res.status(500).json({ error: 'Ошибка при создании шаблона' })
  }
}

async function updateTaskTemplate(dbPool, req, res) {
  try {
    const { id } = req.params
    const { name, description, priority_default, tags_default, deadline_offset_days, is_active } = req.body
    const result = await dbPool.query(
      `UPDATE bp_task_templates
       SET name = COALESCE($1, name), description = COALESCE($2, description),
           priority_default = COALESCE($3, priority_default),
           tags_default = COALESCE($4, tags_default),
           deadline_offset_days = $5,
           is_active = COALESCE($6, is_active),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        name ?? null,
        description !== undefined ? description : null,
        priority_default ?? null,
        tags_default !== undefined ? JSON.stringify(tags_default) : null,
        deadline_offset_days !== undefined ? deadline_offset_days : null,
        is_active !== undefined ? is_active : null,
        id,
      ]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Шаблон не найден' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('updateTaskTemplate:', err)
    res.status(500).json({ error: 'Ошибка при обновлении шаблона' })
  }
}

async function deleteTaskTemplate(dbPool, req, res) {
  try {
    const { id } = req.params
    const result = await dbPool.query(
      'UPDATE bp_task_templates SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Шаблон не найден' })
    }
    res.status(204).send()
  } catch (err) {
    console.error('deleteTaskTemplate:', err)
    res.status(500).json({ error: 'Ошибка при удалении шаблона' })
  }
}

module.exports = {
  getTaskTemplates,
  getTaskTemplateById,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
}
