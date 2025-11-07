// handleController.js
// Контроллер для работы с редактором ручек

// ==================== ТИПЫ СТВОРОК ====================

// Получение всех типов створок
const getLeafTypes = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(
      'SELECT * FROM leaf_types ORDER BY name'
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении типов створок:', err)
    res.status(500).json({ error: 'Ошибка при получении типов створок' })
  }
}

// Создание типа створки
const createLeafType = (dbPool) => async (req, res) => {
  const { name, description, user_id } = req.body
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    const result = await client.query(
      'INSERT INTO leaf_types (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    )
    
    // Добавляем значение в параметр "Тип створки" если он существует
    const paramResult = await client.query(
      'SELECT id FROM parameters WHERE name = $1',
      ['Тип створки']
    )
    if (paramResult.rows.length > 0) {
      await client.query(
        'INSERT INTO parameter_values (parameter_id, value, display_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [paramResult.rows[0].id, name, result.rows[0].id]
      )
    }
    
    // Логируем создание
    if (user_id) {
      await client.query(
        `INSERT INTO handle_history (entity_type, entity_id, action, new_data, changed_by) 
         VALUES ('leaf_type', $1, 'created', $2, $3)`,
        [result.rows[0].id, JSON.stringify(result.rows[0]), user_id]
      )
    }
    
    await client.query('COMMIT')
    res.status(201).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      res.status(409).json({ error: 'Тип створки с таким названием уже существует' })
    } else {
      console.error('Ошибка при создании типа створки:', err)
      res.status(500).json({ error: 'Ошибка при создании типа створки' })
    }
  } finally {
    client.release()
  }
}

// Обновление типа створки
const updateLeafType = (dbPool) => async (req, res) => {
  const { id } = req.params
  const { name, description, user_id } = req.body
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    // Получаем старое значение
    const oldResult = await client.query('SELECT * FROM leaf_types WHERE id = $1', [id])
    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Тип створки не найден' })
    }
    
    const result = await client.query(
      'UPDATE leaf_types SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description || null, id]
    )
    
    // Логируем изменение
    if (user_id) {
      await client.query(
        `INSERT INTO handle_history (entity_type, entity_id, action, old_data, new_data, changed_by) 
         VALUES ('leaf_type', $1, 'updated', $2, $3, $4)`,
        [id, JSON.stringify(oldResult.rows[0]), JSON.stringify(result.rows[0]), user_id]
      )
    }
    
    await client.query('COMMIT')
    res.json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при обновлении типа створки:', err)
    res.status(500).json({ error: 'Ошибка при обновлении типа створки' })
  } finally {
    client.release()
  }
}

// Удаление типа створки
const deleteLeafType = (dbPool) => async (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    const oldResult = await client.query('SELECT * FROM leaf_types WHERE id = $1', [id])
    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Тип створки не найден' })
    }
    
    // Логируем удаление
    if (user_id) {
      await client.query(
        `INSERT INTO handle_history (entity_type, entity_id, action, old_data, changed_by) 
         VALUES ('leaf_type', $1, 'deleted', $2, $3)`,
        [id, JSON.stringify(oldResult.rows[0]), user_id]
      )
    }
    
    await client.query('DELETE FROM leaf_types WHERE id = $1', [id])
    await client.query('COMMIT')
    res.json({ message: 'Тип створки успешно удален' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при удалении типа створки:', err)
    res.status(500).json({ error: 'Ошибка при удалении типа створки' })
  } finally {
    client.release()
  }
}

// ==================== ПАРАМЕТРЫ ====================

// Получение всех параметров
const getParameters = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(
      'SELECT * FROM parameters ORDER BY name'
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении параметров:', err)
    res.status(500).json({ error: 'Ошибка при получении параметров' })
  }
}

// Создание параметра
const createParameter = (dbPool) => async (req, res) => {
  const { name, description, is_multiple, user_id } = req.body
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    const result = await client.query(
      'INSERT INTO parameters (name, description, is_multiple) VALUES ($1, $2, $3) RETURNING *',
      [name, description || null, is_multiple || false]
    )
    
    // Логируем создание
    if (user_id) {
      await client.query(
        `INSERT INTO handle_history (entity_type, entity_id, action, new_data, changed_by) 
         VALUES ('parameter', $1, 'created', $2, $3)`,
        [result.rows[0].id, JSON.stringify(result.rows[0]), user_id]
      )
    }
    
    await client.query('COMMIT')
    res.status(201).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      res.status(409).json({ error: 'Параметр с таким названием уже существует' })
    } else {
      console.error('Ошибка при создании параметра:', err)
      res.status(500).json({ error: 'Ошибка при создании параметра' })
    }
  } finally {
    client.release()
  }
}

// Обновление параметра
const updateParameter = (dbPool) => async (req, res) => {
  const { id } = req.params
  const { name, description, is_multiple, user_id } = req.body
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    const oldResult = await client.query('SELECT * FROM parameters WHERE id = $1', [id])
    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Параметр не найден' })
    }
    
    const result = await client.query(
      'UPDATE parameters SET name = $1, description = $2, is_multiple = $3 WHERE id = $4 RETURNING *',
      [name, description || null, is_multiple || false, id]
    )
    
    // Логируем изменение
    if (user_id) {
      await client.query(
        `INSERT INTO handle_history (entity_type, entity_id, action, old_data, new_data, changed_by) 
         VALUES ('parameter', $1, 'updated', $2, $3, $4)`,
        [id, JSON.stringify(oldResult.rows[0]), JSON.stringify(result.rows[0]), user_id]
      )
    }
    
    await client.query('COMMIT')
    res.json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при обновлении параметра:', err)
    res.status(500).json({ error: 'Ошибка при обновлении параметра' })
  } finally {
    client.release()
  }
}

// Удаление параметра
const deleteParameter = (dbPool) => async (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    const oldResult = await client.query('SELECT * FROM parameters WHERE id = $1', [id])
    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Параметр не найден' })
    }
    
    // Логируем удаление
    if (user_id) {
      await client.query(
        `INSERT INTO handle_history (entity_type, entity_id, action, old_data, changed_by) 
         VALUES ('parameter', $1, 'deleted', $2, $3)`,
        [id, JSON.stringify(oldResult.rows[0]), user_id]
      )
    }
    
    await client.query('DELETE FROM parameters WHERE id = $1', [id])
    await client.query('COMMIT')
    res.json({ message: 'Параметр успешно удален' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при удалении параметра:', err)
    res.status(500).json({ error: 'Ошибка при удалении параметра' })
  } finally {
    client.release()
  }
}

// ==================== ЗНАЧЕНИЯ ПАРАМЕТРОВ ====================

// Получение значений параметра
const getParameterValues = (dbPool) => async (req, res) => {
  const { parameterId } = req.params
  try {
    const result = await dbPool.query(
      'SELECT * FROM parameter_values WHERE parameter_id = $1 ORDER BY display_order, value',
      [parameterId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении значений параметра:', err)
    res.status(500).json({ error: 'Ошибка при получении значений параметра' })
  }
}

// Создание значения параметра
const createParameterValue = (dbPool) => async (req, res) => {
  const { parameterId } = req.params
  const { value, display_order } = req.body
  try {
    const result = await dbPool.query(
      'INSERT INTO parameter_values (parameter_id, value, display_order) VALUES ($1, $2, $3) RETURNING *',
      [parameterId, value, display_order || 0]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Значение с таким названием уже существует для этого параметра' })
    } else {
      console.error('Ошибка при создании значения параметра:', err)
      res.status(500).json({ error: 'Ошибка при создании значения параметра' })
    }
  }
}

// Обновление значения параметра
const updateParameterValue = (dbPool) => async (req, res) => {
  const { id } = req.params
  const { value, display_order } = req.body
  try {
    const result = await dbPool.query(
      'UPDATE parameter_values SET value = $1, display_order = $2 WHERE id = $3 RETURNING *',
      [value, display_order || 0, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Значение параметра не найдено' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('Ошибка при обновлении значения параметра:', err)
    res.status(500).json({ error: 'Ошибка при обновлении значения параметра' })
  }
}

// Удаление значения параметра
const deleteParameterValue = (dbPool) => async (req, res) => {
  const { id } = req.params
  try {
    const result = await dbPool.query('DELETE FROM parameter_values WHERE id = $1', [id])
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Значение параметра не найдено' })
    }
    res.json({ message: 'Значение параметра успешно удалено' })
  } catch (err) {
    console.error('Ошибка при удалении значения параметра:', err)
    res.status(500).json({ error: 'Ошибка при удалении значения параметра' })
  }
}

// ==================== РУЧКИ ====================

// Получение всех ручек
const getHandles = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(
      'SELECT * FROM handles ORDER BY article'
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении ручек:', err)
    res.status(500).json({ error: 'Ошибка при получении ручек' })
  }
}

// Создание ручки
const createHandle = (dbPool) => async (req, res) => {
  const { article, name, description, user_id } = req.body
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    const result = await client.query(
      'INSERT INTO handles (article, name, description) VALUES ($1, $2, $3) RETURNING *',
      [article, name, description || null]
    )
    
    // Логируем создание
    if (user_id) {
      await client.query(
        `INSERT INTO handle_history (entity_type, entity_id, action, new_data, changed_by) 
         VALUES ('handle', $1, 'created', $2, $3)`,
        [result.rows[0].id, JSON.stringify(result.rows[0]), user_id]
      )
    }
    
    await client.query('COMMIT')
    res.status(201).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      res.status(409).json({ error: 'Ручка с таким артикулом уже существует' })
    } else {
      console.error('Ошибка при создании ручки:', err)
      res.status(500).json({ error: 'Ошибка при создании ручки' })
    }
  } finally {
    client.release()
  }
}

