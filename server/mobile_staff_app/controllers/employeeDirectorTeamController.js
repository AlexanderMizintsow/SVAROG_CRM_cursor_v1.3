/**
 * Команда директора: непосредственные подчинённые + метрики их отделов.
 */

const { registerFetch } = require('../services/registerClient')

const displayName = (row) =>
  [row.last_name, row.first_name, row.middle_name].filter(Boolean).join(' ').trim() ||
  `Сотрудник #${row.user_id}`

const extractDeptMetrics = (summaryData) => {
  const tasks = summaryData?.summary?.byCategory?.tasks || {}
  const projects = summaryData?.summary?.byCategory?.projects || {}
  const byDept = Array.isArray(summaryData?.byDepartment) ? summaryData.byDepartment[0] : null
  return {
    tasksInProgress: Number(tasks.total) || Number(byDept?.tasksCount) || 0,
    tasksOverdue: Number(tasks.overdue) || Number(byDept?.overdueCount) || 0,
    projectsInProgress: Number(projects.total) || Number(byDept?.projectsCount) || 0,
  }
}

const getTeamSummary = (pool) => async (req, res) => {
  try {
    const managerId = Number(req.user.userId)
    if (!Number.isFinite(managerId) || managerId <= 0) {
      return res.status(401).json({ message: 'Некорректный пользователь' })
    }

    const { rows } = await pool.query(
      `
      SELECT
        u.id AS user_id,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.department_id,
        d.name AS department_name,
        COALESCE(p.name, '') AS position_name,
        u.status
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN positions p ON p.id = u.position_id
      WHERE u.supervisor_id = $1
      ORDER BY u.last_name NULLS LAST, u.first_name NULLS LAST, u.id
      `,
      [managerId]
    )

    const members = (rows || []).filter((r) => {
      const st = String(r.status || '').toLowerCase()
      return st !== 'fired' && st !== 'уволён' && st !== 'уволен' && st !== 'inactive'
    })

    const uniqueDeptIds = [
      ...new Set(
        members
          .map((m) => m.department_id)
          .filter((id) => id != null && String(id).trim() !== '')
          .map((id) => String(id))
      ),
    ]

    const metricsByDept = {}
    await Promise.all(
      uniqueDeptIds.map(async (departmentId) => {
        try {
          const qs = new URLSearchParams({
            departmentId: String(departmentId),
            statusFilter: 'in_progress',
            clientNow: new Date().toISOString(),
          })
          const summaryData = await registerFetch(`/api/analytics/summary?${qs.toString()}`)
          metricsByDept[departmentId] = extractDeptMetrics(summaryData)
        } catch (err) {
          console.error('[mobile_staff_app][director-team][metrics]', departmentId, err.message)
          metricsByDept[departmentId] = {
            tasksInProgress: 0,
            tasksOverdue: 0,
            projectsInProgress: 0,
          }
        }
      })
    )

    const emptyMetrics = {
      tasksInProgress: 0,
      tasksOverdue: 0,
      projectsInProgress: 0,
    }

    return res.json({
      members: members.map((m) => {
        const departmentId = m.department_id != null ? String(m.department_id) : null
        const metrics =
          departmentId && metricsByDept[departmentId]
            ? metricsByDept[departmentId]
            : emptyMetrics
        return {
          userId: Number(m.user_id),
          name: displayName(m),
          positionName: m.position_name || '',
          departmentId,
          departmentName: m.department_name || 'Без отдела',
          metrics: {
            tasksInProgress: metrics.tasksInProgress,
            tasksOverdue: metrics.tasksOverdue,
            projectsInProgress: metrics.projectsInProgress,
          },
        }
      }),
    })
  } catch (error) {
    console.error('[mobile_staff_app][director-team]', error)
    return res.status(500).json({ message: error.message || 'Ошибка загрузки команды' })
  }
}

module.exports = {
  getTeamSummary,
}
