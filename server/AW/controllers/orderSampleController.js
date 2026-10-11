const Firebird = require('node-firebird')
const { buildItemQuery, buildOrderQuery } = require('../orderSampleQuery')

const STATUS_LABELS = {
  0: 'Создан',
  3: 'Закрыт',
  4: 'В производстве',
}

const attach = (options) =>
  new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db)))
  })

const cancelledError = () => {
  const error = new Error('Отменено')
  error.cancelled = true
  return error
}

const query = (db, sql, params, isCancelled) =>
  new Promise((resolve, reject) => {
    if (isCancelled?.()) {
      reject(cancelledError())
      return
    }
    db.query(sql, Array.isArray(params) ? params : [], (err, result) => {
      if (isCancelled?.()) {
        reject(cancelledError())
        return
      }
      if (err) reject(err)
      else resolve(result || [])
    })
  })

const withDb = async (options, run) => {
  const db = await attach(options)
  try {
    return await run(db)
  } finally {
    db.detach()
  }
}

const mapRow = (row) => ({
  orderId: row.ORDERID,
  orderNumber: row.ORDERNO || '',
  orderName: row.ORDER_NAME || '',
  managerName: row.MANAGER_NAME || '',
  dealerName: row.DEALER_NAME || '',
  dateCreated: row.DATECREATED || null,
  orderStatus: row.ORDERSTATUS,
  statusLabel: STATUS_LABELS[row.ORDERSTATUS] || 'Неизвестно',
  itemId: row.ORDERITEMSID || null,
  itemName: row.ITEM_NAME || '',
  width: row.MODELWIDTH ?? null,
  height: row.MODELHEIGHT ?? null,
  sashCount: row.FLUGELCOUNT ?? null,
  profileName: row.PROFILE_NAME || '',
  furnitureName: row.FURN_NAME || '',
  colorIn: row.COLOR_IN || '',
  colorOut: row.COLOR_OUT || '',
})

const normalizeBody = (body) => {
  const conditions = Array.isArray(body.conditions) ? body.conditions.slice(0, 40) : []
  return {
    dateFrom: String(body.dateFrom || '').slice(0, 10),
    dateTo: String(body.dateTo || '').slice(0, 10),
    orderNumber: body.orderNumber || '',
    orderStatus: body.orderStatus === '' || body.orderStatus === undefined ? '' : body.orderStatus,
    scope: body.scope === 'order' ? 'order' : 'item',
    exactText: body.exactText === true,
    conditions: conditions.map((item) => ({
      field: String(item.field || ''),
      mode: item.mode === 'except' ? 'except' : 'eq',
      value: item.value ?? '',
      valueTo: item.valueTo ?? '',
    })),
  }
}

const loadCatalogs = async (db) => {
  const profiles = await query(
    db,
    `SELECT RSYSTEMID AS ID, NAME FROM R_SYSTEMS
     WHERE "TYPE" = 0 AND COALESCE(DELETED, 0) = 0 ORDER BY NAME`
  )
  const furniture = await query(
    db,
    `SELECT RSYSTEMID AS ID, NAME FROM R_SYSTEMS
     WHERE "TYPE" = 1 AND COALESCE(DELETED, 0) = 0 ORDER BY NAME`
  )
  const glassSystems = await query(
    db,
    `SELECT RSYSTEMID AS ID, NAME FROM R_SYSTEMS
     WHERE "TYPE" = 2 AND COALESCE(DELETED, 0) = 0 ORDER BY NAME`
  )
  const colors = await query(
    db,
    `SELECT COLORID AS ID, TITLE AS NAME FROM COLORS
     WHERE COALESCE(DELETED, 0) = 0 ORDER BY TITLE`
  )
  const itemTypes = await query(
    db,
    `SELECT ITEMTYPEID AS ID, NAME FROM ITEMTYPES
     WHERE COALESCE(DELETED, 0) = 0 ORDER BY NAME`
  )
  const stuffTypes = await query(
    db,
    `SELECT ID, NAME FROM STUFFTYPES
     WHERE COALESCE(DELETED, 0) = 0 ORDER BY NAME`
  )
  const bases = await query(
    db,
    `SELECT ID, NAME FROM R_BASES
     WHERE COALESCE(DELETED, 0) = 0 ORDER BY NAME`
  )

  const mapList = (rows) =>
    rows.map((row) => ({ id: row.ID, name: row.NAME || '' })).filter((row) => row.name)

  return {
    profiles: mapList(profiles),
    furniture: mapList(furniture),
    glassSystems: mapList(glassSystems),
    colors: mapList(colors),
    itemTypes: mapList(itemTypes),
    stuffTypes: mapList(stuffTypes),
    bases: mapList(bases),
  }
}

