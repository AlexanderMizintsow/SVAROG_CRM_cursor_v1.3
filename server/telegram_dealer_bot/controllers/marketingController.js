// marketingController.js
// Контроллер для работы с автоматизацией маркетинга

const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { sanitizeFilename } = require('../helpers/fileUtils')

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath =
      file.fieldname === 'images'
        ? path.join(__dirname, '../../uploads/marketing/images')
        : path.join(__dirname, '../../uploads/marketing/attachments')

    // Создаем папку, если её нет
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'images') {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error('Разрешены только изображения: JPG, PNG, WEBP'))
      }
    } else if (file.fieldname === 'attachments') {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ]
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error('Разрешены только документы: PDF, DOC, DOCX, XLS, XLSX'))
      }
    } else {
      cb(null, true)
    }
  },
})

// ==================== КАТЕГОРИИ ====================

// Получение всех категорий
const getCategories = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(
      'SELECT * FROM marketing_categories ORDER BY display_order, name'
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении категорий:', err)
    res.status(500).json({ error: 'Ошибка при получении категорий' })
  }
}

// Создание категории
const createCategory = (dbPool) => async (req, res) => {
  const { name, description, icon, display_order } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Название категории обязательно' })
  }

  try {
    const result = await dbPool.query(
      `INSERT INTO marketing_categories (name, description, icon, display_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), description || null, icon || null, display_order || 0]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Категория с таким названием уже существует' })
    } else {
      console.error('Ошибка при создании категории:', err)
      res.status(500).json({ error: 'Ошибка при создании категории' })
    }
  }
}

// Обновление категории
const updateCategory = (dbPool) => async (req, res) => {
  const { id } = req.params
  const { name, description, icon, display_order } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Название категории обязательно' })
  }

  try {
    const result = await dbPool.query(
      `UPDATE marketing_categories 
       SET name = $1, description = $2, icon = $3, display_order = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name.trim(), description || null, icon || null, display_order || 0, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' })
    }

    res.json(result.rows[0])
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Категория с таким названием уже существует' })
    } else {
      console.error('Ошибка при обновлении категории:', err)
      res.status(500).json({ error: 'Ошибка при обновлении категории' })
    }
  }
}

// Удаление категории
const deleteCategory = (dbPool) => async (req, res) => {
  const { id } = req.params

  try {
    const result = await dbPool.query(
      'DELETE FROM marketing_categories WHERE id = $1 RETURNING *',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' })
    }

    res.json({ message: 'Категория удалена' })
  } catch (err) {
    console.error('Ошибка при удалении категории:', err)
    res.status(500).json({ error: 'Ошибка при удалении категории' })
  }
}

// ==================== КАМПАНИИ ====================

// Получение всех кампаний с фильтрами
const getCampaigns = (dbPool) => async (req, res) => {
  try {
    const { category_id, status, search, tag_id } = req.query

    let query = `
      SELECT DISTINCT
        c.*,
        cat.name as category_name,
        cat.icon as category_icon,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM marketing_campaigns c
      LEFT JOIN marketing_categories cat ON cat.id = c.category_id
      LEFT JOIN users u ON u.id = c.created_by
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    if (category_id) {
      query += ` AND c.category_id = $${paramIndex}`
      params.push(category_id)
      paramIndex++
    }

    if (status) {
      query += ` AND c.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (search) {
      query += ` AND c.name ILIKE $${paramIndex}`
      params.push(`%${search}%`)
      paramIndex++
    }

    // Фильтр по тегам
    if (tag_id) {
      query += ` AND EXISTS (
        SELECT 1 FROM marketing_campaign_tags mct 
        WHERE mct.campaign_id = c.id AND mct.tag_id = $${paramIndex}
      )`
      params.push(tag_id)
      paramIndex++
    }

    query += ' ORDER BY c.created_at DESC'

    const result = await dbPool.query(query, params)

    // Получаем теги для каждой кампании
    const campaignIds = result.rows.map((row) => row.id)
    let tagsMap = {}
    if (campaignIds.length > 0) {
      const tagsResult = await dbPool.query(
        `SELECT mct.campaign_id, mt.id, mt.name, mt.color
         FROM marketing_campaign_tags mct
         JOIN marketing_tags mt ON mt.id = mct.tag_id
         WHERE mct.campaign_id = ANY($1)`,
        [campaignIds]
      )
      tagsResult.rows.forEach((row) => {
        if (!tagsMap[row.campaign_id]) {
          tagsMap[row.campaign_id] = []
        }
        tagsMap[row.campaign_id].push({
          id: row.id,
          name: row.name,
          color: row.color,
        })
      })
    }

    // Формируем объекты категорий и тегов для удобства
    const campaigns = result.rows.map((row) => ({
      ...row,
      category: row.category_name
        ? {
            id: row.category_id,
            name: row.category_name,
            icon: row.category_icon,
          }
        : null,
      tags: tagsMap[row.id] || [],
    }))

    res.json(campaigns)
  } catch (err) {
    console.error('Ошибка при получении кампаний:', err)
    res.status(500).json({ error: 'Ошибка при получении кампаний' })
  }
}

