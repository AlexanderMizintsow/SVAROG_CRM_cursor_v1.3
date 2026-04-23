const MOBILE_ROLES = Object.freeze({
  DEALER: 'dealer',
  EMPLOYEE: 'employee',
})

const normalizeRole = (value) => String(value || '').trim().toLowerCase()

const isKnownRole = (role) => Object.values(MOBILE_ROLES).includes(normalizeRole(role))

module.exports = {
  MOBILE_ROLES,
  normalizeRole,
  isKnownRole,
}
