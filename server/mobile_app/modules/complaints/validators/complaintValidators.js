const { ALLOWED_YEARS, COMPLAINT_PARTS, REASONS_BY_PART } = require('./complaintRules')

const assertRequired = (value, fieldName) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`${fieldName} is required`)
  }
}

const validateDraftStartPayload = ({ orderNo, year }) => {
  assertRequired(orderNo, 'orderNo')
  assertRequired(year, 'year')
  if (!ALLOWED_YEARS.includes(String(year))) {
    throw new Error('year is not allowed')
  }
}

const validateDraftNodePayload = ({ item, part, reason }) => {
  assertRequired(item, 'item')
  assertRequired(part, 'part')
  assertRequired(reason, 'reason')

  if (!COMPLAINT_PARTS.includes(part)) {
    throw new Error('part is not allowed')
  }

  const allowedReasons = REASONS_BY_PART[part] || []
  if (!allowedReasons.includes(reason)) {
    throw new Error('reason is not allowed for selected part')
  }
}

const validateRatingPayload = ({ rating }) => {
  const numeric = Number(rating)
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
    throw new Error('rating must be integer from 1 to 5')
  }
}

module.exports = {
  validateDraftStartPayload,
  validateDraftNodePayload,
  validateRatingPayload,
}