// Получение одной кампании с полными данными
const getCampaign = (dbPool) => async (req, res) => {
  const { id } = req.params

  try {
    const client = await dbPool.connect()
    try {
      // Основная информация о кампании
      const campaignResult = await client.query(
        `SELECT 
          c.*,
          cat.name as category_name,
          cat.icon as category_icon,
          u.first_name || ' ' || u.last_name as created_by_name,
          cp.first_name || ' ' || cp.last_name as contact_person_name
        FROM marketing_campaigns c
        LEFT JOIN marketing_categories cat ON cat.id = c.category_id
        LEFT JOIN users u ON u.id = c.created_by
        LEFT JOIN users cp ON cp.id = c.contact_person_id
        WHERE c.id = $1`,
        [id]
      )

      if (campaignResult.rows.length === 0) {
        return res.status(404).json({ error: 'Кампания не найдена' })
      }

      const campaign = campaignResult.rows[0]

      // Изображения
      const imagesResult = await client.query(
        'SELECT * FROM marketing_campaign_images WHERE campaign_id = $1 ORDER BY display_order',
        [id]
      )

      // Вложения
      const attachmentsResult = await client.query(
        'SELECT * FROM marketing_campaign_attachments WHERE campaign_id = $1 ORDER BY display_order',
        [id]
      )

      // Локации
      const locationsResult = await client.query(
        `SELECT ml.* 
         FROM marketing_campaign_locations mcl
         JOIN marketing_locations ml ON ml.id = mcl.location_id
         WHERE mcl.campaign_id = $1`,
        [id]
      )

      // Теги
      const tagsResult = await client.query(
        `SELECT mt.* 
         FROM marketing_campaign_tags mct
         JOIN marketing_tags mt ON mt.id = mct.tag_id
         WHERE mct.campaign_id = $1`,
        [id]
      )

      // Компании
      const companiesResult = await client.query(
        `SELECT c.id, c.name_companies as name, c.name_companies as company_name
         FROM marketing_campaign_companies mcc
         JOIN companies c ON c.id = mcc.company_id
         WHERE mcc.campaign_id = $1`,
        [id]
      )

      res.json({
        ...campaign,
        category: campaign.category_name
          ? {
              id: campaign.category_id,
              name: campaign.category_name,
              icon: campaign.category_icon,
            }
          : null,
        images: imagesResult.rows,
        attachments: attachmentsResult.rows,
        locations: locationsResult.rows,
        tags: tagsResult.rows,
        companies: companiesResult.rows,
      })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Ошибка при получении кампании:', err)
    res.status(500).json({ error: 'Ошибка при получении кампании' })
  }
}

// Создание кампании
const createCampaign = (dbPool) => async (req, res) => {
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')

    // Парсим JSON поля из FormData
    const delivery_channels = req.body.delivery_channels
      ? JSON.parse(req.body.delivery_channels)
      : ['telegram']
    const locations = req.body.locations ? JSON.parse(req.body.locations) : []
    const tags = req.body.tags ? JSON.parse(req.body.tags) : []
    const companies = req.body.companies ? JSON.parse(req.body.companies) : []

    // Валидация
    if (!req.body.name || !req.body.name.trim()) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Название кампании обязательно' })
    }

    if (!req.body.category_id) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Категория обязательна' })
    }

    if (!req.body.content || !req.body.content.trim()) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Содержание обязательно' })
    }

    if (!delivery_channels || delivery_channels.length === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Выберите хотя бы один канал доставки' })
    }

    // Создаем кампанию
    const campaignResult = await client.query(
      `INSERT INTO marketing_campaigns (
        category_id, name, content, status, period_type, send_date, 
        period_start, period_end, auto_send, blocking_period_days,
        contact_person_id, show_contact_person, notes, delivery_channels, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        req.body.category_id,
        req.body.name.trim(),
        req.body.content,
        req.body.status || 'draft',
        req.body.period_type || 'unlimited',
        req.body.send_date || null,
        req.body.period_start || null,
        req.body.period_end || null,
        req.body.auto_send === 'true' || req.body.auto_send === true,
        parseInt(req.body.blocking_period_days) || 30,
        req.body.contact_person_id || null,
        req.body.show_contact_person === 'true' || req.body.show_contact_person === true,
        req.body.notes || null,
        JSON.stringify(delivery_channels),
        req.body.created_by || null,
      ]
    )

    const campaignId = campaignResult.rows[0].id

    // Добавляем локации
    if (locations.length > 0) {
      for (const locationId of locations) {
        await client.query(
          'INSERT INTO marketing_campaign_locations (campaign_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [campaignId, locationId]
        )
      }
    }

    // Добавляем теги
    if (tags.length > 0) {
      for (const tagId of tags) {
        await client.query(
          'INSERT INTO marketing_campaign_tags (campaign_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [campaignId, tagId]
        )
      }
    }

    // Добавляем компании
    if (companies.length > 0) {
      for (const companyId of companies) {
        await client.query(
          'INSERT INTO marketing_campaign_companies (campaign_id, company_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [campaignId, companyId]
        )
      }
    }

    // Обрабатываем изображения
    if (req.files && req.files.images) {
      const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images]
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        const originalName = image.originalname || image.filename
        await client.query(
          `INSERT INTO marketing_campaign_images (campaign_id, file_path, file_name, original_name, file_size, display_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [campaignId, image.path, image.filename, originalName, image.size, i]
        )
      }
    }

    // Обрабатываем вложения
    if (req.files && req.files.attachments) {
      const attachments = Array.isArray(req.files.attachments)
        ? req.files.attachments
        : [req.files.attachments]
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i]
        const originalName = attachment.originalname || attachment.filename
        await client.query(
          `INSERT INTO marketing_campaign_attachments (campaign_id, file_path, file_name, original_name, file_size, file_type, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            campaignId,
            attachment.path,
            attachment.filename,
            originalName,
            attachment.size,
            attachment.mimetype,
            i,
          ]
        )
      }
    }

    await client.query('COMMIT')
    res.status(201).json(campaignResult.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при создании кампании:', err)
    res.status(500).json({ error: 'Ошибка при создании кампании: ' + err.message })
  } finally {
    client.release()
  }
}

// Обновление кампании (аналогично createCampaign, но с UPDATE)
const updateCampaign = (dbPool) => async (req, res) => {
  const { id } = req.params
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')

    // Проверяем существование кампании
    const existingCampaign = await client.query(
      'SELECT id FROM marketing_campaigns WHERE id = $1',
      [id]
    )
    if (existingCampaign.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Кампания не найдена' })
    }

    // Парсим JSON поля
    const delivery_channels = req.body.delivery_channels
      ? JSON.parse(req.body.delivery_channels)
      : ['telegram']
    const locations = req.body.locations ? JSON.parse(req.body.locations) : []
    const tags = req.body.tags ? JSON.parse(req.body.tags) : []
    const companies = req.body.companies ? JSON.parse(req.body.companies) : []

    // Валидация
    if (!req.body.name || !req.body.name.trim()) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Название кампании обязательно' })
    }

    if (!req.body.category_id) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Категория обязательна' })
    }

    if (!req.body.content || !req.body.content.trim()) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Содержание обязательно' })
    }

    // Обновляем кампанию
    await client.query(
      `UPDATE marketing_campaigns SET
        category_id = $1, name = $2, content = $3, status = $4, period_type = $5,
        send_date = $6, period_start = $7, period_end = $8, auto_send = $9,
        blocking_period_days = $10, contact_person_id = $11, show_contact_person = $12,
        notes = $13, delivery_channels = $14, updated_at = NOW()
       WHERE id = $15`,
      [
        req.body.category_id,
        req.body.name.trim(),
        req.body.content,
        req.body.status || 'draft',
        req.body.period_type || 'unlimited',
        req.body.send_date || null,
        req.body.period_start || null,
        req.body.period_end || null,
        req.body.auto_send === 'true' || req.body.auto_send === true,
        parseInt(req.body.blocking_period_days) || 30,
        req.body.contact_person_id || null,
        req.body.show_contact_person === 'true' || req.body.show_contact_person === true,
        req.body.notes || null,
        JSON.stringify(delivery_channels),
        id,
      ]
    )

    // Удаляем старые связи
    await client.query('DELETE FROM marketing_campaign_locations WHERE campaign_id = $1', [id])
    await client.query('DELETE FROM marketing_campaign_tags WHERE campaign_id = $1', [id])
    await client.query('DELETE FROM marketing_campaign_companies WHERE campaign_id = $1', [id])

    // Добавляем новые локации
    if (locations.length > 0) {
      for (const locationId of locations) {
        await client.query(
          'INSERT INTO marketing_campaign_locations (campaign_id, location_id) VALUES ($1, $2)',
          [id, locationId]
        )
      }
    }

    // Добавляем новые теги
    if (tags.length > 0) {
      for (const tagId of tags) {
        await client.query(
          'INSERT INTO marketing_campaign_tags (campaign_id, tag_id) VALUES ($1, $2)',
          [id, tagId]
        )
      }
    }

    // Добавляем новые компании
    if (companies.length > 0) {
      for (const companyId of companies) {
        await client.query(
          'INSERT INTO marketing_campaign_companies (campaign_id, company_id) VALUES ($1, $2)',
          [id, companyId]
        )
      }
    }

    // Обрабатываем новые изображения
    if (req.files && req.files.images) {
      const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images]
      const existingImages = await client.query(
        'SELECT COUNT(*) as count FROM marketing_campaign_images WHERE campaign_id = $1',
        [id]
      )
      const currentCount = parseInt(existingImages.rows[0].count)
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        const originalName = image.originalname || image.filename
        await client.query(
          `INSERT INTO marketing_campaign_images (campaign_id, file_path, file_name, original_name, file_size, display_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, image.path, image.filename, originalName, image.size, currentCount + i]
        )
      }
    }

    // Обрабатываем новые вложения
    if (req.files && req.files.attachments) {
      const attachments = Array.isArray(req.files.attachments)
        ? req.files.attachments
        : [req.files.attachments]
      const existingAttachments = await client.query(
        'SELECT COUNT(*) as count FROM marketing_campaign_attachments WHERE campaign_id = $1',
        [id]
      )
      const currentCount = parseInt(existingAttachments.rows[0].count)
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i]
        const originalName = attachment.originalname || attachment.filename
        await client.query(
          `INSERT INTO marketing_campaign_attachments (campaign_id, file_path, file_name, original_name, file_size, file_type, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            attachment.path,
            attachment.filename,
            originalName,
            attachment.size,
            attachment.mimetype,
            currentCount + i,
          ]
        )
      }
    }

    await client.query('COMMIT')
    res.json({ message: 'Кампания обновлена' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Ошибка при обновлении кампании:', err)
    res.status(500).json({ error: 'Ошибка при обновлении кампании: ' + err.message })
  } finally {
    client.release()
  }
}

// Удаление кампании
const deleteCampaign = (dbPool) => async (req, res) => {
  const { id } = req.params

  try {
    const result = await dbPool.query('DELETE FROM marketing_campaigns WHERE id = $1 RETURNING *', [
      id,
    ])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Кампания не найдена' })
    }

    res.json({ message: 'Кампания удалена' })
  } catch (err) {
    console.error('Ошибка при удалении кампании:', err)
    res.status(500).json({ error: 'Ошибка при удалении кампании' })
  }
}

// Ручная отправка кампании
const sendCampaign = (dbPool, bot) => async (req, res) => {
  const { id } = req.params
  const { company_ids } = req.body // массив ID компаний для отправки

  try {
    // Получаем кампанию
    const campaignResult = await dbPool.query(
      `SELECT c.*, cat.name as category_name
       FROM marketing_campaigns c
       LEFT JOIN marketing_categories cat ON cat.id = c.category_id
       WHERE c.id = $1`,
      [id]
    )

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Кампания не найдена' })
    }

    const campaign = campaignResult.rows[0]

    if (campaign.status !== 'active') {
      return res.status(400).json({ error: 'Кампания должна быть активна для отправки' })
    }

    // Получаем список компаний для отправки
    let companiesQuery = `
      SELECT DISTINCT c.id, c.name_companies as name, c.name_companies as company_name,
             uct.chat_id
      FROM companies c
      LEFT JOIN user_company_tg_bot uct ON uct.company_id = c.id
      WHERE uct.chat_id IS NOT NULL
    `
    const params = []
    let paramIndex = 1

    if (company_ids && company_ids.length > 0) {
      companiesQuery += ` AND c.id = ANY($${paramIndex})`
      params.push(company_ids)
    } else {
      // Если компании не указаны, получаем все компании кампании
      const campaignCompaniesResult = await dbPool.query(
        'SELECT company_id FROM marketing_campaign_companies WHERE campaign_id = $1',
        [id]
      )
      const campaignCompanyIds = campaignCompaniesResult.rows.map((r) => r.company_id)

      if (campaignCompanyIds.length > 0) {
        companiesQuery += ` AND c.id = ANY($${paramIndex})`
        params.push(campaignCompanyIds)
      }
    }

    const companiesResult = await dbPool.query(companiesQuery, params)
    const companies = companiesResult.rows.filter((c) => c.chat_id) // Только с chat_id

    console.log(`[MARKETING][SEND] Найдено компаний для отправки: ${companies.length}`)
    if (companies.length === 0) {
      return res.status(400).json({
        error:
          'Нет компаний для отправки. Убедитесь, что компании зарегистрированы в Telegram боте (имеют chat_id).',
      })
    }

    // Отправляем каждой компании
    const results = []
    for (const company of companies) {
      try {
        // Проверка дублирования
        const blockingPeriod = campaign.blocking_period_days || 30
        const duplicateCheck = await dbPool.query(
          `SELECT COUNT(*) as count 
           FROM marketing_send_log 
           WHERE campaign_id = $1 AND company_id = $2 AND status = 'sent'
           AND sent_at > NOW() - INTERVAL '${blockingPeriod} days'`,
          [id, company.id]
        )

        if (parseInt(duplicateCheck.rows[0].count) > 0) {
          const skipMessage = `Пропущено: кампания уже была отправлена в период блокировки (${blockingPeriod} дней)`

          // Логируем пропуск
          await dbPool.query(
            `INSERT INTO marketing_send_log (campaign_id, company_id, status, send_type, delivery_channel, error_message)
             VALUES ($1, $2, 'skipped', 'manual', 'telegram', $3)`,
            [id, company.id, skipMessage]
          )

          results.push({
            company_id: company.id,
            company_name: company.name,
            status: 'skipped',
            message: skipMessage,
          })
          continue
        }

        // Формируем сообщение
        let message = `*${campaign.name}*\n\n`
        if (campaign.category_name) {
          message += `Категория: ${campaign.category_name}\n\n`
        }

        // Конвертируем HTML контент для Telegram
        // Telegram Markdown поддерживает: *bold*, _italic_, `code`, [link](url)
        // Сохраняем переносы строк и форматирование
        let content = campaign.content || ''

        // Сначала обрабатываем специальные случаи
        // Заменяем пустые параграфы на перенос строки
        content = content.replace(/<p>\s*<\/p>/gi, '\n')

        // Конвертируем HTML теги в переносы строк и форматирование Markdown
        content = content
          .replace(/<p>/gi, '')
          .replace(/<\/p>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<div>/gi, '')
          .replace(/<\/div>/gi, '\n')
          .replace(/<strong>/gi, '*')
          .replace(/<\/strong>/gi, '*')
          .replace(/<b>/gi, '*')
          .replace(/<\/b>/gi, '*')
          .replace(/<em>/gi, '_')
          .replace(/<\/em>/gi, '_')
          .replace(/<i>/gi, '_')
          .replace(/<\/i>/gi, '_')
          .replace(/<u>/gi, '')
          .replace(/<\/u>/gi, '')
          .replace(/<s>/gi, '')
          .replace(/<\/s>/gi, '')
          .replace(/<code>/gi, '`')
          .replace(/<\/code>/gi, '`')
          .replace(/<pre>/gi, '```\n')
          .replace(/<\/pre>/gi, '\n```')
          .replace(/<li>/gi, '• ')
          .replace(/<\/li>/gi, '\n')
          .replace(/<ul>/gi, '')
          .replace(/<\/ul>/gi, '\n')
          .replace(/<ol>/gi, '')
          .replace(/<\/ol>/gi, '\n')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")

        // Удаляем все остальные HTML теги
        content = content.replace(/<[^>]*>/g, '')

        // Очищаем множественные переносы строк (более 2 подряд)
        content = content.replace(/\n{3,}/g, '\n\n')

        // Убираем переносы в начале и конце
        content = content.trim()

        message += content

        // Контактное лицо
        if (campaign.show_contact_person && campaign.contact_person_id) {
          const contactResult = await dbPool.query(
            "SELECT first_name || ' ' || last_name as name, email FROM users WHERE id = $1",
            [campaign.contact_person_id]
          )
          if (contactResult.rows.length > 0) {
            const contact = contactResult.rows[0]
            message += `\n\n📞 Контактное лицо: ${contact.name}`
            if (contact.email) {
              message += `\n📧 ${contact.email}`
            }
          }
        }

        // Получаем изображения и вложения
        const imagesResult = await dbPool.query(
          'SELECT * FROM marketing_campaign_images WHERE campaign_id = $1 ORDER BY display_order',
          [id]
        )
        const attachmentsResult = await dbPool.query(
          'SELECT * FROM marketing_campaign_attachments WHERE campaign_id = $1 ORDER BY display_order',
          [id]
        )

        // Отправляем сообщение с изображениями и вложениями
        try {
          if (imagesResult.rows.length > 0) {
            // Проверяем существование всех файлов изображений
            const validImages = []
            for (const image of imagesResult.rows) {
              const imagePath = path.join(
                __dirname,
                '../../uploads/marketing/images',
                image.file_name
              )
              if (fs.existsSync(imagePath)) {
                validImages.push({
                  path: imagePath,
                  fileName: image.file_name,
                })
              } else {
                console.warn(`[MARKETING][SEND] Файл изображения не найден: ${imagePath}`)
              }
            }

            if (validImages.length > 0) {
              // Если одно изображение - отправляем с caption
              if (validImages.length === 1) {
                try {
                  await bot.sendPhoto(company.chat_id, fs.createReadStream(validImages[0].path), {
                    caption: message,
                    parse_mode: 'Markdown',
                  })
                } catch (sendError) {
                  console.error(`[MARKETING][SEND] Ошибка при отправке изображения:`, sendError)
                  // Если ошибка, отправляем только текст
                  await bot.sendMessage(company.chat_id, message, { parse_mode: 'Markdown' })
                }
              } else {
                // Если несколько изображений - отправляем как медиа-группу (альбом)
                // Telegram позволяет до 10 фото в одной группе
                const maxGroupSize = 10
                const imageGroups = []
                for (let i = 0; i < validImages.length; i += maxGroupSize) {
                  imageGroups.push(validImages.slice(i, i + maxGroupSize))
                }

                // Отправляем каждую группу
                for (let groupIndex = 0; groupIndex < imageGroups.length; groupIndex++) {
                  const group = imageGroups[groupIndex]
                  try {
                    const mediaGroup = group.map((image) => ({
                      type: 'photo',
                      media: fs.createReadStream(image.path),
                    }))

                    // Caption можно добавить только к первому элементу первой группы
                    if (groupIndex === 0) {
                      mediaGroup[0].caption = message
                      mediaGroup[0].parse_mode = 'Markdown'
                    }

                    await bot.sendMediaGroup(company.chat_id, mediaGroup)
                  } catch (mediaGroupError) {
                    console.error(
                      `[MARKETING][SEND] Ошибка при отправке медиа-группы:`,
                      mediaGroupError
                    )
                    // Если ошибка с медиа-группой, пробуем отправить по одному
                    if (groupIndex === 0) {
                      // Первое изображение с текстом
                      try {
                        await bot.sendPhoto(company.chat_id, fs.createReadStream(group[0].path), {
                          caption: message,
                          parse_mode: 'Markdown',
                        })
                        // Остальные без текста
                        for (let i = 1; i < group.length; i++) {
                          await bot.sendPhoto(company.chat_id, fs.createReadStream(group[i].path))
                        }
                      } catch (fallbackError) {
                        console.error(
                          `[MARKETING][SEND] Ошибка при fallback отправке:`,
                          fallbackError
                        )
                        await bot.sendMessage(company.chat_id, message, { parse_mode: 'Markdown' })
                      }
                    } else {
                      // Для остальных групп отправляем по одному
                      for (const image of group) {
                        try {
                          await bot.sendPhoto(company.chat_id, fs.createReadStream(image.path))
                        } catch (singleError) {
                          console.error(
                            `[MARKETING][SEND] Ошибка при отправке изображения ${image.fileName}:`,
                            singleError
                          )
                        }
                      }
                    }
                  }
                }
              }
            } else {
              // Если нет валидных изображений, отправляем только текст
              await bot.sendMessage(company.chat_id, message, { parse_mode: 'Markdown' })
            }
          } else {
            // Если нет изображений, отправляем только текст
            await bot.sendMessage(company.chat_id, message, { parse_mode: 'Markdown' })
          }

          // Отправляем вложения (файлы)
          // Файлы отправляются отдельно, так как их нельзя включить в медиа-группу
          if (attachmentsResult.rows.length > 0) {
            // Небольшая задержка перед отправкой файлов, чтобы они шли сразу после альбома
            await new Promise((resolve) => setTimeout(resolve, 200))

            for (const attachment of attachmentsResult.rows) {
              try {
                const attachmentPath = path.join(
                  __dirname,
                  '../../uploads/marketing/attachments',
                  attachment.file_name
                )
                if (fs.existsSync(attachmentPath)) {
                  // Используем оригинальное имя файла, если оно есть, иначе извлекаем из file_name
                  let displayName = attachment.original_name || attachment.file_name
                  // Если file_name содержит префикс timestamp, извлекаем оригинальное имя
                  if (!attachment.original_name && attachment.file_name.includes('-')) {
                    const parts = attachment.file_name.split('-')
                    if (parts.length >= 3) {
                      // Пропускаем первые две части (timestamp и random) и объединяем остальное
                      displayName = parts.slice(2).join('-')
                    }
                  }
                  // Обрабатываем имя файла для корректной кодировки
                  displayName = sanitizeFilename(displayName)

                  await bot.sendDocument(company.chat_id, fs.createReadStream(attachmentPath), {
                    filename: displayName,
                    caption: displayName,
                  })
                  // Небольшая задержка между отправками файлов
                  await new Promise((resolve) => setTimeout(resolve, 100))
                } else {
                  console.warn(`[MARKETING][SEND] Файл вложения не найден: ${attachmentPath}`)
                }
              } catch (attachmentError) {
                console.error(
                  `[MARKETING][SEND] Ошибка при отправке вложения ${attachment.file_name}:`,
                  attachmentError
                )
                // Продолжаем отправку остальных файлов
              }
            }
          }
        } catch (sendError) {
          // Если ошибка отправки, пробуем отправить как обычный текст без HTML
          console.error(`Ошибка отправки сообщения с медиа, пробуем как текст:`, sendError)
          const plainMessage = message
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')

          try {
            if (imagesResult.rows.length > 0) {
              const firstImage = imagesResult.rows[0]
              const imagePath = path.join(
                __dirname,
                '../../uploads/marketing/images',
                firstImage.file_name
              )
              if (fs.existsSync(imagePath)) {
                await bot.sendPhoto(company.chat_id, fs.createReadStream(imagePath), {
                  caption: plainMessage,
                })
              } else {
                await bot.sendMessage(company.chat_id, plainMessage)
              }
            } else {
              await bot.sendMessage(company.chat_id, plainMessage)
            }
          } catch (fallbackError) {
            // Если и fallback не сработал, просто отправляем текст
            console.error(`Ошибка fallback отправки:`, fallbackError)
            await bot.sendMessage(company.chat_id, plainMessage)
          }
        }

        // Логируем успешную отправку
        await dbPool.query(
          `INSERT INTO marketing_send_log (campaign_id, company_id, status, send_type, delivery_channel)
           VALUES ($1, $2, 'sent', 'manual', 'telegram')`,
          [id, company.id]
        )

        results.push({
          company_id: company.id,
          company_name: company.name,
          status: 'sent',
        })
      } catch (error) {
        console.error(`Ошибка при отправке компании ${company.id} (${company.name}):`, error)
        console.error(`Детали ошибки:`, {
          campaign_id: id,
          company_id: company.id,
          chat_id: company.chat_id,
          error_message: error.message,
          error_response: error.response?.data,
          error_code: error.code,
        })

        // Логируем ошибку
        const errorMessage =
          error.response?.data?.description || error.message || 'Неизвестная ошибка'
        await dbPool.query(
          `INSERT INTO marketing_send_log (campaign_id, company_id, status, send_type, delivery_channel, error_message)
           VALUES ($1, $2, 'error', 'manual', 'telegram', $3)`,
          [id, company.id, errorMessage.substring(0, 500)] // Ограничиваем длину сообщения об ошибке
        )

        results.push({
          company_id: company.id,
          company_name: company.name,
          status: 'error',
          message: errorMessage,
        })
      }
    }

    res.json({
      message: 'Отправка завершена',
      results,
      total: companies.length,
      sent: results.filter((r) => r.status === 'sent').length,
      errors: results.filter((r) => r.status === 'error').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
    })
  } catch (err) {
    console.error('Ошибка при отправке кампании:', err)
    res.status(500).json({ error: 'Ошибка при отправке кампании: ' + err.message })
  }
}

