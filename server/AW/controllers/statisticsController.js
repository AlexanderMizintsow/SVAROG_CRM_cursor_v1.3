const Firebird = require('node-firebird')
const {
  EXCLUDED_STUFF_TYPES,
  EXCLUDED_STUFF_TYPE_IDS,
  GROUP_BY_FIELDS,
  SUMMARY_GROUP_BY_FIELDS,
  ERROR_MESSAGES,
} = require('../constants/statisticsConstants')
const { validateFilters, buildWhereConditions } = require('../utils/statisticsUtils')

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
   * Получение заказов с материалами для поиска
   * @param {Object} filters - Фильтры для поиска
   * @param {string} filters.startDate - Дата начала (YYYY-MM-DD)
   * @param {string} filters.endDate - Дата окончания (YYYY-MM-DD)
   * @param {number} filters.orderStatus - Статус заказа (3-закрыт, 4-в производстве)
   * @param {string} filters.stuffType - Тип товара (код)
   * @param {string} filters.materialName - Наименование материала
   * @param {string} filters.materialMarking - Артикул материала
   * @param {string} filters.orderNumber - Номер заказа
   * @param {string} filters.year - Год базы данных
   * @returns {Promise<Object>} Объект с заказами и материалами
   */
  async getOrdersWithMaterials(filters) {
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

          // Строим условия WHERE используя утилиту
          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          // Добавляем параметры для исключаемых типов в правильном порядке
          // EXCLUDED_STUFF_TYPES используется в JOIN, EXCLUDED_STUFF_TYPE_IDS в WHERE после whereClause
          console.log(
            'EXCLUDED_STUFF_TYPES type:',
            typeof EXCLUDED_STUFF_TYPES,
            EXCLUDED_STUFF_TYPES
          )
          console.log(
            'EXCLUDED_STUFF_TYPE_IDS type:',
            typeof EXCLUDED_STUFF_TYPE_IDS,
            EXCLUDED_STUFF_TYPE_IDS
          )

          // Проверяем, что константы определены, иначе используем значения по умолчанию
          const excludedTypes = EXCLUDED_STUFF_TYPES || [
            'Work',
            'Shpros',
            'Dop_Profil_Optim',
            'Uslugi',
          ]
          const excludedTypeIds = EXCLUDED_STUFF_TYPE_IDS || [28]

          const allParams = [...queryParams, excludedTypeIds[0]]

          const query = `
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
                WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN SUM(itd.QTY*oi.QTY)/COUNT(*)
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
          `

          console.log('Executing statistics query with params:', allParams)
          console.log('Query params count:', allParams.length)
          console.log('queryParams from buildWhereConditions:', queryParams)
          console.log('EXCLUDED_STUFF_TYPES:', EXCLUDED_STUFF_TYPES)
          console.log('EXCLUDED_STUFF_TYPE_IDS:', EXCLUDED_STUFF_TYPE_IDS)
          console.log('whereClause:', whereClause)

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
                WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN SUM(itd.QTY*oi.QTY)/COUNT(*)
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

          const excludedTypes = EXCLUDED_STUFF_TYPES || [
            'Work',
            'Shpros',
            'Dop_Profil_Optim',
            'Uslugi',
          ]

          const query = `
            SELECT DISTINCT 
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
   * Очистка кэша
   */
  clearCache() {
    this.cache.clear()
    console.log('Cache cleared')
  }
}

module.exports = StatisticsController
