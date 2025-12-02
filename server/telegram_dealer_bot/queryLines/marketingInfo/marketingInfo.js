// marketingInfo.js
// Обработчик команд для маркетинговой информации в Telegram-боте

const dbPool = require('../../database/db')
const path = require('path')
const fs = require('fs')

// Главное меню маркетинговой информации
async function showMarketingMenu(bot, chatId, userSessions) {
  try {
    // Получаем company_id для фильтрации
    const companyResult = await dbPool.query(
      'SELECT company_id FROM user_company_tg_bot WHERE chat_id = $1',
      [chatId]
    )

    if (companyResult.rows.length === 0) {
      await bot.sendMessage(chatId, '❌ Компания не найдена')
      return
    }

    const companyId = companyResult.rows[0].company_id

    // Получаем все города компании из адресов
    const locationResult = await dbPool.query(
      `SELECT DISTINCT ca.city 
       FROM company_addresses ca 
       WHERE ca.company_id = $1`,
      [companyId]
    )
    const companyCities = locationResult.rows.map((r) => r.city)

    // Получаем категории, в которых есть доступные кампании для этой компании
    // Кампания доступна, если:
    // 1. Активна по статусу
    // 2. Активна по периоду
    // 3. Либо не имеет выбранных компаний (для всех), либо выбрана для текущей компании
    // 4. Либо не имеет выбранных локаций, либо выбрана для локации компании (проверяем все адреса)
    let categoriesQuery = `
      SELECT DISTINCT cat.*
      FROM marketing_categories cat
      JOIN marketing_campaigns c ON c.category_id = cat.id
      WHERE c.status = 'active'
        AND (
          c.period_type = 'unlimited'
          OR (c.period_type = 'date' AND c.send_date = CURRENT_DATE)
          OR (c.period_type = 'period' AND CURRENT_DATE BETWEEN c.period_start::date AND c.period_end::date)
        )
        AND (
          c.id NOT IN (SELECT campaign_id FROM marketing_campaign_companies)
          OR c.id IN (SELECT campaign_id FROM marketing_campaign_companies WHERE company_id = $1)
        )
    `
    const categoriesParams = [companyId]

    // Фильтр по локации - проверяем все адреса компании
    if (companyCities.length > 0) {
      // Получаем ID локаций для всех городов компании
      const locationIdsResult = await dbPool.query(
        'SELECT id FROM marketing_locations WHERE city = ANY($1)',
        [companyCities]
      )
      const companyLocationIds = locationIdsResult.rows.map((r) => r.id)

      if (companyLocationIds.length > 0) {
        categoriesQuery += ` AND (
          c.id NOT IN (SELECT campaign_id FROM marketing_campaign_locations)
          OR c.id IN (SELECT campaign_id FROM marketing_campaign_locations WHERE location_id = ANY($2))
        )`
        categoriesParams.push(companyLocationIds)
      } else {
        // Если ни один город компании не найден в справочнике локаций,
        // показываем только кампании без фильтра по локациям
        categoriesQuery += ` AND c.id NOT IN (SELECT campaign_id FROM marketing_campaign_locations)`
      }
    } else {
      // Если у компании нет адресов, показываем только кампании без фильтра по локациям
      categoriesQuery += ` AND c.id NOT IN (SELECT campaign_id FROM marketing_campaign_locations)`
    }

    categoriesQuery += ' ORDER BY cat.display_order, cat.name'

    const categoriesResult = await dbPool.query(categoriesQuery, categoriesParams)

    if (categoriesResult.rows.length === 0) {
      await bot.sendMessage(chatId, '📭 Нет доступной информации')
      return
    }

    const keyboard = {
      inline_keyboard: [
        ...categoriesResult.rows.map((category) => [
          {
            text: `${category.icon || '📁'} ${category.name}`,
            callback_data: `marketing_category_${category.id}`,
          },
        ]),
        [
          {
            text: '🔙 Назад',
            callback_data: 'back_to_help_menu',
          },
        ],
      ],
    }

    // Инициализация userSessions[chatId]
    if (!userSessions) {
      userSessions = {}
    }
    userSessions[chatId] = userSessions[chatId] || {}

    // Удаляем предыдущее сообщение меню, если оно есть
    if (userSessions[chatId].marketingMenuMessageId) {
      try {
        await bot.deleteMessage(chatId, userSessions[chatId].marketingMenuMessageId)
      } catch (error) {
        console.error(`Не удалось удалить предыдущее сообщение меню: ${error.message}`)
      }
    }

    const message = await bot.sendMessage(chatId, '📋 Выберите категорию:', {
      reply_markup: keyboard,
    })

    // Сохраняем ID сообщения для последующего удаления
    userSessions[chatId].marketingMenuMessageId = message.message_id
  } catch (error) {
    console.error('Ошибка при показе меню маркетинга:', error)
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке информации')
  }
}

