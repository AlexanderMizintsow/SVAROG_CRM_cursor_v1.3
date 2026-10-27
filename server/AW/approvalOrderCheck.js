const Firebird = require('node-firebird')

const STATUS_LABELS = {
  0: 'создан',
  3: 'закрыт',
  4: 'производство',
}

function attach(options) {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db)))
  })
}

function query(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])))
  })
}

function detach(db) {
  try {
    db.detach()
  } catch (error) {
    console.error('approval detach:', error.message)
  }
}

function text(value) {
  if (value == null) return ''
  return String(value).trim()
}

const ORDER_SELECT = `
  SELECT FIRST 2
    o.ORDERID, o.ORDERNO, o.AGREEMENTNO, o.FACTORY_ORDERNO, o.ORIGIN_ORDERNO,
    o.ORDERSTATUS, o.ORDERSTATEID, os.NAME AS STATENAME,
    o.ISRESERVED, o.VALID, o.STUFFS_REQUIREMENTS_COMPLETED, o.PRODDATE
  FROM ORDERS o
  LEFT JOIN ORDERSTATES os ON os.ORDERSTATEID = o.ORDERSTATEID
`

function searchSql(searchBy) {
  if (searchBy === 'orderno') return `${ORDER_SELECT} WHERE o.DELETED = 0 AND o.ORDERNO = ?`
  if (searchBy === 'agreementno') return `${ORDER_SELECT} WHERE o.DELETED = 0 AND o.AGREEMENTNO = ?`
  return null
}

function mapOrder(row) {
  const status = Number(row.ORDERSTATUS)
  return {
    orderId: row.ORDERID,
    orderNo: text(row.ORDERNO),
    agreementNo: text(row.AGREEMENTNO),
    factoryOrderNo: text(row.FACTORY_ORDERNO),
    originOrderNo: text(row.ORIGIN_ORDERNO),
    orderStatus: status,
    orderStatusLabel: STATUS_LABELS[status] || String(status),
    stateName: text(row.STATENAME),
    reserved: Number(row.ISRESERVED) === 1,
    calcValid: Number(row.VALID) === 1,
    stuffsCompleted: Number(row.STUFFS_REQUIREMENTS_COMPLETED) === 1,
    prodDate: row.PRODDATE || null,
  }
}

async function userFieldValue(db, orderId, caption) {
  const rows = await query(
    db,
    `
      SELECT FIRST 1 v.VAR_STR, v.VAR_INT, v.VAR_DATE, v.VAR_BLN, v.VAR_FLT
      FROM ORDER_UF_VALUES v
      JOIN USERFIELDS f ON f.USERFIELDID = v.USERFIELDID
      WHERE v.ORDERID = ? AND f.FIELDCAPTION = ? AND f.DELETED = 0
    `,
    [orderId, caption]
  )
  if (!rows.length) return null
  const row = rows[0]
  if (text(row.VAR_STR)) return text(row.VAR_STR)
  if (row.VAR_INT != null) return String(row.VAR_INT)
  if (row.VAR_FLT != null) return String(row.VAR_FLT)
  if (row.VAR_DATE) return String(row.VAR_DATE)
  if (row.VAR_BLN != null) return Number(row.VAR_BLN) === 1 ? 'да' : 'нет'
  return ''
}

async function stateWas(db, orderId, stateName) {
  const rows = await query(
    db,
    `
      SELECT FIRST 1 r.ORDERSTATESREGID
      FROM ORDERSTATESREG r
      JOIN ORDERSTATES s ON s.ORDERSTATEID = r.ORDERSTATEID
      WHERE r.ORDERID = ? AND s.NAME = ?
    `,
    [orderId, stateName]
  )
  return rows.length > 0
}

function filled(value) {
  return text(value).length > 0
}