// Получение получателей кампании (компании с подключенным Telegram)
const getCampaignRecipients = (dbPool) => async (req, res) => {
  const { id } = req.params

  try {
    // Проверяем существование кампании
    const campaignResult = await dbPool.query(
      'SELECT id, name FROM marketing_campaigns WHERE id = $1',
      [id]
    )

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Кампания не найдена' })
    }

    // Получаем компании кампании
    const campaignCompaniesResult = await dbPool.query(
      'SELECT company_id FROM marketing_campaign_companies WHERE campaign_id = $1',
      [id]
    )
    const campaignCompanyIds = campaignCompaniesResult.rows.map((r) => r.company_id)

    // Получаем локации кампании
    const campaignLocationsResult = await dbPool.query(
      'SELECT location_id FROM marketing_campaign_locations WHERE campaign_id = $1',
      [id]
    )
    const campaignLocationIds = campaignLocationsResult.rows.map((r) => r.location_id)

    // Формируем запрос для получения компаний с подключенным Telegram
    let companiesQuery = `
      SELECT DISTINCT 
        c.id, 
        c.name_companies as name, 
        c.name_companies as company_name,
        uct.chat_id
      FROM companies c
      LEFT JOIN user_company_tg_bot uct ON uct.company_id = c.id
      WHERE uct.chat_id IS NOT NULL
    `
    const params = []
    let paramIndex = 1

    // Если выбраны конкретные компании, фильтруем по ним
    if (campaignCompanyIds.length > 0) {
      companiesQuery += ` AND c.id = ANY($${paramIndex})`
      params.push(campaignCompanyIds)
      paramIndex++
    }
    // Если компаний нет в таблице - значит выбраны "Все компании", фильтр не добавляем

    // Если выбраны локации, фильтруем по ним
    if (campaignLocationIds.length > 0) {
      companiesQuery += ` AND EXISTS (
        SELECT 1 
        FROM company_addresses ca
        JOIN marketing_locations ml ON ml.city = ca.city
        WHERE ca.company_id = c.id 
          AND ml.id = ANY($${paramIndex})
      )`
      params.push(campaignLocationIds)
      paramIndex++
    }

    companiesQuery += ' ORDER BY c.name_companies'

    const companiesResult = await dbPool.query(companiesQuery, params)

    res.json({
      companies: companiesResult.rows,
    })
  } catch (err) {
    console.error('Ошибка при получении получателей кампании:', err)
    res.status(500).json({ error: 'Ошибка при получении получателей кампании: ' + err.message })
  }
}