// Обновление ручки
const updateHandle = (dbPool) => async (req, res) => {
  const { id } = req.params
  const { article, name, description, user_id } = req.body
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    const oldResult = await client.query('SELECT * FROM handles WHERE id = $1', [id])
    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Ручка не найдена' })
    }
    
    const result = await client.query(
      'UPDATE handles SET article = $1, name = $2, description = $3 WHERE id = $4 RETURNING *',
      [article, name, description || null, id]
    )
    
    // Логируем изменение
    if (user_id) {
      await client.query(
        `INSERT INTO handle_history (entity_type, entity_id, action, old_data, new_data, changed_by) 
         VALUES ('handle', $1, 'updated', $2, $3, $4)`,
        [id, JSON.stringify(oldResult.rows[0]), JSON.stringify(result.rows[0]), user_id]
      )
    }
    
    await client.query('COMMIT')
    res.json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при обновлении ручки:', err)
    res.status(500).json({ error: 'Ошибка при обновлении ручки' })
  } finally {
    client.release()
  }
}

// Удаление ручки
const deleteHandle = (dbPool) => async (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    const oldResult = await client.query('SELECT * FROM handles WHERE id = $1', [id])
    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Ручка не найдена' })
    }
    
    // Логируем удаление
    if (user_id) {
      await client.query(
        `INSERT INTO handle_history (entity_type, entity_id, action, old_data, changed_by) 
         VALUES ('handle', $1, 'deleted', $2, $3)`,
        [id, JSON.stringify(oldResult.rows[0]), user_id]
      )
    }
    
    await client.query('DELETE FROM handles WHERE id = $1', [id])
    await client.query('COMMIT')
    res.json({ message: 'Ручка успешно удалена' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при удалении ручки:', err)
    res.status(500).json({ error: 'Ошибка при удалении ручки' })
  } finally {
    client.release()
  }
}

// ==================== ПРАВИЛА ВЫБОРА РУЧЕК ====================