function evaluate(order, check, extras) {
  const params = check.params || {}
  const code = check.check_code || check.code
  if (code === 'order_exists') {
    return { passed: true, detail: `заказ ${order.orderNo || 'найден'}` }
  }
  if (code === 'order_state_eq') {
    return {
      passed: order.stateName === text(params.stateName),
      detail: `состояние: ${order.stateName || 'не задано'}`,
    }
  }
  if (code === 'order_state_ever') {
    return {
      passed: extras.stateEver === true,
      detail: extras.stateEver ? 'состояние уже было' : 'в этом состоянии заказ ещё не был',
    }
  }
  if (code === 'factory_no_filled') {
    return { passed: filled(order.factoryOrderNo), detail: order.factoryOrderNo || 'номера в производстве нет' }
  }
  if (code === 'agreement_no_filled') {
    return { passed: filled(order.agreementNo), detail: order.agreementNo || 'номера договора нет' }
  }
  if (code === 'agreement_no_empty') {
    return { passed: !filled(order.agreementNo), detail: filled(order.agreementNo) ? order.agreementNo : 'номер договора пуст' }
  }
  if (code === 'reserved') {
    return { passed: order.reserved, detail: order.reserved ? 'зарезервирован' : 'не зарезервирован' }
  }
  if (code === 'calc_valid') {
    return { passed: order.calcValid, detail: order.calcValid ? 'калькуляция пересчитана' : 'калькуляция не пересчитана' }
  }
  if (code === 'stuffs_completed') {
    return {
      passed: order.stuffsCompleted,
      detail: order.stuffsCompleted ? 'комплектующие закрыты' : 'комплектующие не закрыты',
    }
  }
  if (code === 'prod_date_set') {
    return { passed: Boolean(order.prodDate), detail: order.prodDate ? 'срок изготовления заполнен' : 'срок изготовления пуст' }
  }
  if (code === 'prod_date_reached') {
    const reached = order.prodDate && new Date(order.prodDate).getTime() <= Date.now()
    return { passed: Boolean(reached), detail: order.prodDate ? 'срок изготовления' : 'срок изготовления пуст' }
  }
  if (code === 'user_field_filled') {
    return { passed: filled(extras.userField), detail: filled(extras.userField) ? extras.userField : 'поле пустое' }
  }
  if (code === 'user_field_eq') {
    return {
      passed: text(extras.userField) === text(params.equals),
      detail: extras.userField || 'поле пустое',
    }
  }
  return { passed: false, detail: 'неизвестная проверка' }
}

async function readInDatabase(options, body) {
  const db = await attach(options)
  try {
    const sql = searchSql(body.searchBy)
    if (!sql) {
      const error = new Error('Неизвестный способ поиска заказа')
      error.status = 400
      throw error
    }
    const rows = await query(db, sql, [body.searchValue])
    if (rows.length === 0) return { found: 'none' }
    if (rows.length > 1) return { found: 'many' }
    const order = mapOrder(rows[0])
    const checks = Array.isArray(body.checks) ? body.checks : []
    const results = []
    for (const check of checks) {
      const code = check.check_code || check.code
      const params = check.params || {}
      const extras = {}
      if (code === 'order_state_ever') extras.stateEver = await stateWas(db, order.orderId, text(params.stateName))
      if (code === 'user_field_filled' || code === 'user_field_eq') {
        extras.userField = await userFieldValue(db, order.orderId, text(params.caption))
      }
      const verdict = evaluate(order, check, extras)
      results.push({ code, passed: verdict.passed, detail: verdict.detail })
    }
    return { found: 'one', order, checks: results }
  } finally {
    detach(db)
  }
}

function withTimeout(work, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('Альтавин не ответил'), { status: 504 }))
    }, ms)
    Promise.resolve(work).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function registerApprovalOrderCheck(app, getDbOptions) {
  app.get('/app/approval/order-states', async (req, res) => {
    let db
    try {
      db = await attach(getDbOptions(String(new Date().getFullYear())))
      const rows = await query(db, 'SELECT NAME FROM ORDERSTATES ORDER BY NAME', [])
      const states = [...new Set(rows.map((row) => text(row.NAME)).filter(Boolean))]
      res.json({ states })
    } catch (error) {
      console.error('approval order states:', error)
      res.json({ states: [] })
    } finally {
      if (db) detach(db)
    }
  })

  app.post('/app/approval/order-snapshot', async (req, res) => {
    try {
      const searchValue = text(req.body?.searchValue)
      if (!searchValue) return res.status(400).json({ message: 'Укажите значение для поиска заказа' })
      const year = new Date().getFullYear()
      const seen = new Set()
      let last = { found: 'none', checks: [] }
      await withTimeout((async () => {
        for (const candidate of [year, year - 1]) {
          const options = getDbOptions(String(candidate))
          if (seen.has(options.database)) continue
          seen.add(options.database)
          const result = await readInDatabase(options, { ...req.body, searchValue })
          if (result.found === 'one' || result.found === 'many') {
            last = { ...result, year: candidate }
            return
          }
          last = result
        }
      })(), 6000)
      res.json(last)
    } catch (error) {
      console.error('approval order snapshot:', error)
      res.status(error.status || 500).json({ message: error.message || 'Ошибка чтения Альтавин' })
    }
  })
}

module.exports = { registerApprovalOrderCheck }
