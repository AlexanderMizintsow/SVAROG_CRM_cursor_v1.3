const { normalizeRole } = require('../auth/roles')

const requireRole = (allowedRoles = []) => (req, res, next) => {
  const role = normalizeRole(req.user?.role)
  const normalizedAllowed = allowedRoles.map(normalizeRole)

  if (!role || !normalizedAllowed.includes(role)) {
    return res.status(403).json({ message: 'Недостаточно прав для выполнения операции' })
  }

  return next()
}

module.exports = {
  requireRole,
}
