// companyRoutes.js
const express = require('express')
const router = express.Router()

module.exports = (pool) => {
  // Получить все компании
  router.get('/companies/list', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM companies')
      res.json(result.rows)
    } catch (error) {
      console.error('Ошибка при получении компаний:', error)
      res.status(500).send('Ошибка сервера')
    }
  })
  // Получить все компании для карточки дилера
  router.get('/companies', async (req, res) => {
    try {
      const result = await pool.query(`
    SELECT 
    c.id AS company_id, 
    c.inn AS inn,
    u1.id AS regional_manager_id, 
    u2.id AS mpp_id, 
    u3.id AS mpr_id, 
    ARRAY_AGG(DISTINCT u4.id) AS replacing_mpr_ids,
    ARRAY_AGG(DISTINCT u5.id) AS replacing_mpp_ids,
      jsonb_agg(DISTINCT jsonb_build_object(  -- Используем jsonb_agg вместо ARRAY_AGG
        'mpp_id', u5.id,
        'priority_level', p.priority_level::TEXT
    )) AS mpp_priorities,
    c.name_companies AS company_name, 
    c.status_companies AS company_status, 
    c.seller_code AS seller_code, 
    c.trade_brand AS trade_brand,
    CONCAT(u1.last_name, ' ', u1.first_name, ' ', u1.middle_name) AS regional_manager_name,
    CONCAT(u2.last_name, ' ', u2.first_name, ' ', u2.middle_name) AS mpp_name,
    CONCAT(u3.last_name, ' ', u3.first_name, ' ', u3.middle_name) AS mpr_name,
    STRING_AGG(DISTINCT CONCAT(u4.last_name, ' ', u4.first_name, ' ', u4.middle_name), ', ') AS replacing_mpr_name,
    STRING_AGG(DISTINCT CONCAT(u5.last_name, ' ', u5.first_name, ' ', u5.middle_name), ', ') AS replacing_mpp_name,
    c.has_availability AS has_availability, 
    c.has_warehouse AS has_warehouse, 
    c.document_transfer_department AS document_transfer_department, 
    c.is_self_service AS is_self_service, 
    c.created_at AS created_at, 
    c.updated_at AS updated_at, 
    STRING_AGG(DISTINCT ca.region || ', ' || ca.city || ', ' || ca.street || ' ' || ca.building || CASE WHEN ca.is_primary THEN ' (Основной)' ELSE '' END, ', ') AS address,
    STRING_AGG(DISTINCT id.date_name || ': ' || id.event_date, ', ') AS important_dates,
    STRING_AGG(DISTINCT nm.method_name, ', ') AS notification_methods,
    STRING_AGG(DISTINCT dt.term_name || CASE WHEN dt.term_comment IS NOT NULL THEN ': ' || dt.term_comment ELSE '' END, ', ') AS delivery_terms,
    STRING_AGG(DISTINCT sn.network_name || CASE WHEN sn.comment IS NOT NULL THEN ': ' || sn.comment ELSE '' END, ', ') AS social_networks,
    STRING_AGG(DISTINCT CASE WHEN fr.is_paid THEN 'Платно' ELSE 'Бесплатно' END || CASE WHEN fr.comment IS NOT NULL THEN ': ' || fr.comment ELSE '' END, ', ') AS floor_rising_status,
    STRING_AGG(DISTINCT ra.activity_name, ', ') AS activity_name,
    STRING_AGG(DISTINCT ct.contract_name, ', ') AS contract_name,
    STRING_AGG(DISTINCT ci.industry_name, ', ') AS industry_name,
    STRING_AGG(DISTINCT pn.phone_number, ', ') AS phone_number,
    STRING_AGG(DISTINCT ec.email, ', ') AS email,
    CASE 
        WHEN SUM(CASE WHEN dc.has_representation THEN 1 ELSE 0 END) > 0 THEN TRUE
        ELSE FALSE
    END AS has_representation,
    
    STRING_AGG(DISTINCT comp.name || ' (' || COALESCE(comp.industry, 'Не указано') || '): ' || COALESCE(comp.contact_email, 'Не указано'), ', ') AS competitors,
    
    ARRAY_AGG(DISTINCT jsonb_build_object(
        'name', comp.name,
        'industry', comp.industry,
        'contact_email', comp.contact_email,
        'has_representation', dc.has_representation
    )) AS competitors_json,

    ARRAY_AGG(DISTINCT jsonb_build_object(
        'region', ca.region, 
        'city', ca.city, 
        'street', ca.street, 
        'building', ca.building,
        'is_primary', ca.is_primary,
        'comment', ca.comment
    )) AS addresses,

    ARRAY_AGG(DISTINCT jsonb_build_object(
        'term_name', dt.term_name,
        'term_comment', dt.term_comment
    )) AS delivery_terms_json, -- Добавлено новое поле для условий доставки в формате JSON

    ARRAY_AGG(DISTINCT jsonb_build_object(
        'network_name', sn.network_name,
        'comment', sn.comment
    )) AS social_networks_json -- Добавлено новое поле для социальных сетей в формате JSON

FROM companies c
LEFT JOIN users u1 ON u1.id = c.regional_manager_id
LEFT JOIN users u2 ON u2.id = c.mpp_id
LEFT JOIN users u3 ON u3.id = c.mpr_id
LEFT JOIN replacing_mpr rmpr ON rmpr.company_id = c.id
LEFT JOIN users u4 ON u4.id = rmpr.user_id
LEFT JOIN replacing_mpp rmpp ON rmpp.company_id = c.id
LEFT JOIN users u5 ON u5.id = rmpp.user_id
LEFT JOIN mpp_priority p ON p.company_id = c.id AND p.replacing_mpp_id = rmpp.id -- JOIN с таблицей приоритетов
LEFT JOIN company_addresses ca ON ca.company_id = c.id
LEFT JOIN important_dates id ON id.company_id = c.id
LEFT JOIN notification_methods nm ON nm.company_id = c.id
LEFT JOIN delivery_terms dt ON dt.company_id = c.id
LEFT JOIN social_networks sn ON sn.company_id = c.id
LEFT JOIN floor_rising fr ON fr.company_id = c.id
LEFT JOIN related_activities ra ON ra.company_id = c.id
LEFT JOIN contracts ct ON ct.company_id = c.id
LEFT JOIN company_industries ci ON ci.company_id = c.id
LEFT JOIN phone_numbers_companies pn ON pn.company_id = c.id
LEFT JOIN emails_companies ec ON ec.company_id = c.id
LEFT JOIN dealer_competitors dc ON dc.company_id = c.id
LEFT JOIN competitors comp ON comp.id = dc.competitor_id
GROUP BY 
    c.id, 
    c.inn,
    u1.id, 
    u2.id, 
    u3.id, 
    u1.last_name, 
    u1.first_name, 
    u1.middle_name, 
    u2.last_name, 
    u2.first_name, 
    u2.middle_name, 
    u3.last_name, 
    u3.first_name, 
    u3.middle_name  
    ORDER BY c.id; 
    `)
      res.json(result.rows)
    } catch (error) {
      console.error('Ошибка при получении компаний:', error)
      res.status(500).send('Ошибка сервера')
    }
  })

  // Создание компании
  router.post('/companies', async (req, res) => {
    const {
      name_companies,
      status_companies,
      seller_code,
      inn,
      trade_brand,
      regional_manager_id,
      mpp_id,
      mpr_id,
      has_availability,
      has_warehouse,
      document_transfer_department,
      is_self_service,
      industries,
      phoneNumbers,
      emails,
      relatedActivities,
      contracts,
      socialNetworks,
      deliveryTerms,
      notificationMethods,
      importantDates,
      floorRising,
      addresses,
      competitors,
      replacing_mpr,
      replacing_mpp,
      userId,
    } = req.body
    console.log('Создание компании от пользователя с ID:', userId)

    try {
      // Начало транзакции
      await pool.query('BEGIN')

      // Вставка в таблицу компаний
      const companyResult = await pool.query(
        `INSERT INTO companies (name_companies, status_companies, seller_code, inn, trade_brand,
            regional_manager_id, mpp_id, mpr_id, has_availability, has_warehouse,
            document_transfer_department, is_self_service)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          name_companies,
          status_companies || 'активный',
          seller_code || null,
          inn || null,
          trade_brand || null,
          regional_manager_id || null,
          mpp_id || null,
          mpr_id || null,
          has_availability || null,
          has_warehouse || null,
          document_transfer_department || null,
          is_self_service || null,
        ]
      )

      const companyId = companyResult.rows[0].id

      // Добавление замещающих МПР
      if (Array.isArray(replacing_mpr) && replacing_mpr.length) {
        for (const mpr of replacing_mpr) {
          if (mpr.user_id) {
            await pool.query(
              `INSERT INTO replacing_mpr (company_id, user_id)
                VALUES ($1, $2)`,
              [companyId, mpr.user_id]
            )
          }
        }
      }

      // Добавление замещающих МПП Правильная логика
      if (Array.isArray(replacing_mpp) && replacing_mpp.length) {
        const replacingMppIds = [] // Массив для новых идентификаторов

        for (const mpp of replacing_mpp) {
          if (mpp.user_id) {
            const result = await pool.query(
              `INSERT INTO replacing_mpp (company_id, user_id)
          VALUES ($1, $2) RETURNING id`, // Получаем id вставленной записи
              [companyId, mpp.user_id]
            )
            replacingMppIds.push(result.rows[0].id) // Сохраняем id
          }
        }

        // Теперь добавляем записи в mpp_priority с использованием полученных id
        for (let i = 0; i < replacing_mpp.length; i++) {
          if (replacing_mpp[i].user_id) {
            await pool.query(
              `INSERT INTO mpp_priority (company_id, replacing_mpp_id, priority_level)
          VALUES ($1, $2, $3)`,
              [companyId, replacingMppIds[i], replacing_mpp[i].priority_level] // Используем соответствующий id
            )
          }
        }
      }

      // Телефоны
      if (Array.isArray(phoneNumbers) && phoneNumbers.length) {
        for (const phoneNumber of phoneNumbers) {
          if (phoneNumber) {
            // Проверка на undefined или null
            await pool.query(
              `INSERT INTO phone_numbers_companies (company_id, phone_number)
                        VALUES ($1, $2)`,
              [companyId, phoneNumber]
            )
          }
        }
      }

      // Электронные письма
      if (Array.isArray(emails) && emails.length) {
        for (const email of emails) {
          if (email) {
            // Проверка на undefined или null
            await pool.query(
              `INSERT INTO emails_companies (company_id, email)
                        VALUES ($1, $2)`,
              [companyId, email]
            )
          }
        }
      }

      // Отрасли компании
      if (Array.isArray(industries) && industries.length) {
        for (const industry of industries) {
          if (industry) {
            // Проверка на undefined или null
            await pool.query(
              `INSERT INTO company_industries (company_id, industry_name)
                        VALUES ($1, $2)`,
              [companyId, industry]
            )
          }
        }
      }

      // Сопутствующая деятельность
      if (Array.isArray(relatedActivities) && relatedActivities.length) {
        for (const activity of relatedActivities) {
          if (activity) {
            // Проверка на undefined или null
            await pool.query(
              `INSERT INTO related_activities (company_id, activity_name)
                        VALUES ($1, $2)`,
              [companyId, activity]
            )
          }
        }
      }

      // Договоры компании
      if (Array.isArray(contracts) && contracts.length) {
        for (const contract of contracts) {
          if (contract) {
            // Проверка на undefined или null
            await pool.query(
              `INSERT INTO contracts (company_id, contract_name)
                        VALUES ($1, $2)`,
              [companyId, contract]
            )
          }
        }
      }

      // Социальные сети
      if (Array.isArray(socialNetworks) && socialNetworks.length) {
        for (const network of socialNetworks) {
          if (network.network_name) {
            // Проверка на undefined или null
            await pool.query(
              `INSERT INTO social_networks (company_id, network_name, comment)
                        VALUES ($1, $2, $3)`,
              [companyId, network.network_name || null, network.comment || null]
            )
          }
        }
      }

      // Условия доставки
      if (Array.isArray(deliveryTerms) && deliveryTerms.length) {
        for (const term of deliveryTerms) {
          if (term.term_name) {
            // Проверка на undefined или null
            await pool.query(
              `INSERT INTO delivery_terms (company_id, term_name, term_comment)
                        VALUES ($1, $2, $3)`,
              [companyId, term.term_name || null, term.term_comment || null]
            )
          }
        }
      }

      // Методы оповещения
      if (Array.isArray(notificationMethods) && notificationMethods.length) {
        for (const method of notificationMethods) {
          if (method) {
            // Проверка на undefined или null
            await pool.query(
              `INSERT INTO notification_methods (company_id, method_name)
                        VALUES ($1, $2)`,
              [companyId, method || null]
            )
          }
        }
      }

      // Значимые даты
      if (Array.isArray(importantDates) && importantDates.length) {
        for (const date of importantDates) {
          if (date.date_name) {
            // Проверка на undefined или null
            await pool.query(
              `INSERT INTO important_dates (company_id, date_name, event_date)
                        VALUES ($1, $2, $3)`,
              [companyId, date.date_name || null, date.event_date || null]
            )
          }
        }
      }

      // Подъем на этаж
      if (floorRising) {
        await pool.query(
          `INSERT INTO floor_rising (company_id, is_paid, comment)
                VALUES ($1, $2, $3)`,
          [companyId, floorRising.is_paid, floorRising.comment || null]
        )
      }

      // Адреса
      if (Array.isArray(addresses) && addresses.length) {
        for (const address of addresses) {
          if (address.region || address.city) {
            // Проверка на undefined или null
            await pool.query(
              `INSERT INTO company_addresses (company_id, region, city, street, building, is_primary, comment)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                companyId,
                address.region || null,
                address.city || null,
                address.street || null,
                address.building || null,
                address.is_primary || null,
                address.comment || null,
              ]
            )
          }
        }
      }

      // Конкуренты
      if (Array.isArray(competitors) && competitors.length) {
        for (const competitor of competitors) {
          if (competitor.competitor_id) {
            // Проверка на undefined или null
            await pool.query(
              `INSERT INTO dealer_competitors (company_id, competitor_id, has_representation)
                        VALUES ($1, $2, $3)`,
              [
                companyId,
                competitor.competitor_id,
                competitor.has_representation || false,
              ]
            )
          }
        }
      }

      // Фиксация транзакции
      await pool.query('COMMIT')
      res.status(201).json({ id: companyId })

      // Записываем действие в таблицу user_actions ****************************
      const action = 'создание' // Действие
      const entityInfo = JSON.stringify({
        id: companyId,
        name: name_companies,
      }) // Замените на реальное название компании
      const context = 'компонент дилеры' // Область действия

      await pool.query(
        'INSERT INTO user_actions (userId, action, entity_info, context) VALUES ($1, $2, $3, $4)',
        [userId, action, entityInfo, context]
      )
      // *************
    } catch (error) {
      await pool.query('ROLLBACK')
      console.error('Ошибка при создании компании:', error)
      res
        .status(500)
        .json({ error: 'Internal Server Error', details: error.message })
    }
  })

  // Обновление данных компании **********************************************
  router.put('/companies/general/:id', async (req, res) => {
    const { id } = req.params
    console.log('Полученные данные:', req.body)

    const {
      name_companies,
      status_companies,
      seller_code,
      inn,
      trade_brand,
      document_transfer_department,
      is_self_service,
      has_availability,
      has_warehouse,
      floor_rising,
    } = req.body

    try {
      // Обновляем данные компании
      const result = await pool.query(
        `UPDATE companies SET 
        name_companies = $1,
        status_companies = $2,
        seller_code = $3,
        inn = $4,
        trade_brand = $5,
        document_transfer_department = $6,
        is_self_service = $7,
        has_availability = $8,
        has_warehouse = $9,
        updated_at = NOW() 
        WHERE id = $10 RETURNING *`,
        [
          name_companies,
          status_companies,
          seller_code,
          inn,
          trade_brand,
          document_transfer_department,
          is_self_service,
          has_availability,
          has_warehouse,
          id,
        ]
      )

      // Обновляем информацию о подъеме на этаж
      if (floor_rising) {
        console.log('Данные для обновления учёта:', {
          companyId: id,
          is_paid: floor_rising.is_paid,
          comment: floor_rising.comment || null,
        })

        await pool.query(
          `UPDATE floor_rising
     SET is_paid = $1, comment = $2
     WHERE company_id = $3`,
          [floor_rising.is_paid, floor_rising.comment || null, id]
        )
      }
      res.json(result.rows[0])
    } catch (error) {
      console.error('Ошибка обновления данных компании:', error)
      res.status(500).json({ error: 'Ошибка обновления данных компании' })
    }
  })

  // Обновление данных компании для менджеров ************************************
  router.put('/companies/manager/:id', async (req, res) => {
    const { id } = req.params
    const {
      regional_manager_id,
      mpp_id,
      mpr_id,
      replacing_mpr,
      replacing_mpp,
      mpp_priorities,
    } = req.body

    try {
      // Обновляем данные компании
      const result = await pool.query(
        `UPDATE companies SET 
          regional_manager_id = $1,
          mpp_id = $2,
          mpr_id = $3,
          updated_at = NOW() 
          WHERE id = $4 RETURNING *`,
        [regional_manager_id, mpp_id, mpr_id, id]
      )

      // Обрабатываем замещающих МПР
      await pool.query(`DELETE FROM replacing_mpr WHERE company_id = $1`, [id])
      for (const userId of replacing_mpr) {
        await pool.query(
          `INSERT INTO replacing_mpr (company_id, user_id) VALUES ($1, $2)`,
          [id, userId]
        )
      }
      //1
      // Удаляем старые записи замещающих МПП и их приоритеты
      await pool.query(`DELETE FROM replacing_mpp WHERE company_id = $1`, [id])
      await pool.query(`DELETE FROM mpp_priority WHERE company_id = $1`, [id])

      // Вставляем новые замещающие МПП и их приоритеты
      for (const [index, userId] of replacing_mpp.entries()) {
        const mppInsertResult = await pool.query(
          `INSERT INTO replacing_mpp (company_id, user_id) VALUES ($1, $2) RETURNING id`,
          [id, userId]
        )
        const newMppId = mppInsertResult.rows[0].id // Получаем новый ID

        const priorityLevel = mpp_priorities[index] || null // Получаем соответствующий приоритет или null

        // Вставляем приоритет в таблицу mpp_priority
        await pool.query(
          `INSERT INTO mpp_priority (company_id, replacing_mpp_id, priority_level) 
       VALUES ($1, $2, $3)`,
          [id, newMppId, priorityLevel]
        )
      }

      res.json(result.rows[0])
    } catch (error) {
      console.error('Ошибка обновления данных компании:', error)
      res.status(500).json({ error: 'Ошибка обновления данных компании' })
    }
  })

  // Обновление данных компании (детали) **************************************************
  router.put('/companies/details/:id', async (req, res) => {
    const { id } = req.params
    const {
      name_companies, // Имя компании (обязательно)
      industries, // Обрабатываем отдельно для таблицы company_industries
      phoneNumbers,
      emails,
      relatedActivities,
      contracts,
      socialNetworks,
      deliveryTerms,
      notificationMethods,
      importantDates,
      addresses,
    } = req.body

    try {
      // Проверка существования компании
      const companyCheck = await pool.query(
        `SELECT * FROM companies WHERE id = $1`,
        [id]
      )

      if (companyCheck.rowCount === 0) {
        return res.status(404).json({ error: 'Компания не найдена' })
      }

      // Генерация запроса обновления
      const updates = []
      const values = []
      let placeholders = 1 // Для нумерации параметров для SQL-запроса

      if (name_companies) {
        updates.push(`name_companies = $${placeholders++}`) // Добавляем имя компании
        values.push(name_companies)
      }

      // Обновление связанных данных (например, отрасли)
      if (industries) {
        // Обновление отраслей
        console.log('Обновление отраслей:', industries)
        await pool.query(
          `DELETE FROM company_industries WHERE company_id = $1`,
          [id]
        )
        for (const industry of industries) {
          await pool.query(
            `INSERT INTO company_industries (company_id, industry_name) VALUES ($1, $2)`,
            [id, industry]
          )
        }
      }

      // Обработка других связанных данных
      if (phoneNumbers) {
        console.log('Обновление телефонных номеров:', phoneNumbers)
        await pool.query(
          `DELETE FROM phone_numbers_companies WHERE company_id = $1`,
          [id]
        )
        for (const phone of phoneNumbers) {
          await pool.query(
            `INSERT INTO phone_numbers_companies (company_id, phone_number) VALUES ($1, $2)`,
            [id, phone]
          )
        }
      }

      if (emails) {
        console.log('Обновление электронных почт:', emails)
        await pool.query(`DELETE FROM emails_companies WHERE company_id = $1`, [
          id,
        ])
        for (const email of emails) {
          await pool.query(
            `INSERT INTO emails_companies (company_id, email) VALUES ($1, $2)`,
            [id, email]
          )
        }
      }

      if (relatedActivities) {
        // Логика для обновления связанных видов деятельности
        await pool.query(
          `DELETE FROM related_activities WHERE company_id = $1`,
          [id]
        )
        for (const activity of relatedActivities) {
          await pool.query(
            `INSERT INTO related_activities (company_id, activity_name) VALUES ($1, $2)`,
            [id, activity]
          )
        }
      }

      if (contracts) {
        // Логика для обновления контрактов
        await pool.query(`DELETE FROM contracts WHERE company_id = $1`, [id])
        for (const contract of contracts) {
          await pool.query(
            `INSERT INTO contracts (company_id, contract_name) VALUES ($1, $2)`,
            [id, contract]
          )
        }
      }

      if (socialNetworks) {
        // Удаляем существующие записи
        await pool.query(`DELETE FROM social_networks WHERE company_id = $1`, [
          id,
        ])

        // Уникальные социальные сети
        const uniqueNetworks = Array.from(
          new Map(
            socialNetworks.map((network) => [network.network_name, network])
          ).values()
        )

        for (const network of uniqueNetworks) {
          await pool.query(
            `INSERT INTO social_networks (company_id, network_name, comment) VALUES ($1, $2, $3)`,
            [id, network.network_name, network.comment]
          )
        }
      }

      if (deliveryTerms) {
        // Удаляем существующие записи
        await pool.query(`DELETE FROM delivery_terms WHERE company_id = $1`, [
          id,
        ])

        // Уникальные условия доставки
        const uniqueTerms = Array.from(
          new Map(deliveryTerms.map((term) => [term.term_name, term])).values()
        )

        for (const term of uniqueTerms) {
          await pool.query(
            `INSERT INTO delivery_terms (company_id, term_name, term_comment) VALUES ($1, $2, $3)`,
            [id, term.term_name, term.term_comment]
          )
        }
      }

      if (notificationMethods) {
        // Логика для обновления способов оповещения
        await pool.query(
          `DELETE FROM notification_methods WHERE company_id = $1`,
          [id]
        )
        for (const method of notificationMethods) {
          await pool.query(
            `INSERT INTO notification_methods (company_id, method_name) VALUES ($1, $2)`,
            [id, method]
          )
        }
      }

      if (importantDates) {
        // Логика для обновления значимых дат
        await pool.query(`DELETE FROM important_dates WHERE company_id = $1`, [
          id,
        ])
        for (const date of importantDates) {
          await pool.query(
            `INSERT INTO important_dates (company_id, date_name, event_date) VALUES ($1, $2, $3)`,
            [id, date.date_name, date.event_date]
          )
        }
      }

      if (addresses) {
        // Логика для обновления адресов
        await pool.query(
          `DELETE FROM company_addresses WHERE company_id = $1`,
          [id]
        )
        for (const address of addresses) {
          await pool.query(
            `INSERT INTO company_addresses (company_id, region, city, street, building, is_primary, comment) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              id,
              address.region,
              address.city,
              address.street,
              address.building,
              address.is_primary,
              address.comment,
            ]
          )
        }
      }

      // Обновление основной информации о компании
      if (updates.length > 0) {
        await pool.query(
          `UPDATE companies SET ${updates.join(', ')} WHERE id = $1`,
          [id] // Добавляем id в качестве первого параметра
        )
      }

      res.status(200).json({ message: 'Данные компании успешно обновлены' })
    } catch (error) {
      console.error('Ошибка при обновлении данных компании:', error)
      res.status(500).json({ error: 'Ошибка обновления данных компании' })
    }
  })

  // Обновление связи Конкурентов и компании
  router.put('/companies/competitors/:id', async (req, res) => {
    const { id } = req.params
    const { competitors } = req.body // Массив идентификаторов конкурентов

    try {
      // Удаляем все существующие связи для компании
      await pool.query('DELETE FROM dealer_competitors WHERE company_id = $1', [
        id,
      ])

      // Добавляем новые связи
      for (const { competitor_id } of competitors) {
        await pool.query(
          'INSERT INTO dealer_competitors (company_id, competitor_id) VALUES ($1, $2)',
          [id, competitor_id]
        )
      }

      res
        .status(200)
        .json({ message: 'Связи с конкурентами успешно обновлены' })
    } catch (error) {
      console.error('Ошибка при обновлении связей с конкурентами:', error)
      res.status(500).json({ error: 'Ошибка обновления' })
    }
  })

  // Получение конкурентов компании
  router.get('/companies/:id/competitors', async (req, res) => {
    const { id } = req.params

    try {
      const result = await pool.query(
        `
      SELECT dc.competitor_id, c.name
      FROM dealer_competitors dc
      JOIN competitors c ON dc.competitor_id = c.id
      WHERE dc.company_id = $1
    `,
        [id]
      )

      res.status(200).json(result.rows)
    } catch (error) {
      console.error(
        'Ошибка при получении связей компании и конкурентов:',
        error
      )
      res.status(500).json({ error: 'Ошибка получения данных' })
    }
  })

  // Обновить пароль компании
  router.put('/companies/password/:id', async (req, res) => {
    const companyId = req.params.id
    const { telegram_password } = req.body

    try {
      // Выполнение запроса для обновления пароля
      const result = await pool.query(
        'UPDATE companies SET telegram_password = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [telegram_password, companyId]
      )

      // Проверяем, была ли компания найдена и обновлена
      if (result.rows.length === 0) {
        return res.status(404).send('Компания не найдена')
      }

      // Возвращаем обновленную компанию
      res.json(result.rows[0])
    } catch (error) {
      console.error('Ошибка при обновлении пароля:', error)
      res.status(500).send('Ошибка сервера')
    }
  })

  // Удалить компанию по ID
  router.delete(
    '/company/delete/:companyId/:companyName/:userId',
    async (req, res) => {
      const companyId = req.params.companyId // Получаем ID компании из параметров запроса
      const companyName = req.params.companyName
      const userId = req.params.userId
      try {
        const result = await pool.query('DELETE FROM companies WHERE id = $1', [
          companyId,
        ])

        if (result.rowCount === 0) {
          return res.status(404).send('Компания не найдена') // Если компания не найдена
        }

        // Записываем действие в таблицу user_actions ****************************
        const action = 'удаление' // Действие
        const entityInfo = JSON.stringify({
          id: companyId,
          name: companyName,
        }) // Замените на реальное название компании
        const context = 'компонент дилеры' // Область действия

        await pool.query(
          'INSERT INTO user_actions (userId, action, entity_info, context) VALUES ($1, $2, $3, $4)',
          [userId, action, entityInfo, context]
        )
        // *************

        res.status(200).send('Компания успешно удалена') // Успешное удаление
      } catch (error) {
        console.error('Ошибка при удалении компании:', error)
        res.status(500).send('Ошибка сервера')
      }
    }
  )

  return router
}

/*// Получить произвольные поля компании
  router.get('/companies/:id/custom-fields', async (req, res) => {
    const companyId = parseInt(req.params.id, 10)
    try {
      const result = await pool.query(
        'SELECT field_name, field_value FROM custom_fields WHERE company_id = $1',
        [companyId]
      )
      res.json(result.rows)
    } catch (error) {
      console.error('Ошибка при получении произвольных полей компании:', error)
      res.status(500).send('Ошибка сервера')
    }
  })

  return router
}
*/