// Проверка дублирования
const checkDuplicate = (dbPool) => async (req, res) => {
  const { id } = req.params
  const { company_ids } = req.body

  try {
    const campaignResult = await dbPool.query(
      'SELECT blocking_period_days FROM marketing_campaigns WHERE id = $1',
      [id]
    )

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Кампания не найдена' })
    }

    const blockingPeriod = campaignResult.rows[0].blocking_period_days || 30

    const duplicateResult = await dbPool.query(
      `SELECT 
        c.id, c.name_companies as company_name,
        msl.sent_at
       FROM companies c
       JOIN marketing_send_log msl ON msl.company_id = c.id
       WHERE msl.campaign_id = $1 
         AND c.id = ANY($2)
         AND msl.status = 'sent'
         AND msl.sent_at > NOW() - INTERVAL '${blockingPeriod} days'
       ORDER BY msl.sent_at DESC`,
      [id, company_ids || []]
    )

    res.json({
      has_duplicates: duplicateResult.rows.length > 0,
      duplicates: duplicateResult.rows,
      blocking_period_days: blockingPeriod,
    })
  } catch (err) {
    console.error('Ошибка при проверке дублирования:', err)
    res.status(500).json({ error: 'Ошибка при проверке дублирования' })
  }
}

// ==================== СПРАВОЧНИКИ ====================

