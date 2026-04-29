const path = require('path')
const { oneCGateway } = require('../../shared/integrations/onec/gateway')
const { awClient } = require('../../shared/integrations/aw/awClient')
const { createReminder } = require('../../shared/reminders/reminderService')
const { enqueueAndSendCompanyPush } = require('../../shared/notifications/pushService')
const { mapDraftSummary } = require('../mappers/complaintMappers')
const { getCompanyById } = require('./complaintsRepository')

const resolveManagerId = (company) => company.mpp_id || company.mpr_id || company.regional_manager_id || null

const toPublicAttachment = (row) => ({
  id: row.id,
  kind: row.kind,
  caption: row.caption || '',
  originalName: row.original_name,
  fileUrl: `/uploads/${row.stored_rel_path.replace(/\\/g, '/')}`,
  createdAt: row.created_at,
})

const normalizeOrderItems = (payload) => {
  if (Array.isArray(payload)) return payload.map((item) => String(item).trim()).filter(Boolean)
  if (Array.isArray(payload?.items)) return payload.items.map((item) => String(item).trim()).filter(Boolean)
  if (Array.isArray(payload?.result)) {
    return payload.result
      .map((row) => String(row?.NAME || row?.name || '').trim())
      .filter(Boolean)
  }
  return []
}

const buildStructuredText = ({ orderNo, nodes }) => {
  const map = new Map()
  for (const row of nodes) {
    if (!map.has(row.item_name)) map.set(row.item_name, new Map())
    const partMap = map.get(row.item_name)
    if (!partMap.has(row.part_name)) partMap.set(row.part_name, [])
    partMap.get(row.part_name).push(row.reason_name)
  }

  const lines = [`Заказ № ${orderNo}`]
  for (const [itemName, partMap] of map.entries()) {
    lines.push(itemName)
    for (const [partName, reasons] of partMap.entries()) {
      lines.push(`  - ${partName}: ${reasons.join(', ')}`)
    }
  }
  return lines.join('\n')
}

const buildAttachmentsText = (attachmentsRows = []) => {
  if (!attachmentsRows.length) return ''
  const lines = ['Вложения:']
  attachmentsRows.forEach((row, index) => {
    const caption = row.caption ? ` (описание: ${row.caption})` : ''
    lines.push(`${index + 1}. ${row.original_name}${caption}`)
  })
  return lines.join('\n')
}

const getDraftById = async (pool, { companyId, draftId }) => {
  const draftRes = await pool.query(
    `SELECT *
       FROM mobile_complaint_drafts
      WHERE id = $1 AND company_id = $2
      LIMIT 1`,
    [draftId, companyId]
  )
  if (!draftRes.rows[0]) return null
  const draft = draftRes.rows[0]
  const nodesRes = await pool.query(
    `SELECT item_name, part_name, reason_name
       FROM mobile_complaint_draft_nodes
      WHERE draft_id = $1
      ORDER BY id ASC`,
    [draftId]
  )
  return mapDraftSummary(draft, nodesRes.rows)
}

const createDraft = async (pool, { companyId, orderNo, year }) => {
  const result = await pool.query(
    `INSERT INTO mobile_complaint_drafts (company_id, order_no, year, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING *`,
    [companyId, String(orderNo).trim(), Number(year)]
  )
  return result.rows[0]
}

const addDraftNode = async (pool, { companyId, draftId, item, part, reason }) => {
  const draft = await getDraftById(pool, { companyId, draftId })
  if (!draft) throw new Error('draft not found')

  await pool.query(
    `INSERT INTO mobile_complaint_draft_nodes (draft_id, item_name, part_name, reason_name)
     VALUES ($1, $2, $3, $4)`,
    [draftId, item, part, reason]
  )
  return getDraftById(pool, { companyId, draftId })
}

const removeLastDraftNode = async (pool, { companyId, draftId }) => {
  const draft = await getDraftById(pool, { companyId, draftId })
  if (!draft) throw new Error('draft not found')

  const lastNodeRes = await pool.query(
    `SELECT id, item_name, part_name, reason_name
       FROM mobile_complaint_draft_nodes
      WHERE draft_id = $1
      ORDER BY id DESC
      LIMIT 1`,
    [draftId]
  )
  const lastNode = lastNodeRes.rows[0]
  if (!lastNode) {
    return { removed: null, draft }
  }

  await pool.query(`DELETE FROM mobile_complaint_draft_nodes WHERE id = $1`, [lastNode.id])
  return {
    removed: {
      item: lastNode.item_name,
      part: lastNode.part_name,
      reason: lastNode.reason_name,
    },
    draft: await getDraftById(pool, { companyId, draftId }),
  }
}

