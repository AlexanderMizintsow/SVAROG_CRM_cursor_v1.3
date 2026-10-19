/**
 * Сборка запроса выборки заказов Альтавин.
 * В текст попадают только поля из белого списка, значения идут параметрами.
 */

const MODEL_FIELDS = {
  profile: { column: 'md.SYSPROFID', type: 'id' },
  furniture: { column: 'md.SYSFURNID', type: 'id' },
  profileMaterial: { column: 'prof.SYSTEMTYPE', type: 'id' },
  profileBase: { column: 'md.PROFBASEID', type: 'id' },
  itemType: { column: 'md.ITEMTYPEID', type: 'id' },
  colorIn: { column: 'md.INCOLORID', type: 'id' },
  colorOut: { column: 'md.OUTCOLORID', type: 'id' },
  sashCount: { column: 'md.FLUGELCOUNT', type: 'range' },
  width: { column: 'md.MODELWIDTH', type: 'range' },
  height: { column: 'md.MODELHEIGHT', type: 'range' },
  area: { column: 'md.AREA', type: 'range' },
  weight: { column: 'md.WEIGHT', type: 'range' },
  itemName: { column: 'oi.NAME', type: 'text' },
}

const COMPONENT_FIELDS = {
  article: { column: 'g.MARKING', type: 'text' },
  internalArticle: { column: 'itd.INT_MARKING', type: 'text' },
  componentName: { column: 'g.NAME', type: 'text' },
  componentType: { column: 'g.STUFFTYPEID', type: 'id' },
  componentColorIn: { column: 'itd.INCOLORID', type: 'id' },
  componentColorOut: { column: 'itd.OUTCOLORID', type: 'id' },
  beamLength: { column: 'itd.THICK', type: 'range' },
  radius: { column: 'itd.RADIUS', type: 'range' },
  radiusOnly: { column: 'itd.RADIUS', type: 'positive' },
  cutAngle: { type: 'angle' },
  beamMark: { column: 'itd.MARK', type: 'text' },
  part: { column: 'itd.IZDPART', type: 'text' },
  side: { column: 'itd.PARTSIDE', type: 'text' },
  connection: { type: 'connection' },
}

const GLASS_FIELDS = {
  glassFormula: { column: 'mg.FORMULA', type: 'text' },
  glassFormulaName: { column: 'mg.FORMULANAME', type: 'text' },
  glassSystem: { column: 'mg.RSYSTEMID', type: 'id' },
  glassShape: { column: 'mg.GEOMETRY', type: 'id' },
  shprosses: { column: 'mg.SHPROSSES', type: 'id' },
  glassThick: { column: 'mg.THICK', type: 'range' },
  chambers: { column: 'mg.CHAMBERCOUNT', type: 'range' },
}

const asNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const asText = (value) => {
  const text = String(value ?? '').trim()
  if (!text || text.length > 128) return null
  return text
}

const asId = (value) => {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0 || number > 100000000) return null
  return number
}

const rangeOf = (condition) => ({
  from: asNumber(condition.value),
  to: asNumber(condition.valueTo),
})