// Локации
const getLocations = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query('SELECT * FROM marketing_locations ORDER BY city')
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении локаций:', err)
    res.status(500).json({ error: 'Ошибка при получении локаций' })
  }
}

const createLocation = (dbPool) => async (req, res) => {
  const { city, region } = req.body

  if (!city || !city.trim()) {
    return res.status(400).json({ error: 'Город обязателен' })
  }

  try {
    const result = await dbPool.query(
      'INSERT INTO marketing_locations (city, region) VALUES ($1, $2) RETURNING *',
      [city.trim(), region || null]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Локация с таким городом уже существует' })
    } else {
      console.error('Ошибка при создании локации:', err)
      res.status(500).json({ error: 'Ошибка при создании локации' })
    }
  }
}

const deleteLocation = (dbPool) => async (req, res) => {
  const { id } = req.params

  try {
    const result = await dbPool.query('DELETE FROM marketing_locations WHERE id = $1 RETURNING *', [
      id,
    ])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Локация не найдена' })
    }

    res.json({ message: 'Локация удалена' })
  } catch (err) {
    console.error('Ошибка при удалении локации:', err)
    res.status(500).json({ error: 'Ошибка при удалении локации' })
  }
}

// Автоматическое создание локаций на основе городов из адресов компаний
const createLocationsFromCompanies = (dbPool) => async (req, res) => {
  try {
    // Получаем уникальные города и регионы из адресов компаний
    const citiesResult = await dbPool.query(
      `SELECT DISTINCT 
        ca.city, 
        ca.region
       FROM company_addresses ca
       WHERE ca.city IS NOT NULL AND ca.city != ''
       ORDER BY ca.city`
    )

    let created = 0
    let skipped = 0

    for (const row of citiesResult.rows) {
      try {
        // Пытаемся создать локацию, игнорируем если уже существует (UNIQUE constraint)
        await dbPool.query(
          'INSERT INTO marketing_locations (city, region) VALUES ($1, $2) ON CONFLICT (city) DO NOTHING',
          [row.city.trim(), row.region || null]
        )
        created++
      } catch (err) {
        if (err.code === '23505') {
          // Уже существует
          skipped++
        } else {
          throw err
        }
      }
    }

    res.json({
      message: `Создано локаций: ${created}, пропущено (уже существуют): ${skipped}`,
      created,
      skipped,
    })
  } catch (err) {
    console.error('Ошибка при создании локаций из адресов компаний:', err)
    res.status(500).json({ error: 'Ошибка при создании локаций' })
  }
}

