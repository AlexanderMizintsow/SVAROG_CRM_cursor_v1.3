const Firebird = require('node-firebird')
const { ERROR_MESSAGES } = require('../constants/statisticsConstants')
const {
  validateFilters,
  buildWhereConditions,
  buildMaterialWhereConditions,
} = require('../utils/statisticsUtils')

/**
 * Контроллер для работы со статистикой и отчетами
 */
class StatisticsController {
  constructor(dbOptions, getDbOptions) {
    this.dbOptions = dbOptions
    this.getDbOptions = getDbOptions
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5 минут
  }

  // Простой кэш для часто запрашиваемых данных
  getCacheKey(filters, type) {
    return `${type}_${JSON.stringify(filters)}`
  }

  getFromCache(key) {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }
    this.cache.delete(key)
    return null
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    })
  }

  /**
   * Получение статистики по материалам (группировка по материалам)
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<Object>} Статистика по материалам
   */
  async getMaterialsSummary(filters) {
    return new Promise((resolve, reject) => {
      try {
        const validatedFilters = validateFilters(filters)
        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          // Определяем уровень группировки на основе фильтров
          let groupByFields = 'ggt.ID, ggt.NAME, g.ID, g.NAME, g.MARKING, m.SHORTNAME'
          let selectFields = `
            ggt.ID as stuff_type_id,
            ggt.NAME as stuff_type_name,
            g.ID as material_id,
            g.NAME as material_name,
            g.MARKING as material_marking,
            m.SHORTNAME as measure_unit
          `

          // Если есть фильтр по конкретному материалу, группируем по материалу
          if (validatedFilters.materialName || validatedFilters.materialMarking) {
            groupByFields = 'g.ID, g.NAME, g.MARKING, ggt.ID, ggt.NAME, m.SHORTNAME'
            selectFields = `
              g.ID as material_id,
              g.NAME as material_name,
              g.MARKING as material_marking,
              ggt.ID as stuff_type_id,
              ggt.NAME as stuff_type_name,
              m.SHORTNAME as measure_unit
            `
          }
          // Если есть фильтр только по типу материала, группируем по типу
          else if (validatedFilters.stuffType) {
            groupByFields = 'ggt.ID, ggt.NAME'
            selectFields = `
              ggt.ID as stuff_type_id,
              ggt.NAME as stuff_type_name,
              NULL as material_id,
              NULL as material_name,
              NULL as material_marking,
              NULL as measure_unit
            `
          }

          const materialsQuery = `
            SELECT 
              ${selectFields},
              COUNT(DISTINCT o.ORDERID) as orders_count,
              COUNT(DISTINCT oi.ORDERITEMSID) as items_count,
              LIST(DISTINCT o.ORDERNO, ', ') as order_numbers,
              SUM(
                CASE
                  WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
                  WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY
                  ELSE itd.QTY*oi.QTY
                END
              ) as total_quantity,
              SUM(itd.SAVINGCOST) as total_cost
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
            JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
            WHERE o.DELETED = 0
            ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
            AND COALESCE(rec.NAME,'') <> 'VIRT' 
            GROUP BY ${groupByFields}
            ORDER BY total_cost DESC
          `

          db.query(materialsQuery, queryParams, (err, result) => {
            if (err) {
              console.error('Materials summary query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            // Вычисляем общие итоги
            const totals = result.reduce(
              (acc, material) => {
                // Для заказов используем максимальное значение, так как один заказ может содержать несколько материалов
                acc.totalOrders = Math.max(acc.totalOrders, material.ORDERS_COUNT)
                // Для изделий суммируем, но нужно быть осторожным с дублированием
                acc.totalItems += material.ITEMS_COUNT
                acc.totalMaterials += 1
                acc.totalQuantity += material.TOTAL_QUANTITY || 0
                acc.totalCost += material.TOTAL_COST || 0
                return acc
              },
              {
                totalOrders: 0,
                totalItems: 0,
                totalMaterials: 0,
                totalQuantity: 0,
                totalCost: 0,
              }
            )

            const response = {
              materials: result || [],
              totals: totals,
              grouping:
                validatedFilters.materialName || validatedFilters.materialMarking
                  ? 'by_material'
                  : validatedFilters.stuffType
                  ? 'by_type'
                  : 'by_all',
            }

            resolve(response)
            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение общей статистики поиска (быстрый запрос)
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<Object>} Общая статистика
   */
  async getSearchSummary(filters) {
    return new Promise((resolve, reject) => {
      try {
        const validatedFilters = validateFilters(filters)
        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          // Быстрый запрос для подсчета общей статистики
          const summaryQuery = `
            SELECT 
              COUNT(DISTINCT o.ORDERID) as total_orders,
              COUNT(DISTINCT oi.ORDERITEMSID) as total_items,
              COUNT(DISTINCT g.ID) as total_materials,
              SUM(
                CASE
                  WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
                  WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY
                  ELSE itd.QTY*oi.QTY
                END
              ) as total_quantity,
              SUM(itd.SAVINGCOST) as total_cost
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
            WHERE o.DELETED = 0
            ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
            AND COALESCE(rec.NAME,'') <> 'VIRT' 
          `

          db.query(summaryQuery, queryParams, (err, result) => {
            if (err) {
              console.error('Summary query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            const summary = result[0] || {
              total_orders: 0,
              total_items: 0,
              total_materials: 0,
              total_quantity: 0,
              total_cost: 0,
            }

            resolve(summary)
            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение полных заказов со всеми изделиями и материалами (старая логика)
   * @param {Object} filters - Фильтры для поиска
   * @param {string} filters.startDate - Дата начала (YYYY-MM-DD)
   * @param {string} filters.endDate - Дата окончания (YYYY-MM-DD)
   * @param {number} filters.orderStatus - Статус заказа (3-закрыт, 4-в производстве)
   * @param {string} filters.stuffType - Тип товара (код)
   * @param {string} filters.materialName - Наименование материала
   * @param {string} filters.materialMarking - Артикул материала
   * @param {string} filters.orderNumber - Номер заказа
   * @param {string} filters.year - Год базы данных
   * @returns {Promise<Object>} Объект с полными заказами
   */
  async getFullOrdersWithMaterials(filters) {
    return new Promise((resolve, reject) => {
      try {
        // Валидация фильтров
        const validatedFilters = validateFilters(filters)

        // Проверяем кэш (отключаем кэш для отладки)
        const cacheKey = this.getCacheKey(validatedFilters, 'ordersWithMaterials')
        // const cachedData = this.getFromCache(cacheKey)
        // if (cachedData) {
        //   console.log('Returning cached orders with materials')
        //   return resolve(cachedData)
        // }

        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        // Используем старый подход: загружаем полные заказы со всеми данными
        this.getFullOrdersData(validatedFilters)
          .then((result) => {
            // Сохраняем в кэш
            this.setCache(cacheKey, result)
            resolve(result)
          })
          .catch((error) => {
            reject(error)
          })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение полных данных заказов со всеми изделиями и материалами
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<Object>} Полные данные заказов
   */
  async getFullOrdersData(filters) {
    return new Promise((resolve, reject) => {
      try {
        const validatedFilters = validateFilters(filters)
        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          console.log('SQL Query will be executed with:')
          console.log('Where clause:', whereClause)
          console.log('Parameters:', queryParams)

          // Пагинация
          const page = Number(validatedFilters.page) || 1
          const limit = Number(validatedFilters.limit) || 100
          const skip = Math.max(0, (page - 1) * limit)

          // СНАЧАЛА найдем заказы с правильной пагинацией
          // Всегда включаем JOIN'ы с таблицами материалов для правильного подсчета изделий с материалами
          const ordersQuery = `
             SELECT 
               o.ORDERID, 
               o.ORDERNO, 
               o.DATECREATED, 
               o.ORDERSTATUS,
               COUNT(DISTINCT oi.ORDERITEMSID) as ITEMS_WITH_MATERIAL
             FROM ORDERS o
             LEFT JOIN ORDERITEMS oi ON o.ORDERID = oi.ORDERID
             LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
             JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
             JOIN STUFFS g ON (g.ID=itd.GOODSID)
             LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
             JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
             WHERE o.DELETED = 0
             ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
             AND COALESCE(rec.NAME,'') <> 'VIRT'
             GROUP BY o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS
             ORDER BY o.DATECREATED DESC, o.ORDERNO
             ROWS ${skip + 1} TO ${skip + limit}
           `

          console.log('Orders query:', ordersQuery)
          console.log('Query parameters:', queryParams)

          // Сначала найдем заказы
          db.query(ordersQuery, queryParams, (err, ordersResult) => {
            if (err) {
              console.error('Orders query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            console.log(`Found ${ordersResult.length} orders in date range`)
            if (ordersResult.length > 0) {
              console.log(
                'Orders found:',
                ordersResult.map((order) => ({
                  ORDERID: order.ORDERID,
                  ORDERNO: order.ORDERNO,
                  DATECREATED: order.DATECREATED,
                }))
              )
            }

            if (ordersResult.length === 0) {
              return resolve({
                orders: [],
                totalOrders: 0,
                totalItems: 0,
                totalMaterials: 0,
                pagination: {
                  page: page,
                  limit: limit,
                  totalCount: 0,
                  hasMore: false,
                },
              })
            }

            // Запрос для общей статистики по искомому материалу
            const overallStatsQuery = `
              SELECT 
                COUNT(DISTINCT o.ORDERID) as TOTAL_ORDERS,
                COUNT(DISTINCT oi.ORDERITEMSID) as TOTAL_ITEMS,
                COUNT(DISTINCT g.ID) as TOTAL_UNIQUE_MATERIALS,
                COUNT(itd.GOODSID) as TOTAL_MATERIAL_INSTANCES,
                SUM(
                  CASE
                    WHEN (itd.ISEXTENDED = 1) THEN itd.QTY*itd.THICK/COALESCE(NULLIF(m.AMFACTOR, 0), 1)
                    ELSE itd.QTY*itd.THICK*oi.QTY/COALESCE(NULLIF(m.AMFACTOR, 0), 1)
                  END
                ) as TOTAL_QUANTITY,
                SUM(itd.SAVINGCOST * (
                  CASE
                    WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
                    WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY
                    ELSE itd.QTY*oi.QTY
                  END
                )) as TOTAL_COST
              FROM ORDERS o
              JOIN ORDERITEMS oi ON o.ORDERID = oi.ORDERID
              LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
              JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
              JOIN STUFFS g ON (g.ID=itd.GOODSID)
              LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
              JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
              JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
              WHERE o.DELETED = 0
              ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
              AND COALESCE(rec.NAME,'') <> 'VIRT'
            `

            // Запрос для детальной статистики по материалам (с GROUP BY)
            const materialsDetailQuery = `
              SELECT 
                g.NAME as MATERIAL_NAME,
                g.MARKING as MATERIAL_MARKING,
                ggt.NAME as MATERIAL_TYPE,
                m.SHORTNAME as MEASURE,
                COUNT(DISTINCT o.ORDERID) as MATERIAL_ORDERS,
                COUNT(oi.ORDERITEMSID) as MATERIAL_ITEMS,
                COUNT(itd.GOODSID) as MATERIAL_INSTANCES,
                SUM(
                  CASE
                    WHEN (itd.ISEXTENDED = 1) THEN itd.QTY*itd.THICK/COALESCE(NULLIF(m.AMFACTOR, 0), 1)
                    ELSE itd.QTY*itd.THICK*oi.QTY/COALESCE(NULLIF(m.AMFACTOR, 0), 1)
                  END
                ) as MATERIAL_QUANTITY,
                SUM(itd.SAVINGCOST * (
                  CASE
                    WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
                    WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY
                    ELSE itd.QTY*oi.QTY
                  END
                )) as MATERIAL_COST
              FROM ORDERS o
              JOIN ORDERITEMS oi ON o.ORDERID = oi.ORDERID
              LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
              JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
              JOIN STUFFS g ON (g.ID=itd.GOODSID)
              LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
              JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
              JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
              WHERE o.DELETED = 0
              ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
              AND COALESCE(rec.NAME,'') <> 'VIRT'
              GROUP BY g.ID, g.NAME, g.MARKING, ggt.NAME, m.SHORTNAME
            `

            console.log('Overall statistics query:', overallStatsQuery)
            console.log('Materials detail query:', materialsDetailQuery)
            console.log('Query parameters:', queryParams)

            // Выполняем оба запроса параллельно
            let overallStats = null
            let materialsDetail = null
            let completedQueries = 0

            const processResults = () => {
              if (completedQueries === 2) {
                // Обрабатываем результаты
                console.log('Overall statistics result:', overallStats)
                console.log('Materials detail result:', materialsDetail)

                // Преобразуем заказы в нужный формат (без материалов)
                const orders = ordersResult.map((order) => ({
                  orderId: order.ORDERID,
                  orderNumber: order.ORDERNO,
                  dateCreated: order.DATECREATED,
                  orderStatus: order.ORDERSTATUS,
                  items: [], // Пустой массив - материалы загружаются отдельно
                  materialsLoaded: false, // Флаг для отслеживания загрузки
                  itemsWithMaterial: order.ITEMS_WITH_MATERIAL || 0, // Количество изделий с искомым материалом
                }))

                // Используем данные из общего запроса
                const stats = overallStats[0] || {
                  TOTAL_ORDERS: 0,
                  TOTAL_ITEMS: 0,
                  TOTAL_UNIQUE_MATERIALS: 0,
                  TOTAL_MATERIAL_INSTANCES: 0,
                  TOTAL_QUANTITY: 0,
                  TOTAL_COST: 0,
                }

                const totalOrders = stats.TOTAL_ORDERS
                const totalItems = stats.TOTAL_ITEMS
                const totalMaterials = stats.TOTAL_UNIQUE_MATERIALS // Количество уникальных материалов
                const totalCost = stats.TOTAL_COST
                const totalQuantity = stats.TOTAL_QUANTITY || 0

                // Определяем, нужно ли показывать количество материалов
                // Показываем только если есть фильтр по конкретному материалу или типу
                const showMaterialsQuantity =
                  validatedFilters.materialName ||
                  validatedFilters.materialMarking ||
                  validatedFilters.stuffType

                // Для поиска по конкретному материалу/артикулу показываем количество экземпляров материала
                // Для поиска по типу показываем количество уникальных материалов
                let materialsCountToShow = null
                if (showMaterialsQuantity) {
                  if (validatedFilters.materialName || validatedFilters.materialMarking) {
                    // Поиск по конкретному материалу - показываем общее количество экземпляров
                    materialsCountToShow = Math.round(totalQuantity * 100) / 100
                  } else if (validatedFilters.stuffType) {
                    // Поиск по типу - показываем количество уникальных материалов
                    materialsCountToShow = totalMaterials
                  }
                }

                console.log(
                  `Found ${
                    orders.length
                  } orders on page, total: ${totalOrders} orders, ${totalItems} items, ${
                    materialsCountToShow || 'N/A'
                  } materials`
                )
                console.log(
                  `Total cost: ${totalCost.toFixed(2)} ₽, Total quantity: ${totalQuantity.toFixed(
                    2
                  )}`
                )

                const response = {
                  orders: orders,
                  totalOrders: totalOrders,
                  totalItems: totalItems,
                  totalMaterials: materialsCountToShow, // Количество материалов в зависимости от типа поиска
                  totalCost: totalCost,
                  totalQuantity: showMaterialsQuantity ? totalQuantity : null, // Скрываем при поиске по всем материалам
                  materialsStats: materialsDetail, // Детальная статистика по каждому материалу
                  pagination: {
                    page: page,
                    limit: limit,
                    totalCount: totalOrders,
                    hasMore: orders.length === limit,
                  },
                }

                resolve(response)
                db.detach()
              }
            }

            // Загружаем общую статистику
            db.query(overallStatsQuery, queryParams, (err, result) => {
              if (err) {
                console.error('Overall statistics query error:', err)
                return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
              }
              overallStats = result
              completedQueries++
              processResults()
            })

            // Загружаем детальную статистику по материалам
            db.query(materialsDetailQuery, queryParams, (err, result) => {
              if (err) {
                console.error('Materials detail query error:', err)
                return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
              }
              materialsDetail = result
              completedQueries++
              processResults()
            })
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение материалов конкретного заказа (для раскрытия)
   * @param {number} orderId - ID заказа
   * @returns {Promise<Object>} Материалы заказа
   */
  async getOrderMaterials(orderId, filters = {}) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Loading materials for order ID: ${orderId} with filters:`, filters)

        const currentDbOptions = this.getDbOptions(filters.year || '2026')

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          // Строим условия фильтрации - используем ВСЕ фильтры как в основном запросе
          const { whereClause, params } = buildWhereConditions(filters)

          console.log('Filters for order:', orderId, filters)
          console.log('Where clause:', whereClause)
          console.log('Params:', params)

          const materialsQuery = `
            SELECT 
              o.ORDERID,
              o.ORDERNO,
              o.DATECREATED,
              o.ORDERSTATUS,
              oi.ORDERITEMSID,
              oi.NAME as ITEM_NAME,
              ggt.NAME as STUFF_TYPE,
              g.NAME as MATERIAL_NAME,
              g.MARKING as ITEM_ART,
              CASE
                WHEN c_in.TITLE IS NOT NULL THEN c_in.TITLE
                ELSE ''
              END as ITEM_COLORIN,
              CASE
                WHEN c_out.TITLE IS NOT NULL THEN c_out.TITLE
                ELSE ''
              END as ITEM_COLOROUT,
              itd.WIDTH,
              itd.HEIGHT,
              itd.THICK as LENGTH,
              CASE
                WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
                WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY
                ELSE itd.QTY*oi.QTY
              END as ITEM_QTY,
              CASE
                WHEN (itd.ISEXTENDED = 1) THEN itd.QTY*itd.THICK/m.AMFACTOR
                ELSE itd.QTY*itd.THICK*oi.QTY/m.AMFACTOR
              END as ITEM_TOTQTY,
              itd.SAVINGCOST as ITEM_PRICE,
              m.SHORTNAME as ITEM_MESURE
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
            JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
            LEFT JOIN COLORS c_in ON (c_in.COLORID = itd.INCOLORID)
            LEFT JOIN COLORS c_out ON (c_out.COLORID = itd.OUTCOLORID)
            WHERE o.DELETED = 0 
            AND o.ORDERID = ?
            AND COALESCE(rec.NAME,'') <> 'VIRT'
            ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
            ORDER BY oi.ORDERITEMSID, g.ID
          `

          const queryParams = [orderId, ...params]

          console.log('Order materials query:', materialsQuery)
          console.log('Query parameters:', queryParams)

          db.query(materialsQuery, queryParams, (err, result) => {
            if (err) {
              console.error('Order materials query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            console.log(`Order materials query returned ${result.length} filtered rows`)

            if (result.length === 0) {
              return resolve(null) // Нет материалов, соответствующих фильтру
            }

            // Группируем данные по изделиям с подсчетом статистики
            const itemsMap = new Map()
            let totalOrderCost = 0
            let totalOrderQuantity = 0

            result.forEach((row) => {
              const itemId = row.ORDERITEMSID

              if (!itemsMap.has(itemId)) {
                itemsMap.set(itemId, {
                  orderItemsId: itemId,
                  itemName: row.ITEM_NAME,
                  materials: [],
                  filteredMaterialsCount: 0,
                  filteredCost: 0,
                  filteredQuantity: 0,
                })
              }

              const item = itemsMap.get(itemId)

              const materialCost = row.ITEM_PRICE * row.ITEM_QTY
              const materialQuantity = row.ITEM_TOTQTY

              item.materials.push({
                stuffType: row.STUFF_TYPE,
                materialName: row.MATERIAL_NAME,
                itemArt: row.ITEM_ART,
                itemColorIn: row.ITEM_COLORIN,
                itemColorOut: row.ITEM_COLOROUT,
                width: row.WIDTH,
                height: row.HEIGHT,
                length: row.LENGTH,
                itemQty: row.ITEM_QTY,
                itemTotQty: row.ITEM_TOTQTY,
                itemPrice: row.ITEM_PRICE,
                itemMesure: row.ITEM_MESURE,
              })

              // Подсчитываем статистику по изделию
              item.filteredMaterialsCount++
              item.filteredCost += materialCost
              item.filteredQuantity += materialQuantity

              // Подсчитываем общую статистику по заказу
              totalOrderCost += materialCost
              totalOrderQuantity += materialQuantity
            })

            // Преобразуем Map в массив
            const items = Array.from(itemsMap.values())

            console.log(
              `Found ${items.length} items with ${result.length} filtered materials for order ${orderId}`
            )
            console.log(
              `Order total cost: ${totalOrderCost.toFixed(
                2
              )} ₽, quantity: ${totalOrderQuantity.toFixed(2)}`
            )

            const response = {
              orderId: orderId,
              orderNumber: result.length > 0 ? result[0].ORDERNO : '',
              dateCreated: result.length > 0 ? result[0].DATECREATED : null,
              orderStatus: result.length > 0 ? result[0].ORDERSTATUS : null,
              items: items,
              filteredItemsCount: items.length,
              filteredMaterialsCount: result.length,
              filteredCost: totalOrderCost,
              filteredQuantity: totalOrderQuantity,
            }

            resolve(response)
            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение общего количества заказов для пагинации
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<number>} Общее количество заказов
   */
  async getOrdersCount(filters) {
    return new Promise((resolve, reject) => {
      try {
        const validatedFilters = validateFilters(filters)
        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          const countQuery = `
            SELECT COUNT(DISTINCT o.ORDERID) as total_count
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
            WHERE o.DELETED = 0
            ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
            AND COALESCE(rec.NAME,'') <> 'VIRT'
          `

          db.query(countQuery, queryParams, (err, result) => {
            if (err) {
              console.error('Orders count query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            const totalCount = result && result.length > 0 ? result[0].TOTAL_COUNT : 0
            resolve(totalCount)
            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение списка заказов с базовой информацией (оптимизированный)
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<Object>} Список заказов с пагинацией
   */
  async getOrdersList(filters) {
    return new Promise((resolve, reject) => {
      try {
        const validatedFilters = validateFilters(filters)
        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          // Пагинация
          const page = Number(validatedFilters.page) || 1
          const limit = Number(validatedFilters.limit) || 50
          const skip = Math.max(0, (page - 1) * limit)

          // Оптимизированный запрос для получения списка заказов с детальной статистикой
          const ordersQuery = `
            SELECT 
              o.ORDERID,
              o.ORDERNO,
              o.DATECREATED,
              o.ORDERSTATUS,
              COUNT(DISTINCT oi.ORDERITEMSID) as items_count,
              COUNT(DISTINCT g.ID) as materials_count,
              SUM(
                CASE
                  WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
                  WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY
                  ELSE itd.QTY*oi.QTY
                END
              ) as total_quantity,
              SUM(itd.SAVINGCOST) as total_cost
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
            WHERE o.DELETED = 0
            ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
            AND COALESCE(rec.NAME,'') <> 'VIRT' 
            GROUP BY o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS
            ORDER BY o.DATECREATED DESC, o.ORDERNO
            ROWS ${skip + 1} TO ${skip + limit}
          `

          db.query(ordersQuery, queryParams, (err, result) => {
            if (err) {
              console.error('Orders list query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            const response = {
              orders: result || [],
              pagination: {
                page: page,
                limit: limit,
                hasMore: result.length === limit,
              },
            }

            resolve(response)
            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение статистики по материалам для конкретного заказа
   * @param {number} orderId - ID заказа
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<Object>} Статистика по материалам заказа
   */
  async getOrderMaterialsSummary(orderId, filters) {
    return new Promise((resolve, reject) => {
      try {
        const validatedFilters = validateFilters(filters)
        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)
          const allParams = [orderId, ...queryParams]

          // Определяем уровень группировки на основе фильтров
          let groupByFields = 'ggt.ID, ggt.NAME, g.ID, g.NAME, g.MARKING, m.SHORTNAME'
          let selectFields = `
            ggt.ID as stuff_type_id,
            ggt.NAME as stuff_type_name,
            g.ID as material_id,
            g.NAME as material_name,
            g.MARKING as material_marking,
            m.SHORTNAME as measure_unit
          `

          // Если есть фильтр по конкретному материалу, группируем по материалу
          if (validatedFilters.materialName || validatedFilters.materialMarking) {
            groupByFields = 'g.ID, g.NAME, g.MARKING, ggt.ID, ggt.NAME, m.SHORTNAME'
            selectFields = `
              g.ID as material_id,
              g.NAME as material_name,
              g.MARKING as material_marking,
              ggt.ID as stuff_type_id,
              ggt.NAME as stuff_type_name,
              m.SHORTNAME as measure_unit
            `
          }
          // Если есть фильтр только по типу материала, группируем по типу
          else if (validatedFilters.stuffType) {
            groupByFields = 'ggt.ID, ggt.NAME'
            selectFields = `
              ggt.ID as stuff_type_id,
              ggt.NAME as stuff_type_name,
              NULL as material_id,
              NULL as material_name,
              NULL as material_marking,
              NULL as measure_unit
            `
          }

          const orderMaterialsQuery = `
            SELECT
              ${selectFields},
              COUNT(DISTINCT oi.ORDERITEMSID) as items_count,
              SUM(
                CASE
                  WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
                  WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY
                  ELSE itd.QTY*oi.QTY
                END
              ) as total_quantity,
              SUM(itd.SAVINGCOST) as total_cost
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
            JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
            WHERE o.ORDERID = ?
            AND o.DELETED = 0
            AND COALESCE(rec.NAME,'') <> 'VIRT'
            ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
            GROUP BY ${groupByFields}
            ORDER BY total_cost DESC
          `

          db.query(orderMaterialsQuery, allParams, (err, result) => {
            if (err) {
              console.error('Order materials summary query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            // Вычисляем общие итоги для заказа
            const totals = result.reduce(
              (acc, material) => {
                acc.totalItems += material.ITEMS_COUNT
                acc.totalMaterials += 1
                acc.totalQuantity += material.TOTAL_QUANTITY || 0
                acc.totalCost += material.TOTAL_COST || 0
                return acc
              },
              {
                totalItems: 0,
                totalMaterials: 0,
                totalQuantity: 0,
                totalCost: 0,
              }
            )

            const response = {
              orderId: orderId,
              materials: result || [],
              totals: totals,
              grouping:
                validatedFilters.materialName || validatedFilters.materialMarking
                  ? 'by_material'
                  : validatedFilters.stuffType
                  ? 'by_type'
                  : 'by_all',
            }

            resolve(response)
            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Поиск заказов по номеру (для мини-окошка)
   * @param {string} orderNumber - Номер заказа для поиска
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<Array>} Список найденных заказов
   */
  async searchOrdersByNumber(orderNumber, filters) {
    return new Promise((resolve, reject) => {
      try {
        const validatedFilters = validateFilters(filters)
        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          // Добавляем поиск по номеру заказа
          let searchConditions = whereClause
          let searchParams = [...queryParams]

          if (orderNumber && orderNumber.trim()) {
            const orderNumberCondition = 'o.ORDERNO CONTAINING ?'
            if (searchConditions) {
              searchConditions =
                searchConditions.replace('WHERE', 'WHERE') + ' AND ' + orderNumberCondition
            } else {
              searchConditions = 'WHERE ' + orderNumberCondition
            }
            searchParams.push(orderNumber.trim())
          }

          const searchQuery = `
            SELECT DISTINCT
              o.ORDERID,
              o.ORDERNO,
              o.DATECREATED,
              o.ORDERSTATUS
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
            WHERE o.DELETED = 0
            ${searchConditions ? searchConditions.replace('WHERE', 'AND') : ''}
            AND COALESCE(rec.NAME,'') <> 'VIRT'
            ORDER BY o.DATECREATED DESC, o.ORDERNO
            ROWS 1 TO 20
          `

          db.query(searchQuery, searchParams, (err, result) => {
            if (err) {
              console.error('Orders search query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            resolve(result || [])
            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение детальной информации по конкретному заказу
   * @param {number} orderId - ID заказа
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<Object>} Детальная информация по заказу
   */
  async getOrderDetails(orderId, filters) {
    return new Promise((resolve, reject) => {
      try {
        const validatedFilters = validateFilters(filters)
        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)
          const allParams = [orderId, ...queryParams]

          // Детальный запрос по заказу (на основе быстрого примера)
          const detailsQuery = `
            SELECT
              oi.ORDERITEMSID,
              oi.NAME,
              g.MARKING,
              ggt.NAME as ITEM_DESC,
              g.NAME as ITEM_NAME,
              itd.WIDTH as W,
              itd.HEIGHT as H,
              itd.THICK as L,
              itd.QTY,
              itd.SAVINGCOST as ITEM_PRICE,
              o.ORDERNO,
              o.DATECREATED,
              o.ORDERSTATUS,
              md.MODELID,
              IIF(ggt.CODE='SP',
                CASE
                  WHEN (mf.GEOMETRY=2) AND (mf.SHPROSSES=0) THEN 'A'||g.MARKING
                  WHEN (mf.GEOMETRY=3) AND (mf.SHPROSSES=0) THEN 'AT'||g.MARKING
                  WHEN (mf.GEOMETRY=1) AND (mf.SHPROSSES=0) THEN 'T'||g.MARKING
                  WHEN (mf.GEOMETRY=0) AND (mf.SHPROSSES=1) THEN 'P'||g.MARKING
                  WHEN (mf.GEOMETRY=2) AND (mf.SHPROSSES=1) THEN 'PA'||g.MARKING
                  WHEN (mf.GEOMETRY=1) AND (mf.SHPROSSES=1) THEN 'PT'||g.MARKING
                  WHEN (mf.GEOMETRY=3) AND (mf.SHPROSSES=1) THEN 'PAT'||g.MARKING
                  ELSE g.MARKING
                END, g.MARKING) as ITEM_ART,
              COALESCE(c.TITLE,'Без цвета') as ITEM_COLOR_IN,
              COALESCE(c1.TITLE,'Без цвета') as ITEM_COLOR_OUT,
              m1.NAME as EI_NAME,
              m.SHORTNAME as ITEM_MESURE,
              CASE
                WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
                WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY
                ELSE itd.QTY*oi.QTY
              END as ITEM_QTY,
              CASE
                WHEN itd.ISEXTENDED = 1 THEN itd.QTY*itd.THICK/m.AMFACTOR
                ELSE itd.QTY*itd.THICK*oi.QTY/m.AMFACTOR
              END as ITEM_TOTQTY,
              itd.POSITIONID,
              itd.PARTNUM,
              itd.IZDPART,
              itd.MARK,
              oi.ISADDITION
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID = itd.GOODSID)
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
            JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
            JOIN MEASURE m1 ON (m1.MEASUREID= m.GRMEASUREID)
            LEFT JOIN COLORS c ON c.COLORID = itd.INCOLORID
            LEFT JOIN COLORS c1 ON c1.COLORID = itd.OUTCOLORID
            LEFT JOIN MODELPARTS mp ON mp.MODELPARTID=itd.MODELPARTID
            LEFT JOIN MODELFILLINGS mf ON mf.MODELPARTID=mp.MODELPARTID
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            WHERE o.ORDERID = ? 
            AND o.DELETED = 0
            AND COALESCE(rec.NAME,'') <> 'VIRT' 
            ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
            GROUP BY oi.ORDERITEMSID, oi.NAME, g.MARKING, ggt.NAME, g.NAME, itd.WIDTH, itd.HEIGHT, 
                     itd.THICK, itd.QTY, itd.SAVINGCOST, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS, 
                     md.MODELID, mf.GEOMETRY, mf.SHPROSSES, c.TITLE, c1.TITLE, m1.NAME, m.SHORTNAME,
                     itd.POSITIONID, itd.PARTNUM, itd.IZDPART, itd.MARK, oi.ISADDITION, 
                     itd.ISEXTENDED, g.AMOUNTGROUPID, m.AMFACTOR, oi.QTY, ggt.CODE
            ORDER BY oi.ORDERITEMSID, g.MARKING
          `

          db.query(detailsQuery, allParams, (err, result) => {
            if (err) {
              console.error('Order details query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            // Группируем результаты по изделиям и материалам
            const orderDetails = {
              orderId: orderId,
              orderNumber: result[0]?.ORDERNO || '',
              dateCreated: result[0]?.DATECREATED || '',
              orderStatus: result[0]?.ORDERSTATUS || 0,
              items: new Map(),
            }

            result.forEach((row) => {
              const itemId = row.ORDERITEMSID

              if (!orderDetails.items.has(itemId)) {
                orderDetails.items.set(itemId, {
                  orderItemsId: row.ORDERITEMSID,
                  itemName: row.NAME,
                  modelId: row.MODELID,
                  materials: new Map(),
                })
              }

              const item = orderDetails.items.get(itemId)
              const materialKey = `${row.ITEM_NAME}_${row.MARKING}_${row.ITEM_DESC}`

              if (!item.materials.has(materialKey)) {
                item.materials.set(materialKey, {
                  stuffType: row.ITEM_DESC,
                  materialName: row.ITEM_NAME,
                  materialMarking: row.MARKING,
                  itemArt: row.ITEM_ART,
                  itemColorIn: row.ITEM_COLOR_IN,
                  itemColorOut: row.ITEM_COLOR_OUT,
                  eiName: row.EI_NAME,
                  itemMesure: row.ITEM_MESURE,
                  width: row.W,
                  height: row.H,
                  length: row.L,
                  itemQty: row.ITEM_QTY,
                  itemTotQty: row.ITEM_TOTQTY,
                  itemPrice: row.ITEM_PRICE,
                  positionId: row.POSITIONID,
                  partNum: row.PARTNUM,
                  izdPart: row.IZDPART,
                  mark: row.MARK,
                  isAddition: row.ISADDITION,
                })
              } else {
                // Суммируем количества для одинаковых материалов
                const existingMaterial = item.materials.get(materialKey)
                existingMaterial.itemQty = (existingMaterial.itemQty || 0) + (row.ITEM_QTY || 0)
                existingMaterial.itemTotQty =
                  (existingMaterial.itemTotQty || 0) + (row.ITEM_TOTQTY || 0)
                existingMaterial.itemPrice =
                  (existingMaterial.itemPrice || 0) + (row.ITEM_PRICE || 0)
              }
            })

            // Преобразуем Map в массив
            orderDetails.items = Array.from(orderDetails.items.values()).map((item) => ({
              ...item,
              materials: Array.from(item.materials.values()),
            }))

            resolve(orderDetails)
            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение списка типов товаров
   * @param {string} year - Год базы данных
   * @returns {Promise<Array>} Массив типов товаров
   */
  async getStuffTypes(year) {
    return new Promise((resolve, reject) => {
      try {
        // Проверяем кэш для типов товаров
        const cacheKey = this.getCacheKey({ year }, 'stuffTypes')
        const cachedData = this.getFromCache(cacheKey)
        if (cachedData) {
          console.log('Returning cached stuff types')
          return resolve(cachedData)
        }

        const currentDbOptions = this.getDbOptions(year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const query = `
            SELECT
              ggt.ID,
              ggt.NAME,
              ggt.CODE
            FROM STUFFTYPES ggt
            WHERE ggt.CODE NOT IN ('Work','Shpros','Dop_Profil_Optim','Uslugi')
            ORDER BY ggt.NAME
          `
          db.query(query, [], (err, result) => {
            if (err) {
              console.error('Database query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            // Сохраняем в кэш
            this.setCache(cacheKey, result || [])

            resolve(result || [])

            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение детальной статистики по заказам (старый метод для совместимости)
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<Object>} Объект с данными и пагинацией
   */
  async getOrdersStatistics(filters) {
    return new Promise((resolve, reject) => {
      try {
        // Валидация фильтров
        const validatedFilters = validateFilters(filters)

        // Проверяем кэш
        const cacheKey = this.getCacheKey(validatedFilters, 'orders')
        const cachedData = this.getFromCache(cacheKey)
        if (cachedData) {
          console.log('Returning cached orders statistics')
          return resolve(cachedData)
        }

        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          // Получаем исключенные типы товаров
          const EXCLUDED_STUFF_TYPES = ['Work', 'Shpros', 'Dop_Profil_Optim', 'Uslugi']
          const EXCLUDED_STUFF_TYPE_IDS = [28]

          // Формируем параметры запроса
          const allParams = [...queryParams, ...EXCLUDED_STUFF_TYPE_IDS]

          console.log('Executing statistics query with params:', allParams)

          // Пагинация на уровне SQL
          const page = Number(validatedFilters.page) || 1
          const limit = Number(validatedFilters.limit) || 50
          const skip = Math.max(0, (page - 1) * limit)

          console.log('Pagination debug:', { page, limit, skip })

          // Оптимизированный запрос для подсчета записей
          const countQuery = `
            SELECT COUNT(*) as total_count
            FROM (
              SELECT md.ORDERITEMSID
              FROM ORDERITEMS oi
              JOIN ORDERS o ON o.ORDERID = oi.ORDERID
              LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
              JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
              JOIN STUFFS g ON (g.ID=itd.GOODSID)
              LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
              JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID AND ggt.CODE NOT IN ('Work','Shpros','Dop_Profil_Optim','Uslugi'))
              JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
              JOIN MEASURE m1 ON (m1.MEASUREID= m.GRMEASUREID)
              LEFT JOIN COLORS c ON c.COLORID = itd.INCOLORID
              LEFT JOIN COLORS c1 ON c1.COLORID = itd.OUTCOLORID
              LEFT JOIN MODELPARTS mp ON mp.MODELPARTID=itd.MODELPARTID
              LEFT JOIN MODELFILLINGS mf ON mf.MODELPARTID=mp.MODELPARTID
              WHERE o.DELETED = 0
              ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
              AND COALESCE(rec.NAME,'') <> 'VIRT' 
              AND ggt.ID <> ?
              GROUP BY md.ORDERITEMSID, md.MODELID, oi.NAME, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS, 
                       oi.ORDERITEMSID, g.MARKING, ggt.NAME, g.NAME, c.TITLE, c1.TITLE, m1.NAME, m.NAME, 
                       m.SHORTNAME, itd.WIDTH, itd.HEIGHT, itd.POSITIONID, itd.IZDPART, itd.ITEMSDETAILID, 
                       itd.PARTNUM, itd.MARK, itd.ISEXTENDED, oi.ISADDITION, g.AMOUNTGROUPID, g.WEIGHT, 
                       g.LINEARCUTTERID, mf.GEOMETRY, mf.SHPROSSES, ggt.CODE, ggt.ID
            ) as count_subquery
          `

          // Основной запрос с пагинацией
          const dataQuery = `
            SELECT
              md.ORDERITEMSID,
              md.MODELID,
              oi.NAME as ITEM_NAME,
              o.ORDERNO,
              o.DATECREATED,
              o.ORDERSTATUS,
              CASE
                WHEN oi.ISADDITION = 1 THEN NULL
                ELSE oi.ORDERITEMSID
              END as ITEM_ORDNO,
              IIF(ggt.CODE='SP',
                CASE
                  WHEN (mf.GEOMETRY=2) AND (mf.SHPROSSES=0) THEN 'A'||g.MARKING
                  WHEN (mf.GEOMETRY=3) AND (mf.SHPROSSES=0) THEN 'AT'||g.MARKING
                  WHEN (mf.GEOMETRY=1) AND (mf.SHPROSSES=0) THEN 'T'||g.MARKING
                  WHEN (mf.GEOMETRY=0) AND (mf.SHPROSSES=1) THEN 'P'||g.MARKING
                  WHEN (mf.GEOMETRY=2) AND (mf.SHPROSSES=1) THEN 'PA'||g.MARKING
                  WHEN (mf.GEOMETRY=1) AND (mf.SHPROSSES=1) THEN 'PT'||g.MARKING
                  WHEN (mf.GEOMETRY=3) AND (mf.SHPROSSES=1) THEN 'PAT'||g.MARKING
                  ELSE g.MARKING
                END, g.MARKING) as ITEM_ART,
              ggt.NAME as ITEM_DESC,
              g.NAME as MATERIAL_NAME,
              COALESCE(c.TITLE,'Без цвета') as ITEM_COLOR_IN,
              COALESCE(c1.TITLE,'Без цвета') as ITEM_COLOR_OUT,
              m1.NAME as EI_NAME,
              m.NAME as EI_NAME1,
              m.SHORTNAME as ITEM_MESURE,
              itd.WIDTH as W,
              itd.HEIGHT as H,
              SUM(itd.THICK) as L,
              CASE
                WHEN ggt.ID IN (1,2,3,4,12,13,14,15,16,17) THEN itd.POSITIONID
                ELSE ''
              END as ITEM_PARTNO,
              CASE
                WHEN (itd.ISEXTENDED = 1) THEN SUM(itd.QTY)
                WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN SUM(itd.QTY*oi.QTY)
                ELSE SUM(itd.QTY*oi.QTY)
              END as ITEM_QTY,
              CASE
                WHEN itd.ISEXTENDED = 1 THEN SUM(itd.QTY*itd.THICK/m.AMFACTOR)
                ELSE SUM(itd.QTY*itd.THICK*oi.QTY/m.AMFACTOR)
              END as ITEM_TOTQTY,
              CASE
                WHEN itd.IZDPART='Сдн' THEN 1
                WHEN itd.ISEXTENDED = 1 THEN 1
              END as DOP,
              CASE
                WHEN itd.ISEXTENDED = 1 THEN itd.ITEMSDETAILID
                WHEN ggt.ID IN (1,2,3,4,12,13,14,15,16,17) THEN itd.ITEMSDETAILID      
                ELSE ''
              END as ITEM_ID,
              'wp' as ITEM_TYPE,
              SUM(itd.SAVINGCOST) as ITEM_PRICE,
              g.LINEARCUTTERID as OG_ID,
              CASE
                WHEN ggt.ID IN (1,2,3,4,12,13,14,15,16,17) THEN itd.PARTNUM
                ELSE ''
              END as ELEMNO,
              CASE
                WHEN ggt.ID IN (1,2,3,4,12,13,14,15,16,17,7) THEN itd.IZDPART
                ELSE ''
              END as IZDPART,
              itd.MARK,
              itd.MARK as WP_SIDE,
              itd.ISEXTENDED as EXT1,
              oi.ISADDITION,
              itd.ISEXTENDED,
              g.AMOUNTGROUPID,
              g.WEIGHT
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID AND ggt.CODE NOT IN ('Work','Shpros','Dop_Profil_Optim','Uslugi'))
            JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
            JOIN MEASURE m1 ON (m1.MEASUREID= m.GRMEASUREID)
            LEFT JOIN COLORS c ON c.COLORID = itd.INCOLORID
            LEFT JOIN COLORS c1 ON c1.COLORID = itd.OUTCOLORID
            LEFT JOIN MODELPARTS mp ON mp.MODELPARTID=itd.MODELPARTID
            LEFT JOIN MODELFILLINGS mf ON mf.MODELPARTID=mp.MODELPARTID
            WHERE o.DELETED = 0
            ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
            AND COALESCE(rec.NAME,'') <> 'VIRT' 
            AND ggt.ID <> ?
            GROUP BY md.ORDERITEMSID, md.MODELID, oi.NAME, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS, 
                     oi.ORDERITEMSID, g.MARKING, ggt.NAME, g.NAME, c.TITLE, c1.TITLE, m1.NAME, m.NAME, 
                     m.SHORTNAME, itd.WIDTH, itd.HEIGHT, itd.POSITIONID, itd.IZDPART, itd.ITEMSDETAILID, 
                     itd.PARTNUM, itd.MARK, itd.ISEXTENDED, oi.ISADDITION, g.AMOUNTGROUPID, g.WEIGHT, 
                     g.LINEARCUTTERID, mf.GEOMETRY, mf.SHPROSSES, ggt.CODE, ggt.ID
            ORDER BY o.DATECREATED DESC, oi.ORDERITEMSID, md.MODELID
            ROWS ${skip + 1} TO ${skip + limit}
          `

          // Выполняем запрос на подсчет общего количества записей
          db.query(countQuery, allParams, (err, countResult) => {
            if (err) {
              console.error('Count query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            const totalRecords = countResult[0]?.TOTAL_COUNT || 0
            console.log(`Total records found: ${totalRecords}`)

            // Теперь выполняем основной запрос с пагинацией
            db.query(dataQuery, allParams, (err, result) => {
              if (err) {
                console.error('Database query error:', err)
                return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
              }

              console.log(
                `Retrieved ${result.length} records for page ${page}, total: ${totalRecords}`
              )

              // Формируем ответ с пагинацией
              const response = {
                data: result || [],
                pagination: {
                  page: page,
                  limit: limit,
                  totalRecords: totalRecords,
                  hasMore: skip + limit < totalRecords,
                  totalPages: Math.ceil(totalRecords / limit),
                },
              }

              // Сохраняем в кэш (только для первой страницы)
              if (page === 1) {
                this.setCache(cacheKey, response)
              }

              resolve(response)
              db.detach()
            })
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение сводной статистики по материалам (старый метод для совместимости)
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<Object>} Объект с данными и пагинацией
   */
  async getSummaryStatistics(filters) {
    return new Promise((resolve, reject) => {
      try {
        const validatedFilters = validateFilters(filters)

        // Проверяем кэш
        const cacheKey = this.getCacheKey(validatedFilters, 'summary')
        const cachedData = this.getFromCache(cacheKey)
        if (cachedData) {
          console.log('Returning cached summary statistics')
          return resolve(cachedData)
        }

        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          // Получаем исключенные типы товаров
          const EXCLUDED_STUFF_TYPES = ['Work', 'Shpros', 'Dop_Profil_Optim', 'Uslugi']
          const EXCLUDED_STUFF_TYPE_IDS = [28]

          // Формируем параметры запроса
          const allParams = [...queryParams, ...EXCLUDED_STUFF_TYPE_IDS]

          // Пагинация для сводной статистики
          const page = Number(validatedFilters.page) || 1
          const limit = Number(validatedFilters.limit) || 50
          const skip = Math.max(0, (page - 1) * limit)

          console.log('Summary pagination debug:', { page, limit, skip })

          // Запрос для подсчета общего количества записей сводной статистики
          const countQuery = `
            SELECT COUNT(*) as total_count
            FROM (
              SELECT ggt.NAME
              FROM ORDERITEMS oi
              JOIN ORDERS o ON o.ORDERID = oi.ORDERID
              LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
              JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
              JOIN STUFFS g ON (g.ID=itd.GOODSID)
              LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
              JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID AND ggt.CODE NOT IN ('Work','Shpros','Dop_Profil_Optim','Uslugi'))
              JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
              WHERE o.DELETED = 0
              ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
              AND COALESCE(rec.NAME,'') <> 'VIRT' 
              AND ggt.ID <> ?
              GROUP BY ggt.NAME, g.NAME, g.MARKING
            ) as count_subquery
          `

          // Основной запрос сводной статистики с пагинацией
          const dataQuery = `
            SELECT
              ggt.NAME as STUFF_TYPE,
              g.NAME as MATERIAL_NAME,
              g.MARKING,
              COUNT(DISTINCT o.ORDERID) as ORDERS_COUNT,
              COUNT(DISTINCT oi.ORDERITEMSID) as ITEMS_COUNT,
              SUM(
                CASE
                  WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
                  WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY
                  ELSE itd.QTY*oi.QTY
                END
              ) as TOTAL_QTY,
              SUM(itd.SAVINGCOST) as TOTAL_COST,
              SUM(
                CASE
                  WHEN itd.ISEXTENDED = 1 THEN itd.QTY*itd.THICK/m.AMFACTOR
                  ELSE itd.QTY*itd.THICK*oi.QTY/m.AMFACTOR
                END
              ) as TOTAL_VOLUME
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID AND ggt.CODE NOT IN ('Work','Shpros','Dop_Profil_Optim','Uslugi'))
            JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
            WHERE o.DELETED = 0
            ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
            AND COALESCE(rec.NAME,'') <> 'VIRT' 
            AND ggt.ID <> ?
            GROUP BY ggt.NAME, g.NAME, g.MARKING
            ORDER BY TOTAL_COST DESC
            ROWS ${skip + 1} TO ${skip + limit}
          `

          console.log('Executing summary query with params:', allParams)

          // Выполняем запрос на подсчет общего количества записей
          db.query(countQuery, allParams, (err, countResult) => {
            if (err) {
              console.error('Summary count query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            const totalRecords = countResult[0]?.TOTAL_COUNT || 0
            console.log(`Total summary records found: ${totalRecords}`)

            // Теперь выполняем основной запрос с пагинацией
            db.query(dataQuery, allParams, (err, result) => {
              if (err) {
                console.error('Database query error:', err)
                return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
              }

              console.log(
                `Retrieved ${result.length} summary records for page ${page}, total: ${totalRecords}`
              )

              // Формируем ответ с пагинацией
              const response = {
                data: result || [],
                pagination: {
                  page: page,
                  limit: limit,
                  totalRecords: totalRecords,
                  hasMore: skip + limit < totalRecords,
                  totalPages: Math.ceil(totalRecords / limit),
                },
              }

              // Сохраняем в кэш (только для первой страницы)
              if (page === 1) {
                this.setCache(cacheKey, response)
              }

              resolve(response)
              db.detach()
            })
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение общей статистики по заказам (старый метод для совместимости)
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<Object>} Объект с общей статистикой
   */
  async getOrdersOverview(filters) {
    return new Promise((resolve, reject) => {
      try {
        const validatedFilters = validateFilters(filters)
        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          const query = `
            SELECT
              COUNT(DISTINCT o.ORDERID) as total_orders,
              COUNT(DISTINCT oi.ORDERITEMSID) as total_items,
              SUM(itd.SAVINGCOST) as total_cost
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID AND ggt.CODE NOT IN ('Work','Shpros','Dop_Profil_Optim','Uslugi'))
            WHERE o.DELETED = 0
            ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
            AND COALESCE(rec.NAME,'') <> 'VIRT' 
            AND ggt.ID <> 28
          `

          db.query(query, queryParams, (err, result) => {
            if (err) {
              console.error('Database query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            resolve(result[0] || { total_orders: 0, total_items: 0, total_cost: 0 })
            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение статистики по материалам (старый метод для совместимости)
   * @param {Object} filters - Фильтры для поиска
   * @returns {Promise<Array>} Массив статистики по материалам
   */
  async getMaterialsStatistics(filters) {
    return new Promise((resolve, reject) => {
      try {
        const validatedFilters = validateFilters(filters)
        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          const query = `
            SELECT
              ggt.NAME as stuff_type,
              COUNT(*) as material_count,
              SUM(itd.SAVINGCOST) as total_cost
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID AND ggt.CODE NOT IN ('Work','Shpros','Dop_Profil_Optim','Uslugi'))
            WHERE o.DELETED = 0
            ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
            AND COALESCE(rec.NAME,'') <> 'VIRT' 
            AND ggt.ID <> 28
            GROUP BY ggt.NAME
            ORDER BY total_cost DESC
          `

          db.query(query, queryParams, (err, result) => {
            if (err) {
              console.error('Database query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            resolve(result || [])
            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Очистка кэша
   */
  clearCache() {
    this.cache.clear()
    console.log('Cache cleared')
  }
}

module.exports = StatisticsController
//1