// Показ кампаний категории
async function showCategoryCampaigns(bot, chatId, categoryId, page = 0, userSessions) {
  try {
    const pageSize = 5
    const offset = page * pageSize

    // Получаем активные кампании категории для данного дилера
    const companyResult = await dbPool.query(
      'SELECT company_id FROM user_company_tg_bot WHERE chat_id = $1',
      [chatId]
    )

    if (companyResult.rows.length === 0) {
      await bot.sendMessage(chatId, '❌ Компания не найдена')
      return
    }

    const companyId = companyResult.rows[0].company_id

    // Получаем все города компании из адресов
    const locationResult = await dbPool.query(
      `SELECT DISTINCT ca.city 
       FROM company_addresses ca 
       WHERE ca.company_id = $1`,
      [companyId]
    )
    const companyCities = locationResult.rows.map((r) => r.city)

    // Запрос кампаний
    let query = `
      SELECT DISTINCT c.*
      FROM marketing_campaigns c
      WHERE c.status = 'active'
        AND c.category_id = $1
        AND (
          c.period_type = 'unlimited'
          OR (c.period_type = 'date' AND c.send_date = CURRENT_DATE)
          OR (c.period_type = 'period' AND CURRENT_DATE BETWEEN c.period_start::date AND c.period_end::date)
        )
    `
    const params = [categoryId]
    let paramIndex = 2

    // Фильтр по компаниям
    // Кампания показывается, если:
    // 1. Она выбрана "для всех" (нет записей в marketing_campaign_companies) - показывается всем
    // 2. ИЛИ она выбрана для конкретных компаний И текущая компания в списке выбранных
    query += ` AND (
      c.id NOT IN (SELECT campaign_id FROM marketing_campaign_companies) 
      OR c.id IN (SELECT campaign_id FROM marketing_campaign_companies WHERE company_id = $${paramIndex})
    )`
    params.push(companyId)
    paramIndex++

    // Фильтр по локации - проверяем все адреса компании
    if (companyCities.length > 0) {
      // Получаем ID локаций для всех городов компании
      const locationIdsResult = await dbPool.query(
        'SELECT id FROM marketing_locations WHERE city = ANY($1)',
        [companyCities]
      )
      const companyLocationIds = locationIdsResult.rows.map((r) => r.id)

      if (companyLocationIds.length > 0) {
        query += ` AND (
          c.id NOT IN (SELECT campaign_id FROM marketing_campaign_locations)
          OR c.id IN (SELECT campaign_id FROM marketing_campaign_locations WHERE location_id = ANY($${paramIndex}))
        )`
        params.push(companyLocationIds)
        paramIndex++
      } else {
        // Если ни один город компании не найден в справочнике локаций,
        // показываем только кампании без фильтра по локациям
        query += ` AND c.id NOT IN (SELECT campaign_id FROM marketing_campaign_locations)`
      }
    } else {
      // Если у компании нет адресов, показываем только кампании без фильтра по локациям
      query += ` AND c.id NOT IN (SELECT campaign_id FROM marketing_campaign_locations)`
    }

    // Сохраняем запрос для подсчета общего количества (без LIMIT и OFFSET)
    const countQuery = query
    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(pageSize, offset)

    // Логируем запрос для отладки
    console.log('[MARKETING] Запрос кампаний:', query)
    console.log('[MARKETING] Параметры:', params)

    const campaignsResult = await dbPool.query(query, params)
    const campaigns = campaignsResult.rows

    console.log('[MARKETING] Найдено кампаний:', campaigns.length)

    if (campaigns.length === 0) {
      await bot.sendMessage(chatId, '📭 Нет доступных кампаний в этой категории')
      return
    }

    // Формируем клавиатуру
    const keyboard = {
      inline_keyboard: campaigns.map((campaign) => [
        {
          text: campaign.name,
          callback_data: `marketing_campaign_${campaign.id}`,
        },
      ]),
    }

    // Кнопки навигации
    const navButtons = []
    if (page > 0) {
      navButtons.push({
        text: '◀️ Назад',
        callback_data: `marketing_category_${categoryId}_page_${page - 1}`,
      })
    }

    // Проверяем, есть ли еще страницы
    // Используем сохраненный запрос без LIMIT и OFFSET, но с теми же параметрами (кроме последних двух)
    const countParams = params.slice(0, -2)
    const totalResult = await dbPool.query(countQuery + ' ORDER BY c.created_at DESC', countParams)
    const total = totalResult.rows.length

    if (offset + campaigns.length < total) {
      navButtons.push({
        text: 'Вперед ▶️',
        callback_data: `marketing_category_${categoryId}_page_${page + 1}`,
      })
    }

    if (navButtons.length > 0) {
      keyboard.inline_keyboard.push(navButtons)
    }

    // Кнопка "Назад к категориям"
    keyboard.inline_keyboard.push([
      {
        text: '🔙 К категориям',
        callback_data: 'marketing_info',
      },
    ])

    // Инициализация userSessions[chatId]
    if (!userSessions) {
      userSessions = {}
    }
    userSessions[chatId] = userSessions[chatId] || {}

    // Удаляем предыдущее сообщение меню, если оно есть
    if (userSessions[chatId].marketingMenuMessageId) {
      try {
        await bot.deleteMessage(chatId, userSessions[chatId].marketingMenuMessageId)
      } catch (error) {
        console.error(`Не удалось удалить предыдущее сообщение меню: ${error.message}`)
      }
    }

    const message = await bot.sendMessage(chatId, `📋 Кампании (страница ${page + 1}):`, {
      reply_markup: keyboard,
    })

    // Сохраняем ID сообщения для последующего удаления
    userSessions[chatId].marketingMenuMessageId = message.message_id
  } catch (error) {
    console.error('Ошибка при показе кампаний категории:', error)
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке кампаний')
  }
}