// Теги
const getTags = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query('SELECT * FROM marketing_tags ORDER BY name')
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении тегов:', err)
    res.status(500).json({ error: 'Ошибка при получении тегов' })
  }
}

const createTag = (dbPool) => async (req, res) => {
  const { name, color } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Название тега обязательно' })
  }

  try {
    const result = await dbPool.query(
      'INSERT INTO marketing_tags (name, color) VALUES ($1, $2) RETURNING *',
      [name.trim(), color || '#667eea']
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Тег с таким названием уже существует' })
    } else {
      console.error('Ошибка при создании тега:', err)
      res.status(500).json({ error: 'Ошибка при создании тега' })
    }
  }
}

const deleteTag = (dbPool) => async (req, res) => {
  const { id } = req.params

  try {
    const result = await dbPool.query('DELETE FROM marketing_tags WHERE id = $1 RETURNING *', [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Тег не найден' })
    }

    res.json({ message: 'Тег удален' })
  } catch (err) {
    console.error('Ошибка при удалении тега:', err)
    res.status(500).json({ error: 'Ошибка при удалении тега' })
  }
}

// Дилеры (для выбора в форме)
// Получение компаний (дилерских компаний) для выбора в кампаниях
const getCompanies = (dbPool) => async (req, res) => {
  try {
    const { location_ids } = req.query
    let query = `
      SELECT DISTINCT ON (c.id)
        c.id,
        c.name_companies as name,
        c.name_companies as company_name,
        (SELECT ca.city FROM company_addresses ca WHERE ca.company_id = c.id AND ca.is_primary = true LIMIT 1) as location_city,
        (SELECT uct.chat_id FROM user_company_tg_bot uct WHERE uct.company_id = c.id LIMIT 1) as chat_id,
        CASE WHEN (SELECT uct.chat_id FROM user_company_tg_bot uct WHERE uct.company_id = c.id LIMIT 1) IS NOT NULL THEN true ELSE false END as has_telegram
      FROM companies c
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    if (location_ids) {
      const locationIdsArray = location_ids.split(',').map((id) => parseInt(id.trim()))
      if (locationIdsArray.length > 0) {
        query += ` AND EXISTS (
          SELECT 1 
          FROM company_addresses ca2
          JOIN marketing_locations ml ON ml.city = ca2.city
          WHERE ca2.company_id = c.id 
            AND ml.id = ANY($${paramIndex})
        )`
        params.push(locationIdsArray)
        paramIndex++
      }
    }

    query += ' ORDER BY c.id, c.name_companies'

    const result = await dbPool.query(query, params)
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении компаний:', err)
    res.status(500).json({ error: 'Ошибка при получении компаний' })
  }
}

// ==================== ЖУРНАЛ ОТПРАВОК ====================

const getSendLog = (dbPool) => async (req, res) => {
  try {
    const {
      campaign_id,
      company_id,
      status,
      send_type,
      date_from,
      date_to,
      limit = 100,
      offset = 0,
    } = req.query

    let query = `
      SELECT 
        msl.*,
        c.name as campaign_name,
        comp.name_companies as company_name,
        ca.city as location
      FROM marketing_send_log msl
      LEFT JOIN marketing_campaigns c ON c.id = msl.campaign_id
      LEFT JOIN companies comp ON comp.id = msl.company_id
      LEFT JOIN company_addresses ca ON ca.company_id = comp.id AND ca.is_primary = true
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    if (campaign_id) {
      query += ` AND msl.campaign_id = $${paramIndex}`
      params.push(campaign_id)
      paramIndex++
    }

    if (company_id) {
      query += ` AND msl.company_id = $${paramIndex}`
      params.push(company_id)
      paramIndex++
    }

    if (status) {
      query += ` AND msl.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (send_type) {
      query += ` AND msl.send_type = $${paramIndex}`
      params.push(send_type)
      paramIndex++
    }

    if (date_from) {
      query += ` AND msl.sent_at >= $${paramIndex}`
      params.push(date_from)
      paramIndex++
    }

    if (date_to) {
      query += ` AND msl.sent_at <= $${paramIndex}`
      params.push(date_to + ' 23:59:59')
      paramIndex++
    }

    query += ` ORDER BY msl.sent_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(parseInt(limit), parseInt(offset))

    const result = await dbPool.query(query, params)
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении журнала отправок:', err)
    res.status(500).json({ error: 'Ошибка при получении журнала отправок' })
  }
}

const exportSendLog = (dbPool) => async (req, res) => {
  try {
    const {
      campaign_id,
      company_id,
      status,
      send_type,
      date_from,
      date_to,
      format = 'csv',
    } = req.query

    let query = `
      SELECT 
        msl.sent_at,
        c.name as campaign_name,
        comp.name_companies as company_name,
        ca.city as location,
        msl.status,
        msl.send_type,
        msl.error_message
      FROM marketing_send_log msl
      LEFT JOIN marketing_campaigns c ON c.id = msl.campaign_id
      LEFT JOIN companies comp ON comp.id = msl.company_id
      LEFT JOIN company_addresses ca ON ca.company_id = comp.id AND ca.is_primary = true
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    if (campaign_id) {
      query += ` AND msl.campaign_id = $${paramIndex}`
      params.push(campaign_id)
      paramIndex++
    }

    if (company_id) {
      query += ` AND msl.company_id = $${paramIndex}`
      params.push(company_id)
      paramIndex++
    }

    if (status) {
      query += ` AND msl.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (send_type) {
      query += ` AND msl.send_type = $${paramIndex}`
      params.push(send_type)
      paramIndex++
    }

    if (date_from) {
      query += ` AND msl.sent_at >= $${paramIndex}`
      params.push(date_from)
      paramIndex++
    }

    if (date_to) {
      query += ` AND msl.sent_at <= $${paramIndex}`
      params.push(date_to + ' 23:59:59')
      paramIndex++
    }

    query += ' ORDER BY msl.sent_at DESC'

    const result = await dbPool.query(query, params)

    // Формируем заголовки
    const headers = [
      'Дата/время',
      'Кампания',
      'Компания',
      'Локация',
      'Статус',
      'Тип отправки',
      'Ошибка',
    ]

    // Подготовка данных
    const rows = result.rows.map((row) => {
      const statusText =
        row.status === 'sent'
          ? 'Отправлено'
          : row.status === 'error'
          ? 'Ошибка'
          : row.status === 'no_telegram'
          ? 'Нет ТГ'
          : row.status
      const sendTypeText =
        row.send_type === 'auto'
          ? 'Автоматическая'
          : row.send_type === 'manual'
          ? 'Ручная'
          : row.send_type
      return [
        row.sent_at || '',
        row.campaign_name || '',
        row.company_name || '',
        row.location || '',
        statusText,
        sendTypeText,
        row.error_message || '',
      ]
    })

    if (format === 'excel') {
      // Экспорт в Excel
      const xlsx = require('xlsx')
      const workbook = xlsx.utils.book_new()
      const worksheetData = [headers, ...rows]
      const worksheet = xlsx.utils.aoa_to_sheet(worksheetData)
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Журнал отправок')

      // Генерируем буфер
      const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader('Content-Disposition', 'attachment; filename=send-log.xlsx')
      res.send(excelBuffer)
    } else {
      // Экспорт в CSV
      const csvHeader = headers.join(',')
      const csvRows = rows.map((row) => {
        return row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',')
      })

      const csv = [csvHeader, ...csvRows].join('\n')

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename=send-log.csv')
      res.send('\ufeff' + csv) // BOM для правильной кодировки в Excel
    }
  } catch (err) {
    console.error('Ошибка при экспорте журнала:', err)
    res.status(500).json({ error: 'Ошибка при экспорте журнала' })
  }
}

// ==================== СТАТИСТИКА ====================

const getStatistics = (dbPool) => async (req, res) => {
  try {
    const { date_from, date_to } = req.query

    let dateFilter = ''
    const params = []
    let paramIndex = 1

    if (date_from && date_to) {
      dateFilter = `WHERE msl.sent_at >= $${paramIndex} AND msl.sent_at <= $${paramIndex + 1}`
      params.push(date_from, date_to + ' 23:59:59')
      paramIndex += 2
    } else if (date_from) {
      dateFilter = `WHERE msl.sent_at >= $${paramIndex}`
      params.push(date_from)
      paramIndex++
    } else if (date_to) {
      dateFilter = `WHERE msl.sent_at <= $${paramIndex}`
      params.push(date_to + ' 23:59:59')
      paramIndex++
    }

    // Общая статистика
    const totalStats = await dbPool.query(
      `SELECT 
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE status = 'sent') as total_success,
        COUNT(*) FILTER (WHERE status = 'error') as total_errors
       FROM marketing_send_log msl
       ${dateFilter}`,
      params
    )

    // По категориям
    const byCategory = await dbPool.query(
      `SELECT 
        c.category_id,
        cat.name as category_name,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE msl.status = 'sent') as success,
        COUNT(*) FILTER (WHERE msl.status = 'error') as errors
       FROM marketing_send_log msl
       JOIN marketing_campaigns c ON c.id = msl.campaign_id
       LEFT JOIN marketing_categories cat ON cat.id = c.category_id
       ${dateFilter}
       GROUP BY c.category_id, cat.name
       ORDER BY total DESC`,
      params
    )

    // По локациям
    const byLocation = await dbPool.query(
      `SELECT 
        ca.city as location_name,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE msl.status = 'sent') as success,
        COUNT(*) FILTER (WHERE msl.status = 'error') as errors
       FROM marketing_send_log msl
       JOIN companies comp ON comp.id = msl.company_id
       LEFT JOIN company_addresses ca ON ca.company_id = comp.id AND ca.is_primary = true
       ${dateFilter}
       GROUP BY ca.city
       ORDER BY total DESC`,
      params
    )

    // Активные кампании
    const activeCampaigns = await dbPool.query(
      `SELECT COUNT(*) as count 
       FROM marketing_campaigns 
       WHERE status = 'active'`
    )

    res.json({
      total_sent: parseInt(totalStats.rows[0].total_sent) || 0,
      total_success: parseInt(totalStats.rows[0].total_success) || 0,
      total_errors: parseInt(totalStats.rows[0].total_errors) || 0,
      active_campaigns: parseInt(activeCampaigns.rows[0].count) || 0,
      by_category: byCategory.rows.map((row) => ({
        category_id: row.category_id,
        category_name: row.category_name || 'Без категории',
        total: parseInt(row.total) || 0,
        success: parseInt(row.success) || 0,
        errors: parseInt(row.errors) || 0,
      })),
      by_location: byLocation.rows.map((row) => ({
        location_id: null,
        location_name: row.location_name || 'Все локации',
        total: parseInt(row.total) || 0,
        success: parseInt(row.success) || 0,
        errors: parseInt(row.errors) || 0,
      })),
    })
  } catch (err) {
    console.error('Ошибка при получении статистики:', err)
    res.status(500).json({ error: 'Ошибка при получении статистики' })
  }
}

// ==================== ПРАВА ДОСТУПА ====================

const getUserPermissions = (dbPool) => async (req, res) => {
  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ error: 'Не указан ID пользователя' })
  }

  try {
    const result = await dbPool.query(
      'SELECT * FROM marketing_editor_permissions WHERE user_id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      return res.json({
        user_id: parseInt(userId),
        can_edit: false,
      })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error('Ошибка при получении прав доступа:', err)
    res.status(500).json({ error: 'Ошибка при получении прав доступа' })
  }
}