// Получение всех правил
const getHandleRules = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT 
        hr.*,
        h.article as handle_article,
        h.name as handle_name,
        lt.name as leaf_type_name
      FROM handle_rules hr
      LEFT JOIN handles h ON hr.handle_id = h.id
      LEFT JOIN leaf_types lt ON hr.leaf_type_id = lt.id
      ORDER BY hr.created_at DESC
    `)
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении правил:', err)
    res.status(500).json({ error: 'Ошибка при получении правил' })
  }
}

// Получение правила с условиями
const getHandleRuleById = (dbPool) => async (req, res) => {
  const { id } = req.params
  try {
    // Получаем правило
    const ruleResult = await dbPool.query(`
      SELECT 
        hr.*,
        h.article as handle_article,
        h.name as handle_name,
        lt.name as leaf_type_name
      FROM handle_rules hr
      LEFT JOIN handles h ON hr.handle_id = h.id
      LEFT JOIN leaf_types lt ON hr.leaf_type_id = lt.id
      WHERE hr.id = $1
    `, [id])
    
    if (ruleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Правило не найдено' })
    }
    
    // Получаем условия правила
    const conditionsResult = await dbPool.query(`
      SELECT 
        hrc.*,
        p.name as parameter_name,
        pv.value as parameter_value
      FROM handle_rule_conditions hrc
      LEFT JOIN parameters p ON hrc.parameter_id = p.id
      LEFT JOIN parameter_values pv ON hrc.parameter_value_id = pv.id
      WHERE hrc.rule_id = $1
    `, [id])
    
    res.json({
      ...ruleResult.rows[0],
      conditions: conditionsResult.rows
    })
  } catch (err) {
    console.error('Ошибка при получении правила:', err)
    res.status(500).json({ error: 'Ошибка при получении правила' })
  }
}

// Создание правила (поддерживает множественный выбор ручек)
const createHandleRule = (dbPool) => async (req, res) => {
  const { handle_ids, leaf_type_id, quantity, conditions, user_id } = req.body
  
  // Поддержка старого формата (handle_id) для обратной совместимости
  const handleIdsArray = handle_ids && Array.isArray(handle_ids) 
    ? handle_ids 
    : (req.body.handle_id ? [req.body.handle_id] : [])
  
  if (!handleIdsArray.length || !leaf_type_id) {
    return res.status(400).json({ error: 'Необходимо указать ручки и тип створки' })
  }
  
  const client = await dbPool.connect()
  const createdRules = []
  
  try {
    await client.query('BEGIN')
    
    // Создаем правило для каждой ручки
    for (const handleId of handleIdsArray) {
      const ruleResult = await client.query(
        'INSERT INTO handle_rules (handle_id, leaf_type_id, quantity) VALUES ($1, $2, $3) RETURNING *',
        [handleId, leaf_type_id, quantity || 1]
      )
      const ruleId = ruleResult.rows[0].id
      
      // Добавляем условия
      if (conditions && Array.isArray(conditions)) {
        for (const condition of conditions) {
          await client.query(
            'INSERT INTO handle_rule_conditions (rule_id, parameter_id, parameter_value_id) VALUES ($1, $2, $3)',
            [ruleId, condition.parameter_id, condition.parameter_value_id || null]
          )
        }
      }
      
      // Логируем создание правила
      if (user_id) {
        await client.query(
          `INSERT INTO handle_history (entity_type, entity_id, action, new_data, changed_by) 
           VALUES ('rule', $1, 'created', $2, $3)`,
          [
            ruleId,
            JSON.stringify({
              handle_id: handleId,
              leaf_type_id: leaf_type_id,
              quantity: quantity || 1,
              conditions: conditions || []
            }),
            user_id
          ]
        )
      }
      
      createdRules.push(ruleId)
    }
    
    await client.query('COMMIT')
    
    // Получаем созданные правила с условиями
    const rulesData = []
    for (const ruleId of createdRules) {
      const fullRuleResult = await dbPool.query(`
        SELECT 
          hr.*,
          h.article as handle_article,
          h.name as handle_name,
          lt.name as leaf_type_name
        FROM handle_rules hr
        LEFT JOIN handles h ON hr.handle_id = h.id
        LEFT JOIN leaf_types lt ON hr.leaf_type_id = lt.id
        WHERE hr.id = $1
      `, [ruleId])
      
      const conditionsResult = await dbPool.query(`
        SELECT 
          hrc.*,
          p.name as parameter_name,
          pv.value as parameter_value
        FROM handle_rule_conditions hrc
        LEFT JOIN parameters p ON hrc.parameter_id = p.id
        LEFT JOIN parameter_values pv ON hrc.parameter_value_id = pv.id
        WHERE hrc.rule_id = $1
      `, [ruleId])
      
      rulesData.push({
        ...fullRuleResult.rows[0],
        conditions: conditionsResult.rows
      })
    }
    
    res.status(201).json({
      rules: rulesData,
      message: `Создано правил: ${createdRules.length}`
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при создании правила:', err)
    res.status(500).json({ error: 'Ошибка при создании правила' })
  } finally {
    client.release()
  }
}

// Обновление правила
const updateHandleRule = (dbPool) => async (req, res) => {
  const { id } = req.params
  const { handle_id, leaf_type_id, quantity, conditions, user_id } = req.body
  
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    // Получаем старое правило для истории
    const oldRuleResult = await client.query('SELECT * FROM handle_rules WHERE id = $1', [id])
    if (oldRuleResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Правило не найдено' })
    }
    const oldRule = oldRuleResult.rows[0]
    
    // Получаем старые условия
    const oldConditionsResult = await client.query(
      'SELECT * FROM handle_rule_conditions WHERE rule_id = $1',
      [id]
    )
    
    // Обновляем правило
    const ruleResult = await client.query(
      'UPDATE handle_rules SET handle_id = $1, leaf_type_id = $2, quantity = $3 WHERE id = $4 RETURNING *',
      [handle_id, leaf_type_id, quantity || 1, id]
    )
    
    // Удаляем старые условия
    await client.query('DELETE FROM handle_rule_conditions WHERE rule_id = $1', [id])
    
    // Добавляем новые условия
    if (conditions && Array.isArray(conditions)) {
      for (const condition of conditions) {
        await client.query(
          'INSERT INTO handle_rule_conditions (rule_id, parameter_id, parameter_value_id) VALUES ($1, $2, $3)',
          [id, condition.parameter_id, condition.parameter_value_id || null]
        )
      }
    }
    
    // Логируем обновление
    if (user_id) {
      await client.query(
        `INSERT INTO handle_history (entity_type, entity_id, action, old_data, new_data, changed_by) 
         VALUES ('rule', $1, 'updated', $2, $3, $4)`,
        [
          id,
          JSON.stringify({
            ...oldRule,
            conditions: oldConditionsResult.rows
          }),
          JSON.stringify({
            handle_id: handle_id,
            leaf_type_id: leaf_type_id,
            quantity: quantity || 1,
            conditions: conditions || []
          }),
          user_id
        ]
      )
    }
    
    await client.query('COMMIT')
    
    // Получаем обновленное правило с условиями
    const fullRuleResult = await dbPool.query(`
      SELECT 
        hr.*,
        h.article as handle_article,
        h.name as handle_name,
        lt.name as leaf_type_name
      FROM handle_rules hr
      LEFT JOIN handles h ON hr.handle_id = h.id
      LEFT JOIN leaf_types lt ON hr.leaf_type_id = lt.id
      WHERE hr.id = $1
    `, [id])
    
    const conditionsResult = await dbPool.query(`
      SELECT 
        hrc.*,
        p.name as parameter_name,
        pv.value as parameter_value
      FROM handle_rule_conditions hrc
      LEFT JOIN parameters p ON hrc.parameter_id = p.id
      LEFT JOIN parameter_values pv ON hrc.parameter_value_id = pv.id
      WHERE hrc.rule_id = $1
    `, [id])
    
    res.json({
      ...fullRuleResult.rows[0],
      conditions: conditionsResult.rows
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при обновлении правила:', err)
    res.status(500).json({ error: 'Ошибка при обновлении правила' })
  } finally {
    client.release()
  }
}

// Удаление правила
const deleteHandleRule = (dbPool) => async (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    // Получаем правило для истории
    const oldRuleResult = await client.query('SELECT * FROM handle_rules WHERE id = $1', [id])
    if (oldRuleResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Правило не найдено' })
    }
    const oldRule = oldRuleResult.rows[0]
    
    const oldConditionsResult = await client.query(
      'SELECT * FROM handle_rule_conditions WHERE rule_id = $1',
      [id]
    )
    
    // Логируем удаление
    if (user_id) {
      await client.query(
        `INSERT INTO handle_history (entity_type, entity_id, action, old_data, changed_by) 
         VALUES ('rule', $1, 'deleted', $2, $3)`,
        [
          id,
          JSON.stringify({
            ...oldRule,
            conditions: oldConditionsResult.rows
          }),
          user_id
        ]
      )
    }
    
    // Удаляем правило (условия удалятся каскадно)
    await client.query('DELETE FROM handle_rules WHERE id = $1', [id])
    
    await client.query('COMMIT')
    res.json({ message: 'Правило успешно удалено' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при удалении правила:', err)
    res.status(500).json({ error: 'Ошибка при удалении правила' })
  } finally {
    client.release()
  }
}

// ==================== ПОДБОР РУЧЕК ПО ПАРАМЕТРАМ ====================

// Подбор ручек по параметрам (логика ИЛИ для значений параметров)
const findHandlesByParameters = (dbPool) => async (req, res) => {
  const { leaf_type_id, parameters } = req.body // parameters: { parameter_id: [value_id1, value_id2, ...] }
  
  try {
    // Получаем все правила для данного типа створки
    let query = `
      SELECT DISTINCT hr.id, hr.handle_id, hr.quantity,
        h.article, h.name, h.description
      FROM handle_rules hr
      INNER JOIN handles h ON hr.handle_id = h.id
      WHERE hr.leaf_type_id = $1
    `
    const queryParams = [leaf_type_id]
    
    // Фильтруем правила по условиям
    // Для каждого параметра проверяем, что есть условие, которое соответствует выбранным значениям
    // ЛОГИКА: 
    // - Если параметр выбран с конкретными значениями - проверяем совпадение значений или NULL
    // - Если параметр НЕ выбран (отсутствует в запросе или пустой массив) - НЕ проверяем его вообще
    // - Если в правиле есть условие для параметра с конкретным значением, но параметр не выбран - правило НЕ подходит
    
    // Фильтруем параметры: оставляем только те, у которых есть выбранные значения
    const filteredParameters = {}
    if (parameters && Object.keys(parameters).length > 0) {
      for (const [paramId, valueIds] of Object.entries(parameters)) {
        if (valueIds && Array.isArray(valueIds) && valueIds.length > 0) {
          filteredParameters[paramId] = valueIds
        }
      }
    }
    
    if (Object.keys(filteredParameters).length > 0) {
      const paramConditions = []
      let paramIndex = 2
      const selectedParamIds = [] // Только параметры, для которых выбраны значения
      
      for (const [paramId, valueIds] of Object.entries(filteredParameters)) {
        selectedParamIds.push(parseInt(paramId))
        
        // Условие: параметр должен иметь хотя бы одно из выбранных значений ИЛИ NULL (любое значение)
        // Это означает: (param_value_id IN (valueIds) OR param_value_id IS NULL)
        paramConditions.push(`
          EXISTS (
            SELECT 1 FROM handle_rule_conditions hrc
            WHERE hrc.rule_id = hr.id
            AND hrc.parameter_id = $${paramIndex}
            AND (hrc.parameter_value_id = ANY($${paramIndex + 1}) OR hrc.parameter_value_id IS NULL)
          )
        `)
        queryParams.push(parseInt(paramId))
        queryParams.push(valueIds)
        paramIndex += 2
      }
      
      if (paramConditions.length > 0) {
        query += ' AND ' + paramConditions.join(' AND ')
      }
      
      // ВАЖНО: Проверяем, что в правиле нет условий для параметров, которые НЕ были выбраны пользователем
      // Если в правиле есть условие с конкретным значением для параметра, который не выбран - правило не подходит
      // Это гарантирует, что если в правиле указано "Цвет петель = Красный", но пользователь не выбрал "Цвет петель",
      // то правило не будет найдено
      
      // Получаем все параметры, которые есть в базе
      const allParamsResult = await dbPool.query('SELECT id FROM parameters WHERE name != $1', ['Тип створки'])
      const allParamIds = allParamsResult.rows.map(row => row.id)
      
      // Находим параметры, которые НЕ выбраны пользователем
      const unselectedParamIds = allParamIds.filter(pid => !selectedParamIds.includes(pid))
      
      if (unselectedParamIds.length > 0) {
        // Проверяем, что в правиле НЕТ условий с конкретными значениями для невыбранных параметров
        // (NULL значения разрешены, так как они означают "любое значение")
        query += `
          AND NOT EXISTS (
            SELECT 1 FROM handle_rule_conditions hrc3
            WHERE hrc3.rule_id = hr.id
            AND hrc3.parameter_id = ANY($${paramIndex})
            AND hrc3.parameter_value_id IS NOT NULL
          )
        `
        queryParams.push(unselectedParamIds)
        paramIndex += 1
      }
    } else {
      // Если ничего не выбрано, находим только правила, у которых все условия NULL (любое значение)
      // или вообще нет условий
      query += `
        AND (
          SELECT COUNT(*) FROM handle_rule_conditions hrc4
          WHERE hrc4.rule_id = hr.id
          AND hrc4.parameter_value_id IS NOT NULL
        ) = 0
      `
    }
    
    const result = await dbPool.query(query, queryParams)
    
    // Группируем результаты по handle_id, чтобы каждая ручка отображалась только один раз
    const handlesMap = new Map()
    
    for (const row of result.rows) {
      if (!handlesMap.has(row.handle_id)) {
        handlesMap.set(row.handle_id, {
          handle_id: row.handle_id,
          article: row.article,
          name: row.name,
          description: row.description,
          quantity: row.quantity,
          rule_ids: []
        })
      }
      handlesMap.get(row.handle_id).rule_ids.push(row.id)
    }
    
    // Преобразуем Map в массив
    const uniqueHandles = Array.from(handlesMap.values())
    
    // Проверяем на совпадения условий между разными ручками
    const warnings = []
    if (uniqueHandles.length > 1) {
      // Проверяем совпадение условий между правилами разных ручек
      for (let i = 0; i < uniqueHandles.length; i++) {
        for (let j = i + 1; j < uniqueHandles.length; j++) {
          const handle1 = uniqueHandles[i]
          const handle2 = uniqueHandles[j]
          
          // Получаем все условия для всех правил каждой ручки
          const conditions1Set = new Set()
          const conditions2Set = new Set()
          
          for (const ruleId of handle1.rule_ids) {
            const conditions1 = await dbPool.query(
              'SELECT parameter_id, parameter_value_id FROM handle_rule_conditions WHERE rule_id = $1',
              [ruleId]
            )
            conditions1.rows.forEach(c => {
              conditions1Set.add(`${c.parameter_id}:${c.parameter_value_id || 'NULL'}`)
            })
          }
          
          for (const ruleId of handle2.rule_ids) {
            const conditions2 = await dbPool.query(
              'SELECT parameter_id, parameter_value_id FROM handle_rule_conditions WHERE rule_id = $1',
              [ruleId]
            )
            conditions2.rows.forEach(c => {
              conditions2Set.add(`${c.parameter_id}:${c.parameter_value_id || 'NULL'}`)
            })
          }
          
          // Проверяем полное совпадение условий
          if (conditions1Set.size === conditions2Set.size && 
              Array.from(conditions1Set).every(c => conditions2Set.has(c))) {
            warnings.push({
              message: `Полное совпадение условий для ручек "${handle1.article}" и "${handle2.article}"`,
              handle1: handle1.article,
              handle2: handle2.article
            })
          }
        }
      }
    }
    
    res.json({
      handles: uniqueHandles,
      warnings: warnings
    })
  } catch (err) {
    console.error('Ошибка при подборе ручек:', err)
    res.status(500).json({ error: 'Ошибка при подборе ручек' })
  }
}

// ==================== ЭКСПОРТ/ИМПОРТ ====================

// Экспорт всех правил в формат для Excel
const exportRules = (dbPool) => async (req, res) => {
  try {
    // Получаем все параметры (исключая "Тип створки", так как он уже в отдельной колонке)
    const parametersResult = await dbPool.query(
      "SELECT * FROM parameters WHERE name != 'Тип створки' ORDER BY name"
    )
    const parameters = parametersResult.rows
    
    // Получаем все правила с условиями
    const rulesResult = await dbPool.query(`
      SELECT 
        hr.id,
        h.article,
        h.name as handle_name,
        lt.name as leaf_type_name,
        hr.quantity
      FROM handle_rules hr
      INNER JOIN handles h ON hr.handle_id = h.id
      INNER JOIN leaf_types lt ON hr.leaf_type_id = lt.id
      ORDER BY h.article, lt.name
    `)
    
    // Получаем условия для каждого правила
    const rules = []
    for (const rule of rulesResult.rows) {
      const conditionsResult = await dbPool.query(`
        SELECT 
          p.id as parameter_id,
          p.name as parameter_name,
          pv.id as value_id,
          pv.value as parameter_value
        FROM handle_rule_conditions hrc
        INNER JOIN parameters p ON hrc.parameter_id = p.id
        LEFT JOIN parameter_values pv ON hrc.parameter_value_id = pv.id
        WHERE hrc.rule_id = $1
      `, [rule.id])
      
      rules.push({
        ...rule,
        conditions: conditionsResult.rows
      })
    }
    
    // Группируем правила по комбинации (handle_id, leaf_type_id, quantity)
    // чтобы объединить значения параметров для одной ручки
    const groupedRules = new Map()
    
    for (const rule of rules) {
      const key = `${rule.article}_${rule.leaf_type_name}_${rule.quantity}`
      
      if (!groupedRules.has(key)) {
        groupedRules.set(key, {
          article: rule.article,
          handle_name: rule.handle_name,
          leaf_type_name: rule.leaf_type_name,
          quantity: rule.quantity,
          conditions: {} // { parameter_id: Set of values }
        })
      }
      
      // Объединяем условия для всех правил этой ручки
      rule.conditions.forEach(condition => {
        const paramId = condition.parameter_id
        if (!groupedRules.get(key).conditions[paramId]) {
          groupedRules.get(key).conditions[paramId] = new Set()
        }
        const value = condition.parameter_value || 'Любое значение'
        groupedRules.get(key).conditions[paramId].add(value)
      })
    }
    
    // Формируем данные для Excel
    const excelData = []
    
    // Заголовки
    const headers = ['Артикул ручки', 'Наименование ручки', 'Тип створки', 'Количество']
    parameters.forEach(param => {
      headers.push(param.name)
    })
    excelData.push(headers)
    
    // Данные - теперь одна строка на ручку с объединенными значениями параметров
    groupedRules.forEach((groupedRule, key) => {
      const row = [
        groupedRule.article,
        groupedRule.handle_name,
        groupedRule.leaf_type_name,
        groupedRule.quantity
      ]
      
      // Для каждого параметра добавляем все значения через запятую (ИЛИ)
      parameters.forEach(param => {
        const paramValues = groupedRule.conditions[param.id]
        if (paramValues && paramValues.size > 0) {
          // Сортируем значения для консистентности
          const sortedValues = Array.from(paramValues).sort()
          row.push(sortedValues.join(', '))
        } else {
          row.push('')
        }
      })
      
      excelData.push(row)
    })
    
    res.json({ data: excelData })
  } catch (err) {
    console.error('Ошибка при экспорте правил:', err)
    res.status(500).json({ error: 'Ошибка при экспорте правил' })
  }
}

// Импорт правил из Excel
const importRules = (dbPool) => async (req, res) => {
  const { data } = req.body // Массив массивов строк из Excel
  
  if (!data || !Array.isArray(data) || data.length < 2) {
    return res.status(400).json({ error: 'Неверный формат данных' })
  }
  
  const headers = data[0]
  const rows = data.slice(1)
  
  // Находим индексы колонок
  const articleIndex = headers.indexOf('Артикул ручки')
  const nameIndex = headers.indexOf('Наименование ручки')
  const leafTypeIndex = headers.indexOf('Тип створки')
  const quantityIndex = headers.indexOf('Количество')
  
  if (articleIndex === -1 || nameIndex === -1 || leafTypeIndex === -1) {
    return res.status(400).json({ error: 'Отсутствуют обязательные колонки' })
  }
  
  const client = await dbPool.connect()
  const results = { created: 0, updated: 0, errors: [] }
  
  try {
    await client.query('BEGIN')
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const article = row[articleIndex]
        const handleName = row[nameIndex]
        const leafTypeName = row[leafTypeIndex]
        const quantity = row[quantityIndex] ? parseInt(row[quantityIndex]) : 1
        
        if (!article || !handleName || !leafTypeName) {
          results.errors.push(`Строка ${i + 2}: отсутствуют обязательные данные`)
          continue
        }
        
        // Получаем или создаем ручку
        let handleResult = await client.query('SELECT id FROM handles WHERE article = $1', [article])
        let handleId
        if (handleResult.rows.length === 0) {
          const newHandle = await client.query(
            'INSERT INTO handles (article, name) VALUES ($1, $2) RETURNING id',
            [article, handleName]
          )
          handleId = newHandle.rows[0].id
        } else {
          handleId = handleResult.rows[0].id
          // Обновляем название если изменилось
          await client.query('UPDATE handles SET name = $1 WHERE id = $2', [handleName, handleId])
        }
        
        // Разделяем типы створок по запятой (логика ИЛИ)
        const leafTypeNames = leafTypeName.split(',').map(name => name.trim()).filter(name => name)
        
        // Получаем параметры из заголовков (кроме стандартных колонок)
        const parameterColumns = []
        for (let j = 4; j < headers.length; j++) {
          if (headers[j]) {
            let paramResult = await client.query('SELECT id FROM parameters WHERE name = $1', [headers[j]])
            if (paramResult.rows.length === 0) {
              const newParam = await client.query(
                'INSERT INTO parameters (name) VALUES ($1) RETURNING id',
                [headers[j]]
              )
              paramResult.rows.push(newParam.rows[0])
            }
            parameterColumns.push({
              parameterId: paramResult.rows[0].id,
              columnIndex: j,
              parameterName: headers[j]
            })
          }
        }
        
        // Обрабатываем каждый тип створки (если указано несколько через запятую)
        for (const currentLeafTypeName of leafTypeNames) {
          // Получаем или создаем тип створки
          let leafTypeResult = await client.query('SELECT id FROM leaf_types WHERE name = $1', [currentLeafTypeName])
          if (leafTypeResult.rows.length === 0) {
            const newLeafType = await client.query(
              'INSERT INTO leaf_types (name) VALUES ($1) RETURNING id',
              [currentLeafTypeName]
            )
            leafTypeResult.rows.push(newLeafType.rows[0])
          }
          const leafTypeId = leafTypeResult.rows[0].id
          
          // Собираем условия из текущей строки для сравнения
          const currentConditions = new Map() // { parameter_id: Set of values }
          for (const paramCol of parameterColumns) {
            const valueStr = row[paramCol.columnIndex]
            if (valueStr) {
              const values = valueStr.split(',').map(v => v.trim()).filter(v => v)
              if (values.length > 0) {
                currentConditions.set(paramCol.parameterId, new Set(values))
              } else {
                currentConditions.set(paramCol.parameterId, new Set([null])) // NULL = любое значение
              }
            } else {
              currentConditions.set(paramCol.parameterId, new Set([null])) // NULL = любое значение
            }
          }
          
          // Проверяем существование правил для этой комбинации
          let ruleResult = await client.query(
            'SELECT id FROM handle_rules WHERE handle_id = $1 AND leaf_type_id = $2',
            [handleId, leafTypeId]
          )
          
          let ruleId = null
          
          // Если есть существующие правила, проверяем их условия
          if (ruleResult.rows.length > 0) {
            let foundMatchingRule = false
            
            for (const existingRule of ruleResult.rows) {
              // Получаем условия существующего правила
              const existingConditionsResult = await client.query(
                `SELECT 
                  hrc.parameter_id,
                  pv.value as parameter_value
                FROM handle_rule_conditions hrc
                LEFT JOIN parameter_values pv ON hrc.parameter_value_id = pv.id
                WHERE hrc.rule_id = $1`,
                [existingRule.id]
              )
              
              // Группируем условия существующего правила
              const existingConditions = new Map()
              existingConditionsResult.rows.forEach(cond => {
                const paramId = cond.parameter_id
                const value = cond.parameter_value || null
                if (!existingConditions.has(paramId)) {
                  existingConditions.set(paramId, new Set())
                }
                existingConditions.get(paramId).add(value)
              })
              
              // Сравниваем условия: если полностью совпадают - обновляем это правило
              let conditionsMatch = true
              if (currentConditions.size !== existingConditions.size) {
                conditionsMatch = false
              } else {
                for (const [paramId, currentValues] of currentConditions.entries()) {
                  if (!existingConditions.has(paramId)) {
                    conditionsMatch = false
                    break
                  }
                  const existingValues = existingConditions.get(paramId)
                  if (currentValues.size !== existingValues.size) {
                    conditionsMatch = false
                    break
                  }
                  for (const val of currentValues) {
                    if (!existingValues.has(val)) {
                      conditionsMatch = false
                      break
                    }
                  }
                  if (!conditionsMatch) break
                }
              }
              
              if (conditionsMatch) {
                // Нашли правило с такими же условиями - обновляем его
                ruleId = existingRule.id
                await client.query(
                  'UPDATE handle_rules SET quantity = $1 WHERE id = $2',
                  [quantity, ruleId]
                )
                // Удаляем старые условия для перезаписи
                await client.query('DELETE FROM handle_rule_conditions WHERE rule_id = $1', [ruleId])
                foundMatchingRule = true
                results.updated++
                break
              }
            }
            
            // Если не нашли правило с такими же условиями - создаем новое
            if (!foundMatchingRule) {
              const newRule = await client.query(
                'INSERT INTO handle_rules (handle_id, leaf_type_id, quantity) VALUES ($1, $2, $3) RETURNING id',
                [handleId, leafTypeId, quantity]
              )
              ruleId = newRule.rows[0].id
              results.created++
            }
          } else {
            // Правил нет - создаем новое
            const newRule = await client.query(
              'INSERT INTO handle_rules (handle_id, leaf_type_id, quantity) VALUES ($1, $2, $3) RETURNING id',
              [handleId, leafTypeId, quantity]
            )
            ruleId = newRule.rows[0].id
            results.created++
          }
          
          // Добавляем условия
          for (const paramCol of parameterColumns) {
            const valueStr = row[paramCol.columnIndex]
            if (valueStr) {
              // Значения могут быть через запятую (множественный выбор)
              const values = valueStr.split(',').map(v => v.trim()).filter(v => v)
              
              for (const value of values) {
                // Получаем или создаем значение параметра
                let valueResult = await client.query(
                  'SELECT id FROM parameter_values WHERE parameter_id = $1 AND value = $2',
                  [paramCol.parameterId, value]
                )
                let valueId
                if (valueResult.rows.length === 0) {
                  const newValue = await client.query(
                    'INSERT INTO parameter_values (parameter_id, value) VALUES ($1, $2) RETURNING id',
                    [paramCol.parameterId, value]
                  )
                  valueId = newValue.rows[0].id
                } else {
                  valueId = valueResult.rows[0].id
                }
                
                // Добавляем условие
                await client.query(
                  'INSERT INTO handle_rule_conditions (rule_id, parameter_id, parameter_value_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                  [ruleId, paramCol.parameterId, valueId]
                )
              }
            } else {
              // Если значение пустое, добавляем условие с NULL (любое значение)
              await client.query(
                'INSERT INTO handle_rule_conditions (rule_id, parameter_id, parameter_value_id) VALUES ($1, $2, NULL) ON CONFLICT DO NOTHING',
                [ruleId, paramCol.parameterId]
              )
            }
          }
        }
      } catch (err) {
        results.errors.push(`Строка ${i + 2}: ${err.message}`)
      }
    }
    
    await client.query('COMMIT')
    res.json(results)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при импорте правил:', err)
    res.status(500).json({ error: 'Ошибка при импорте правил', details: err.message })
  } finally {
    client.release()
  }
}

// ==================== ПОЛУЧЕНИЕ ПОЛНЫХ ДАННЫХ ДЛЯ РЕДАКТОРА ====================

// Получение истории изменений
const getHandleHistory = (dbPool) => async (req, res) => {
  const { entity_type, entity_id } = req.query
  
  try {
    let query = `
      SELECT 
        hh.*,
        u.first_name,
        u.last_name,
        u.middle_name,
        u.username
      FROM handle_history hh
      LEFT JOIN users u ON hh.changed_by = u.id
      WHERE 1=1
    `
    const queryParams = []
    
    if (entity_type) {
      query += ` AND hh.entity_type = $${queryParams.length + 1}`
      queryParams.push(entity_type)
    }
    
    if (entity_id) {
      query += ` AND hh.entity_id = $${queryParams.length + 1}`
      queryParams.push(parseInt(entity_id))
    }
    
    query += ' ORDER BY hh.created_at DESC'
    
    const result = await dbPool.query(query, queryParams)
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении истории:', err)
    res.status(500).json({ error: 'Ошибка при получении истории' })
  }
}

// ==================== ПОДТВЕРЖДЕНИЕ ЭТАЛОННОСТИ ====================

// Получение статуса эталонности
const getApprovalStatus = (dbPool) => async (req, res) => {
  try {
    // Получаем текущую дату
    const today = new Date().toISOString().split('T')[0]
    
    // Получаем пользователей, которые могут подтверждать эталонность
    const usersResult = await dbPool.query(`
      SELECT DISTINCT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.middle_name, 
        u.role_id, 
        r.name as role_name
      FROM handle_approval_users hau
      INNER JOIN users u ON hau.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.last_name, u.first_name
    `)
    
    // Получаем подтверждения на текущую дату
    const approvalsResult = await dbPool.query(`
      SELECT 
        ha.*,
        u.first_name,
        u.last_name,
        u.middle_name
      FROM handle_approvals ha
      LEFT JOIN users u ON ha.approved_by = u.id
      WHERE ha.snapshot_date = $1 AND ha.is_current = TRUE
    `, [today])
    
    // Проверяем, были ли изменения после последнего подтверждения
    // Берем самую позднюю дату подтверждения
    let lastApprovalDate = null
    if (approvalsResult.rows.length > 0) {
      const dates = approvalsResult.rows.map(a => new Date(a.approved_at)).filter(d => !isNaN(d))
      if (dates.length > 0) {
        lastApprovalDate = new Date(Math.max(...dates))
      }
    }
    
    let hasChanges = false
    if (lastApprovalDate) {
      // Исключаем запись о восстановлении эталонного снапшота из проверки изменений
      // Проверяем через JSONB оператор для корректной работы
      const changesResult = await dbPool.query(`
        SELECT COUNT(*) as count
        FROM handle_history
        WHERE created_at > $1
        AND NOT (
          entity_type = 'system' 
          AND action = 'restored' 
          AND (new_data->>'was_approved')::boolean = true
        )
      `, [lastApprovalDate])
      hasChanges = parseInt(changesResult.rows[0].count) > 0
    } else if (approvalsResult.rows.length === 0) {
      // Если нет подтверждений, но есть история изменений (кроме восстановления эталонного снапшота)
      const changesResult = await dbPool.query(`
        SELECT COUNT(*) as count
        FROM handle_history
        WHERE NOT (
          entity_type = 'system' 
          AND action = 'restored' 
          AND (new_data->>'was_approved')::boolean = true
        )
      `)
      hasChanges = parseInt(changesResult.rows[0].count) > 0
    }
    
    // Проверяем, все ли подтвердили
    const allApproved = usersResult.rows.length > 0 && 
      usersResult.rows.every(user => 
        approvalsResult.rows.some(approval => approval.approved_by === user.id)
      )
    
    res.json({
      isApproved: allApproved && !hasChanges,
      hasChanges: hasChanges,
      requiredUsers: usersResult.rows,
      approvals: approvalsResult.rows,
      lastApprovalDate: lastApprovalDate,
      snapshotDate: today
    })
  } catch (err) {
    console.error('Ошибка при получении статуса эталонности:', err)
    res.status(500).json({ error: 'Ошибка при получении статуса эталонности' })
  }
}

// Подтверждение эталонности
const approveHandleData = (dbPool) => async (req, res) => {
  const { user_id } = req.body
  
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Проверяем, имеет ли пользователь право подтверждать (прямо в таблице handle_approval_users)
    const approvalUserResult = await dbPool.query(`
      SELECT * FROM handle_approval_users WHERE user_id = $1
    `, [user_id])
    
    if (approvalUserResult.rows.length === 0) {
      return res.status(403).json({ error: 'У вас нет прав на подтверждение эталонности' })
    }
    
    // Проверяем, не подтвердил ли уже на эту дату (независимо от is_current)
    const existingApproval = await dbPool.query(`
      SELECT * FROM handle_approvals 
      WHERE approved_by = $1 AND snapshot_date = $2
    `, [user_id, today])
    
    if (existingApproval.rows.length > 0) {
      // Если запись существует, но is_current = FALSE, значит это повторное подтверждение после изменений
      const approval = existingApproval.rows[0]
      if (approval.is_current) {
        return res.status(400).json({ error: 'Вы уже подтвердили эталонность на эту дату' })
      } else {
        // Обновляем существующую запись, устанавливая is_current = TRUE
        await dbPool.query(`
          UPDATE handle_approvals 
          SET is_current = TRUE, approved_at = NOW()
          WHERE approved_by = $1 AND snapshot_date = $2
        `, [user_id, today])
      }
    } else {
      // Создаем новое подтверждение
      await dbPool.query(`
        INSERT INTO handle_approvals (approved_by, snapshot_date, is_current)
        VALUES ($1, $2, TRUE)
      `, [user_id, today])
    }
    
    // Сбрасываем флаг is_current для старых подтверждений этого пользователя на другие даты
    await dbPool.query(`
      UPDATE handle_approvals 
      SET is_current = FALSE 
      WHERE approved_by = $1 AND snapshot_date != $2 AND is_current = TRUE
    `, [user_id, today])
    
    res.json({ message: 'Эталонность подтверждена' })
  } catch (err) {
    console.error('Ошибка при подтверждении эталонности:', err)
    res.status(500).json({ error: 'Ошибка при подтверждении эталонности' })
  }
}

// Управление пользователями для подтверждения (только для администратора)
const getApprovalUsers = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT 
        hau.id,
        hau.user_id,
        hau.created_at,
        hau.created_by,
        u.first_name,
        u.last_name,
        u.middle_name,
        u.username,
        r.name as role_name
      FROM handle_approval_users hau
      INNER JOIN users u ON hau.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.last_name, u.first_name
    `)
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении пользователей для подтверждения:', err)
    res.status(500).json({ error: 'Ошибка при получении пользователей' })
  }
}

