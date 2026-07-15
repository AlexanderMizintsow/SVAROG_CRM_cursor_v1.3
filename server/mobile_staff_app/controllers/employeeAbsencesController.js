/**
 * Прокси отсутствий сотрудников (отпуск / командировка / …).
 * Те же данные, что GET /api/users/absences/* на register.
 */

const { registerFetch } = require('../services/registerClient')

const getActive = () => async (_req, res) => {
  try {
    const data = await registerFetch('/api/users/absences/active')
    return res.json(Array.isArray(data) ? data : [])
  } catch (error) {
    console.error('[mobile_staff_app][absences][active]', error)
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const getUpcoming = () => async (_req, res) => {
  try {
    const data = await registerFetch('/api/users/absences/upcoming')
    return res.json(Array.isArray(data) ? data : [])
  } catch (error) {
    console.error('[mobile_staff_app][absences][upcoming]', error)
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

module.exports = { getActive, getUpcoming }
