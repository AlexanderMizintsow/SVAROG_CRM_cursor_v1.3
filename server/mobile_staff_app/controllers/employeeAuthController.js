const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const MOBILE_STAFF_PASSWORD_LOCKED = 'NOTACCES'

const createAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' })

const createRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' })

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')
const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value)

const getClientMeta = (req) => ({
  ipAddress: req.headers['x-forwarded-for'] || req.ip || null,
  userAgent: req.headers['user-agent'] || null,
})

const writeAuditLog = async (
  pool,
  { userId = null, username = null, eventType, status, message, ipAddress, userAgent }
) => {
  await pool.query(
    `INSERT INTO mobile_staff_auth_audit_logs
      (user_id, username, event_type, status, message, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, username, eventType, status, message, ipAddress, userAgent]
  )
}

const buildUserDisplayName = (row) => {
  const parts = [row.last_name, row.first_name, row.middle_name].filter(Boolean)
  return parts.length ? parts.join(' ') : row.username
}

const createSessionTokens = async (pool, userRow) => {
  const refreshTokenId = crypto.randomUUID()
  const displayName = buildUserDisplayName(userRow)
  const tokenPayload = {
    userId: userRow.id,
    username: userRow.username,
    role: 'employee',
    roleName: userRow.role_name || null,
    displayName,
  }

  const accessToken = createAccessToken(tokenPayload)
  const refreshToken = createRefreshToken({
    ...tokenPayload,
    jti: refreshTokenId,
  })

  await pool.query(
    `INSERT INTO mobile_employee_refresh_sessions
      (refresh_token_id, user_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
    [refreshTokenId, userRow.id, hashToken(refreshToken)]
  )

  return { accessToken, refreshToken, displayName }
}

const login = (pool) => async (req, res) => {
  const { login: loginField, password } = req.body
  const meta = getClientMeta(req)
  const normalizedLogin = String(loginField || '').trim()
  const normalizedPassword = String(password || '')

  if (!normalizedLogin || !normalizedPassword) {
    return res.status(400).json({ message: 'Логин и пароль обязательны' })
  }

  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.username,
         u.first_name,
         u.last_name,
         u.middle_name,
         u.mobile_staff_password,
         u.role_assigned,
         r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.username) = LOWER($1)
       LIMIT 1`,
      [normalizedLogin]
    )

    if (!result.rows.length) {
      await writeAuditLog(pool, {
        username: normalizedLogin,
        eventType: 'login',
        status: 'failed',
        message: 'Пользователь не найден',
        ...meta,
      })
      return res.status(401).json({ message: 'Данные введены не верно' })
    }

    const user = result.rows[0]

    if (!user.role_assigned) {
      await writeAuditLog(pool, {
        userId: user.id,
        username: user.username,
        eventType: 'login',
        status: 'failed',
        message: 'Роль не назначена',
        ...meta,
      })
      return res.status(403).json({
        message: 'Доступ не настроен. Обратитесь к администратору.',
      })
    }

    if (user.mobile_staff_password === MOBILE_STAFF_PASSWORD_LOCKED) {
      await writeAuditLog(pool, {
        userId: user.id,
        username: user.username,
        eventType: 'login',
        status: 'failed',
        message: 'Доступ не выдан',
        ...meta,
      })
      return res.status(403).json({
        message: 'Доступ не выдан. Обратитесь к администратору.',
      })
    }

    if (!isBcryptHash(user.mobile_staff_password)) {
      await writeAuditLog(pool, {
        userId: user.id,
        username: user.username,
        eventType: 'login',
        status: 'failed',
        message: 'Мобильный пароль не настроен',
        ...meta,
      })
      return res.status(403).json({
        message: 'Доступ не настроен. Обратитесь к администратору.',
      })
    }

    let isValidPassword = false
    try {
      isValidPassword = await bcrypt.compare(normalizedPassword, user.mobile_staff_password)
    } catch (compareError) {
      await writeAuditLog(pool, {
        userId: user.id,
        username: user.username,
        eventType: 'login',
        status: 'failed',
        message: 'Ошибка проверки пароля',
        ...meta,
      })
      return res.status(401).json({ message: 'Данные введены не верно' })
    }

    if (!isValidPassword) {
      await writeAuditLog(pool, {
        userId: user.id,
        username: user.username,
        eventType: 'login',
        status: 'failed',
        message: 'Неверный пароль',
        ...meta,
      })
      return res.status(401).json({ message: 'Данные введены не верно' })
    }

    const tokens = await createSessionTokens(pool, user)
    await writeAuditLog(pool, {
      userId: user.id,
      username: user.username,
      eventType: 'login',
      status: 'success',
      message: 'Успешный вход',
      ...meta,
    })

    return res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        login: user.username,
        name: tokens.displayName,
        roleName: user.role_name || null,
      },
    })
  } catch (error) {
    console.error('[mobile_staff_app][auth][login] 500', error)
    return res.status(500).json({ message: 'Внутренняя ошибка сервера' })
  }
}

const refresh = (pool) => async (req, res) => {
  const { refreshToken } = req.body
  const meta = getClientMeta(req)

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token обязателен' })
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
    if (!decoded.jti || !decoded.userId) {
      await writeAuditLog(pool, {
        username: decoded.username || null,
        eventType: 'refresh',
        status: 'failed',
        message: 'Отсутствует jti/userId в refresh токене',
        ...meta,
      })
      return res.status(401).json({ message: 'Недействительный refresh token' })
    }

    const sessionResult = await pool.query(
      `SELECT refresh_token_id, user_id, refresh_token_hash, revoked_at, expires_at
       FROM mobile_employee_refresh_sessions
       WHERE refresh_token_id = $1 AND user_id = $2
       LIMIT 1`,
      [decoded.jti, decoded.userId]
    )

    if (!sessionResult.rows.length) {
      await writeAuditLog(pool, {
        userId: decoded.userId,
        username: decoded.username || null,
        eventType: 'refresh',
        status: 'failed',
        message: 'Сессия refresh token не найдена',
        ...meta,
      })
      return res.status(401).json({ message: 'Недействительный refresh token' })
    }

    const session = sessionResult.rows[0]
    if (session.revoked_at || new Date(session.expires_at) <= new Date()) {
      await writeAuditLog(pool, {
        userId: decoded.userId,
        username: decoded.username || null,
        eventType: 'refresh',
        status: 'failed',
        message: 'Сессия истекла или отозвана',
        ...meta,
      })
      return res.status(401).json({ message: 'Недействительный refresh token' })
    }

    if (hashToken(refreshToken) !== session.refresh_token_hash) {
      await writeAuditLog(pool, {
        userId: decoded.userId,
        username: decoded.username || null,
        eventType: 'refresh',
        status: 'failed',
        message: 'Хэш refresh token не совпал',
        ...meta,
      })
      return res.status(401).json({ message: 'Недействительный refresh token' })
    }

    await pool.query(
      `UPDATE mobile_employee_refresh_sessions
       SET revoked_at = NOW(), revoke_reason = 'rotated'
       WHERE refresh_token_id = $1`,
      [session.refresh_token_id]
    )

    const userResult = await pool.query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.middle_name, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1
       LIMIT 1`,
      [decoded.userId]
    )

    if (!userResult.rows.length) {
      return res.status(401).json({ message: 'Недействительный refresh token' })
    }

    const tokens = await createSessionTokens(pool, userResult.rows[0])

    await writeAuditLog(pool, {
      userId: decoded.userId,
      username: decoded.username || null,
      eventType: 'refresh',
      status: 'success',
      message: 'Refresh token успешно обновлен',
      ...meta,
    })

    return res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: userResult.rows[0].id,
        login: userResult.rows[0].username,
        name: tokens.displayName,
        roleName: userResult.rows[0].role_name || null,
      },
    })
  } catch (error) {
    await writeAuditLog(pool, {
      eventType: 'refresh',
      status: 'failed',
      message: 'Ошибка валидации refresh token',
      ...meta,
    })
    return res.status(401).json({ message: 'Недействительный refresh token' })
  }
}

const logout = (pool) => async (req, res) => {
  const { refreshToken } = req.body
  const meta = getClientMeta(req)

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token обязателен' })
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
    if (!decoded.jti || !decoded.userId) {
      return res.status(401).json({ message: 'Недействительный refresh token' })
    }

    await pool.query(
      `UPDATE mobile_employee_refresh_sessions
       SET revoked_at = NOW(), revoke_reason = 'logout'
       WHERE refresh_token_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [decoded.jti, decoded.userId]
    )

    await writeAuditLog(pool, {
      userId: decoded.userId,
      username: decoded.username || null,
      eventType: 'logout',
      status: 'success',
      message: 'Сессия завершена пользователем',
      ...meta,
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(401).json({ message: 'Недействительный refresh token' })
  }
}

module.exports = {
  login,
  refresh,
  logout,
}