const addApprovalUser = (dbPool) => async (req, res) => {
  const { user_id, created_by } = req.body
  
  try {
    const result = await dbPool.query(`
      INSERT INTO handle_approval_users (user_id, created_by)
      VALUES ($1, $2)
      RETURNING *
    `, [user_id, created_by || null])
    res.status(201).json(result.rows[0])
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Этот пользователь уже добавлен' })
    } else {
      console.error('Ошибка при добавлении пользователя:', err)
      res.status(500).json({ error: 'Ошибка при добавлении пользователя' })
    }
  }
}

const removeApprovalUser = (dbPool) => async (req, res) => {
  const { id } = req.params
  
  try {
    await dbPool.query('DELETE FROM handle_approval_users WHERE id = $1', [id])
    res.json({ message: 'Пользователь удален' })
  } catch (err) {
    console.error('Ошибка при удалении пользователя:', err)
    res.status(500).json({ error: 'Ошибка при удалении пользователя' })
  }
}

// Получение всех пользователей для выбора (для администратора)
const getAllUsers = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.middle_name,
        u.username,
        r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.last_name, u.first_name
    `)
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении пользователей:', err)
    res.status(500).json({ error: 'Ошибка при получении пользователей' })
  }
}

// ==================== СНАПШОТЫ И ОТКАТ ====================

// Создание снапшота
const createSnapshot = (dbPool) => async (req, res) => {
  const { description, user_id } = req.body
  
  try {
    // Проверяем, был ли эталон подтвержден на момент создания
    const today = new Date().toISOString().split('T')[0]
    const approvalStatusResult = await dbPool.query(`
      SELECT 
        COUNT(DISTINCT hau.user_id) as required_count,
        COUNT(DISTINCT ha.approved_by) as approved_count
      FROM handle_approval_users hau
      LEFT JOIN handle_approvals ha ON hau.user_id = ha.approved_by 
        AND ha.snapshot_date = $1 
        AND ha.is_current = TRUE
      GROUP BY ha.snapshot_date
    `, [today])
    
    let isApproved = false
    if (approvalStatusResult.rows.length > 0) {
      const requiredCount = parseInt(approvalStatusResult.rows[0].required_count) || 0
      const approvedCount = parseInt(approvalStatusResult.rows[0].approved_count) || 0
      isApproved = requiredCount > 0 && requiredCount === approvedCount
      
      // Проверяем, были ли изменения после последнего подтверждения
      if (isApproved) {
        const lastApproval = await dbPool.query(`
          SELECT MAX(approved_at) as last_approval
          FROM handle_approvals
          WHERE snapshot_date = $1 AND is_current = TRUE
        `, [today])
        
        if (lastApproval.rows[0]?.last_approval) {
          const changesResult = await dbPool.query(`
            SELECT COUNT(*) as count
            FROM handle_history
            WHERE created_at > $1
          `, [lastApproval.rows[0].last_approval])
          if (parseInt(changesResult.rows[0].count) > 0) {
            isApproved = false
          }
        }
      }
    }
    
    // Получаем все данные
    const leafTypes = await dbPool.query('SELECT * FROM leaf_types ORDER BY id')
    const parameters = await dbPool.query('SELECT * FROM parameters ORDER BY id')
    const parameterValues = await dbPool.query('SELECT * FROM parameter_values ORDER BY id')
    const handles = await dbPool.query('SELECT * FROM handles ORDER BY id')
    const handleRules = await dbPool.query('SELECT * FROM handle_rules ORDER BY id')
    const handleRuleConditions = await dbPool.query('SELECT * FROM handle_rule_conditions ORDER BY id')
    
    const snapshot = {
      leaf_types: leafTypes.rows,
      parameters: parameters.rows,
      parameter_values: parameterValues.rows,
      handles: handles.rows,
      handle_rules: handleRules.rows,
      handle_rule_conditions: handleRuleConditions.rows
    }
    
    const result = await dbPool.query(`
      INSERT INTO handle_snapshots (
        description, 
        created_by,
        is_approved,
        leaf_types_data,
        parameters_data,
        parameter_values_data,
        handles_data,
        handle_rules_data,
        handle_rule_conditions_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      description || null,
      user_id || null,
      isApproved,
      JSON.stringify(snapshot.leaf_types),
      JSON.stringify(snapshot.parameters),
      JSON.stringify(snapshot.parameter_values),
      JSON.stringify(snapshot.handles),
      JSON.stringify(snapshot.handle_rules),
      JSON.stringify(snapshot.handle_rule_conditions)
    ])
    
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Ошибка при создании снапшота:', err)
    res.status(500).json({ error: 'Ошибка при создании снапшота' })
  }
}

