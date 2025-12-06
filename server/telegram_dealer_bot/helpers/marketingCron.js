// marketingCron.js
// CRON-задача для автоматической отправки маркетинговых кампаний

const dbPool = require('../database/db')
const { runWithTimeout } = require('./networkUtils')
const path = require('path')
const fs = require('fs')

// Инициализация CRON-задачи для маркетинга
function initMarketingCron(bot, cronManager) {
  console.log('[CRON][INIT] Инициализация планировщика автоматической отправки маркетинга...')

  const task = async () => {
    const timestamp = new Date().toISOString()
    console.log(
      `[CRON][MARKETING][${timestamp}] Старт автоматической отправки маркетинговых кампаний...`
    )

    const TASK_TIMEOUT = 10 * 60 * 1000 // 10 минут таймаут

    try {
      await runWithTimeout(
        async () => {
          console.log('[CRON][MARKETING] Обработка кампаний...')
          await processMarketingCampaigns(bot)
          console.log('[CRON][MARKETING] Обработка завершена')
        },
        TASK_TIMEOUT,
        'Marketing Campaigns'
      )
    } catch (error) {
      console.error(`[CRON][MARKETING][ERROR] ${error.message}`)
      console.error(error.stack)

      console.error(`[CRON][MARKETING][${timestamp}] Задача завершилась с ошибкой:`, {
        error: error.message,
        stack: error.stack,
        timestamp: timestamp,
      })

      throw error
    } finally {
      console.log(`[CRON][MARKETING][${timestamp}] Завершено`)
    }
  }

  if (cronManager) {
    return cronManager.addJob('marketing', '0 8 * * *', task) // Каждый день в 8:00
  } else {
    // Fallback к старому способу если CronManager не доступен
    const cron = require('node-cron')
    const job = cron.schedule('0 8 * * *', task, {
      scheduled: true,
      timezone: 'Europe/Saratov',
      recoverMissedExecutions: true,
    })

    job.on('error', (error) => {
      console.error('[CRON][MARKETING][CRON_ERROR] Ошибка в cron-задаче:', error)
    })

    return job
  }
}

// Обработка маркетинговых кампаний
async function processMarketingCampaigns(bot) {
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')

    // Получаем активные кампании на сегодня
    const campaignsResult = await client.query(
      `SELECT c.*
       FROM marketing_campaigns c
       WHERE c.status = 'active'
         AND c.auto_send = true
         AND (
           c.period_type = 'unlimited'
           OR (c.period_type = 'date' AND c.send_date = CURRENT_DATE)
           OR (c.period_type = 'period' AND CURRENT_DATE BETWEEN c.period_start::date AND c.period_end::date)
         )
       ORDER BY c.created_at`
    )

    const campaigns = campaignsResult.rows
    console.log(`[CRON][MARKETING] Найдено кампаний для обработки: ${campaigns.length}`)

    if (campaigns.length === 0) {
      console.log('[CRON][MARKETING] Нет активных кампаний для отправки')
      await client.query('COMMIT')
      return
    }

    let totalSent = 0
    let totalErrors = 0
    let totalSkipped = 0
    const errors = []
    const sentCompanies = []
    const skippedCompanies = []

    for (const campaign of campaigns) {
      try {
        console.log(`[CRON][MARKETING] Обработка кампании: "${campaign.name}" (ID: ${campaign.id})`)
        const result = await sendCampaignToCompanies(
          client,
          bot,
          campaign,
          sentCompanies,
          skippedCompanies
        )
        totalSent += result.sent
        totalErrors += result.errors
        totalSkipped += result.skipped

        if (result.errors > 0) {
          errors.push({
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            errors: result.errorDetails,
          })
        }
      } catch (error) {
        console.error(
          `[CRON][MARKETING] Ошибка при обработке кампании ${campaign.id}:`,
          error.message
        )
        totalErrors++
        errors.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          error: error.message,
        })
      }
    }

    await client.query('COMMIT')

    // Итоговый отчет
    console.log('='.repeat(80))
    console.log('[CRON][MARKETING] ===== ИТОГИ ОТПРАВКИ =====')
    console.log(`[CRON][MARKETING] Обработано кампаний: ${campaigns.length}`)
    console.log(`[CRON][MARKETING] Отправлено: ${totalSent}`)
    console.log(`[CRON][MARKETING] Пропущено: ${totalSkipped}`)
    console.log(`[CRON][MARKETING] Ошибок: ${totalErrors}`)

    if (sentCompanies.length > 0) {
      console.log(`[CRON][MARKETING] Отправлено компаниям (${sentCompanies.length}):`)
      sentCompanies.forEach((company, index) => {
        console.log(`[CRON][MARKETING]   ${index + 1}. ${company.name} (ID: ${company.id})`)
      })
    }

    if (skippedCompanies.length > 0) {
      console.log(`[CRON][MARKETING] Пропущено компаний (${skippedCompanies.length}):`)
      skippedCompanies.forEach((company, index) => {
        console.log(
          `[CRON][MARKETING]   ${index + 1}. ${company.name} (ID: ${company.id}) - ${
            company.reason
          }`
        )
      })
    }

    if (errors.length > 0) {
      console.log(`[CRON][MARKETING] Ошибки (${errors.length}):`)
      errors.forEach((error, index) => {
        console.log(
          `[CRON][MARKETING]   ${index + 1}. Кампания "${error.campaign_name}" (ID: ${
            error.campaign_id
          })`
        )
        if (error.errors) {
          error.errors.forEach((err) => {
            console.log(`[CRON][MARKETING]      - ${err.company_name}: ${err.error}`)
          })
        } else {
          console.log(`[CRON][MARKETING]      - ${error.error}`)
        }
      })
    }

    console.log('='.repeat(80))

    // TODO: Отправить отчет администраторам (можно через бот или записать в БД)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Отправка кампании дилерам
