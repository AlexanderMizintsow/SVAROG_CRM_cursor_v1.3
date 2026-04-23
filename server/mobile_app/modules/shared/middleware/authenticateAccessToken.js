const jwt = require('jsonwebtoken')

const authenticateAccessToken = (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Требуется access token' })
  }

  const token = authHeader.slice(7).trim()
  if (!token) {
    return res.status(401).json({ message: 'Требуется access token' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    req.user = payload
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Недействительный access token' })
  }
}

module.exports = {
  authenticateAccessToken,
}