// Получение списка снапшотов
const getSnapshots = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT 
        hs.*,
        u.first_name,
        u.last_name,
        u.middle_name,
        u.username
      FROM handle_snapshots hs
      LEFT JOIN users u ON hs.created_by = u.id
      ORDER BY hs.snapshot_date DESC
    `)
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении снапшотов:', err)
    res.status(500).json({ error: 'Ошибка при получении снапшотов' })
  }
}

// Удаление снапшота
const deleteSnapshot = (dbPool) => async (req, res) => {
  const { id } = req.params
  
  try {
    const result = await dbPool.query('DELETE FROM handle_snapshots WHERE id = $1 RETURNING *', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Снапшот не найден' })
    }
    res.json({ message: 'Снапшот успешно удален' })
  } catch (err) {
    console.error('Ошибка при удалении снапшота:', err)
    res.status(500).json({ error: 'Ошибка при удалении снапшота' })
  }
}

// Восстановление из снапшота
const restoreFromSnapshot = (dbPool) => async (req, res) => {
  const { snapshot_id, user_id } = req.body
  
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    
    // Получаем снапшот
    const snapshotResult = await client.query('SELECT * FROM handle_snapshots WHERE id = $1', [snapshot_id])
    if (snapshotResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Снапшот не найден' })
    }
    
    const snapshot = snapshotResult.rows[0]
    
    // Удаляем все текущие данные (в правильном порядке с учетом внешних ключей)
    await client.query('DELETE FROM handle_rule_conditions')
    await client.query('DELETE FROM handle_rules')
    await client.query('DELETE FROM handles')
    await client.query('DELETE FROM parameter_values')
    await client.query('DELETE FROM parameters')
    await client.query('DELETE FROM leaf_types')
    
    // Восстанавливаем данные с проверкой на пустые массивы
    // JSONB в PostgreSQL возвращается как объект, не строка
    if (snapshot.leaf_types_data) {
      const leafTypes = typeof snapshot.leaf_types_data === 'string' 
        ? JSON.parse(snapshot.leaf_types_data) 
        : snapshot.leaf_types_data
      if (Array.isArray(leafTypes) && leafTypes.length > 0) {
        for (const lt of leafTypes) {
          await client.query(`
            INSERT INTO leaf_types (id, name, description, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
          `, [lt.id, lt.name, lt.description || null, lt.created_at || null, lt.updated_at || null])
        }
        // Обновляем последовательность
        if (leafTypes.length > 0) {
          const maxId = Math.max(...leafTypes.map(lt => lt.id || 0))
          if (maxId > 0) {
            await client.query(`SELECT setval('leaf_types_id_seq', $1, true)`, [maxId])
          }
        }
      }
    }
    
    if (snapshot.parameters_data) {
      const parameters = typeof snapshot.parameters_data === 'string' 
        ? JSON.parse(snapshot.parameters_data) 
        : snapshot.parameters_data
      if (Array.isArray(parameters) && parameters.length > 0) {
        for (const param of parameters) {
          await client.query(`
            INSERT INTO parameters (id, name, description, is_multiple, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            param.id, 
            param.name, 
            param.description || null, 
            param.is_multiple !== undefined ? param.is_multiple : false, 
            param.created_at || null, 
            param.updated_at || null
          ])
        }
        // Обновляем последовательность
        if (parameters.length > 0) {
          const maxId = Math.max(...parameters.map(p => p.id || 0))
          if (maxId > 0) {
            await client.query(`SELECT setval('parameters_id_seq', $1, true)`, [maxId])
          }
        }
      }
    }
    
    if (snapshot.parameter_values_data) {
      const parameterValues = typeof snapshot.parameter_values_data === 'string' 
        ? JSON.parse(snapshot.parameter_values_data) 
        : snapshot.parameter_values_data
      if (Array.isArray(parameterValues) && parameterValues.length > 0) {
        for (const pv of parameterValues) {
          await client.query(`
            INSERT INTO parameter_values (id, parameter_id, value, display_order, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            pv.id, 
            pv.parameter_id, 
            pv.value, 
            pv.display_order !== undefined ? pv.display_order : 0, 
            pv.created_at || null, 
            pv.updated_at || null
          ])
        }
        // Обновляем последовательность
        if (parameterValues.length > 0) {
          const maxId = Math.max(...parameterValues.map(pv => pv.id || 0))
          if (maxId > 0) {
            await client.query(`SELECT setval('parameter_values_id_seq', $1, true)`, [maxId])
          }
        }
      }
    }
    
    if (snapshot.handles_data) {
      const handles = typeof snapshot.handles_data === 'string' 
        ? JSON.parse(snapshot.handles_data) 
        : snapshot.handles_data
      if (Array.isArray(handles) && handles.length > 0) {
        for (const handle of handles) {
          await client.query(`
            INSERT INTO handles (id, article, name, description, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            handle.id, 
            handle.article, 
            handle.name, 
            handle.description || null, 
            handle.created_at || null, 
            handle.updated_at || null
          ])
        }
        // Обновляем последовательность
        if (handles.length > 0) {
          const maxId = Math.max(...handles.map(h => h.id || 0))
          if (maxId > 0) {
            await client.query(`SELECT setval('handles_id_seq', $1, true)`, [maxId])
          }
        }
      }
    }
    
    if (snapshot.handle_rules_data) {
      const handleRules = typeof snapshot.handle_rules_data === 'string' 
        ? JSON.parse(snapshot.handle_rules_data) 
        : snapshot.handle_rules_data
      if (Array.isArray(handleRules) && handleRules.length > 0) {
        for (const rule of handleRules) {
          await client.query(`
            INSERT INTO handle_rules (id, handle_id, leaf_type_id, quantity, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            rule.id, 
            rule.handle_id, 
            rule.leaf_type_id, 
            rule.quantity !== undefined ? rule.quantity : 1, 
            rule.created_at || null, 
            rule.updated_at || null
          ])
        }
        // Обновляем последовательность
        if (handleRules.length > 0) {
          const maxId = Math.max(...handleRules.map(r => r.id || 0))
          if (maxId > 0) {
            await client.query(`SELECT setval('handle_rules_id_seq', $1, true)`, [maxId])
          }
        }
      }
    }
    
    if (snapshot.handle_rule_conditions_data) {
      const handleRuleConditions = typeof snapshot.handle_rule_conditions_data === 'string' 
        ? JSON.parse(snapshot.handle_rule_conditions_data) 
        : snapshot.handle_rule_conditions_data
      if (Array.isArray(handleRuleConditions) && handleRuleConditions.length > 0) {
        for (const condition of handleRuleConditions) {
          await client.query(`
            INSERT INTO handle_rule_conditions (id, rule_id, parameter_id, parameter_value_id, created_at)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            condition.id, 
            condition.rule_id, 
            condition.parameter_id, 
            condition.parameter_value_id || null, 
            condition.created_at || null
          ])
        }
        // Обновляем последовательность
        if (handleRuleConditions.length > 0) {
          const maxId = Math.max(...handleRuleConditions.map(c => c.id || 0))
          if (maxId > 0) {
            await client.query(`SELECT setval('handle_rule_conditions_id_seq', $1, true)`, [maxId])
          }
        }
      }
    }
    
    // Работа с подтверждениями эталонности
    const today = new Date().toISOString().split('T')[0]
    
    // Логируем восстановление ПЕРЕД созданием подтверждений, чтобы запись о восстановлении
    // не считалась изменением после подтверждения
    if (user_id) {
      await client.query(`
        INSERT INTO handle_history (entity_type, entity_id, action, new_data, changed_by)
        VALUES ('system', 0, 'restored', $1, $2)
      `, [JSON.stringify({ 
        snapshot_id, 
        snapshot_date: snapshot.snapshot_date,
        was_approved: snapshot.is_approved 
      }), user_id])
    }
    
    // Если снапшот был создан с подтвержденным эталоном, восстанавливаем подтверждения
    if (snapshot.is_approved) {
      // Получаем текущих пользователей, которые могут подтверждать
      const approvalUsersResult = await client.query(`
        SELECT user_id FROM handle_approval_users
      `)
      
      const currentApprovalUsers = approvalUsersResult.rows.map(row => row.user_id)
      
      // Сбрасываем старые подтверждения для текущей даты
      await client.query(`
        UPDATE handle_approvals 
        SET is_current = FALSE 
        WHERE snapshot_date = $1 AND is_current = TRUE
      `, [today])
      
      // Создаем подтверждения для всех текущих пользователей, которые могут подтверждать
      // Устанавливаем время подтверждения как текущее время, чтобы оно было после записи о восстановлении
      const approvalTime = new Date()
      
      if (currentApprovalUsers.length > 0) {
        for (const userId of currentApprovalUsers) {
          // Проверяем, не подтвердил ли уже на эту дату
          const existingApproval = await client.query(`
            SELECT id FROM handle_approvals 
            WHERE approved_by = $1 AND snapshot_date = $2
          `, [userId, today])
          
          if (existingApproval.rows.length === 0) {
            // Создаем новое подтверждение с текущим временем
            await client.query(`
              INSERT INTO handle_approvals (approved_by, snapshot_date, is_current, approved_at)
              VALUES ($1, $2, TRUE, $3)
            `, [userId, today, approvalTime])
          } else {
            // Обновляем существующее подтверждение с текущим временем
            await client.query(`
              UPDATE handle_approvals 
              SET is_current = TRUE, approved_at = $1
              WHERE id = $2
            `, [approvalTime, existingApproval.rows[0].id])
          }
        }
      }
    } else {
      // Если снапшот был без подтвержденного эталона, сбрасываем все подтверждения
      await client.query(`
        UPDATE handle_approvals 
        SET is_current = FALSE 
        WHERE snapshot_date = $1 AND is_current = TRUE
      `, [today])
    }
    
    await client.query('COMMIT')
    res.json({ message: 'Данные успешно восстановлены из снапшота' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при восстановлении из снапшота:', err)
    console.error('Детали ошибки:', err.message, err.stack)
    res.status(500).json({ 
      error: 'Ошибка при восстановлении из снапшота',
      details: err.message 
    })
  } finally {
    client.release()
  }
}

