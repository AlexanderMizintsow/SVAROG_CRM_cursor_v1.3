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
  }

  /**
   * Получение детальной статистики по заказам
   * @param {Object} filters - Фильтры для поиска
   * @param {string} filters.startDate - Дата начала (YYYY-MM-DD)
   * @param {string} filters.endDate - Дата окончания (YYYY-MM-DD)
   * @param {number} filters.orderStatus - Статус заказа (3-закрыт, 4-в производстве)
   * @param {string} filters.stuffType - Тип товара (код)
   * @param {string} filters.materialName - Наименование материала
   * @param {string} filters.year - Год базы данных
   * @returns {Promise<Array>} Массив записей статистики
   */
  async getOrdersStatistics(filters) {
    return new Promise((resolve, reject) => {
      try {
        // Валидация фильтров
        const validatedFilters = validateFilters(filters)
        const currentDbOptions = this.getDbOptions(validatedFilters.year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          // Строим условия WHERE используя утилиту
          const { whereClause, params: queryParams } = buildWhereConditions(validatedFilters)

          // Добавляем параметры для исключаемых типов
          const excludedTypesParams = [...EXCLUDED_STUFF_TYPES, ...EXCLUDED_STUFF_TYPE_IDS]
          const allParams = [...queryParams, ...excludedTypesParams]

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
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID AND ggt.CODE NOT IN (${EXCLUDED_STUFF_TYPES.map(
              () => '?'
            ).join(',')}))
            JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
            JOIN MEASURE m1 ON (m1.MEASUREID= m.GRMEASUREID)
            LEFT JOIN COLORS c ON c.COLORID = itd.INCOLORID
            LEFT JOIN COLORS c1 ON c1.COLORID = itd.OUTCOLORID
            LEFT JOIN MODELPARTS mp ON mp.MODELPARTID=itd.MODELPARTID
            LEFT JOIN MODELFILLINGS mf ON mf.MODELPARTID=mp.MODELPARTID
            ${whereClause}
            AND COALESCE(rec.NAME,'') <> 'VIRT' 
            AND ggt.ID NOT IN (${EXCLUDED_STUFF_TYPE_IDS.map(() => '?').join(',')})
            GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13,14,16,17,20,21,22,24,25,26,27,28,29,30,31,32,33
            ORDER BY o.DATECREATED DESC, oi.ORDERITEMSID, md.MODELID
          `

          console.log('Executing statistics query with params:', allParams)

          db.query(query, allParams, (err, result) => {
            if (err) {
              console.error('Database query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            console.log(`Found ${result.length} records`)
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
   * Получение сводной статистики по материалам
   * @param {Object} filters - Фильтры для поиска
   * @param {string} filters.startDate - Дата начала (YYYY-MM-DD)
   * @param {string} filters.endDate - Дата окончания (YYYY-MM-DD)
   * @param {number} filters.orderStatus - Статус заказа
   * @param {string} filters.year - Год базы данных
   * @returns {Promise<Array>} Массив сводной статистики
   */
  async getSummaryStatistics(filters) {
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
          const excludedTypesParams = [...EXCLUDED_STUFF_TYPES, ...EXCLUDED_STUFF_TYPE_IDS]
          const allParams = [...queryParams, ...excludedTypesParams]

          const query = `
            SELECT
              ggt.NAME as STUFF_TYPE,
              g.NAME as MATERIAL_NAME,
              g.MARKING,
              COUNT(DISTINCT o.ORDERID) as ORDERS_COUNT,
              COUNT(DISTINCT oi.ORDERITEMSID) as ITEMS_COUNT,
              SUM(
                CASE
                  WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
                  WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY/COUNT(*)
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
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID AND ggt.CODE NOT IN (${EXCLUDED_STUFF_TYPES.map(
              () => '?'
            ).join(',')}))
            JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
            ${whereClause}
            AND COALESCE(rec.NAME,'') <> 'VIRT' 
            AND ggt.ID NOT IN (${EXCLUDED_STUFF_TYPE_IDS.map(() => '?').join(',')})
            GROUP BY ggt.NAME, g.NAME, g.MARKING
            ORDER BY TOTAL_COST DESC
          `

          console.log('Executing summary query with params:', allParams)

          db.query(query, allParams, (err, result) => {
            if (err) {
              console.error('Database query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            console.log(`Found ${result.length} summary records`)
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
   * Получение списка типов товаров
   * @param {string} year - Год базы данных
   * @returns {Promise<Array>} Массив типов товаров
   */
  async getStuffTypes(year) {
    return new Promise((resolve, reject) => {
      try {
        const currentDbOptions = this.getDbOptions(year)

        Firebird.attach(currentDbOptions, (err, db) => {
          if (err) {
            console.error('Database connection error:', err)
            return reject(new Error(ERROR_MESSAGES.DB_CONNECTION))
          }

          const query = `
            SELECT DISTINCT 
              ggt.ID,
              ggt.NAME,
              ggt.CODE
            FROM STUFFTYPES ggt
            WHERE ggt.CODE NOT IN (${EXCLUDED_STUFF_TYPES.map(() => '?').join(',')})
            ORDER BY ggt.NAME
          `

          db.query(query, EXCLUDED_STUFF_TYPES, (err, result) => {
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
   * Получение статистики по заказам за период
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
              COUNT(DISTINCT o.ORDERID) as TOTAL_ORDERS,
              COUNT(DISTINCT oi.ORDERITEMSID) as TOTAL_ITEMS,
              SUM(o.TOTALPRICE) as TOTAL_ORDERS_COST,
              AVG(o.TOTALPRICE) as AVG_ORDER_COST,
              COUNT(DISTINCT CASE WHEN o.ORDERSTATUS = 3 THEN o.ORDERID END) as CLOSED_ORDERS,
              COUNT(DISTINCT CASE WHEN o.ORDERSTATUS = 4 THEN o.ORDERID END) as IN_PRODUCTION_ORDERS
            FROM ORDERS o
            JOIN ORDERITEMS oi ON o.ORDERID = oi.ORDERID
            ${whereClause}
          `

          db.query(query, queryParams, (err, result) => {
            if (err) {
              console.error('Database query error:', err)
              return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
            }

            resolve(result[0] || {})

            db.detach()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Получение статистики по материалам за период
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
          const excludedTypesParams = [...EXCLUDED_STUFF_TYPES, ...EXCLUDED_STUFF_TYPE_IDS]
          const allParams = [...queryParams, ...excludedTypesParams]

          const query = `
            SELECT
              ggt.NAME as STUFF_TYPE,
              COUNT(DISTINCT g.ID) as UNIQUE_MATERIALS,
              SUM(
                CASE
                  WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
                  WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY/COUNT(*)
                  ELSE itd.QTY*oi.QTY
                END
              ) as TOTAL_QTY,
              SUM(itd.SAVINGCOST) as TOTAL_COST
            FROM ORDERITEMS oi
            JOIN ORDERS o ON o.ORDERID = oi.ORDERID
            LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
            JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
            JOIN STUFFS g ON (g.ID=itd.GOODSID)
            LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
            JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID AND ggt.CODE NOT IN (${EXCLUDED_STUFF_TYPES.map(
              () => '?'
            ).join(',')}))
            ${whereClause}
            AND COALESCE(rec.NAME,'') <> 'VIRT' 
            AND ggt.ID NOT IN (${EXCLUDED_STUFF_TYPE_IDS.map(() => '?').join(',')})
            GROUP BY ggt.NAME
            ORDER BY TOTAL_COST DESC
          `

          db.query(query, allParams, (err, result) => {
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
}

module.exports = StatisticsController