const hasNarrowingCondition = (filters) => {
  if (String(filters.orderNumber || '').trim()) return true
  return filters.conditions.some((item) => {
    if (item.field === 'radiusOnly') return true
    return String(item.value ?? '').trim() !== '' || String(item.valueTo ?? '').trim() !== ''
  })
}

const assertPeriod = (filters) => {
  if (!filters.dateFrom || !filters.dateTo) {
    const error = new Error('Укажите период')
    error.status = 400
    throw error
  }
  const start = new Date(`${filters.dateFrom}T00:00:00`)
  const end = new Date(`${filters.dateTo}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    const error = new Error('Проверьте даты периода')
    error.status = 400
    throw error
  }
  if (hasNarrowingCondition(filters)) return
  const monthLater = new Date(start)
  monthLater.setMonth(monthLater.getMonth() + 1)
  if (end > monthLater) {
    const error = new Error('Без условий период не может быть больше месяца. Добавьте хотя бы одно условие или номер заказа.')
    error.status = 400
    throw error
  }
}

const searchOrders = async (db, body, isCancelled) => {
  const filters = normalizeBody(body)
  assertPeriod(filters)
  if (isCancelled?.()) throw cancelledError()

  if (filters.scope === 'item') {
    const built = buildItemQuery(filters)
    const rows = await query(db, built.sql, built.params, isCancelled)
    return {
      scope: 'item',
      orders: groupOrders(rows.map(mapRow)),
    }
  }

  const built = buildOrderQuery(filters)
  const orders = await query(db, built.sql, built.params, isCancelled)
  if (isCancelled?.()) throw cancelledError()
  const headers = orders.map(mapRow)
  const hasEquals = filters.conditions.some((item) => item.mode !== 'except')
  if (!headers.length || !hasEquals) {
    return {
      scope: 'order',
      orders: headers.map((order) => ({ ...order, items: [] })),
    }
  }

  const ids = headers.map((order) => order.orderId)
  const detail = buildItemQuery(filters, ids)
  const itemRows = await query(db, detail.sql, detail.params, isCancelled)
  const grouped = groupOrders(itemRows.map(mapRow))
  const byId = new Map(grouped.map((order) => [order.orderId, order.items]))
  return {
    scope: 'order',
    orders: headers.map((order) => ({
      ...order,
      items: byId.get(order.orderId) || [],
    })),
  }
}

const groupOrders = (rows) => {
  const map = new Map()
  rows.forEach((row) => {
    if (!map.has(row.orderId)) {
      map.set(row.orderId, {
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        orderName: row.orderName,
        managerName: row.managerName,
        dealerName: row.dealerName,
        dateCreated: row.dateCreated,
        orderStatus: row.orderStatus,
        statusLabel: row.statusLabel,
        items: [],
      })
    }
    if (row.itemId) {
      const order = map.get(row.orderId)
      const key = `${row.itemId}-${row.profileName}-${row.width}-${row.height}`
      if (!order.items.some((item) => item.key === key)) {
        order.items.push({ ...row, key })
      }
    }
  })
  return Array.from(map.values())
}

module.exports = {
  loadCatalogs,
  searchOrders,
  withDb,
  attach,
  assertPeriod,
  normalizeBody,
}
