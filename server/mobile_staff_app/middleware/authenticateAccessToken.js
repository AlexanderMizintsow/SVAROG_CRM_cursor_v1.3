const jwt = require('jsonwebtoken')

const authenticateAccessToken = (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const headerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : ''
  // Query-токен нужен для открытия вложений через Linking (без Authorization header)
  const queryToken =
    typeof req.query.access_token === 'string' ? req.query.access_token.trim() : ''
  const token = headerToken || queryToken

  if (!token) {
    return res.status(401).json({ message: 'Требуется access token' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    if (payload.role !== 'employee') {
      return res.status(403).json({ message: 'Недостаточно прав' })
    }
    req.user = payload
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Недействительный access token' })
  }
}

module.exports = {
  authenticateAccessToken,
}