// Получение всех данных для редактора
const getEditorData = (dbPool) => async (req, res) => {
  try {
    // Получаем все типы створок
    const leafTypesResult = await dbPool.query('SELECT * FROM leaf_types ORDER BY name')
    
    // Получаем все параметры с их значениями (исключая "Тип створки")
    const parametersResult = await dbPool.query(
      "SELECT * FROM parameters WHERE name != 'Тип створки' ORDER BY name"
    )
    const parameters = []
    
    for (const param of parametersResult.rows) {
      const valuesResult = await dbPool.query(
        'SELECT * FROM parameter_values WHERE parameter_id = $1 ORDER BY display_order, value',
        [param.id]
      )
      parameters.push({
        ...param,
        values: valuesResult.rows
      })
    }
    
    // Получаем все ручки
    const handlesResult = await dbPool.query('SELECT * FROM handles ORDER BY article')
    
    // Получаем все правила с условиями
    const rulesResult = await dbPool.query(`
      SELECT 
        hr.*,
        h.article as handle_article,
        h.name as handle_name,
        lt.name as leaf_type_name
      FROM handle_rules hr
      LEFT JOIN handles h ON hr.handle_id = h.id
      LEFT JOIN leaf_types lt ON hr.leaf_type_id = lt.id
      ORDER BY hr.created_at DESC
    `)
    
    const rules = []
    for (const rule of rulesResult.rows) {
      const conditionsResult = await dbPool.query(`
        SELECT 
          hrc.*,
          p.name as parameter_name,
          pv.value as parameter_value
        FROM handle_rule_conditions hrc
        LEFT JOIN parameters p ON hrc.parameter_id = p.id
        LEFT JOIN parameter_values pv ON hrc.parameter_value_id = pv.id
        WHERE hrc.rule_id = $1
      `, [rule.id])
      
      rules.push({
        ...rule,
        conditions: conditionsResult.rows
      })
    }
    
    res.json({
      leafTypes: leafTypesResult.rows,
      parameters: parameters,
      handles: handlesResult.rows,
      rules: rules
    })
  } catch (err) {
    console.error('Ошибка при получении данных редактора:', err)
    res.status(500).json({ error: 'Ошибка при получении данных редактора' })
  }
}

module.exports = {
  // Типы створок
  getLeafTypes,
  createLeafType,
  updateLeafType,
  deleteLeafType,
  
  // Параметры
  getParameters,
  createParameter,
  updateParameter,
  deleteParameter,
  
  // Значения параметров
  getParameterValues,
  createParameterValue,
  updateParameterValue,
  deleteParameterValue,
  
  // Ручки
  getHandles,
  createHandle,
  updateHandle,
  deleteHandle,
  
  // Правила
  getHandleRules,
  getHandleRuleById,
  createHandleRule,
  updateHandleRule,
  deleteHandleRule,
  
  // Подбор ручек
  findHandlesByParameters,
  
  // Экспорт/Импорт
  exportRules,
  importRules,
  
  // Получение всех данных
  getEditorData,
  
  // История изменений
  getHandleHistory,
  
  // Подтверждение эталонности
  getApprovalStatus,
  approveHandleData,
  getApprovalUsers,
  addApprovalUser,
  removeApprovalUser,
  getAllUsers,
  
  // Снапшоты и откат
  createSnapshot,
  getSnapshots,
  restoreFromSnapshot,
  deleteSnapshot
}