async function sendCampaignToCompanies(
  client,
  bot,
  campaign,
  sentCompanies = [],
  skippedCompanies = []
) {
  let sent = 0
  let errors = 0
  let skipped = 0
  const errorDetails = []

  // Получаем список компаний для отправки
  let companiesQuery = `
    SELECT DISTINCT 
      c.id as company_id,
      c.name_companies as company_name,
      uct.chat_id
    FROM companies c
    LEFT JOIN user_company_tg_bot uct ON uct.company_id = c.id
    WHERE uct.chat_id IS NOT NULL
  `
  const params = []
  let paramIndex = 1

  // Фильтр по локациям - проверяем все адреса компании, а не только primary
  const campaignLocationsResult = await client.query(
    'SELECT location_id FROM marketing_campaign_locations WHERE campaign_id = $1',
    [campaign.id]
  )
  const campaignLocationIds = campaignLocationsResult.rows.map((r) => r.location_id)

  // Фильтр по компаниям кампании
  const campaignCompaniesResult = await client.query(
    'SELECT company_id FROM marketing_campaign_companies WHERE campaign_id = $1',
    [campaign.id]
  )
  const campaignCompanyIds = campaignCompaniesResult.rows.map((r) => r.company_id)

  // Если выбраны локации, но не выбраны компании - не отправляем никому
  // (это должно быть проверено на клиенте, но для безопасности проверяем и здесь)
  if (campaignLocationIds.length > 0 && campaignCompanyIds.length === 0) {
    console.log(
      `[CRON][MARKETING] Кампания ${campaign.id}: выбраны локации, но не выбраны компании - пропускаем отправку`
    )
    return { sent: 0, errors: 0, skipped: 0, errorDetails: [] }
  }

  if (campaignCompanyIds.length > 0) {
    companiesQuery += ` AND c.id = ANY($${paramIndex})`
    params.push(campaignCompanyIds)
    paramIndex++
  }

  if (campaignLocationIds.length > 0) {
    // Если у кампании выбраны локации, отправляем только компаниям:
    // 1. Которые имеют адреса И хотя бы один адрес соответствует выбранным локациям
    // 2. Компании без адресов НЕ получат кампанию с выбранными локациями
    companiesQuery += ` AND EXISTS (
      SELECT 1 
      FROM company_addresses ca
      JOIN marketing_locations ml ON ml.city = ca.city
      WHERE ca.company_id = c.id 
        AND ml.id = ANY($${paramIndex})
    )`
    params.push(campaignLocationIds)
    paramIndex++
    // Примечание: компании без адресов автоматически исключаются из выборки,
    // так как EXISTS вернет false для них
  }
  // Если у кампании НЕ выбраны локации (campaignLocationIds.length === 0),
  // то все компании получат кампанию (включая компании без адресов)

  const companiesResult = await client.query(companiesQuery, params)
  const companies = companiesResult.rows

  console.log(`[CRON][MARKETING] Кампания ${campaign.id}: найдено ${companies.length} компаний`)

  // Отправляем каждой компании
  for (const company of companies) {
    try {
      // Проверка дублирования
      const blockingPeriod = campaign.blocking_period_days || 30
      const duplicateCheck = await client.query(
        `SELECT COUNT(*) as count 
         FROM marketing_send_log 
         WHERE campaign_id = $1 AND company_id = $2 AND status = 'sent'
         AND sent_at > NOW() - INTERVAL '${blockingPeriod} days'`,
        [campaign.id, company.company_id]
      )

      if (parseInt(duplicateCheck.rows[0].count) > 0) {
        skipped++
        const skipMessage = `Пропущено: кампания уже была отправлена в период блокировки (${blockingPeriod} дней)`

        console.log(
          `[CRON][MARKETING] ⚠ Пропуск: ${company.company_name} (ID: ${company.company_id}) - дублирование (отправлено в последние ${blockingPeriod} дней)`
        )

        skippedCompanies.push({
          id: company.company_id,
          name: company.company_name,
          reason: `Дублирование (отправлено в последние ${blockingPeriod} дней)`,
        })

        // Логируем пропуск
        await client.query(
          `INSERT INTO marketing_send_log (campaign_id, company_id, status, send_type, delivery_channel, error_message)
           VALUES ($1, $2, 'skipped', 'auto', 'telegram', $3)`,
          [campaign.id, company.company_id, skipMessage]
        )

        continue
      }

      // Формируем сообщение
      let message = `*${campaign.name}*\n\n`
      if (campaign.category_id) {
        const categoryResult = await client.query(
          'SELECT name, icon FROM marketing_categories WHERE id = $1',
          [campaign.category_id]
        )
        if (categoryResult.rows.length > 0) {
          const category = categoryResult.rows[0]
          message += `${category.icon || '📁'} ${category.name}\n\n`
        }
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

      // Контактное лицо
      if (campaign.show_contact_person && campaign.contact_person_id) {
        const contactResult = await client.query(
          "SELECT first_name || ' ' || last_name as name FROM users WHERE id = $1",
          [campaign.contact_person_id]
        )
        if (contactResult.rows.length > 0) {
          const contact = contactResult.rows[0]
          message += `\n\n📞 Контактное лицо: ${contact.name}`
        }
      }

      // Получаем изображения и вложения
      const imagesResult = await client.query(
        'SELECT * FROM marketing_campaign_images WHERE campaign_id = $1 ORDER BY display_order',
        [campaign.id]
      )
      const attachmentsResult = await client.query(
        'SELECT * FROM marketing_campaign_attachments WHERE campaign_id = $1 ORDER BY display_order',
        [campaign.id]
      )

      // Отправляем сообщение с изображениями и вложениями
      if (imagesResult.rows.length > 0) {
        // Проверяем существование всех файлов изображений
        const validImages = []
        for (const image of imagesResult.rows) {
          const imagePath = path.join(__dirname, '../../uploads/marketing/images', image.file_name)
          if (fs.existsSync(imagePath)) {
            validImages.push({
              path: imagePath,
              fileName: image.file_name,
            })
          } else {
            console.warn(`[CRON][MARKETING] Файл изображения не найден: ${imagePath}`)
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
              console.error(`[CRON][MARKETING] Ошибка при отправке изображения:`, sendError)
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
                  `[CRON][MARKETING] Ошибка при отправке медиа-группы:`,
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
                    console.error(`[CRON][MARKETING] Ошибка при fallback отправке:`, fallbackError)
                    await bot.sendMessage(company.chat_id, message, { parse_mode: 'Markdown' })
                  }
                } else {
                  // Для остальных групп отправляем по одному
                  for (const image of group) {
                    try {
                      await bot.sendPhoto(company.chat_id, fs.createReadStream(image.path))
                    } catch (singleError) {
                      console.error(
                        `[CRON][MARKETING] Ошибка при отправке изображения ${image.fileName}:`,
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
              const { sanitizeFilename } = require('../helpers/fileUtils')
              displayName = sanitizeFilename(displayName)

              await bot.sendDocument(company.chat_id, fs.createReadStream(attachmentPath), {
                filename: displayName,
                caption: displayName,
              })
              // Небольшая задержка между отправками файлов
              await new Promise((resolve) => setTimeout(resolve, 100))
            } else {
              console.warn(`[CRON][MARKETING] Файл вложения не найден: ${attachmentPath}`)
            }
          } catch (attachmentError) {
            console.error(
              `[CRON][MARKETING] Ошибка при отправке вложения ${attachment.file_name}:`,
              attachmentError
            )
            // Продолжаем отправку остальных файлов
          }
        }
      }

      // Логируем успешную отправку
      await client.query(
        `INSERT INTO marketing_send_log (campaign_id, company_id, status, send_type, delivery_channel)
         VALUES ($1, $2, 'sent', 'auto', 'telegram')`,
        [campaign.id, company.company_id]
      )

      sent++
      console.log(
        `[CRON][MARKETING] ✓ Отправлено: ${company.company_name} (ID: ${company.company_id})`
      )

      sentCompanies.push({
        id: company.company_id,
        name: company.company_name,
      })

      // Задержка между отправками (100ms)
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (error) {
      errors++
      errorDetails.push({
        company_id: company.company_id,
        company_name: company.company_name,
        error: error.message,
      })

      console.error(
        `[CRON][MARKETING] ✗ Ошибка отправки: ${company.company_name} (ID: ${company.company_id}) - ${error.message}`
      )

      // Логируем ошибку
      await client.query(
        `INSERT INTO marketing_send_log (campaign_id, company_id, status, send_type, delivery_channel, error_message)
         VALUES ($1, $2, 'error', 'auto', 'telegram', $3)`,
        [campaign.id, company.company_id, error.message]
      )
    }
  }

  return { sent, errors, skipped, errorDetails }
}

module.exports = {
  initMarketingCron,
  processMarketingCampaigns,
}
