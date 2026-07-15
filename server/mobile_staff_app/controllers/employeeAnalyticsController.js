/**
 * Прокси аналитики CRM («Мониторинг процессов») для POZ-Staff.
 * Логика SQL/метрик — в register /api/analytics/*; здесь только auth + проброс.
 */

const { registerFetch } = require('../services/registerClient')

const buildQuery = (query = {}) => {
  const params = new URLSearchParams()
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  const s = params.toString()
  return s ? `?${s}` : ''
}

const getDepartments = () => async (_req, res) => {
  try {
    const data = await registerFetch('/api/analytics/departments')
    return res.json(data || [])
  } catch (error) {
    console.error('[mobile_staff_app][analytics][departments]', error)
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const getEmployees = () => async (req, res) => {
  try {
    const data = await registerFetch(`/api/analytics/employees${buildQuery(req.query)}`)
    return res.json(data || [])
  } catch (error) {
    console.error('[mobile_staff_app][analytics][employees]', error)
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const getSummary = () => async (req, res) => {
  try {
    const data = await registerFetch(`/api/analytics/summary${buildQuery(req.query)}`)
    return res.json(data || {})
  } catch (error) {
    console.error('[mobile_staff_app][analytics][summary]', error)
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const getDetail = () => async (req, res) => {
  try {
    const data = await registerFetch(`/api/analytics/detail${buildQuery(req.query)}`)
    return res.json(data || [])
  } catch (error) {
    console.error('[mobile_staff_app][analytics][detail]', error)
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const listBusinessProcesses = () => async (req, res) => {
  try {
    const data = await registerFetch(
      `/api/analytics/business-processes/list${buildQuery(req.query)}`
    )
    return res.json(data || [])
  } catch (error) {
    console.error('[mobile_staff_app][analytics][bp-list]', error)
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const getBusinessProcessNodes = () => async (req, res) => {
  try {
    const processId = req.params.processId
    const data = await registerFetch(
      `/api/analytics/business-processes/${processId}/nodes${buildQuery(req.query)}`
    )
    return res.json(data || {})
  } catch (error) {
    console.error('[mobile_staff_app][analytics][bp-nodes]', error)
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const getBottleneckParticipants = () => async (req, res) => {
  try {
    const data = await registerFetch(
      `/api/analytics/bottlenecks/participants${buildQuery(req.query)}`
    )
    return res.json(data || [])
  } catch (error) {
    console.error('[mobile_staff_app][analytics][bn-part]', error)
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

const getBottleneckDepartments = () => async (req, res) => {
  try {
    const data = await registerFetch(
      `/api/analytics/bottlenecks/departments${buildQuery(req.query)}`
    )
    return res.json(data || [])
  } catch (error) {
    console.error('[mobile_staff_app][analytics][bn-dept]', error)
    return res.status(error.status || 500).json({ message: error.message || 'Ошибка' })
  }
}

module.exports = {
  getDepartments,
  getEmployees,
  getSummary,
  getDetail,
  listBusinessProcesses,
  getBusinessProcessNodes,
  getBottleneckParticipants,
  getBottleneckDepartments,
}
