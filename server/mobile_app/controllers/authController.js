const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

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
  { companyId = null, companyName = null, eventType, status, message, ipAddress, userAgent }
) => {
  await pool.query(
    `INSERT INTO mobile_auth_audit_logs
      (company_id, company_name, event_type, status, message, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [companyId, companyName, eventType, status, message, ipAddress, userAgent]
  )
}

const createSessionTokens = async (pool, company) => {
  const refreshTokenId = crypto.randomUUID()
  const tokenPayload = {
    companyId: company.id,
    companyName: company.name_companies,
    role: 'dealer',
    roleLegacy: 'dealer_mobile',
  }

  const accessToken = createAccessToken(tokenPayload)
  const refreshToken = createRefreshToken({
    ...tokenPayload,
    jti: refreshTokenId,
  })

  await pool.query(
    `INSERT INTO mobile_refresh_sessions
      (refresh_token_id, company_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
    [refreshTokenId, company.id, hashToken(refreshToken)]
  )

  return { accessToken, refreshToken }
}

const login = (pool) => async (req, res) => {
  const { companyName, password } = req.body
  const meta = getClientMeta(req)
  const normalizedCompanyName = String(companyName || '').trim()
  const normalizedPassword = String(password || '')

  if (!normalizedCompanyName || !normalizedPassword) {
    console.log(
      '[mobile_app][auth][login] 400 missing fields',
      { ip: meta.ipAddress, ua: meta.userAgent?.slice(0, 80) }
    )
    return res.status(400).json({ message: 'Имя компании и пароль обязательны' })
  }

  const nameForLog = normalizedCompanyName
  console.log('[mobile_app][auth][login] attempt', {
    company: nameForLog,
    ip: meta.ipAddress,
    ua: meta.userAgent?.slice(0, 80),
  })

  try {
    const result = await pool.query(
      `SELECT id, name_companies, mobile_password
       FROM companies
       WHERE LOWER(name_companies) = LOWER($1)
       LIMIT 1`,
      [normalizedCompanyName]
    )

    if (!result.rows.length) {
      console.log('[mobile_app][auth][login] 401 company not found', { company: nameForLog })
      await writeAuditLog(pool, {
        companyName: normalizedCompanyName,
        eventType: 'login',
        status: 'failed',
        message: 'Компания не найдена',
        ...meta,
      })
      return res.status(401).json({ message: 'Данные введены не верно' })
    }

    const company = result.rows[0]
    if (company.mobile_password === 'NOTACCES') {
      await writeAuditLog(pool, {
        companyId: company.id,
        companyName: company.name_companies,
        eventType: 'login',
        status: 'failed',
        message: 'Доступ не выдан',
        ...meta,
      })
      console.log('[mobile_app][auth][login] 403 access not granted (NOTACCES)', {
        companyId: company.id,
        company: company.name_companies,
      })
      return res.status(403).json({
        message: 'Доступ не выдан. Обратитесь к менеджерам ПОЗ.',
      })
    }

    if (!isBcryptHash(company.mobile_password)) {
      await writeAuditLog(pool, {
        companyId: company.id,
        companyName: company.name_companies,
        eventType: 'login',
        status: 'failed',
        message: 'Пароль для мобильного входа не настроен',
        ...meta,
      })
      console.log('[mobile_app][auth][login] 403 password hash invalid', {
        companyId: company.id,
        company: company.name_companies,
      })
      return res.status(403).json({
        message: 'Доступ не настроен. Обратитесь к менеджерам ПОЗ.',
      })
    }

    let isValidPassword = false
    try {
      isValidPassword = await bcrypt.compare(normalizedPassword, company.mobile_password)
    } catch (compareError) {
      await writeAuditLog(pool, {
        companyId: company.id,
        companyName: company.name_companies,
        eventType: 'login',
        status: 'failed',
        message: 'Ошибка проверки пароля',
        ...meta,
      })
      console.error('[mobile_app][auth][login] bcrypt compare failed', {
        companyId: company.id,
        company: company.name_companies,
        error: compareError?.message || compareError,
      })
      return res.status(401).json({ message: 'Данные введены не верно' })
    }

    if (!isValidPassword) {
      await writeAuditLog(pool, {
        companyId: company.id,
        companyName: company.name_companies,
        eventType: 'login',
        status: 'failed',
        message: 'Неверный пароль',
        ...meta,
      })
      console.log('[mobile_app][auth][login] 401 wrong password', {
        companyId: company.id,
        company: company.name_companies,
      })
      return res.status(401).json({ message: 'Данные введены не верно' })
    }
    const tokens = await createSessionTokens(pool, company)
    await writeAuditLog(pool, {
      companyId: company.id,
      companyName: company.name_companies,
      eventType: 'login',
      status: 'success',
      message: 'Успешный вход',
      ...meta,
    })

    console.log('[mobile_app][auth][login] 200 ok', {
      companyId: company.id,
      company: company.name_companies,
    })
    return res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      company: {
        id: company.id,
        name: company.name_companies,
      },
    })
  } catch (error) {
    console.error('[mobile_app][auth][login] 500', error)
    console.error('Ошибка при mobile авторизации:', error)
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
    if (!decoded.jti || !decoded.companyId) {
      await writeAuditLog(pool, {
        companyName: decoded.companyName || null,
        eventType: 'refresh',
        status: 'failed',
        message: 'Отсутствует jti/companyId в refresh токене',
        ...meta,
      })
      return res.status(401).json({ message: 'Недействительный refresh token' })
    }

    const sessionResult = await pool.query(
      `SELECT refresh_token_id, company_id, refresh_token_hash, revoked_at, expires_at
       FROM mobile_refresh_sessions
       WHERE refresh_token_id = $1 AND company_id = $2
       LIMIT 1`,
      [decoded.jti, decoded.companyId]
    )

    if (!sessionResult.rows.length) {
      await writeAuditLog(pool, {
        companyId: decoded.companyId,
        companyName: decoded.companyName || null,
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
        companyId: decoded.companyId,
        companyName: decoded.companyName || null,
        eventType: 'refresh',
        status: 'failed',
        message: 'Сессия истекла или отозвана',
        ...meta,
      })
      return res.status(401).json({ message: 'Недействительный refresh token' })
    }

    if (hashToken(refreshToken) !== session.refresh_token_hash) {
      await writeAuditLog(pool, {
        companyId: decoded.companyId,
        companyName: decoded.companyName || null,
        eventType: 'refresh',
        status: 'failed',
        message: 'Хэш refresh token не совпал',
        ...meta,
      })
      return res.status(401).json({ message: 'Недействительный refresh token' })
    }

    await pool.query(
      `UPDATE mobile_refresh_sessions
       SET revoked_at = NOW(), revoke_reason = 'rotated'
       WHERE refresh_token_id = $1`,
      [session.refresh_token_id]
    )

    const company = {
      id: decoded.companyId,
      name_companies: decoded.companyName,
    }
    const tokens = await createSessionTokens(pool, company)

    await writeAuditLog(pool, {
      companyId: decoded.companyId,
      companyName: decoded.companyName || null,
      eventType: 'refresh',
      status: 'success',
      message: 'Refresh token успешно обновлен',
      ...meta,
    })

    return res.status(200).json(tokens)
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
    if (!decoded.jti || !decoded.companyId) {
      return res.status(401).json({ message: 'Недействительный refresh token' })
    }

    await pool.query(
      `UPDATE mobile_refresh_sessions
       SET revoked_at = NOW(), revoke_reason = 'logout'
       WHERE refresh_token_id = $1 AND company_id = $2 AND revoked_at IS NULL`,
      [decoded.jti, decoded.companyId]
    )

    await writeAuditLog(pool, {
      companyId: decoded.companyId,
      companyName: decoded.companyName || null,
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