const clearDraftNodes = async (pool, { companyId, draftId }) => {
  const draft = await getDraftById(pool, { companyId, draftId })
  if (!draft) throw new Error('draft not found')

  const deletedRes = await pool.query(
    `DELETE FROM mobile_complaint_draft_nodes
      WHERE draft_id = $1
  RETURNING id`,
    [draftId]
  )

  return {
    removedCount: deletedRes.rowCount || 0,
    draft: await getDraftById(pool, { companyId, draftId }),
  }
}

const addDraftAttachment = async (pool, { companyId, draftId, file, caption = '', kind = 'document' }) => {
  const draft = await getDraftById(pool, { companyId, draftId })
  if (!draft) throw new Error('draft not found')

  const uploadsRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', 'uploads')
  const relPath = path.relative(uploadsRoot, file.path)

  const result = await pool.query(
    `INSERT INTO mobile_complaint_attachments
      (draft_id, kind, caption, original_name, stored_rel_path, mime_type, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [draftId, kind, caption, file.originalname, relPath, file.mimetype, file.size]
  )
  return toPublicAttachment(result.rows[0])
}

const submitDraft = async (pool, { companyId, draftId, notes = [], allowEmptyStructure = false }) => {
  const company = await getCompanyById(pool, companyId)
  if (!company) throw new Error('company not found')
  const managerId = resolveManagerId(company)
  if (!managerId) throw new Error('manager is not resolved for company')

  const draftRes = await pool.query(
    `SELECT * FROM mobile_complaint_drafts WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [draftId, companyId]
  )
  const draft = draftRes.rows[0]
  if (!draft) throw new Error('draft not found')

  const nodesRes = await pool.query(
    `SELECT item_name, part_name, reason_name
       FROM mobile_complaint_draft_nodes
      WHERE draft_id = $1
      ORDER BY id ASC`,
    [draftId]
  )
  if (!nodesRes.rows.length && !allowEmptyStructure) {
    throw new Error('draft has no complaint nodes')
  }

  const attachmentsRes = await pool.query(
    `SELECT * FROM mobile_complaint_attachments
      WHERE draft_id = $1
      ORDER BY id ASC`,
    [draftId]
  )

  const textBlocks = []
  if (notes.length) textBlocks.push(notes.join('\n'))
  if (nodesRes.rows.length) {
    textBlocks.push(buildStructuredText({ orderNo: draft.order_no, nodes: nodesRes.rows }))
  } else {
    textBlocks.push(`Заказ № ${draft.order_no}\nБыстрая рекламация без структурированного конструктора.`)
  }
  const attachmentsText = buildAttachmentsText(attachmentsRes.rows)
  if (attachmentsText) {
    textBlocks.push(attachmentsText)
  }
  const textCalc = textBlocks.join('\n\n')

  const publicBase = String(process.env.MOBILE_PUBLIC_BASE_URL || '').trim()
  const links = attachmentsRes.rows.map((item) => {
    const rel = `/uploads/${item.stored_rel_path.replace(/\\/g, '/')}`
    return publicBase ? `${publicBase}${rel}` : rel
  })
  const reminder = await createReminder(pool, {
    relatedId: -1,
    userId: managerId,
    textCalc,
    typeReminders: 'complaint_report_problem',
    priority: 'high',
    title: `Рекламация (mobile) · ${company.name_companies}`,
    tags: [{ title: 'Mobile' }, { title: 'Рекламация' }],
    links,
  })

  await pool.query(
    `UPDATE mobile_complaint_drafts
        SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
      WHERE id = $1`,
    [draftId]
  )

  return {
    reminderId: reminder.id,
    draft: await getDraftById(pool, { companyId, draftId }),
  }
}

const createQuickComplaint = async (pool, { companyId, orderName, note = '', files = [], captions = [] }) => {
  const draft = await createDraft(pool, {
    companyId,
    orderNo: orderName,
    year: 2026,
  })
  const saved = []
  for (const [index, file] of files.entries()) {
    const kind = file.mimetype?.startsWith('image/') ? 'photo' : 'document'
    const caption = String(captions[index] || '')
    // eslint-disable-next-line no-await-in-loop
    const item = await addDraftAttachment(pool, { companyId, draftId: draft.id, file, caption, kind })
    saved.push(item)
  }
  return submitDraft(pool, {
    companyId,
    draftId: draft.id,
    notes: [note].filter(Boolean),
    allowEmptyStructure: true,
  })
}

const fetchOrderItems = async (pool, { companyId, orderNo, year }) => {
  const company = await getCompanyById(pool, companyId)
  if (!company?.inn) {
    throw new Error('company INN is missing')
  }
  const payload = await awClient.getOrderItems({
    orderNo,
    inn: company.inn,
    year,
  })
  return normalizeOrderItems(payload)
}

const getComplaintList = async (pool, { companyId }) => {
  const company = await getCompanyById(pool, companyId)
  if (!company?.inn) {
    throw new Error('company INN is missing')
  }
  const onecResult = await oneCGateway.execute('complaint.list', { inn: company.inn })
  return onecResult.parsed
}