const getAllPermissions = (dbPool) => async (req, res) => {
  try {
    const result = await dbPool.query(
      `SELECT mep.*, 
              u.first_name || ' ' || u.last_name || ' ' || COALESCE(u.middle_name, '') as user_name,
              u.email as user_email
       FROM marketing_editor_permissions mep
       JOIN users u ON u.id = mep.user_id
       ORDER BY mep.created_at DESC`
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Ошибка при получении всех прав доступа:', err)
    res.status(500).json({ error: 'Ошибка при получении всех прав доступа' })
  }
}

const setPermissions = (dbPool) => async (req, res) => {
  const { user_id, can_edit, created_by } = req.body

  if (!user_id) {
    return res.status(400).json({ error: 'Не указан ID пользователя' })
  }

  try {
    const result = await dbPool.query(
      `INSERT INTO marketing_editor_permissions (user_id, can_edit, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         can_edit = EXCLUDED.can_edit,
         updated_at = NOW()
       RETURNING *`,
      [user_id, can_edit || false, created_by || null]
    )

    res.json(result.rows[0])
  } catch (err) {
    console.error('Ошибка при установке прав доступа:', err)
    res.status(500).json({ error: 'Ошибка при установке прав доступа' })
  }
}

const deletePermissions = (dbPool) => async (req, res) => {
  const { id } = req.params

  try {
    const result = await dbPool.query(
      'DELETE FROM marketing_editor_permissions WHERE id = $1 RETURNING *',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Права доступа не найдены' })
    }

    res.json({ message: 'Права доступа удалены' })
  } catch (err) {
    console.error('Ошибка при удалении прав доступа:', err)
    res.status(500).json({ error: 'Ошибка при удалении прав доступа' })
  }
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  getCampaignRecipients,
  checkDuplicate,
  getLocations,
  createLocation,
  deleteLocation,
  createLocationsFromCompanies,
  getTags,
  createTag,
  deleteTag,
  getCompanies,
  getSendLog,
  exportSendLog,
  getStatistics,
  getUserPermissions,
  getAllPermissions,
  setPermissions,
  deletePermissions,
  upload,
}
