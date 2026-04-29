const mapDraftSummary = (draft, nodes = []) => ({
  id: draft.id,
  orderNo: draft.order_no,
  year: String(draft.year),
  status: draft.status,
  createdAt: draft.created_at,
  updatedAt: draft.updated_at,
  items: nodes.reduce((acc, row) => {
    const existingItem = acc.find((item) => item.name === row.item_name)
    const reason = row.reason_name
    if (!existingItem) {
      acc.push({
        name: row.item_name,
        parts: [{ name: row.part_name, reasons: [reason] }],
      })
      return acc
    }
    const existingPart = existingItem.parts.find((part) => part.name === row.part_name)
    if (!existingPart) {
      existingItem.parts.push({ name: row.part_name, reasons: [reason] })
      return acc
    }
    if (!existingPart.reasons.includes(reason)) {
      existingPart.reasons.push(reason)
    }
    return acc
  }, []),
})

const mapTicket = (row) => ({
  id: row.id,
  requestNumber: row.request_number,
  orderNumber: row.order_number,
  status: row.status,
  comment: row.comment,
  createdAt: row.created_at,
  closedAt: row.closed_at,
})

module.exports = {
  mapDraftSummary,
  mapTicket,
}