const oneMatch = (def, condition, params) => {
  if (def.type === 'positive') return `${def.column} > 0`

  if (def.type === 'id') {
    const id = asId(condition.value)
    if (id === null) return null
    params.push(id)
    return `${def.column} = ?`
  }

  if (def.type === 'text') {
    const text = asText(condition.value)
    if (!text) return null
    params.push(text)
    if (condition.exact) return `UPPER(TRIM(${def.column})) = UPPER(?)`
    return `${def.column} CONTAINING ?`
  }

  if (def.type === 'range') {
    const { from, to } = rangeOf(condition)
    if (from === null && to === null) return null
    if (from !== null && to !== null) {
      params.push(from, to)
      return `${def.column} BETWEEN ? AND ?`
    }
    if (from !== null) {
      params.push(from)
      return `${def.column} >= ?`
    }
    params.push(to)
    return `${def.column} <= ?`
  }

  if (def.type === 'angle') {
    const { from, to } = rangeOf(condition)
    if (from === null && to === null) return null
    const left = []
    const right = []
    const pushSide = (bucket) => {
      if (from !== null && to !== null) {
        params.push(from, to)
        bucket.push(`BETWEEN ? AND ?`)
      } else if (from !== null) {
        params.push(from)
        bucket.push(`>= ?`)
      } else {
        params.push(to)
        bucket.push(`<= ?`)
      }
    }
    pushSide(left)
    pushSide(right)
    return `(itd.ANG1 ${left[0]} OR itd.ANG2 ${right[0]})`
  }

  if (def.type === 'connection') {
    const text = asText(condition.value)
    if (!text) return null
    params.push(text)
    const nameMatch = condition.exact
      ? 'UPPER(TRIM(rc.NAME)) = UPPER(?)'
      : 'rc.NAME CONTAINING ?'
    return `EXISTS (
      SELECT 1 FROM R_CONNECTIONS rc
      WHERE (rc.RCONNECTIONID = itd.CONNECTION1 OR rc.RCONNECTIONID = itd.CONNECTION2)
        AND ${nameMatch}
    )`
  }

  return null
}