const getComplaintDetails = async (pool, { companyId, requestNumber }) => {
  const tickets = await getComplaintList(pool, { companyId })
  const ticket = tickets.find((item) => String(item.requestNumber) === String(requestNumber))
  if (!ticket) return null

  const closedRes = await pool.query(
    `SELECT defect, location, closed_at
       FROM mobile_complaint_closed_claims
      WHERE company_id = $1 AND request_number = $2
      LIMIT 1`,
    [companyId, requestNumber]
  )

  const ratingRes = await pool.query(
    `SELECT rating, comment, updated_at
       FROM mobile_complaint_ratings
      WHERE company_id = $1 AND request_number = $2
      LIMIT 1`,
    [companyId, requestNumber]
  )

  return {
    ...ticket,
    defect: closedRes.rows[0]?.defect || null,
    location: closedRes.rows[0]?.location || null,
    closedAt: closedRes.rows[0]?.closed_at || null,
    rating: ratingRes.rows[0] || null,
  }
}

const upsertClosedClaims = async (pool, claims) => {
  let insertedCount = 0
  for (const claim of claims) {
    const companyRes = await pool.query(
      `SELECT id, name_companies
         FROM companies
        WHERE ($1::text IS NOT NULL AND inn = $1) OR LOWER(name_companies) = LOWER($2)
        LIMIT 1`,
      [claim.inn, claim.contractor]
    )
    const company = companyRes.rows[0]
    if (!company) continue
    // eslint-disable-next-line no-await-in-loop
    const existsRes = await pool.query(
      `SELECT 1 FROM mobile_complaint_closed_claims WHERE request_number = $1 AND company_id = $2 LIMIT 1`,
      [claim.requestNumber, company.id]
    )
    const isNew = !existsRes.rows[0]
    // eslint-disable-next-line no-await-in-loop
    await pool.query(
      `INSERT INTO mobile_complaint_closed_claims
        (request_number, company_id, company_name, contractor_name, inn, defect, location, closed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (request_number, company_id)
       DO UPDATE SET
         contractor_name = EXCLUDED.contractor_name,
         inn = EXCLUDED.inn,
         defect = EXCLUDED.defect,
         location = EXCLUDED.location,
         updated_at = NOW()`,
      [claim.requestNumber, company.id, company.name_companies, claim.contractor, claim.inn, claim.defect, claim.location]
    )
    if (isNew) {
      insertedCount += 1
      // eslint-disable-next-line no-await-in-loop
      await enqueueAndSendCompanyPush(pool, {
        companyId: company.id,
        companyName: company.name_companies,
        title: 'Закрыта рекламация',
        body: `Заявка №${claim.requestNumber} закрыта. Оцените качество обработки.`,
        payload: {
          type: 'complaint.closed',
          requestNumber: claim.requestNumber,
        },
      })
    }
  }
  return insertedCount
}

const syncClosedClaimsFromOneC = async (pool) => {
  const result = await oneCGateway.execute('complaint.closed', {})
  const inserted = await upsertClosedClaims(pool, result.parsed)
  return inserted
}

const getPendingRatings = async (pool, { companyId }) => {
  const result = await pool.query(
    `SELECT c.request_number, c.defect, c.closed_at
       FROM mobile_complaint_closed_claims c
  LEFT JOIN mobile_complaint_ratings r
         ON r.request_number = c.request_number AND r.company_id = c.company_id
      WHERE c.company_id = $1
        AND r.id IS NULL
   ORDER BY c.closed_at DESC
      LIMIT 100`,
    [companyId]
  )
  return result.rows
}

const saveRating = async (pool, { companyId, requestNumber, rating, comment = '' }) => {
  const result = await oneCGateway.execute('complaint.rating', { requestNumber, rating })
  if (!result.parsed.ok) {
    throw new Error('oneC rating ack failed')
  }

  const upsert = await pool.query(
    `INSERT INTO mobile_complaint_ratings
      (request_number, company_id, rating, comment, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (request_number, company_id)
     DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
     RETURNING *`,
    [requestNumber, companyId, rating, comment]
  )
  return upsert.rows[0]
}

const saveRatingComment = async (pool, { companyId, requestNumber, comment }) => {
  const result = await pool.query(
    `UPDATE mobile_complaint_ratings
        SET comment = $1,
            updated_at = NOW()
      WHERE request_number = $2
        AND company_id = $3
    RETURNING *`,
    [comment, requestNumber, companyId]
  )
  if (!result.rows[0]) {
    throw new Error('rating not found')
  }
  return result.rows[0]
}

module.exports = {
  complaintsService: {
    createDraft,
    addDraftNode,
    removeLastDraftNode,
    clearDraftNodes,
    addDraftAttachment,
    submitDraft,
    createQuickComplaint,
    fetchOrderItems,
    getComplaintList,
    getComplaintDetails,
    syncClosedClaimsFromOneC,
    getPendingRatings,
    saveRating,
    saveRatingComment,
    getDraftById,
  },
}
