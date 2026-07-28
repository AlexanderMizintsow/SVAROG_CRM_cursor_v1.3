const { computeDigestCounts, buildDigestBody } = require('../services/directorDigestScheduler')

const getDigestSettings = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const prefs = await pool.query(
      `SELECT enabled, last_sent_on FROM staff_director_digest_prefs WHERE user_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] }))

    const counts = await computeDigestCounts(pool, userId)
    const enabled =
      prefs.rows[0]?.enabled === undefined ? true : Boolean(prefs.rows[0].enabled)

    return res.json({
      enabled,
      lastSentOn: prefs.rows[0]?.last_sent_on || null,
      summary: {
        ...counts,
        text: buildDigestBody(counts),
      },
    })
  } catch (error) {
    console.error('[mobile_staff_app][digest][get]', error)
    if (error.code === '42P01') {
      return res.status(503).json({
        message: 'Таблица дайджеста не создана. Выполните add_staff_director_digest_prefs.sql',
      })
    }
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

const setDigestSettings = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const enabled = req.body?.enabled !== false
    await pool.query(
      `
      INSERT INTO staff_director_digest_prefs (user_id, enabled, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) DO UPDATE
        SET enabled = EXCLUDED.enabled, updated_at = NOW()
      `,
      [userId, enabled]
    )
    return res.json({ enabled })
  } catch (error) {
    console.error('[mobile_staff_app][digest][set]', error)
    if (error.code === '42P01') {
      return res.status(503).json({
        message: 'Таблица дайджеста не создана. Выполните add_staff_director_digest_prefs.sql',
      })
    }
    return res.status(500).json({ message: error.message || 'Ошибка' })
  }
}

module.exports = {
  getDigestSettings,
  setDigestSettings,
}