const matchClause = (def, list) => {
  const params = []
  const parts = []
  list.forEach((condition) => {
    const piece = oneMatch(def, condition, params)
    if (piece) parts.push(piece)
  })
  if (!parts.length) return null
  return {
    sql: parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`,
    params,
  }
}

const exceptOne = (def, condition) => {
  const params = []
  if (def.type === 'id') {
    const id = asId(condition.value)
    if (id === null) return null
    params.push(id)
    return { sql: `(${def.column} IS NULL OR ${def.column} <> ?)`, params }
  }
  if (def.type === 'text') {
    const text = asText(condition.value)
    if (!text) return null
    params.push(text)
    if (condition.exact) {
      return { sql: `(${def.column} IS NULL OR UPPER(TRIM(${def.column})) <> UPPER(?))`, params }
    }
    return { sql: `(${def.column} IS NULL OR ${def.column} NOT CONTAINING ?)`, params }
  }
  if (def.type === 'range' || def.type === 'angle' || def.type === 'positive' || def.type === 'connection') {
    const matched = oneMatch(def, condition, params)
    if (!matched) return null
    return { sql: `NOT (${matched})`, params }
  }
  return null
}

const groupFields = (conditions, fieldMap) => {
  const grouped = new Map()
  conditions.forEach((condition) => {
    if (!fieldMap[condition.field]) return
    if (!grouped.has(condition.field)) grouped.set(condition.field, [])
    grouped.get(condition.field).push(condition)
  })
  return grouped
}

const componentExists = (inner, forOrder) => {
  const from = forOrder
    ? `FROM ORDERITEMS oi
       JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
       JOIN ITEMSDETAIL itd ON itd.ORDERITEMSID = oi.ORDERITEMSID AND itd.MODELNO = md.MODELNO
       JOIN STUFFS g ON g.ID = itd.GOODSID
       WHERE oi.ORDERID = o.ORDERID AND `
    : `FROM ITEMSDETAIL itd
       JOIN STUFFS g ON g.ID = itd.GOODSID
       WHERE itd.ORDERITEMSID = oi.ORDERITEMSID AND itd.MODELNO = md.MODELNO AND `
  return `EXISTS (SELECT 1 ${from}(${inner.sql}))`
}

const glassExists = (inner, forOrder) => {
  const from = forOrder
    ? `FROM ORDERITEMS oi
       JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
       JOIN MODELPARTS mp ON mp.MODELID = md.MODELID
       JOIN MODELGLASSES mg ON mg.MODELPARTID = mp.MODELPARTID
       WHERE oi.ORDERID = o.ORDERID AND `
    : `FROM MODELPARTS mp
       JOIN MODELGLASSES mg ON mg.MODELPARTID = mp.MODELPARTID
       WHERE mp.MODELID = md.MODELID AND `
  return `EXISTS (SELECT 1 ${from}(${inner.sql}))`
}

const modelExists = (inner, forOrder) => {
  if (!forOrder) return `(${inner.sql})`
  return `EXISTS (
    SELECT 1
    FROM ORDERITEMS oi
    JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
    LEFT JOIN R_SYSTEMS prof ON prof.RSYSTEMID = md.SYSPROFID
    WHERE oi.ORDERID = o.ORDERID AND (${inner.sql})
  )`
}

const pushFieldGroup = (chunks, fieldMap, conditions, forOrder, existsSql) => {
  groupFields(conditions, fieldMap).forEach((list, field) => {
    const def = fieldMap[field]
    const equals = list.filter((item) => item.mode !== 'except')
    const excepts = list.filter((item) => item.mode === 'except')

    if (equals.length && !forOrder && fieldMap === MODEL_FIELDS) {
      const matched = matchClause(def, equals)
      if (matched) chunks.push({ sql: modelExists(matched, false), params: matched.params })
      excepts.forEach((condition) => {
        const excluded = exceptOne(def, condition)
        if (excluded) chunks.push(excluded)
      })
      return
    }

    if (equals.length) {
      const matched = matchClause(def, equals)
      if (matched) {
        const wrapped = existsSql ? existsSql(matched, forOrder) : modelExists(matched, forOrder)
        chunks.push({ sql: wrapped, params: matched.params })
      }
    }

    if (excepts.length) {
      const matched = matchClause(def, excepts)
      if (!matched) return
      if (!forOrder && fieldMap === MODEL_FIELDS) {
        excepts.forEach((condition) => {
          const excluded = exceptOne(def, condition)
          if (excluded) chunks.push(excluded)
        })
        return
      }
      const wrapped = existsSql ? existsSql(matched, forOrder) : modelExists(matched, forOrder)
      chunks.push({ sql: `NOT ${wrapped}`, params: matched.params })
    }
  })
}

const baseFilters = (body) => {
  const chunks = [{ sql: 'o.DELETED = 0', params: [] }]
  if (body.dateFrom) {
    chunks.push({ sql: 'o.DATECREATED >= ?', params: [`${body.dateFrom} 00:00:00`] })
  }
  if (body.dateTo) {
    chunks.push({ sql: 'o.DATECREATED < ?', params: [`${body.dateTo} 23:59:59`] })
  }
  if (body.orderStatus !== '' && body.orderStatus !== null && body.orderStatus !== undefined) {
    const status = asId(body.orderStatus)
    if (status !== null) chunks.push({ sql: 'o.ORDERSTATUS = ?', params: [status] })
  }
  const orderNumber = asText(body.orderNumber)
  if (orderNumber) chunks.push({ sql: 'o.ORDERNO CONTAINING ?', params: [orderNumber] })
  return chunks
}

const pushCombinedEquals = (chunks, fieldMap, conditions, existsSql) => {
  const parts = []
  const params = []
  groupFields(conditions, fieldMap).forEach((list, field) => {
    const equals = list.filter((item) => item.mode !== 'except')
    const excepts = list.filter((item) => item.mode === 'except')
    if (equals.length) {
      const matched = matchClause(fieldMap[field], equals)
      if (matched) {
        parts.push(matched.sql)
        params.push(...matched.params)
      }
    }
    if (excepts.length) {
      const matched = matchClause(fieldMap[field], excepts)
      if (matched) chunks.push({ sql: `NOT ${existsSql(matched, false)}`, params: matched.params })
    }
  })
  if (parts.length) {
    chunks.push({
      sql: existsSql({ sql: parts.join(' AND ') }, false),
      params,
    })
  }
}

const conditionChunks = (conditions, forOrder) => {
  const chunks = []
  pushFieldGroup(chunks, MODEL_FIELDS, conditions, forOrder, null)
  if (forOrder) {
    pushFieldGroup(chunks, COMPONENT_FIELDS, conditions, true, componentExists)
    pushFieldGroup(chunks, GLASS_FIELDS, conditions, true, glassExists)
  } else {
    pushCombinedEquals(chunks, COMPONENT_FIELDS, conditions, componentExists)
    pushCombinedEquals(chunks, GLASS_FIELDS, conditions, glassExists)
  }
  return chunks
}

const flatten = (chunks) => ({
  where: chunks.map((chunk) => chunk.sql).join(' AND '),
  params: chunks.flatMap((chunk) => chunk.params),
})

const ORDER_PARTIES = `
  LEFT JOIN CUSTOMERS cust ON cust.CUSTOMERID = o.CUSTOMERID
  LEFT JOIN CONTRAGENTS cc ON cc.CONTRAGID = cust.CONTRAGID
  LEFT JOIN EMPLOYEE emp ON emp.EMPID = o.OWNERID
  LEFT JOIN PERSONS mgr ON mgr.PERSONID = emp.PERSONID
`

const ORDER_PARTY_COLUMNS = `
    cc.NAME AS ORDER_NAME,
    COALESCE(
      NULLIF(TRIM(mgr.PERSONTITLE), ''),
      TRIM(COALESCE(mgr.PERSONLASTNAME, '') || ' ' || COALESCE(mgr.PERSONNAME, '') || ' ' || COALESCE(mgr.PERSONMIDDLE, ''))
    ) AS MANAGER_NAME`

const ITEM_SELECT = `
  SELECT
    o.ORDERID,
    o.ORDERNO,
    o.DATECREATED,
    o.ORDERSTATUS,
    ${ORDER_PARTY_COLUMNS},
    oi.ORDERITEMSID,
    oi.NAME AS ITEM_NAME,
    md.MODELWIDTH,
    md.MODELHEIGHT,
    md.FLUGELCOUNT,
    prof.NAME AS PROFILE_NAME,
    furn.NAME AS FURN_NAME,
    cin.TITLE AS COLOR_IN,
    cout.TITLE AS COLOR_OUT
  FROM ORDERS o
  JOIN ORDERITEMS oi ON oi.ORDERID = o.ORDERID
  JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
  LEFT JOIN R_SYSTEMS prof ON prof.RSYSTEMID = md.SYSPROFID
  LEFT JOIN R_SYSTEMS furn ON furn.RSYSTEMID = md.SYSFURNID
  LEFT JOIN COLORS cin ON cin.COLORID = md.INCOLORID
  LEFT JOIN COLORS cout ON cout.COLORID = md.OUTCOLORID
  ${ORDER_PARTIES}
`

const markExact = (conditions, exactText) =>
  (conditions || []).map((item) => ({ ...item, exact: Boolean(exactText) }))

const buildItemQuery = (body, orderIds) => {
  const source = orderIds
    ? (body.conditions || []).filter((item) => item.mode !== 'except')
    : body.conditions || []
  const conditions = markExact(source, body.exactText)
  const chunks = baseFilters(body).concat(conditionChunks(conditions, false))
  if (Array.isArray(orderIds) && orderIds.length) {
    chunks.push({
      sql: `o.ORDERID IN (${orderIds.map(() => '?').join(', ')})`,
      params: orderIds,
    })
  }
  const { where, params } = flatten(chunks)
  return {
    sql: `${ITEM_SELECT} WHERE ${where} ORDER BY o.DATECREATED DESC, o.ORDERNO, oi.ORDERITEMSID`,
    params,
  }
}

const buildOrderQuery = (body) => {
  const chunks = baseFilters(body).concat(conditionChunks(markExact(body.conditions, body.exactText), true))
  const { where, params } = flatten(chunks)
  return {
    sql: `
      SELECT
        o.ORDERID,
        o.ORDERNO,
        o.DATECREATED,
        o.ORDERSTATUS,
        ${ORDER_PARTY_COLUMNS}
      FROM ORDERS o
      ${ORDER_PARTIES}
      WHERE ${where}
      ORDER BY o.DATECREATED DESC, o.ORDERNO
    `,
    params,
  }
}

module.exports = {
  buildItemQuery,
  buildOrderQuery,
}