// Показ деталей кампании
async function showCampaignDetails(bot, chatId, campaignId, userSessions) {
  try {
    const client = await dbPool.connect()
    try {
      // Получаем кампанию
      const campaignResult = await client.query(
        `SELECT c.*, cat.name as category_name, cat.icon as category_icon,
                u.first_name || ' ' || u.last_name as contact_person_name,
                u.email as contact_person_email
         FROM marketing_campaigns c
         LEFT JOIN marketing_categories cat ON cat.id = c.category_id
         LEFT JOIN users u ON u.id = c.contact_person_id AND c.show_contact_person = true
         WHERE c.id = $1 AND c.status = 'active'`,
        [campaignId]
      )

      if (campaignResult.rows.length === 0) {
        await bot.sendMessage(chatId, '❌ Кампания не найдена')
        return
      }

      const campaign = campaignResult.rows[0]

      // Формируем сообщение
      let message = `*${campaign.name}*\n\n`

      if (campaign.category_name) {
        message += `${campaign.category_icon || '📁'} ${campaign.category_name}\n\n`
      }

      // Конвертируем HTML контент для Telegram
      // Telegram Markdown поддерживает: *bold*, _italic_, `code`, [link](url)
      // Сохраняем переносы строк и форматирование
      let content = campaign.content || ''

      // Сначала обрабатываем специальные случаи
      // Заменяем пустые параграфы на перенос строки
      content = content.replace(/<p>\s*<\/p>/gi, '\n')

      // Конвертируем HTML теги в переносы строк и форматирование
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

      if (campaign.contact_person_name && campaign.show_contact_person) {
        message += `\n\n📞 Контактное лицо: ${campaign.contact_person_name}`
      }

      // Получаем изображения
      const imagesResult = await client.query(
        'SELECT * FROM marketing_campaign_images WHERE campaign_id = $1 ORDER BY display_order',
        [campaignId]
      )

      // Получаем вложения
      const attachmentsResult = await client.query(
        'SELECT * FROM marketing_campaign_attachments WHERE campaign_id = $1 ORDER BY display_order',
        [campaignId]
      )

      // Отправляем сообщение
      if (imagesResult.rows.length > 0) {
        // Проверяем существование всех файлов изображений
        const validImages = []
        for (const image of imagesResult.rows) {
          const imagePath = path.join(
            __dirname,
            '../../../uploads/marketing/images',
            image.file_name
          )
          if (fs.existsSync(imagePath)) {
            validImages.push({
              path: imagePath,
              fileName: image.file_name,
            })
          } else {
            console.warn(`[MARKETING][INFO] Файл изображения не найден: ${imagePath}`)
          }
        }

        if (validImages.length > 0) {
          // Если одно изображение - отправляем с caption
          if (validImages.length === 1) {
            try {
              await bot.sendPhoto(chatId, fs.createReadStream(validImages[0].path), {
                caption: message,
                parse_mode: 'Markdown',
              })
            } catch (sendError) {
              console.error(`[MARKETING][INFO] Ошибка при отправке изображения:`, sendError)
              // Если ошибка, отправляем только текст
              await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
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

                await bot.sendMediaGroup(chatId, mediaGroup)
              } catch (mediaGroupError) {
                console.error(
                  `[MARKETING][INFO] Ошибка при отправке медиа-группы:`,
                  mediaGroupError
                )
                // Если ошибка с медиа-группой, пробуем отправить по одному
                if (groupIndex === 0) {
                  // Первое изображение с текстом
                  try {
                    await bot.sendPhoto(chatId, fs.createReadStream(group[0].path), {
                      caption: message,
                      parse_mode: 'Markdown',
                    })
                    // Остальные без текста
                    for (let i = 1; i < group.length; i++) {
                      await bot.sendPhoto(chatId, fs.createReadStream(group[i].path))
                    }
                  } catch (fallbackError) {
                    console.error(`[MARKETING][INFO] Ошибка при fallback отправке:`, fallbackError)
                    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
                  }
                } else {
                  // Для остальных групп отправляем по одному
                  for (const image of group) {
                    try {
                      await bot.sendPhoto(chatId, fs.createReadStream(image.path))
                    } catch (singleError) {
                      console.error(
                        `[MARKETING][INFO] Ошибка при отправке изображения ${image.fileName}:`,
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
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
        }
      } else {
        // Если нет изображений, отправляем только текст
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
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
              '../../../uploads/marketing/attachments',
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
              const { sanitizeFilename } = require('../../helpers/fileUtils')
              displayName = sanitizeFilename(displayName)

              await bot.sendDocument(chatId, fs.createReadStream(attachmentPath), {
                filename: displayName,
                caption: displayName,
              })
              // Небольшая задержка между отправками файлов
              await new Promise((resolve) => setTimeout(resolve, 100))
            } else {
              console.warn(`[MARKETING][INFO] Файл вложения не найден: ${attachmentPath}`)
            }
          } catch (attachmentError) {
            console.error(
              `[MARKETING][INFO] Ошибка при отправке вложения ${attachment.file_name}:`,
              attachmentError
            )
            // Продолжаем отправку остальных файлов
          }
        }
      }

      // Кнопка "Назад"
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '🔙 Назад',
              callback_data: `marketing_category_${campaign.category_id}`,
            },
          ],
        ],
      }

      // Инициализация userSessions[chatId]
      if (!userSessions) {
        userSessions = {}
      }
      userSessions[chatId] = userSessions[chatId] || {}

      // Удаляем предыдущее сообщение меню, если оно есть
      if (userSessions[chatId].marketingMenuMessageId) {
        try {
          await bot.deleteMessage(chatId, userSessions[chatId].marketingMenuMessageId)
        } catch (error) {
          console.error(`Не удалось удалить предыдущее сообщение меню: ${error.message}`)
        }
      }

      const actionMessage = await bot.sendMessage(chatId, 'Выберите действие:', {
        reply_markup: keyboard,
      })

      // Сохраняем ID сообщения для последующего удаления
      userSessions[chatId].marketingMenuMessageId = actionMessage.message_id
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Ошибка при показе деталей кампании:', error)
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке информации о кампании')
  }
}

// Обработка callback запросов
async function handleMarketingCallback(bot, chatId, callbackData, userSessions) {
  if (callbackData === 'marketing_info') {
    await showMarketingMenu(bot, chatId, userSessions)
  } else if (callbackData.startsWith('marketing_category_')) {
    const parts = callbackData.split('_')
    if (parts.length === 3) {
      const categoryId = parseInt(parts[2])
      await showCategoryCampaigns(bot, chatId, categoryId, 0, userSessions)
    } else if (parts.length === 5 && parts[3] === 'page') {
      const categoryId = parseInt(parts[2])
      const page = parseInt(parts[4])
      await showCategoryCampaigns(bot, chatId, categoryId, page, userSessions)
    }
  } else if (callbackData.startsWith('marketing_campaign_')) {
    const campaignId = parseInt(callbackData.replace('marketing_campaign_', ''))
    await showCampaignDetails(bot, chatId, campaignId, userSessions)
  }
}

module.exports = {
  showMarketingMenu,
  showCategoryCampaigns,
  showCampaignDetails,
  handleMarketingCallback,
}
