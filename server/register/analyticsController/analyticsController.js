/**
 * Контроллер аналитики для компонента «Мониторинг процессов».
 * Проекты/задачи из БП учитываются только в категории «Бизнес-процессы»;
 * задачи из проекта (без БП) — в категории «Проекты».
 *
 * Просрочки (overdue): только ЗАДАЧИ (tasks). Определение как в канбане и в checkOverdueTasks:
 * дедлайн задан, дедлайн уже наступил (<= NOW()), статус задачи не «done» (не в колонке «Выполнено»).
 * Проекты (global_tasks) в блок «Просрочки» не входят.
 */

/** Часовой пояс для интерпретации дедлайна (tasks.deadline без зоны) — как в index.js для пула. */
const APP_TZ = (process.env.DB_TIMEZONE || 'Europe/Moscow').replace(/'/g, "''")

/** Дедлайн в БД — TIMESTAMP без зоны; при сессии в Europe/Moscow туда попадает локальное время. Сравниваем с «сейчас» в том же поясе (APP_TZ). */
const OVERDUE_COND = `(t.deadline IS NOT NULL AND t.status IS DISTINCT FROM 'done' AND t.deadline <= (CURRENT_TIMESTAMP AT TIME ZONE '${APP_TZ}'))`
/** Просрочено среди завершённых: дедлайн был раньше completed_at. */
const OVERDUE_COMPLETED_COND = `(t.deadline IS NOT NULL AND t.completed_at IS NOT NULL AND t.deadline < t.completed_at)`
/** В работе и не просрочено. */
const NOT_OVERDUE_IN_PROGRESS = `(t.deadline IS NULL OR t.deadline > (CURRENT_TIMESTAMP AT TIME ZONE '${APP_TZ}'))`

/** Проекты: финальные статусы (работа больше не ведётся). */
const PROJECT_STATUS_COMPLETED = `(gt.status IN ('Завершено', 'Провал', 'Удален'))`
const PROJECT_STATUS_IN_PROGRESS = `(gt.status IS NULL OR gt.status NOT IN ('Завершено', 'Провал', 'Удален'))`
/** Задачи: по completed_at. */
const TASK_STATUS_COMPLETED = `(t.completed_at IS NOT NULL)`
const TASK_STATUS_IN_PROGRESS = `(t.completed_at IS NULL)`
/** БП: финальные и активные. */
const BP_STATUS_COMPLETED = `(pi.status IN ('completed', 'failed', 'cancelled'))`
const BP_STATUS_IN_PROGRESS = `(pi.status IN ('running', 'waiting_gateway', 'waiting_timer', 'waiting_user_input', 'waiting_decision', 'waiting_additional_info', 'waiting_join'))`

function buildFilters(req) {
  const dateFrom = req.query.dateFrom || null
  const dateTo = req.query.dateTo || null
  const departmentId = req.query.departmentId || null
  const userId = req.query.userId || null
  const statusFilter = req.query.statusFilter || null
  const params = []
  let dateFilter = ''
  let dateFilterT = ''
  let dateFilterBP = ''
  if (dateFrom && dateTo) {
    params.push(dateFrom, dateTo)
    dateFilter = ' AND gt.created_at >= CAST($1 AS timestamp) AND gt.created_at <= CAST($2 AS timestamp)'
    dateFilterT = ' AND t.created_at >= CAST($1 AS timestamp) AND t.created_at <= CAST($2 AS timestamp)'
    dateFilterBP = ' AND pi.started_at >= CAST($1 AS timestamp) AND pi.started_at <= CAST($2 AS timestamp)'
  }
  let depFilter = ''
  let depFilterTask = ''
  let taskDepExistsFilter = ''
  let projDepFilter = ''
  let projUserFilter = ''
  if (departmentId) {
    params.push(departmentId)
    const n = params.length
    const phDepCast = `CAST($${n} AS integer)`
    depFilter = ` AND u.department_id = ${phDepCast}`
    depFilterTask = ` AND u_assignee.department_id = ${phDepCast}`
    taskDepExistsFilter = ` AND EXISTS (SELECT 1 FROM task_assignments ta JOIN users u ON u.id = ta.user_id WHERE ta.task_id = t.id AND u.department_id = ${phDepCast})`
    projDepFilter = ` AND (gt.created_by IN (SELECT id FROM users WHERE department_id = ${phDepCast}) OR gt.id IN (SELECT global_task_id FROM global_task_responsibles WHERE user_id IN (SELECT id FROM users WHERE department_id = ${phDepCast})))`
  }
  let userFilterProject = ''
  let userFilterTask = ''
  let taskUserExistsFilter = ''
  let userFilterBP = ''
  if (userId) {
    params.push(userId)
    const n = params.length
    const phCast = `CAST($${n} AS integer)`
    userFilterProject = ` AND gt.created_by = ${phCast}`
    projUserFilter = ` AND (gt.created_by = ${phCast} OR gt.id IN (SELECT global_task_id FROM global_task_responsibles WHERE user_id = ${phCast}))`
    userFilterTask = ` AND ta.user_id = ${phCast}`
    taskUserExistsFilter = ` AND EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.user_id = ${phCast})`
    userFilterBP = ` AND pi.initiator_id = ${phCast}`
  }
  let projStatusCond = ''
  let taskStatusCond = ''
  let bpStatusCond = ''
  let overdueCond = OVERDUE_COND
  if (statusFilter === 'in_progress') {
    projStatusCond = ` AND ${PROJECT_STATUS_IN_PROGRESS}`
    taskStatusCond = ` AND ${TASK_STATUS_IN_PROGRESS}`
    bpStatusCond = ` AND ${BP_STATUS_IN_PROGRESS}`
  } else if (statusFilter === 'completed') {
    projStatusCond = ` AND ${PROJECT_STATUS_COMPLETED}`
    taskStatusCond = ` AND ${TASK_STATUS_COMPLETED}`
    bpStatusCond = ` AND ${BP_STATUS_COMPLETED}`
    overdueCond = OVERDUE_COMPLETED_COND
  }
  return {
    params,
    dateFilter,
    dateFilterT,
    dateFilterBP,
    depFilter,
    depFilterTask,
    taskDepExistsFilter,
    taskUserExistsFilter,
    projDepFilter,
    projUserFilter,
    userFilterProject,
    userFilterTask,
    userFilterBP,
    statusFilter,
    projStatusCond,
    taskStatusCond,
    bpStatusCond,
    overdueCond,
  }
}

const getAnalyticsSummary = (dbPool) => {
  return async (req, res) => {
    try {
      const departmentId = req.query.departmentId || null
      const userId = req.query.userId || null
      const { params, dateFilter, dateFilterT, dateFilterBP, depFilter, depFilterTask, taskDepExistsFilter, taskUserExistsFilter, projDepFilter, projUserFilter, userFilterProject, userFilterTask, userFilterBP, statusFilter, projStatusCond, taskStatusCond, bpStatusCond, overdueCond } = buildFilters(req)
      // Объединяем оба фильтра, чтобы все параметры ($1, $2, ...) использовались в запросе — иначе PostgreSQL 42P18
      const projFilter = [projDepFilter, projUserFilter].filter(Boolean).join(' ')

      const projectsStandalone = await dbPool.query(
        `SELECT COUNT(*) AS cnt, 
                COUNT(*) FILTER (WHERE gt.status = 'Завершено') AS completed,
                COUNT(*) FILTER (WHERE gt.status = 'Пауза') AS on_pause,
                COUNT(*) FILTER (WHERE gt.status = 'Провал') AS failed,
                COUNT(*) FILTER (WHERE gt.status = 'Удален') AS deleted
         FROM global_tasks gt
         WHERE gt.id NOT IN (SELECT global_task_id FROM bp_gateway_project_waiting)
           ${dateFilter} ${projFilter} ${projStatusCond}`,
        params
      )

      const n2 = params.length
      const n1 = departmentId && userId ? n2 - 1 : n2
      const bpExecFilter = (departmentId || userId)
        ? (userId
          ? ` AND (EXISTS (SELECT 1 FROM bp_task_process_links l JOIN task_assignments ta ON ta.task_id = l.task_id WHERE ta.user_id = CAST($${n2} AS integer) AND l.process_instance_id = w.instance_id)
             OR EXISTS (SELECT 1 FROM tasks t JOIN task_assignments ta ON ta.task_id = t.id WHERE t.business_process_instance_id = w.instance_id AND ta.user_id = CAST($${n2} AS integer)))
             ${departmentId && userId ? ` AND (SELECT department_id FROM users WHERE id = CAST($${n2} AS integer)) = CAST($${n1} AS integer)` : ''}`
          : ` AND (EXISTS (SELECT 1 FROM bp_task_process_links l JOIN task_assignments ta ON ta.task_id = l.task_id JOIN users u ON u.id = ta.user_id WHERE u.department_id = CAST($${n2} AS integer) AND l.process_instance_id = w.instance_id)
              OR EXISTS (SELECT 1 FROM tasks t JOIN task_assignments ta ON ta.task_id = t.id JOIN users u ON u.id = ta.user_id WHERE t.business_process_instance_id = w.instance_id AND u.department_id = CAST($${n2} AS integer)))`)
        : ''
      const projectsFromBP = await dbPool.query(
        `SELECT COUNT(*) AS cnt FROM global_tasks gt
         JOIN bp_gateway_project_waiting w ON w.global_task_id = gt.id
         WHERE 1=1 ${dateFilter} ${bpExecFilter} ${projStatusCond}`,
        params
      )
      const pFromBP = parseInt(projectsFromBP.rows[0]?.cnt || 0, 10)

      const tasksFromBP = await dbPool.query(
        `SELECT COUNT(DISTINCT t.id) AS cnt,
                COUNT(DISTINCT t.id) FILTER (WHERE t.completed_at IS NOT NULL) AS completed,
                COUNT(DISTINCT t.id) FILTER (WHERE ${overdueCond}) AS overdue
         FROM tasks t
         LEFT JOIN task_history th ON th.task_id = t.id AND th.change_description = 'Дедлайн истёк'
         LEFT JOIN task_assignments ta ON ta.task_id = t.id
         LEFT JOIN users u_assignee ON u_assignee.id = ta.user_id
         WHERE (t.business_process_instance_id IS NOT NULL OR t.id IN (SELECT task_id FROM bp_task_process_links))
           ${dateFilterT} ${depFilterTask} ${userFilterTask} ${taskStatusCond}`,
        params
      )

      const tasksFromProject = await dbPool.query(
        `SELECT COUNT(DISTINCT t.id) AS cnt,
                COUNT(DISTINCT t.id) FILTER (WHERE t.completed_at IS NOT NULL) AS completed,
                COUNT(DISTINCT t.id) FILTER (WHERE ${overdueCond}) AS overdue
         FROM tasks t
         LEFT JOIN task_history th ON th.task_id = t.id AND th.change_description = 'Дедлайн истёк'
         LEFT JOIN task_assignments ta ON ta.task_id = t.id
         LEFT JOIN users u_assignee ON u_assignee.id = ta.user_id
         WHERE t.global_task_id IS NOT NULL
           AND (t.business_process_instance_id IS NULL AND t.id NOT IN (SELECT task_id FROM bp_task_process_links))
           ${dateFilterT} ${depFilterTask} ${userFilterTask} ${taskStatusCond}`,
        params
      )

      const tasksStandalone = await dbPool.query(
        `SELECT COUNT(DISTINCT t.id) AS cnt,
                COUNT(DISTINCT t.id) FILTER (WHERE t.completed_at IS NOT NULL) AS completed,
                COUNT(DISTINCT t.id) FILTER (WHERE ${overdueCond}) AS overdue
         FROM tasks t
         LEFT JOIN task_history th ON th.task_id = t.id AND th.change_description = 'Дедлайн истёк'
         LEFT JOIN task_assignments ta ON ta.task_id = t.id
         LEFT JOIN users u_assignee ON u_assignee.id = ta.user_id
         WHERE t.global_task_id IS NULL AND t.business_process_instance_id IS NULL
           ${dateFilterT} ${depFilterTask} ${userFilterTask} ${taskStatusCond}`,
        params
      )

      // Задачи: все задачи (включая корневые проектов) во всех фильтрах — чтобы завершённые и одобренные автором тоже попадали в карточку и диаграмму
      const tasksScopeCond = '1=1'
      const tasksAsTasks = await dbPool.query(
        `SELECT COUNT(DISTINCT t.id) AS cnt,
                COUNT(DISTINCT t.id) FILTER (WHERE t.completed_at IS NOT NULL) AS completed,
                COUNT(DISTINCT t.id) FILTER (WHERE ${overdueCond}) AS overdue
         FROM tasks t
         LEFT JOIN task_history th ON th.task_id = t.id AND th.change_description = 'Дедлайн истёк'
         LEFT JOIN task_assignments ta ON ta.task_id = t.id
         LEFT JOIN users u_assignee ON u_assignee.id = ta.user_id
         WHERE ${tasksScopeCond}
           AND t.business_process_instance_id IS NULL
           AND t.id NOT IN (SELECT task_id FROM bp_task_process_links)
           ${dateFilterT} ${depFilterTask} ${userFilterTask} ${taskStatusCond}`,
        params
      )

      // При фильтре «В работе» — отдельный запрос просрочки. «Сейчас» с клиента (clientNow), период — как в списке и диаграмме.
      let overdueCountInProgress = null
      if (statusFilter === 'in_progress') {
        const nowIso = req.query.clientNow || new Date().toISOString()
        const dateFrom = req.query.dateFrom || null
        const dateTo = req.query.dateTo || null
        const paramsOverdue = [nowIso]
        let ph = 2
        const dateFilterOverdue = dateFrom && dateTo
          ? ` AND t.created_at >= CAST($${ph++} AS timestamp) AND t.created_at <= CAST($${ph++} AS timestamp)`
          : ''
        if (dateFrom && dateTo) paramsOverdue.push(dateFrom, dateTo)
        const taskDepExistsOverdue = departmentId
          ? ` AND EXISTS (SELECT 1 FROM task_assignments ta JOIN users u ON u.id = ta.user_id WHERE ta.task_id = t.id AND u.department_id = CAST($${ph++} AS integer))`
          : ''
        const taskUserExistsOverdue = userId
          ? ` AND EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.user_id = CAST($${ph} AS integer))`
          : ''
        if (departmentId) paramsOverdue.push(departmentId)
        if (userId) paramsOverdue.push(userId)
        const overdueOnly = await dbPool.query(
          `SELECT COUNT(*) AS overdue
           FROM tasks t
           WHERE ${tasksScopeCond}
             AND t.business_process_instance_id IS NULL
             AND t.id NOT IN (SELECT task_id FROM bp_task_process_links)
             AND t.completed_at IS NULL
             AND t.deadline IS NOT NULL
             AND t.status IS DISTINCT FROM 'done'
             AND t.deadline <= (CAST($1 AS TIMESTAMPTZ) AT TIME ZONE '${APP_TZ}')
             ${dateFilterOverdue} ${taskDepExistsOverdue} ${taskUserExistsOverdue}`,
          paramsOverdue
        )
        overdueCountInProgress = parseInt(overdueOnly.rows[0]?.overdue || 0, 10)
      }

      // Разбивка по статусам канбана только для «В работе»: просроченные не входят в статусы (один сектор «Просрочка»). Используем то же «сейчас» (clientNow), что и для счётчика просрочек.
      const TASK_STATUS_IDS = ['backlog', 'todo', 'wait', 'doing', 'done', 'pause']
      let tasksByStatusInProgress = null
      if (statusFilter === 'in_progress') {
        const paramsStatus = [...params, req.query.clientNow || new Date().toISOString()]
        const phNow = paramsStatus.length
        const notOverdueCond = `(t.deadline IS NULL OR t.deadline > (CAST($${phNow} AS TIMESTAMPTZ) AT TIME ZONE '${APP_TZ}'))`
        const tasksByStatusRes = await dbPool.query(
          `SELECT COALESCE(NULLIF(TRIM(t.status), ''), 'backlog') AS status, COUNT(DISTINCT t.id) AS cnt
           FROM tasks t
           LEFT JOIN task_history th ON th.task_id = t.id AND th.change_description = 'Дедлайн истёк'
           LEFT JOIN task_assignments ta ON ta.task_id = t.id
           LEFT JOIN users u_assignee ON u_assignee.id = ta.user_id
           WHERE ${tasksScopeCond}
             AND t.business_process_instance_id IS NULL
             AND t.id NOT IN (SELECT task_id FROM bp_task_process_links)
             AND t.completed_at IS NULL
             AND ${notOverdueCond}
             ${dateFilterT} ${depFilterTask} ${userFilterTask}
           GROUP BY COALESCE(NULLIF(TRIM(t.status), ''), 'backlog')`,
          paramsStatus
        )
        tasksByStatusInProgress = {}
        TASK_STATUS_IDS.forEach((sid) => { tasksByStatusInProgress[sid] = 0 })
        ;(tasksByStatusRes.rows || []).forEach((row) => {
          const s = row.status && TASK_STATUS_IDS.includes(row.status) ? row.status : 'backlog'
          tasksByStatusInProgress[s] = parseInt(row.cnt || 0, 10)
        })
      }

      const bpInstFilter = (departmentId || userId)
        ? (userId
          ? ` AND (EXISTS (SELECT 1 FROM bp_task_process_links l JOIN task_assignments ta ON ta.task_id = l.task_id WHERE ta.user_id = CAST($${n2} AS integer) AND l.process_instance_id = pi.id)
              OR EXISTS (SELECT 1 FROM tasks t JOIN task_assignments ta ON ta.task_id = t.id WHERE t.business_process_instance_id = pi.id AND ta.user_id = CAST($${n2} AS integer)))
             ${departmentId && userId ? ` AND (SELECT department_id FROM users WHERE id = CAST($${n2} AS integer)) = CAST($${n1} AS integer)` : ''}`
          : ` AND (EXISTS (SELECT 1 FROM bp_task_process_links l JOIN task_assignments ta ON ta.task_id = l.task_id JOIN users u ON u.id = ta.user_id WHERE u.department_id = CAST($${n2} AS integer) AND l.process_instance_id = pi.id)
              OR EXISTS (SELECT 1 FROM tasks t JOIN task_assignments ta ON ta.task_id = t.id JOIN users u ON u.id = ta.user_id WHERE t.business_process_instance_id = pi.id AND u.department_id = CAST($${n2} AS integer)))`)
        : ''
      const bpInstances = await dbPool.query(
        `SELECT COUNT(*) AS cnt,
                COUNT(*) FILTER (WHERE pi.status = 'completed') AS completed,
                COUNT(*) FILTER (WHERE pi.status = 'failed') AS failed,
                COUNT(*) FILTER (WHERE pi.status IN ('running', 'waiting_gateway', 'waiting_timer', 'waiting_user_input', 'waiting_decision', 'waiting_additional_info', 'waiting_join')) AS running
         FROM bp_process_instances pi
         WHERE 1=1 ${dateFilterBP} ${bpInstFilter} ${bpStatusCond}`,
        params
      )

      const ps = projectsStandalone.rows[0]
      const tbp = tasksFromBP.rows[0]
      const tproj = tasksFromProject.rows[0]
      const ts = tasksStandalone.rows[0]
      const tTasks = tasksAsTasks.rows[0]
      const bp = bpInstances.rows[0]

      const summary = {
        byCategory: {
          projects: {
            total: parseInt(ps?.cnt || 0, 10) + pFromBP,
            completed: parseInt(ps?.completed || 0, 10),
            onPause: parseInt(ps?.on_pause || 0, 10),
            failed: parseInt(ps?.failed || 0, 10),
            deleted: parseInt(ps?.deleted || 0, 10),
            fromBP: pFromBP,
          },
          businessProcesses: {
            total: parseInt(bp?.cnt || 0, 10),
            instances: parseInt(bp?.cnt || 0, 10),
            completed: parseInt(bp?.completed || 0, 10),
            failed: parseInt(bp?.failed || 0, 10),
            running: parseInt(bp?.running || 0, 10),
            tasksFromBP: parseInt(tbp?.cnt || 0, 10),
            tasksFromBPCompleted: parseInt(tbp?.completed || 0, 10),
            tasksFromBPOverdue: parseInt(tbp?.overdue || 0, 10),
            projectsFromBP: pFromBP,
          },
          tasks: {
            total: parseInt(tTasks?.cnt || 0, 10) + parseInt(tbp?.cnt || 0, 10),
            completed: parseInt(tTasks?.completed || 0, 10) + parseInt(tbp?.completed || 0, 10),
            overdue: overdueCountInProgress !== null ? overdueCountInProgress : parseInt(tTasks?.overdue || 0, 10) + parseInt(tbp?.overdue || 0, 10),
            fromProject: parseInt(tproj?.cnt || 0, 10),
            fromProjectCompleted: parseInt(tproj?.completed || 0, 10),
            fromProjectOverdue: parseInt(tproj?.overdue || 0, 10),
            standalone: parseInt(ts?.cnt || 0, 10),
            standaloneCompleted: parseInt(ts?.completed || 0, 10),
            standaloneOverdue: parseInt(ts?.overdue || 0, 10),
            fromBP: parseInt(tbp?.cnt || 0, 10),
            ...(tasksByStatusInProgress && { byStatusInProgress: tasksByStatusInProgress }),
          },
        },
      }

      const dateFrom = req.query.dateFrom || null
      const dateTo = req.query.dateTo || null
      const dateCond = dateFrom && dateTo ? ' AND gt.created_at >= CAST($1 AS timestamp) AND gt.created_at <= CAST($2 AS timestamp)' : ''
      const dateCondT = dateFrom && dateTo ? ' AND t.created_at >= CAST($1 AS timestamp) AND t.created_at <= CAST($2 AS timestamp)' : ''
      const byDeptParams = [...(dateFrom && dateTo ? [dateFrom, dateTo] : []), ...(departmentId ? [departmentId] : [])]
      const byDeptDeptCond = departmentId ? ` AND d.id = CAST($${byDeptParams.length} AS integer)` : ''
      const empQueryParams = dateFrom && dateTo ? [dateFrom, dateTo] : []

      const byDepartment = await dbPool.query(
        `SELECT d.id, d.name,
                (SELECT COUNT(DISTINCT gt.id) FROM global_tasks gt
                 WHERE 1=1 ${dateCond}
                   AND (gt.created_by IN (SELECT id FROM users WHERE department_id = d.id)
                        OR gt.id IN (SELECT global_task_id FROM global_task_responsibles WHERE user_id IN (SELECT id FROM users WHERE department_id = d.id)))${projStatusCond}) AS projects_count,
                COUNT(DISTINCT t.id) AS tasks_count,
                COUNT(DISTINCT t.id) FILTER (WHERE ${overdueCond}) AS overdue_count
         FROM departments d
         LEFT JOIN users u ON u.department_id = d.id
         LEFT JOIN task_assignments ta ON ta.user_id = u.id
         LEFT JOIN tasks t ON t.id = ta.task_id ${dateCondT} ${taskStatusCond}
         LEFT JOIN task_history th ON th.task_id = t.id AND th.change_description = 'Дедлайн истёк'
         WHERE 1=1 ${byDeptDeptCond}
         GROUP BY d.id, d.name
         ORDER BY d.name`,
        byDeptParams
      )

      const empQuery = await dbPool.query(
        `SELECT u.id, u.first_name, u.last_name, u.department_id, d.name AS department_name,
                (SELECT COUNT(DISTINCT gt.id) FROM global_tasks gt
                 WHERE 1=1 ${dateCond}
                   AND (gt.created_by = u.id OR gt.id IN (SELECT global_task_id FROM global_task_responsibles WHERE user_id = u.id))${projStatusCond}) AS projects_count,
                COUNT(DISTINCT t.id) AS tasks_count,
                COUNT(DISTINCT t.id) FILTER (WHERE t.completed_at IS NOT NULL) AS tasks_completed,
                COUNT(DISTINCT t.id) FILTER (WHERE ${overdueCond}) AS tasks_overdue
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN task_assignments ta ON ta.user_id = u.id
         LEFT JOIN tasks t ON t.id = ta.task_id ${dateCondT} ${taskStatusCond}
         LEFT JOIN task_history th ON th.task_id = t.id AND th.change_description = 'Дедлайн истёк'
         WHERE u.id IS NOT NULL
         GROUP BY u.id, u.first_name, u.last_name, u.department_id, d.name
         ORDER BY d.name, u.last_name, u.first_name`,
        empQueryParams
      )

      const tasksCountForFilter = (r) =>
        statusFilter === 'completed' ? parseInt(r.tasks_completed || 0, 10) : parseInt(r.tasks_count || 0, 10)
      let byEmployee = empQuery.rows.map((r) => ({
        userId: r.id,
        userName: [r.last_name, r.first_name].filter(Boolean).join(' ') || 'Без имени',
        departmentId: r.department_id,
        departmentName: r.department_name || '—',
        projectsCount: parseInt(r.projects_count || 0, 10),
        tasksCount: tasksCountForFilter(r),
        tasksCompleted: parseInt(r.tasks_completed || 0, 10),
        tasksOverdue: parseInt(r.tasks_overdue || 0, 10),
      }))

      if (departmentId) byEmployee = byEmployee.filter((e) => String(e.departmentId) === String(departmentId))
      if (userId) byEmployee = byEmployee.filter((e) => String(e.userId) === String(userId))

      let loadByAuthorDepartment = []
      if (departmentId || userId) {
        const loadParams = [...empQueryParams, userId || departmentId]
        const loadPh = loadParams.length
        const loadExecFilter = userId ? ` AND ta.user_id = CAST($${loadPh} AS integer)` : ` AND u_exec.department_id = CAST($${loadPh} AS integer)`
        const loadJoinCond = userId ? '' : ` AND u_exec.department_id = CAST($${loadPh} AS integer)`
        const loadByAuthorTasks = await dbPool.query(
          `SELECT u_author.department_id AS author_department_id, d_author.name AS author_department_name,
                  COUNT(DISTINCT t.id) AS cnt
           FROM tasks t
           JOIN task_assignments ta ON ta.task_id = t.id
           JOIN users u_exec ON u_exec.id = ta.user_id${loadJoinCond}
           JOIN users u_author ON u_author.id = t.created_by
           LEFT JOIN departments d_author ON d_author.id = u_author.department_id
           WHERE 1=1 ${dateCondT} ${taskStatusCond} ${userId ? loadExecFilter : ` AND u_exec.department_id = CAST($${loadPh} AS integer)`}
           GROUP BY u_author.department_id, d_author.name`,
          loadParams
        )
        const loadByAuthorProj = await dbPool.query(
          `SELECT u_author.department_id AS author_department_id, d_author.name AS author_department_name,
                  COUNT(DISTINCT gt.id) AS cnt
           FROM global_tasks gt
           JOIN global_task_responsibles gtr ON gtr.global_task_id = gt.id
           JOIN users u_exec ON u_exec.id = gtr.user_id${loadJoinCond}
           JOIN users u_author ON u_author.id = gt.created_by
           LEFT JOIN departments d_author ON d_author.id = u_author.department_id
           WHERE gt.id NOT IN (SELECT global_task_id FROM bp_gateway_project_waiting)
             ${dateCond} ${projStatusCond} ${userId ? ` AND gtr.user_id = CAST($${loadPh} AS integer)` : ` AND u_exec.department_id = CAST($${loadPh} AS integer)`}
           GROUP BY u_author.department_id, d_author.name`,
          loadParams
        )
        const authorDeptMap = {}
        loadByAuthorTasks.rows.forEach((r) => {
          const id = r.author_department_id || 0
          if (!authorDeptMap[id]) authorDeptMap[id] = { authorDepartmentId: id, authorDepartmentName: r.author_department_name || 'Без отдела', tasks: 0, projects: 0 }
          authorDeptMap[id].tasks += parseInt(r.cnt || 0, 10)
        })
        loadByAuthorProj.rows.forEach((r) => {
          const id = r.author_department_id || 0
          if (!authorDeptMap[id]) authorDeptMap[id] = { authorDepartmentId: id, authorDepartmentName: r.author_department_name || 'Без отдела', tasks: 0, projects: 0 }
          authorDeptMap[id].projects += parseInt(r.cnt || 0, 10)
        })
        loadByAuthorDepartment = Object.values(authorDeptMap).map((x) => ({ ...x, value: x.tasks + x.projects }))
      }

      res.json({
        summary,
        byDepartment: byDepartment.rows.map((r) => ({
          departmentId: r.id,
          departmentName: r.name,
          projectsCount: parseInt(r.projects_count || 0, 10),
          tasksCount: parseInt(r.tasks_count || 0, 10),
          overdueCount: parseInt(r.overdue_count || 0, 10),
        })),
        byEmployee,
        loadByAuthorDepartment,
        filters: { dateFrom: req.query.dateFrom || null, dateTo: req.query.dateTo || null, departmentId, userId, statusFilter: statusFilter || null },
      })
    } catch (err) {
      console.error('getAnalyticsSummary:', err)
      res.status(500).json({ error: 'Ошибка сервера при получении аналитики' })
    }
  }
}

const getAnalyticsDepartments = (dbPool) => {
  return async (req, res) => {
    try {
      const r = await dbPool.query(
        `SELECT d.id, d.name, d.head_user_id,
                u.first_name AS head_first_name, u.last_name AS head_last_name
         FROM departments d
         LEFT JOIN users u ON u.id = d.head_user_id
         ORDER BY d.name`
      )
      res.json(r.rows.map((row) => ({
        id: row.id,
        name: row.name,
        headUserId: row.head_user_id,
        headName: [row.head_last_name, row.head_first_name].filter(Boolean).join(' ') || null,
      })))
    } catch (err) {
      console.error('getAnalyticsDepartments:', err)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  }
}

const getAnalyticsEmployees = (dbPool) => {
  return async (req, res) => {
    try {
      const departmentId = req.query.departmentId || null
      let query = `SELECT u.id, u.first_name, u.last_name, u.department_id, d.name AS department_name
                   FROM users u
                   LEFT JOIN departments d ON d.id = u.department_id
                   WHERE 1=1`
      const params = []
      if (departmentId) {
        params.push(departmentId)
        query += ` AND u.department_id = $1`
      }
      query += ' ORDER BY d.name, u.last_name, u.first_name'
      const r = await dbPool.query(query, params)
      res.json(r.rows.map((row) => ({
        id: row.id,
        name: [row.last_name, row.first_name].filter(Boolean).join(' ') || 'Без имени',
        departmentId: row.department_id,
        departmentName: row.department_name || '—',
      })))
    } catch (err) {
      console.error('getAnalyticsEmployees:', err)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  }
}

/** Список бизнес-процессов со сводной статистикой (для детального анализа) */
const getBusinessProcessesList = (dbPool) => {
  return async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom || null
      const dateTo = req.query.dateTo || null
      const params = []
      const dateCond = dateFrom && dateTo
        ? ' AND pi.started_at >= $1::timestamp AND pi.started_at <= $2::timestamp'
        : ''
      if (dateFrom && dateTo) params.push(dateFrom, dateTo)
      const r = await dbPool.query(
        `SELECT pd.id, pd.name, pd.description,
                COUNT(pi.id) AS instances_total,
                COUNT(pi.id) FILTER (WHERE pi.status = 'completed') AS instances_completed,
                COUNT(pi.id) FILTER (WHERE pi.status = 'failed') AS instances_failed,
                COUNT(pi.id) FILTER (WHERE pi.status IN ('running', 'waiting_gateway', 'waiting_timer', 'waiting_user_input', 'waiting_decision', 'waiting_additional_info', 'waiting_join')) AS instances_running
         FROM bp_process_definitions pd
         LEFT JOIN bp_process_instances pi ON pi.process_id = pd.id ${dateCond}
         WHERE pd.is_draft = false
         GROUP BY pd.id, pd.name, pd.description
         ORDER BY pd.name`,
        params
      )
      res.json(r.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description || null,
        instancesTotal: parseInt(row.instances_total || 0, 10),
        instancesCompleted: parseInt(row.instances_completed || 0, 10),
        instancesFailed: parseInt(row.instances_failed || 0, 10),
        instancesRunning: parseInt(row.instances_running || 0, 10),
      })))
    } catch (err) {
      console.error('getBusinessProcessesList:', err)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  }
}

/**
 * Детальная статистика по узлам процесса: время на этапах (включая ожидание до следующей активности),
 * задачи/подзадачи БП по узлам, узкие места.
 */
const getBusinessProcessNodes = (dbPool) => {
  return async (req, res) => {
    try {
      const { processId } = req.params
      const dateFrom = req.query.dateFrom || null
      const dateTo = req.query.dateTo || null
      const params = [processId]
      const dateCond = dateFrom && dateTo
        ? ' AND pi.started_at >= $2::timestamp AND pi.started_at <= $3::timestamp'
        : ''
      if (dateFrom && dateTo) params.push(dateFrom, dateTo)

      // Ср. время процесса целиком: от started_at до finished_at (или NOW для активных) по каждому экземпляру
      let processAvgDurationSeconds = null
      let processMaxDurationSeconds = null
      try {
        const durationRes = await dbPool.query(
          `SELECT
            ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(pi.finished_at, NOW()) - pi.started_at)))::numeric, 1) AS avg_seconds,
            ROUND(MAX(EXTRACT(EPOCH FROM (COALESCE(pi.finished_at, NOW()) - pi.started_at)))::numeric, 1) AS max_seconds
           FROM bp_process_instances pi
           WHERE pi.process_id = $1 ${dateCond}`,
          params
        )
        const row = durationRes.rows[0]
        if (row && (row.avg_seconds != null || row.max_seconds != null)) {
          processAvgDurationSeconds = row.avg_seconds != null ? parseFloat(row.avg_seconds) : null
          processMaxDurationSeconds = row.max_seconds != null ? parseFloat(row.max_seconds) : null
        }
      } catch (durationErr) {
        console.warn('getBusinessProcessNodes process duration:', durationErr.message)
      }

      // Время в узле = от entered_at до выхода ИЛИ до следующей записи в логе (следующий шаг экземпляра) ИЛИ до завершения/сейчас
      const r = await dbPool.query(
        `WITH log_with_end AS (
           SELECT l.id, l.instance_id, l.node_id, l.entered_at, l.exited_at,
                  COALESCE(
                    l.exited_at,
                    (SELECT MIN(l2.entered_at) FROM bp_node_execution_log l2
                     WHERE l2.instance_id = l.instance_id AND l2.entered_at > l.entered_at),
                    pi.finished_at,
                    NOW()
                  ) AS effective_end
           FROM bp_node_execution_log l
           JOIN bp_process_instances pi ON pi.id = l.instance_id AND pi.process_id = $1 ${dateCond}
         ),
         node_durations AS (
           SELECT node_id,
                  COUNT(*) AS pass_count,
                  COUNT(*) FILTER (WHERE exited_at IS NOT NULL) AS completed_count,
                  AVG(EXTRACT(EPOCH FROM (effective_end - entered_at))) AS avg_seconds,
                  MAX(EXTRACT(EPOCH FROM (effective_end - entered_at))) AS max_seconds,
                  SUM(EXTRACT(EPOCH FROM (effective_end - entered_at))) AS total_seconds
           FROM log_with_end
           GROUP BY node_id
         )
         SELECT node_id, pass_count, completed_count, avg_seconds, max_seconds, total_seconds
         FROM node_durations
         ORDER BY total_seconds DESC NULLS LAST, pass_count DESC`,
        params
      )

      // Задачи БП по узлам: время, дедлайны, просрочки, авторы, исполнители (для анализа узких мест)
      let taskStatsByNode = {}
      try {
        const taskParams = [processId]
        const taskDateCond = dateFrom && dateTo
          ? ' AND pi.started_at >= $2::timestamp AND pi.started_at <= $3::timestamp'
          : ''
        if (dateFrom && dateTo) taskParams.push(dateFrom, dateTo)
        const taskRes = await dbPool.query(
          `SELECT link.node_id,
                  COUNT(DISTINCT link.task_id) AS tasks_count,
                  COUNT(DISTINCT link.task_id) FILTER (WHERE t.completed_at IS NOT NULL) AS tasks_completed,
                  COUNT(DISTINCT link.task_id) FILTER (WHERE t.deadline IS NOT NULL) AS tasks_with_deadline,
                  COUNT(DISTINCT link.task_id) FILTER (WHERE t.deadline IS NOT NULL AND t.completed_at IS NULL AND t.deadline <= (CURRENT_TIMESTAMP AT TIME ZONE '${APP_TZ}')) AS tasks_overdue,
                  COUNT(DISTINCT t.created_by) FILTER (WHERE t.created_by IS NOT NULL) AS authors_count,
                  COUNT(DISTINCT ta.user_id) AS assignees_count,
                  ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at)))::numeric, 1) AS task_time_avg_seconds,
                  ROUND(MAX(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at)))::numeric, 1) AS task_time_max_seconds
           FROM bp_task_process_links link
           JOIN bp_process_instances pi ON pi.id = link.process_instance_id AND pi.process_id = $1 ${taskDateCond}
           LEFT JOIN tasks t ON t.id = link.task_id
           LEFT JOIN task_assignments ta ON ta.task_id = link.task_id
           GROUP BY link.node_id`,
          taskParams
        )
        taskRes.rows.forEach((row) => {
          taskStatsByNode[row.node_id] = {
            tasksCount: parseInt(row.tasks_count || 0, 10),
            tasksCompleted: parseInt(row.tasks_completed || 0, 10),
            tasksWithDeadline: parseInt(row.tasks_with_deadline || 0, 10),
            tasksOverdue: parseInt(row.tasks_overdue || 0, 10),
            authorsCount: parseInt(row.authors_count || 0, 10),
            assigneesCount: parseInt(row.assignees_count || 0, 10),
            taskTimeAvgSeconds: row.task_time_avg_seconds != null ? parseFloat(row.task_time_avg_seconds) : null,
            taskTimeMaxSeconds: row.task_time_max_seconds != null ? parseFloat(row.task_time_max_seconds) : null,
          }
        })
      } catch (taskErr) {
        console.warn('getBusinessProcessNodes task stats:', taskErr.message)
      }

      // Проекты БП по узлам: (1) ожидание развилки bp_gateway_project_waiting, (2) созданные в узле — из context.project_outputs (узел «Создать проект», label может быть именем проекта)
      let projectStatsByNode = {}
      const projParams = [processId]
      const projDateCond = dateFrom && dateTo
        ? ' AND pi.started_at >= $2::timestamp AND pi.started_at <= $3::timestamp'
        : ''
      if (dateFrom && dateTo) projParams.push(dateFrom, dateTo)

      const mergeProjectStats = (row, docsCnt, avgSec, maxSec) => {
        const prev = projectStatsByNode[row.node_id] || {
          projectsCount: 0, projectsCompleted: 0, responsiblesCount: 0, approvalPendingCount: 0, docsCount: 0, projectTimeAvgSeconds: null, projectTimeMaxSeconds: null, mailRoundsCount: 0, mailWaitAvgSeconds: null, mailWaitMaxSeconds: null,
        }
        projectStatsByNode[row.node_id] = {
          projectsCount: prev.projectsCount + parseInt(row.projects_count || 0, 10),
          projectsCompleted: prev.projectsCompleted + parseInt(row.projects_completed || 0, 10),
          responsiblesCount: prev.responsiblesCount + parseInt(row.responsibles_count || 0, 10),
          approvalPendingCount: prev.approvalPendingCount + parseInt(row.approval_pending_count || 0, 10),
          docsCount: prev.docsCount + (docsCnt || 0),
          projectTimeAvgSeconds: avgSec != null ? avgSec : prev.projectTimeAvgSeconds,
          projectTimeMaxSeconds: maxSec != null ? maxSec : prev.projectTimeMaxSeconds,
          mailRoundsCount: prev.mailRoundsCount,
          mailWaitAvgSeconds: prev.mailWaitAvgSeconds,
          mailWaitMaxSeconds: prev.mailWaitMaxSeconds,
        }
      }

      try {
        // (1) Проекты на развилке (ожидание по проекту)
        const projRes = await dbPool.query(
          `SELECT w.node_id,
                  COUNT(DISTINCT w.global_task_id) AS projects_count,
                  COUNT(DISTINCT w.global_task_id) FILTER (WHERE gt.status = 'Завершено') AS projects_completed,
                  COUNT(DISTINCT gtr.user_id) AS responsibles_count,
                  COUNT(DISTINCT CASE WHEN gtr.requires_approval AND gtr.approval_status IS NULL THEN gtr.user_id END) AS approval_pending_count
           FROM bp_gateway_project_waiting w
           JOIN bp_process_instances pi ON pi.id = w.instance_id AND pi.process_id = $1 ${projDateCond}
           LEFT JOIN global_tasks gt ON gt.id = w.global_task_id
           LEFT JOIN global_task_responsibles gtr ON gtr.global_task_id = w.global_task_id
           GROUP BY w.node_id`,
          projParams
        )
        const docsRes = await dbPool.query(
          `SELECT w.node_id, COUNT(a.id) AS docs_count
           FROM bp_gateway_project_waiting w
           JOIN bp_process_instances pi ON pi.id = w.instance_id AND pi.process_id = $1 ${projDateCond}
           LEFT JOIN task_attachments_global_tasks a ON a.task_id = w.global_task_id
           GROUP BY w.node_id`,
          projParams
        )
        const docsByNodeGateway = {}
        docsRes.rows.forEach((r) => { docsByNodeGateway[r.node_id] = parseInt(r.docs_count || 0, 10) })
        projRes.rows.forEach((row) => {
          mergeProjectStats(row, docsByNodeGateway[row.node_id], null, null)
        })
        const lastActivityRes = await dbPool.query(
          `WITH proj_created AS (
             SELECT w.node_id, w.global_task_id, gt.created_at AS created_at
             FROM bp_gateway_project_waiting w
             JOIN bp_process_instances pi ON pi.id = w.instance_id AND pi.process_id = $1 ${projDateCond}
             LEFT JOIN global_tasks gt ON gt.id = w.global_task_id
           ),
           proj_last_act AS (
             SELECT pc.node_id, pc.global_task_id, pc.created_at,
                    GREATEST(pc.created_at,
                      COALESCE((SELECT MAX(h.created_at) FROM global_task_history h WHERE h.global_task_id = pc.global_task_id), pc.created_at),
                      COALESCE((SELECT MAX(c.timestamp) FROM global_task_chat_messages c WHERE c.global_task_id = pc.global_task_id), pc.created_at)
                    ) AS last_activity
             FROM proj_created pc
           )
           SELECT node_id,
                  ROUND(AVG(EXTRACT(EPOCH FROM (last_activity - created_at)))::numeric, 1) AS project_time_avg_seconds,
                  ROUND(MAX(EXTRACT(EPOCH FROM (last_activity - created_at)))::numeric, 1) AS project_time_max_seconds
           FROM proj_last_act
           GROUP BY node_id`,
          projParams
        )
        lastActivityRes.rows.forEach((r) => {
          if (projectStatsByNode[r.node_id]) {
            projectStatsByNode[r.node_id].projectTimeAvgSeconds = r.project_time_avg_seconds != null ? parseFloat(r.project_time_avg_seconds) : null
            projectStatsByNode[r.node_id].projectTimeMaxSeconds = r.project_time_max_seconds != null ? parseFloat(r.project_time_max_seconds) : null
          }
        })
      } catch (e1) {
        console.warn('getBusinessProcessNodes project stats (gateway):', e1.message)
      }

      try {
        // (2) Проекты, созданные в узле «Создать проект» — из context.project_outputs (имя этапа в схеме = label узла, может совпадать с названием проекта)
        const createdProjRes = await dbPool.query(
          `WITH created_projects AS (
             SELECT (e.key)::text AS node_id, (e.value->>'global_task_id')::int AS global_task_id
             FROM bp_process_instances pi
             CROSS JOIN LATERAL jsonb_each(COALESCE(pi.context->'project_outputs', '{}'::jsonb)) e
             WHERE pi.process_id = $1 ${projDateCond}
               AND (e.value->>'global_task_id') ~ '^[0-9]+$'
           )
           SELECT cp.node_id,
                  COUNT(DISTINCT cp.global_task_id) AS projects_count,
                  COUNT(DISTINCT cp.global_task_id) FILTER (WHERE gt.status = 'Завершено') AS projects_completed,
                  COUNT(DISTINCT gtr.user_id) AS responsibles_count,
                  COUNT(DISTINCT CASE WHEN gtr.requires_approval AND gtr.approval_status IS NULL THEN gtr.user_id END) AS approval_pending_count
           FROM created_projects cp
           LEFT JOIN global_tasks gt ON gt.id = cp.global_task_id
           LEFT JOIN global_task_responsibles gtr ON gtr.global_task_id = cp.global_task_id
           GROUP BY cp.node_id`,
          projParams
        )
        const createdDocsRes = await dbPool.query(
          `WITH created_projects AS (
             SELECT (e.key)::text AS node_id, (e.value->>'global_task_id')::int AS global_task_id
             FROM bp_process_instances pi
             CROSS JOIN LATERAL jsonb_each(COALESCE(pi.context->'project_outputs', '{}'::jsonb)) e
             WHERE pi.process_id = $1 ${projDateCond}
               AND (e.value->>'global_task_id') ~ '^[0-9]+$'
           )
           SELECT cp.node_id, COUNT(a.id) AS docs_count
           FROM created_projects cp
           LEFT JOIN task_attachments_global_tasks a ON a.task_id = cp.global_task_id
           GROUP BY cp.node_id`,
          projParams
        )
        const createdDocsByNode = {}
        createdDocsRes.rows.forEach((r) => { createdDocsByNode[r.node_id] = parseInt(r.docs_count || 0, 10) })
        const createdTimeRes = await dbPool.query(
          `WITH created_projects AS (
             SELECT (e.key)::text AS node_id, (e.value->>'global_task_id')::int AS global_task_id
             FROM bp_process_instances pi
             CROSS JOIN LATERAL jsonb_each(COALESCE(pi.context->'project_outputs', '{}'::jsonb)) e
             WHERE pi.process_id = $1 ${projDateCond}
               AND (e.value->>'global_task_id') ~ '^[0-9]+$'
           ),
           proj_created AS (
             SELECT cp.node_id, cp.global_task_id, gt.created_at AS created_at
             FROM created_projects cp
             LEFT JOIN global_tasks gt ON gt.id = cp.global_task_id
           ),
           proj_last_act AS (
             SELECT pc.node_id, pc.global_task_id, pc.created_at,
                    GREATEST(pc.created_at,
                      COALESCE((SELECT MAX(h.created_at) FROM global_task_history h WHERE h.global_task_id = pc.global_task_id), pc.created_at),
                      COALESCE((SELECT MAX(c.timestamp) FROM global_task_chat_messages c WHERE c.global_task_id = pc.global_task_id), pc.created_at)
                    ) AS last_activity
             FROM proj_created pc
           )
           SELECT node_id,
                  ROUND(AVG(EXTRACT(EPOCH FROM (last_activity - created_at)))::numeric, 1) AS project_time_avg_seconds,
                  ROUND(MAX(EXTRACT(EPOCH FROM (last_activity - created_at)))::numeric, 1) AS project_time_max_seconds
           FROM proj_last_act
           GROUP BY node_id`,
          projParams
        )
        const createdTimeByNode = {}
        createdTimeRes.rows.forEach((r) => {
          createdTimeByNode[r.node_id] = {
            avg: r.project_time_avg_seconds != null ? parseFloat(r.project_time_avg_seconds) : null,
            max: r.project_time_max_seconds != null ? parseFloat(r.project_time_max_seconds) : null,
          }
        })
        createdProjRes.rows.forEach((row) => {
          const t = createdTimeByNode[row.node_id]
          mergeProjectStats(row, createdDocsByNode[row.node_id], t?.avg, t?.max)
        })
      } catch (e2) {
        console.warn('getBusinessProcessNodes project stats (created):', e2.message)
      }

      try {
        // Почта по проектам БП: время от отправки письма до ответа (раунды и суммарное ожидание по узлам)
        const mailRes = await dbPool.query(
          `WITH project_nodes AS (
             SELECT w.node_id, w.global_task_id
             FROM bp_gateway_project_waiting w
             JOIN bp_process_instances pi ON pi.id = w.instance_id AND pi.process_id = $1 ${projDateCond}
             UNION
             SELECT (e.key)::text AS node_id, (e.value->>'global_task_id')::int AS global_task_id
             FROM bp_process_instances pi
             CROSS JOIN LATERAL jsonb_each(COALESCE(pi.context->'project_outputs', '{}'::jsonb)) e
             WHERE pi.process_id = $1 ${projDateCond}
               AND (e.value->>'global_task_id') ~ '^[0-9]+$'
           ),
           mail_by_project AS (
             SELECT pse.global_task_id,
                    COUNT(*) AS mail_rounds,
                    ROUND(SUM(EXTRACT(EPOCH FROM (pert.reply_received_at - pse.sent_at)))::numeric, 1) AS mail_wait_seconds
             FROM project_sent_emails pse
             JOIN project_email_response_times pert ON pert.sent_message_id = pse.message_id
             GROUP BY pse.global_task_id
           )
           SELECT pn.node_id,
                  COALESCE(SUM(mbp.mail_rounds), 0)::int AS mail_rounds,
                  ROUND(AVG(mbp.mail_wait_seconds)::numeric, 1) AS mail_wait_avg_seconds,
                  ROUND(MAX(mbp.mail_wait_seconds)::numeric, 1) AS mail_wait_max_seconds
           FROM project_nodes pn
             LEFT JOIN mail_by_project mbp ON mbp.global_task_id = pn.global_task_id
           GROUP BY pn.node_id`,
          projParams
        )
        mailRes.rows.forEach((r) => {
          const nodeId = r.node_id
          if (!projectStatsByNode[nodeId]) {
            projectStatsByNode[nodeId] = {
              projectsCount: 0, projectsCompleted: 0, responsiblesCount: 0, approvalPendingCount: 0, docsCount: 0,
              projectTimeAvgSeconds: null, projectTimeMaxSeconds: null, mailRoundsCount: 0, mailWaitAvgSeconds: null, mailWaitMaxSeconds: null,
            }
          }
          projectStatsByNode[nodeId].mailRoundsCount = parseInt(r.mail_rounds || 0, 10)
          projectStatsByNode[nodeId].mailWaitAvgSeconds = r.mail_wait_avg_seconds != null ? parseFloat(r.mail_wait_avg_seconds) : null
          projectStatsByNode[nodeId].mailWaitMaxSeconds = r.mail_wait_max_seconds != null ? parseFloat(r.mail_wait_max_seconds) : null
        })
      } catch (eMail) {
        console.warn('getBusinessProcessNodes mail stats:', eMail.message)
      }

      // Время на задачи внутри проектов этапа (задачи и подзадачи, созданные в проектах этого узла)
      let projectTasksTimeByNode = {}
      try {
        const ptRes = await dbPool.query(
          `WITH project_nodes AS (
             SELECT w.node_id, w.global_task_id
             FROM bp_gateway_project_waiting w
             JOIN bp_process_instances pi ON pi.id = w.instance_id AND pi.process_id = $1 ${projDateCond}
             UNION
             SELECT (e.key)::text AS node_id, (e.value->>'global_task_id')::int AS global_task_id
             FROM bp_process_instances pi
             CROSS JOIN LATERAL jsonb_each(COALESCE(pi.context->'project_outputs', '{}'::jsonb)) e
             WHERE pi.process_id = $1 ${projDateCond}
               AND (e.value->>'global_task_id') ~ '^[0-9]+$'
           )
           SELECT pn.node_id,
                  COUNT(DISTINCT t.id) AS tasks_in_projects_count,
                  ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at)))::numeric, 1) AS tasks_in_projects_avg_seconds,
                  ROUND(MAX(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at)))::numeric, 1) AS tasks_in_projects_max_seconds
           FROM project_nodes pn
           JOIN tasks t ON t.global_task_id = pn.global_task_id
           GROUP BY pn.node_id`,
          projParams
        )
        ptRes.rows.forEach((r) => {
          projectTasksTimeByNode[r.node_id] = {
            tasksInProjectsCount: parseInt(r.tasks_in_projects_count || 0, 10),
            tasksInProjectsAvgSeconds: r.tasks_in_projects_avg_seconds != null ? parseFloat(r.tasks_in_projects_avg_seconds) : null,
            tasksInProjectsMaxSeconds: r.tasks_in_projects_max_seconds != null ? parseFloat(r.tasks_in_projects_max_seconds) : null,
          }
        })
      } catch (ePt) {
        console.warn('getBusinessProcessNodes project-tasks time:', ePt.message)
      }

      const schemeResult = await dbPool.query(
        'SELECT scheme FROM bp_process_definitions WHERE id = $1',
        [processId]
      )
      const scheme = schemeResult.rows[0]?.scheme
      const nodeLabels = {}
      if (scheme && typeof scheme === 'object' && Array.isArray(scheme.nodes)) {
        scheme.nodes.forEach((n) => {
          if (n.id) nodeLabels[n.id] = n.label || n.data?.label || n.id
        })
      } else if (scheme && typeof scheme === 'string') {
        try {
          const parsed = JSON.parse(scheme)
          if (Array.isArray(parsed.nodes)) {
            parsed.nodes.forEach((n) => {
              if (n.id) nodeLabels[n.id] = n.label || n.data?.label || n.id
            })
          }
        } catch (_) {}
      }

      const nodes = r.rows.map((row) => {
        const ts = taskStatsByNode[row.node_id] || {}
        const ps = projectStatsByNode[row.node_id] || {}
        const pt = projectTasksTimeByNode[row.node_id] || {}
        const nodeAvg = (row.avg_seconds != null ? parseFloat(Number(row.avg_seconds).toFixed(1)) : 0) || 0
        const nodeMax = (row.max_seconds != null ? parseFloat(Number(row.max_seconds).toFixed(1)) : 0) || 0
        const taskAvg = ts.taskTimeAvgSeconds ?? 0
        const taskMax = ts.taskTimeMaxSeconds ?? 0
        const projectAvg = ps.projectTimeAvgSeconds ?? 0
        const projectMax = ps.projectTimeMaxSeconds ?? 0
        const projectTasksAvg = pt.tasksInProjectsAvgSeconds ?? 0
        const projectTasksMax = pt.tasksInProjectsMaxSeconds ?? 0
        const mailAvg = ps.mailWaitAvgSeconds ?? 0
        const mailMax = ps.mailWaitMaxSeconds ?? 0
        const combinedAvg = nodeAvg + taskAvg + projectAvg + projectTasksAvg + mailAvg
        const combinedMax = nodeMax + taskMax + projectMax + projectTasksMax + mailMax
        return {
          nodeId: row.node_id,
          nodeLabel: nodeLabels[row.node_id] || row.node_id,
          passCount: parseInt(row.pass_count || 0, 10),
          completedCount: parseInt(row.completed_count || 0, 10),
          avgSeconds: row.avg_seconds != null ? parseFloat(Number(row.avg_seconds).toFixed(1)) : null,
          maxSeconds: row.max_seconds != null ? parseFloat(Number(row.max_seconds).toFixed(1)) : null,
          tasksCount: ts.tasksCount ?? 0,
          tasksCompleted: ts.tasksCompleted ?? 0,
          tasksWithDeadline: ts.tasksWithDeadline ?? 0,
          tasksOverdue: ts.tasksOverdue ?? 0,
          authorsCount: ts.authorsCount ?? 0,
          assigneesCount: ts.assigneesCount ?? 0,
          taskTimeAvgSeconds: ts.taskTimeAvgSeconds ?? null,
          taskTimeMaxSeconds: ts.taskTimeMaxSeconds ?? null,
          projectsCount: ps.projectsCount ?? 0,
          projectsCompleted: ps.projectsCompleted ?? 0,
          responsiblesCount: ps.responsiblesCount ?? 0,
          approvalPendingCount: ps.approvalPendingCount ?? 0,
          docsCount: ps.docsCount ?? 0,
          projectTimeAvgSeconds: ps.projectTimeAvgSeconds ?? null,
          projectTimeMaxSeconds: ps.projectTimeMaxSeconds ?? null,
          tasksInProjectsCount: pt.tasksInProjectsCount ?? 0,
          tasksInProjectsAvgSeconds: pt.tasksInProjectsAvgSeconds ?? null,
          tasksInProjectsMaxSeconds: pt.tasksInProjectsMaxSeconds ?? null,
          mailRoundsCount: ps.mailRoundsCount ?? 0,
          mailWaitAvgSeconds: ps.mailWaitAvgSeconds ?? null,
          mailWaitMaxSeconds: ps.mailWaitMaxSeconds ?? null,
          combinedAvgSeconds: combinedAvg,
          combinedMaxSeconds: combinedMax,
          timeBreakdown: {
            nodeAvgSeconds: nodeAvg,
            nodeMaxSeconds: nodeMax,
            tasksBpAvgSeconds: taskAvg,
            tasksBpMaxSeconds: taskMax,
            projectsAvgSeconds: projectAvg,
            projectsMaxSeconds: projectMax,
            tasksInProjectsAvgSeconds: projectTasksAvg,
            tasksInProjectsMaxSeconds: projectTasksMax,
            mailAvgSeconds: mailAvg,
            mailMaxSeconds: mailMax,
          },
        }
      })

      nodes.sort((a, b) => (b.combinedAvgSeconds ?? 0) - (a.combinedAvgSeconds ?? 0))
      res.json({
        nodes,
        processAvgDurationSeconds,
        processMaxDurationSeconds,
      })
    } catch (err) {
      console.error('getBusinessProcessNodes:', err)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  }
}

/**
 * Список задач и проектов процесса с деталями (исполнители, авторы, дедлайны, прогресс, документы, переписка)
 * для полноценной картины и анализа узких мест.
 */
const getBusinessProcessEntities = (dbPool) => {
  return async (req, res) => {
    try {
      const { processId } = req.params
      const dateFrom = req.query.dateFrom || null
      const dateTo = req.query.dateTo || null
      const params = [processId]
      const dateCond = dateFrom && dateTo
        ? ' AND pi.started_at >= $2::timestamp AND pi.started_at <= $3::timestamp'
        : ''
      if (dateFrom && dateTo) params.push(dateFrom, dateTo)

      const tasksRes = await dbPool.query(
        `SELECT link.node_id, link.process_instance_id AS instance_id, t.id AS task_id, t.title, t.created_at, t.completed_at, t.deadline,
                t.created_by AS author_id,
                u_last.last_name AS author_last, u_last.first_name AS author_first,
                (SELECT json_agg(json_build_object('userId', ta.user_id, 'userName', u_assign.last_name || ' ' || u_assign.first_name))
                 FROM task_assignments ta LEFT JOIN users u_assign ON u_assign.id = ta.user_id WHERE ta.task_id = t.id) AS assignees
         FROM bp_task_process_links link
         JOIN bp_process_instances pi ON pi.id = link.process_instance_id AND pi.process_id = $1 ${dateCond}
         LEFT JOIN tasks t ON t.id = link.task_id
         LEFT JOIN users u_last ON u_last.id = t.created_by
         ORDER BY link.node_id, t.created_at`,
        params
      )
      const tasks = tasksRes.rows
        .filter((r) => r.task_id != null)
        .map((r) => {
          const assigneesList = r.assignees && Array.isArray(r.assignees)
            ? r.assignees
            : (r.assignees ? [r.assignees] : [])
          return {
            nodeId: r.node_id,
            instanceId: r.instance_id,
            taskId: r.task_id,
            title: r.title,
            createdAt: r.created_at,
            completedAt: r.completed_at,
            deadline: r.deadline,
            overdue: r.deadline && !r.completed_at && new Date(r.deadline) < new Date(),
            authorId: r.author_id,
            authorName: [r.author_last, r.author_first].filter(Boolean).join(' ') || null,
            assignees: assigneesList.filter((a) => a && (a.userId != null || a.userName)),
          }
        })

      const projectsFromGateway = await dbPool.query(
        `SELECT w.node_id, w.instance_id, w.global_task_id AS project_id, gt.title, gt.status, gt.progress, gt.created_at, gt.deadline,
                gt.created_by AS author_id,
                u_last.last_name AS author_last, u_last.first_name AS author_first,
                (SELECT COUNT(*) FROM global_task_responsibles gtr WHERE gtr.global_task_id = gt.id) AS responsibles_count,
                (SELECT COUNT(*) FROM global_task_responsibles gtr WHERE gtr.global_task_id = gt.id AND gtr.requires_approval AND gtr.approval_status IS NULL) AS approval_pending,
                (SELECT COUNT(*) FROM task_attachments_global_tasks a WHERE a.task_id = gt.id) AS docs_count,
                (SELECT MAX(timestamp) FROM global_task_chat_messages c WHERE c.global_task_id = gt.id) AS last_chat_at,
                (SELECT MAX(created_at) FROM global_task_history h WHERE h.global_task_id = gt.id) AS last_history_at,
                (SELECT COUNT(*) FROM project_sent_emails pse JOIN project_email_response_times pert ON pert.sent_message_id = pse.message_id WHERE pse.global_task_id = gt.id) AS mail_rounds,
                (SELECT ROUND(SUM(EXTRACT(EPOCH FROM (pert.reply_received_at - pse.sent_at)))::numeric, 1) FROM project_sent_emails pse JOIN project_email_response_times pert ON pert.sent_message_id = pse.message_id WHERE pse.global_task_id = gt.id) AS mail_wait_total_seconds
         FROM bp_gateway_project_waiting w
         JOIN bp_process_instances pi ON pi.id = w.instance_id AND pi.process_id = $1 ${dateCond}
         LEFT JOIN global_tasks gt ON gt.id = w.global_task_id
         LEFT JOIN users u_last ON u_last.id = gt.created_by
         ORDER BY w.node_id, gt.created_at`,
        params
      )
      const projectsFromCreated = await dbPool.query(
        `WITH created_projects AS (
           SELECT pi.id AS instance_id, (e.key)::text AS node_id, (e.value->>'global_task_id')::int AS global_task_id
           FROM bp_process_instances pi
           CROSS JOIN LATERAL jsonb_each(COALESCE(pi.context->'project_outputs', '{}'::jsonb)) e
           WHERE pi.process_id = $1 ${dateCond}
             AND (e.value->>'global_task_id') ~ '^[0-9]+$'
         )
         SELECT cp.node_id, cp.instance_id, cp.global_task_id AS project_id, gt.title, gt.status, gt.progress, gt.created_at, gt.deadline,
                gt.created_by AS author_id,
                u_last.last_name AS author_last, u_last.first_name AS author_first,
                (SELECT COUNT(*) FROM global_task_responsibles gtr WHERE gtr.global_task_id = gt.id) AS responsibles_count,
                (SELECT COUNT(*) FROM global_task_responsibles gtr WHERE gtr.global_task_id = gt.id AND gtr.requires_approval AND gtr.approval_status IS NULL) AS approval_pending,
                (SELECT COUNT(*) FROM task_attachments_global_tasks a WHERE a.task_id = gt.id) AS docs_count,
                (SELECT MAX(timestamp) FROM global_task_chat_messages c WHERE c.global_task_id = gt.id) AS last_chat_at,
                (SELECT MAX(created_at) FROM global_task_history h WHERE h.global_task_id = gt.id) AS last_history_at,
                (SELECT COUNT(*) FROM project_sent_emails pse JOIN project_email_response_times pert ON pert.sent_message_id = pse.message_id WHERE pse.global_task_id = gt.id) AS mail_rounds,
                (SELECT ROUND(SUM(EXTRACT(EPOCH FROM (pert.reply_received_at - pse.sent_at)))::numeric, 1) FROM project_sent_emails pse JOIN project_email_response_times pert ON pert.sent_message_id = pse.message_id WHERE pse.global_task_id = gt.id) AS mail_wait_total_seconds
         FROM created_projects cp
         LEFT JOIN global_tasks gt ON gt.id = cp.global_task_id
         LEFT JOIN users u_last ON u_last.id = gt.created_by
         ORDER BY cp.node_id, gt.created_at`,
        params
      )
      const projectsRes = { rows: [...projectsFromGateway.rows, ...projectsFromCreated.rows] }
      const projects = projectsRes.rows
        .filter((r) => r.project_id != null)
        .map((r) => {
          const dates = [r.last_chat_at, r.last_history_at, r.created_at].filter(Boolean)
          const lastActivityAt = dates.length
            ? dates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
            : r.created_at
          return {
            nodeId: r.node_id,
            instanceId: r.instance_id,
            projectId: r.project_id,
            title: r.title,
            status: r.status,
            progress: r.progress,
            createdAt: r.created_at,
            deadline: r.deadline,
            authorId: r.author_id,
            authorName: [r.author_last, r.author_first].filter(Boolean).join(' ') || null,
            responsiblesCount: parseInt(r.responsibles_count || 0, 10),
            approvalPending: parseInt(r.approval_pending || 0, 10),
            docsCount: parseInt(r.docs_count || 0, 10),
            mailRounds: parseInt(r.mail_rounds || 0, 10),
            mailWaitTotalSeconds: r.mail_wait_total_seconds != null ? parseFloat(r.mail_wait_total_seconds) : 0,
            lastActivityAt,
          }
        })

      res.json({ tasks, projects })
    } catch (err) {
      console.error('getBusinessProcessEntities:', err)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  }
}

/**
 * Узкие места по участникам: кто из исполнителей (assignee) больше всего «тормозит» —
 * по задачам в рамках процесса, проекта, дерева задачи или всех задач за период.
 * Возвращает: участник, отдел, кол-во задач, выполнено, среднее/суммарное время выполнения, просрочено.
 */
const getBottlenecksByParticipants = (dbPool) => {
  return async (req, res) => {
    try {
      const scope = req.query.scope || 'all'
      const processId = req.query.processId || null
      const globalTaskId = req.query.globalTaskId || null
      const rootTaskId = req.query.rootTaskId || null
      const dateFrom = req.query.dateFrom || null
      const dateTo = req.query.dateTo || null
      const departmentId = req.query.departmentId || null

      const params = []
      let dateCond = ''
      if (dateFrom && dateTo) {
        params.push(dateFrom, dateTo)
        dateCond = ` AND t.created_at >= $${params.length - 1}::timestamp AND t.created_at <= $${params.length}::timestamp`
      }

      let scopeCond = ''
      if (scope === 'process' && processId) {
        params.push(processId)
        scopeCond = ` AND t.id IN (
          SELECT link.task_id FROM bp_task_process_links link
          JOIN bp_process_instances pi ON pi.id = link.process_instance_id AND pi.process_id = $${params.length}
          WHERE 1=1 ${dateFrom && dateTo ? ` AND pi.started_at >= $1::timestamp AND pi.started_at <= $2::timestamp` : ''}
        )`
      } else if (scope === 'project' && globalTaskId) {
        params.push(globalTaskId)
        scopeCond = ` AND t.global_task_id = $${params.length}`
      } else if (scope === 'task' && rootTaskId) {
        params.push(rootTaskId, rootTaskId)
        scopeCond = ` AND (t.root_id = $${params.length - 1} OR t.id = $${params.length})`
      }

      let depFilter = ''
      if (departmentId) {
        params.push(departmentId)
        depFilter = ` AND u.department_id = $${params.length}`
      }

      const r = await dbPool.query(
        `SELECT u.id AS user_id,
                u.first_name, u.last_name,
                u.department_id, d.name AS department_name,
                COUNT(t.id) AS tasks_count,
                COUNT(t.id) FILTER (WHERE t.completed_at IS NOT NULL) AS tasks_completed,
                ROUND((AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))) FILTER (WHERE t.completed_at IS NOT NULL))::numeric, 1) AS avg_duration_seconds,
                ROUND((SUM(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))) FILTER (WHERE t.completed_at IS NOT NULL))::numeric, 1) AS total_duration_seconds,
                COUNT(t.id) FILTER (WHERE t.deadline IS NOT NULL AND t.completed_at IS NULL AND t.deadline <= (CURRENT_TIMESTAMP AT TIME ZONE '${APP_TZ}')) AS overdue_count,
                COUNT(t.id) FILTER (WHERE t.parent_id IS NULL) AS root_tasks_count,
                COUNT(t.id) FILTER (WHERE t.parent_id IS NOT NULL) AS subtasks_count,
                ROUND((SUM(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))) FILTER (WHERE t.completed_at IS NOT NULL AND t.parent_id IS NULL))::numeric, 1) AS task_time_seconds,
                ROUND((SUM(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))) FILTER (WHERE t.completed_at IS NOT NULL AND t.parent_id IS NOT NULL))::numeric, 1) AS subtask_time_seconds
         FROM tasks t
         JOIN task_assignments ta ON ta.task_id = t.id
         JOIN users u ON u.id = ta.user_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE 1=1 ${dateCond} ${scopeCond} ${depFilter}
         GROUP BY u.id, u.first_name, u.last_name, u.department_id, d.name
         ORDER BY total_duration_seconds DESC NULLS LAST, avg_duration_seconds DESC NULLS LAST, overdue_count DESC`,
        params
      )

      const participants = r.rows.map((row) => ({
        userId: row.user_id,
        userName: [row.last_name, row.first_name].filter(Boolean).join(' ') || 'Без имени',
        departmentId: row.department_id,
        departmentName: row.department_name || '—',
        tasksCount: parseInt(row.tasks_count || 0, 10),
        tasksCompleted: parseInt(row.tasks_completed || 0, 10),
        avgDurationSeconds: row.avg_duration_seconds != null ? parseFloat(row.avg_duration_seconds) : null,
        totalDurationSeconds: row.total_duration_seconds != null ? parseFloat(row.total_duration_seconds) : null,
        overdueCount: parseInt(row.overdue_count || 0, 10),
        breakdown: {
          task: { count: parseInt(row.root_tasks_count || 0, 10), totalSeconds: row.task_time_seconds != null ? parseFloat(row.task_time_seconds) : 0 },
          subtask: { count: parseInt(row.subtasks_count || 0, 10), totalSeconds: row.subtask_time_seconds != null ? parseFloat(row.subtask_time_seconds) : 0 },
          project: { count: 0, totalSeconds: 0 },
          mail: { rounds: 0, totalSeconds: 0 },
        },
      }))

      const userIds = participants.map((p) => p.userId)
      if (userIds.length === 0) {
        return res.json(participants)
      }

      const projectScopeParams = []
      let projectScopeCond = ' AND 1=1'
      if (scope === 'process' && processId) {
        projectScopeParams.push(processId)
        const pDate = dateFrom && dateTo ? ' AND pi.started_at >= $2::timestamp AND pi.started_at <= $3::timestamp' : ''
        if (dateFrom && dateTo) projectScopeParams.push(dateFrom, dateTo)
        projectScopeCond = ` AND pse.global_task_id IN (
          SELECT w.global_task_id FROM bp_gateway_project_waiting w
          JOIN bp_process_instances pi ON pi.id = w.instance_id AND pi.process_id = $1 ${pDate}
          UNION
          SELECT (e.value->>'global_task_id')::int FROM bp_process_instances pi
          CROSS JOIN LATERAL jsonb_each(COALESCE(pi.context->'project_outputs', '{}'::jsonb)) e
          WHERE pi.process_id = $1 ${pDate} AND (e.value->>'global_task_id') ~ '^[0-9]+$'
        )`
      } else if (scope === 'project' && globalTaskId) {
        projectScopeParams.push(globalTaskId)
        projectScopeCond = ` AND pse.global_task_id = $1`
      } else if (scope === 'task' && rootTaskId) {
        const gtRes = await dbPool.query('SELECT global_task_id FROM tasks WHERE id = $1', [rootTaskId])
        const gid = gtRes.rows[0]?.global_task_id
        if (gid) {
          projectScopeParams.push(gid)
          projectScopeCond = ` AND pse.global_task_id = $1`
        }
      } else if (scope === 'all' && dateFrom && dateTo) {
        projectScopeParams.push(dateFrom, dateTo)
        projectScopeCond = ` AND pse.sent_at >= $1::timestamp AND pse.sent_at <= $2::timestamp`
      }
      if (dateFrom && dateTo && scope === 'project' && globalTaskId) {
        projectScopeParams.push(dateFrom, dateTo)
        projectScopeCond += ` AND pse.sent_at >= $2::timestamp AND pse.sent_at <= $3::timestamp`
      } else if (dateFrom && dateTo && scope === 'task' && rootTaskId) {
        projectScopeParams.push(dateFrom, dateTo)
        projectScopeCond += ` AND pse.sent_at >= $2::timestamp AND pse.sent_at <= $3::timestamp`
      }

      const mailParams = [...projectScopeParams, userIds]
      const mailByUser = await dbPool.query(
        `SELECT pse.user_id,
                COUNT(*) AS mail_rounds,
                ROUND(SUM(EXTRACT(EPOCH FROM (pert.reply_received_at - pse.sent_at)))::numeric, 1) AS mail_wait_seconds
         FROM project_sent_emails pse
         JOIN project_email_response_times pert ON pert.sent_message_id = pse.message_id
         WHERE pse.user_id = ANY($${mailParams.length}) ${projectScopeParams.length ? projectScopeCond : ' AND 1=1'}
         GROUP BY pse.user_id`,
        mailParams
      )
      const mailMap = {}
      ;(mailByUser.rows || []).forEach((row) => {
        mailMap[row.user_id] = { rounds: parseInt(row.mail_rounds || 0, 10), totalSeconds: row.mail_wait_seconds != null ? parseFloat(row.mail_wait_seconds) : 0 }
      })

      const projScopeParams = []
      let projScopeFrom = ''
      if (scope === 'process' && processId) {
        projScopeParams.push(processId)
        const pDate = dateFrom && dateTo ? ' AND pi.started_at >= $2::timestamp AND pi.started_at <= $3::timestamp' : ''
        if (dateFrom && dateTo) projScopeParams.push(dateFrom, dateTo)
        projScopeFrom = `(
          SELECT w.global_task_id FROM bp_gateway_project_waiting w
          JOIN bp_process_instances pi ON pi.id = w.instance_id AND pi.process_id = $1 ${pDate}
          UNION
          SELECT (e.value->>'global_task_id')::int FROM bp_process_instances pi
          CROSS JOIN LATERAL jsonb_each(COALESCE(pi.context->'project_outputs', '{}'::jsonb)) e
          WHERE pi.process_id = $1 ${pDate} AND (e.value->>'global_task_id') ~ '^[0-9]+$'
        )`
      } else if (scope === 'project' && globalTaskId) {
        projScopeParams.push(globalTaskId)
        projScopeFrom = `(SELECT $1::int)`
      } else if (scope === 'task' && rootTaskId) {
        const gtRes = await dbPool.query('SELECT global_task_id FROM tasks WHERE id = $1', [rootTaskId])
        const gid = gtRes.rows[0]?.global_task_id
        if (gid) {
          projScopeParams.push(gid)
          projScopeFrom = `(SELECT $1::int)`
        }
      }
      if (projScopeFrom) {
        const projTimeRes = await dbPool.query(
          `WITH scope_projects AS (SELECT * FROM ${projScopeFrom} AS g(global_task_id)),
           project_dur AS (
             SELECT gt.id AS gid,
                    EXTRACT(EPOCH FROM (GREATEST(gt.created_at,
                      COALESCE((SELECT MAX(c.timestamp) FROM global_task_chat_messages c WHERE c.global_task_id = gt.id), gt.created_at),
                      COALESCE((SELECT MAX(h.created_at) FROM global_task_history h WHERE h.global_task_id = gt.id), gt.created_at)
                    ) - gt.created_at)) AS dur
             FROM global_tasks gt
             WHERE gt.id IN (SELECT global_task_id FROM scope_projects)
           ),
           by_user AS (
             SELECT gt.created_by AS uid, pd.dur FROM project_dur pd JOIN global_tasks gt ON gt.id = pd.gid WHERE gt.created_by IS NOT NULL
             UNION ALL
             SELECT gtr.user_id AS uid, pd.dur FROM project_dur pd JOIN global_task_responsibles gtr ON gtr.global_task_id = pd.gid
           )
           SELECT uid AS user_id, COUNT(*) AS projects_count, ROUND(SUM(dur)::numeric, 1) AS project_time_seconds
           FROM by_user
           WHERE uid = ANY($${projScopeParams.length + 1})
           GROUP BY uid`,
          [...projScopeParams, userIds]
        )
        const projMap = {}
        ;(projTimeRes.rows || []).forEach((row) => {
          projMap[row.user_id] = { count: parseInt(row.projects_count || 0, 10), totalSeconds: row.project_time_seconds != null ? parseFloat(row.project_time_seconds) : 0 }
        })
        participants.forEach((p) => {
          const d = projMap[p.userId]
          if (d) {
            p.breakdown.project.count = d.count
            p.breakdown.project.totalSeconds = d.totalSeconds
          }
        })
      }

      participants.forEach((p) => {
        const m = mailMap[p.userId]
        if (m) {
          p.breakdown.mail.rounds = m.rounds
          p.breakdown.mail.totalSeconds = m.totalSeconds
        }
      })

      res.json(participants)
    } catch (err) {
      console.error('getBottlenecksByParticipants:', err)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  }
}

/**
 * Узкие места по отделам: какой отдел в среднем дольше выполняет задачи (в рамках процесса, проекта, задачи или всех).
 */
const getBottlenecksByDepartments = (dbPool) => {
  return async (req, res) => {
    try {
      const scope = req.query.scope || 'all'
      const processId = req.query.processId || null
      const globalTaskId = req.query.globalTaskId || null
      const rootTaskId = req.query.rootTaskId || null
      const dateFrom = req.query.dateFrom || null
      const dateTo = req.query.dateTo || null

      const params = []
      let dateCond = ''
      if (dateFrom && dateTo) {
        params.push(dateFrom, dateTo)
        dateCond = ` AND t.created_at >= $${params.length - 1}::timestamp AND t.created_at <= $${params.length}::timestamp`
      }

      let scopeCond = ''
      if (scope === 'process' && processId) {
        params.push(processId)
        scopeCond = ` AND t.id IN (
          SELECT link.task_id FROM bp_task_process_links link
          JOIN bp_process_instances pi ON pi.id = link.process_instance_id AND pi.process_id = $${params.length}
          WHERE 1=1 ${dateFrom && dateTo ? ` AND pi.started_at >= $1::timestamp AND pi.started_at <= $2::timestamp` : ''}
        )`
      } else if (scope === 'project' && globalTaskId) {
        params.push(globalTaskId)
        scopeCond = ` AND t.global_task_id = $${params.length}`
      } else if (scope === 'task' && rootTaskId) {
        params.push(rootTaskId, rootTaskId)
        scopeCond = ` AND (t.root_id = $${params.length - 1} OR t.id = $${params.length})`
      }

      const r = await dbPool.query(
        `SELECT u.department_id, d.name AS department_name,
                COUNT(t.id) AS tasks_count,
                COUNT(t.id) FILTER (WHERE t.completed_at IS NOT NULL) AS tasks_completed,
                ROUND((AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))) FILTER (WHERE t.completed_at IS NOT NULL))::numeric, 1) AS avg_duration_seconds,
                ROUND((SUM(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))) FILTER (WHERE t.completed_at IS NOT NULL))::numeric, 1) AS total_duration_seconds,
                COUNT(t.id) FILTER (WHERE t.deadline IS NOT NULL AND t.completed_at IS NULL AND t.deadline <= (CURRENT_TIMESTAMP AT TIME ZONE '${APP_TZ}')) AS overdue_count,
                COUNT(t.id) FILTER (WHERE t.parent_id IS NULL) AS root_tasks_count,
                COUNT(t.id) FILTER (WHERE t.parent_id IS NOT NULL) AS subtasks_count,
                ROUND((SUM(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))) FILTER (WHERE t.completed_at IS NOT NULL AND t.parent_id IS NULL))::numeric, 1) AS task_time_seconds,
                ROUND((SUM(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))) FILTER (WHERE t.completed_at IS NOT NULL AND t.parent_id IS NOT NULL))::numeric, 1) AS subtask_time_seconds
         FROM tasks t
         JOIN task_assignments ta ON ta.task_id = t.id
         JOIN users u ON u.id = ta.user_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE 1=1 ${dateCond} ${scopeCond} AND u.department_id IS NOT NULL
         GROUP BY u.department_id, d.name
         ORDER BY total_duration_seconds DESC NULLS LAST, avg_duration_seconds DESC NULLS LAST, overdue_count DESC`,
        params
      )

      const departments = r.rows.map((row) => ({
        departmentId: row.department_id,
        departmentName: row.department_name || '—',
        tasksCount: parseInt(row.tasks_count || 0, 10),
        tasksCompleted: parseInt(row.tasks_completed || 0, 10),
        avgDurationSeconds: row.avg_duration_seconds != null ? parseFloat(row.avg_duration_seconds) : null,
        totalDurationSeconds: row.total_duration_seconds != null ? parseFloat(row.total_duration_seconds) : null,
        overdueCount: parseInt(row.overdue_count || 0, 10),
        breakdown: {
          task: { count: parseInt(row.root_tasks_count || 0, 10), totalSeconds: row.task_time_seconds != null ? parseFloat(row.task_time_seconds) : 0 },
          subtask: { count: parseInt(row.subtasks_count || 0, 10), totalSeconds: row.subtask_time_seconds != null ? parseFloat(row.subtask_time_seconds) : 0 },
          project: { count: 0, totalSeconds: 0 },
          mail: { rounds: 0, totalSeconds: 0 },
        },
      }))

      const depIds = departments.map((d) => d.departmentId).filter(Boolean)
      if (depIds.length === 0) {
        return res.json(departments)
      }

      const projectScopeParamsDep = []
      let projectScopeCondDep = ' AND 1=1'
      if (scope === 'process' && processId) {
        projectScopeParamsDep.push(processId)
        if (dateFrom && dateTo) projectScopeParamsDep.push(dateFrom, dateTo)
        const pDate = dateFrom && dateTo ? ' AND pi.started_at >= $2::timestamp AND pi.started_at <= $3::timestamp' : ''
        projectScopeCondDep = ` AND pse.global_task_id IN (
          SELECT w.global_task_id FROM bp_gateway_project_waiting w
          JOIN bp_process_instances pi ON pi.id = w.instance_id AND pi.process_id = $1 ${pDate}
          UNION
          SELECT (e.value->>'global_task_id')::int FROM bp_process_instances pi
          CROSS JOIN LATERAL jsonb_each(COALESCE(pi.context->'project_outputs', '{}'::jsonb)) e
          WHERE pi.process_id = $1 ${pDate} AND (e.value->>'global_task_id') ~ '^[0-9]+$'
        )`
      } else if (scope === 'project' && globalTaskId) {
        projectScopeParamsDep.push(globalTaskId)
        projectScopeCondDep = ` AND pse.global_task_id = $1`
      } else if (scope === 'task' && rootTaskId) {
        const gtRes = await dbPool.query('SELECT global_task_id FROM tasks WHERE id = $1', [rootTaskId])
        const gid = gtRes.rows[0]?.global_task_id
        if (gid) {
          projectScopeParamsDep.push(gid)
          projectScopeCondDep = ` AND pse.global_task_id = $1`
        }
      } else if (scope === 'all' && dateFrom && dateTo) {
        projectScopeParamsDep.push(dateFrom, dateTo)
        projectScopeCondDep = ` AND pse.sent_at >= $1::timestamp AND pse.sent_at <= $2::timestamp`
      }
      if (dateFrom && dateTo && (scope === 'project' && globalTaskId || scope === 'task' && rootTaskId)) {
        projectScopeParamsDep.push(dateFrom, dateTo)
        projectScopeCondDep += ` AND pse.sent_at >= $2::timestamp AND pse.sent_at <= $3::timestamp`
      }

      const mailByDep = await dbPool.query(
        `SELECT u.department_id,
                COUNT(*) AS mail_rounds,
                ROUND(SUM(EXTRACT(EPOCH FROM (pert.reply_received_at - pse.sent_at)))::numeric, 1) AS mail_wait_seconds
         FROM project_sent_emails pse
         JOIN project_email_response_times pert ON pert.sent_message_id = pse.message_id
         JOIN users u ON u.id = pse.user_id
         WHERE u.department_id = ANY($${projectScopeParamsDep.length + 1}) ${projectScopeParamsDep.length ? projectScopeCondDep : ' AND 1=1'}
         GROUP BY u.department_id`,
        [...projectScopeParamsDep, depIds]
      )
      const mailDepMap = {}
      ;(mailByDep.rows || []).forEach((row) => {
        mailDepMap[row.department_id] = { rounds: parseInt(row.mail_rounds || 0, 10), totalSeconds: row.mail_wait_seconds != null ? parseFloat(row.mail_wait_seconds) : 0 }
      })

      let projScopeFromDep = ''
      const projScopeParamsDep = []
      if (scope === 'process' && processId) {
        projScopeParamsDep.push(processId)
        if (dateFrom && dateTo) projScopeParamsDep.push(dateFrom, dateTo)
        const pDate = dateFrom && dateTo ? ' AND pi.started_at >= $2::timestamp AND pi.started_at <= $3::timestamp' : ''
        projScopeFromDep = `(
          SELECT w.global_task_id FROM bp_gateway_project_waiting w
          JOIN bp_process_instances pi ON pi.id = w.instance_id AND pi.process_id = $1 ${pDate}
          UNION
          SELECT (e.value->>'global_task_id')::int FROM bp_process_instances pi
          CROSS JOIN LATERAL jsonb_each(COALESCE(pi.context->'project_outputs', '{}'::jsonb)) e
          WHERE pi.process_id = $1 ${pDate} AND (e.value->>'global_task_id') ~ '^[0-9]+$'
        )`
      } else if (scope === 'project' && globalTaskId) {
        projScopeParamsDep.push(globalTaskId)
        projScopeFromDep = `(SELECT $1::int)`
      } else if (scope === 'task' && rootTaskId) {
        const gtRes = await dbPool.query('SELECT global_task_id FROM tasks WHERE id = $1', [rootTaskId])
        const gid = gtRes.rows[0]?.global_task_id
        if (gid) {
          projScopeParamsDep.push(gid)
          projScopeFromDep = `(SELECT $1::int)`
        }
      }
      if (projScopeFromDep) {
        const projTimeDepRes = await dbPool.query(
          `WITH scope_projects(global_task_id) AS ${projScopeFromDep},
           project_dur AS (
             SELECT gt.id AS gid,
                    EXTRACT(EPOCH FROM (GREATEST(gt.created_at,
                      COALESCE((SELECT MAX(c.timestamp) FROM global_task_chat_messages c WHERE c.global_task_id = gt.id), gt.created_at),
                      COALESCE((SELECT MAX(h.created_at) FROM global_task_history h WHERE h.global_task_id = gt.id), gt.created_at)
                    ) - gt.created_at)) AS dur
             FROM global_tasks gt
             WHERE gt.id IN (SELECT global_task_id FROM scope_projects)
           ),
           by_user AS (
             SELECT gt.created_by AS uid, pd.dur FROM project_dur pd JOIN global_tasks gt ON gt.id = pd.gid WHERE gt.created_by IS NOT NULL
             UNION ALL
             SELECT gtr.user_id AS uid, pd.dur FROM project_dur pd JOIN global_task_responsibles gtr ON gtr.global_task_id = pd.gid
           )
           SELECT u.department_id, COUNT(*) AS projects_count, ROUND(SUM(bu.dur)::numeric, 1) AS project_time_seconds
           FROM by_user bu
           JOIN users u ON u.id = bu.uid
           WHERE u.department_id IS NOT NULL AND u.department_id = ANY($${projScopeParamsDep.length + 1})
           GROUP BY u.department_id`,
          [...projScopeParamsDep, depIds]
        )
        const projDepMap = {}
        ;(projTimeDepRes.rows || []).forEach((row) => {
          projDepMap[row.department_id] = { count: parseInt(row.projects_count || 0, 10), totalSeconds: row.project_time_seconds != null ? parseFloat(row.project_time_seconds) : 0 }
        })
        departments.forEach((d) => {
          const p = projDepMap[d.departmentId]
          if (p) {
            d.breakdown.project.count = p.count
            d.breakdown.project.totalSeconds = p.totalSeconds
          }
        })
      }

      departments.forEach((d) => {
        const m = mailDepMap[d.departmentId]
        if (m) {
          d.breakdown.mail.rounds = m.rounds
          d.breakdown.mail.totalSeconds = m.totalSeconds
        }
      })

      res.json(departments)
    } catch (err) {
      console.error('getBottlenecksByDepartments:', err)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  }
}

/**
 * Детализация для карточек: список проектов, задач, экземпляров БП или просроченных задач с теми же фильтрами, что и сводка.
 */
function taskStatusLabel(status) {
  if (!status) return 'В работе'
  const map = { pending: 'В ожидании', doing: 'В работе', done: 'Выполнено', pause: 'Пауза' }
  return map[status] || status
}

const getAnalyticsDetail = (dbPool) => {
  return async (req, res) => {
    try {
      const type = req.query.type || ''
      const { params, dateFilter, dateFilterT, dateFilterBP, depFilterTask, projDepFilter, projUserFilter, userFilterTask, userFilterBP, projStatusCond, taskStatusCond, bpStatusCond, overdueCond } = buildFilters(req)

      if (type === 'projects') {
        const statusFilterDetail = req.query.status || ''
        const statusFilterQuery = req.query.statusFilter || ''
        let statusCond = projStatusCond || ''
        const projParams = [...params]
        if (!projStatusCond && (statusFilterDetail === 'В работе' || statusFilterDetail === 'in_progress')) {
          statusCond = ` AND (gt.status IS NULL OR gt.status NOT IN ('Завершено', 'Провал', 'Удален'))`
        } else if (!projStatusCond && statusFilterDetail === 'Завершено' && statusFilterQuery === 'completed') {
          statusCond = ` AND gt.status IN ('Завершено', 'Провал', 'Удален')`
        } else if (!projStatusCond && statusFilterDetail && statusFilterDetail !== 'all' && statusFilterDetail !== 'Все') {
          projParams.push(statusFilterDetail)
          statusCond = ` AND gt.status = $${projParams.length}`
        }
        const projFilter = [projDepFilter, projUserFilter].filter(Boolean).join(' ')
        const r = await dbPool.query(
          `SELECT gt.id, gt.title, gt.status, gt.created_at, gt.deadline,
                  u.last_name AS author_last, u.first_name AS author_first,
                  (SELECT h.created_at FROM global_task_history h
                   WHERE h.global_task_id = gt.id
                   ORDER BY h.created_at DESC LIMIT 1) AS last_history_at,
                  (SELECT COUNT(*) FROM tasks t WHERE t.global_task_id = gt.id) AS tasks_count,
                  (SELECT string_agg(t.title, chr(10) ORDER BY t.created_at)
                   FROM tasks t WHERE t.global_task_id = gt.id) AS tasks_titles,
                  EXISTS (SELECT 1 FROM bp_gateway_project_waiting w WHERE w.global_task_id = gt.id) AS from_bp
           FROM global_tasks gt
           LEFT JOIN users u ON u.id = gt.created_by
           WHERE 1=1 ${dateFilter} ${projFilter} ${statusCond}
           ORDER BY gt.created_at DESC`,
          projParams
        )
        return res.json(r.rows.map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: ['Завершено', 'Провал', 'Удален'].includes(row.status) ? row.last_history_at : null,
          deadline: row.deadline,
          authorName: [row.author_last, row.author_first].filter(Boolean).join(' ') || '—',
          taskCount: parseInt(row.tasks_count || 0, 10),
          taskTitles: row.tasks_titles || '',
          fromBP: !!row.from_bp,
        })))
      }

      if (type === 'tasks') {
        const tasksScopeCond = '1=1'
        const r = await dbPool.query(
          `SELECT DISTINCT ON (t.id) t.id, t.title, t.created_at, t.completed_at, t.deadline, t.status AS task_status,
                  u.last_name AS author_last, u.first_name AS author_first,
                  gt.title AS project_title,
                  (SELECT string_agg(u2.last_name || ' ' || u2.first_name, ', ' ORDER BY u2.last_name)
                   FROM task_assignments ta2
                   JOIN users u2 ON u2.id = ta2.user_id
                   WHERE ta2.task_id = t.id) AS assignees,
                  (t.business_process_instance_id IS NOT NULL OR t.id IN (SELECT task_id FROM bp_task_process_links)) AS from_bp
           FROM tasks t
           LEFT JOIN users u ON u.id = t.created_by
           LEFT JOIN global_tasks gt ON gt.id = t.global_task_id
           LEFT JOIN task_assignments ta ON ta.task_id = t.id
           LEFT JOIN users u_assignee ON u_assignee.id = ta.user_id
           WHERE ${tasksScopeCond}
             ${dateFilterT} ${depFilterTask} ${userFilterTask} ${taskStatusCond}
           ORDER BY t.id, t.created_at DESC`,
          params
        )
        return res.json(r.rows.map((row) => ({
          id: row.id,
          title: row.title,
          createdAt: row.created_at,
          completedAt: row.completed_at,
          deadline: row.deadline,
          authorName: [row.author_last, row.author_first].filter(Boolean).join(' ') || '—',
          projectTitle: row.project_title,
          assignees: row.assignees || '—',
          status: row.completed_at ? 'Выполнено' : taskStatusLabel(row.task_status),
          fromBP: !!row.from_bp,
        })))
      }

      if (type === 'processes') {
        const bpInstFilterDetail = (req.query.departmentId || req.query.userId)
          ? (req.query.userId
            ? ` AND (EXISTS (SELECT 1 FROM bp_task_process_links l JOIN task_assignments ta ON ta.task_id = l.task_id WHERE ta.user_id = CAST($${params.length} AS integer) AND l.process_instance_id = pi.id)
                  OR EXISTS (SELECT 1 FROM tasks t JOIN task_assignments ta ON ta.task_id = t.id WHERE t.business_process_instance_id = pi.id AND ta.user_id = CAST($${params.length} AS integer)))`
            : ` AND (EXISTS (SELECT 1 FROM bp_task_process_links l JOIN task_assignments ta ON ta.task_id = l.task_id JOIN users u ON u.id = ta.user_id WHERE u.department_id = CAST($${params.length} AS integer) AND l.process_instance_id = pi.id)
                  OR EXISTS (SELECT 1 FROM tasks t JOIN task_assignments ta ON ta.task_id = t.id JOIN users u ON u.id = ta.user_id WHERE t.business_process_instance_id = pi.id AND u.department_id = CAST($${params.length} AS integer)))`)
          : ''
        const r = await dbPool.query(
          `SELECT pi.id, pi.started_at, pi.finished_at, pi.status,
                  pd.name AS process_name,
                  u.last_name AS initiator_last, u.first_name AS initiator_first,
                  (SELECT COUNT(*) FROM bp_gateway_project_waiting w WHERE w.instance_id = pi.id) AS project_count,
                  (SELECT string_agg(gt.title, chr(10) ORDER BY gt.title)
                   FROM bp_gateway_project_waiting w JOIN global_tasks gt ON gt.id = w.global_task_id WHERE w.instance_id = pi.id) AS project_titles,
                  (SELECT COUNT(*) FROM (
                    SELECT t.id FROM tasks t WHERE t.business_process_instance_id = pi.id
                    UNION SELECT l.task_id FROM bp_task_process_links l WHERE l.process_instance_id = pi.id
                  ) sub) AS task_count,
                  (SELECT string_agg(t.title, chr(10) ORDER BY t.id)
                   FROM tasks t
                   WHERE t.id IN (
                     SELECT t2.id FROM tasks t2 WHERE t2.business_process_instance_id = pi.id
                     UNION SELECT l2.task_id FROM bp_task_process_links l2 WHERE l2.process_instance_id = pi.id
                   )) AS task_titles
           FROM bp_process_instances pi
           LEFT JOIN bp_process_definitions pd ON pd.id = pi.process_id
           LEFT JOIN users u ON u.id = pi.initiator_id
           WHERE 1=1 ${dateFilterBP} ${bpInstFilterDetail} ${bpStatusCond}
           ORDER BY pi.started_at DESC`,
          params
        )
        return res.json(r.rows.map((row) => ({
          id: row.id,
          processName: row.process_name,
          startedAt: row.started_at,
          finishedAt: row.finished_at,
          status: row.status,
          initiatorName: [row.initiator_last, row.initiator_first].filter(Boolean).join(' ') || '—',
          projectCount: parseInt(row.project_count || 0, 10),
          projectTitles: row.project_titles || '',
          taskCount: parseInt(row.task_count || 0, 10),
          taskTitles: row.task_titles || '',
        })))
      }

      if (type === 'overdue') {
        // Как в Task.jsx (getTimeAndPriority): new Date(deadline) < new Date(). Используем «сейчас» с клиента (clientNow), иначе — сервера.
        const nowIso = req.query.clientNow || new Date().toISOString()
        const overdueParams = [nowIso]
        let ph = 2
        const overdueDepFilter = req.query.departmentId
          ? ` AND EXISTS (SELECT 1 FROM task_assignments ta JOIN users u_assignee ON u_assignee.id = ta.user_id WHERE ta.task_id = t.id AND u_assignee.department_id = CAST($${ph++} AS integer))`
          : ''
        const overdueUserFilter = req.query.userId
          ? ` AND EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.user_id = CAST($${ph} AS integer))`
          : ''
        if (req.query.departmentId) overdueParams.push(req.query.departmentId)
        if (req.query.userId) overdueParams.push(req.query.userId)
        const r = await dbPool.query(
          `SELECT DISTINCT t.id, t.title, t.created_at, t.deadline, t.completed_at, t.status AS task_status,
                  u.last_name AS author_last, u.first_name AS author_first,
                  gt.title AS project_title,
                  (SELECT string_agg(u2.last_name || ' ' || u2.first_name, ', ' ORDER BY u2.last_name)
                   FROM task_assignments ta2
                   JOIN users u2 ON u2.id = ta2.user_id
                   WHERE ta2.task_id = t.id) AS assignees,
                  CASE
                    WHEN t.id IN (SELECT task_id FROM bp_task_process_links) THEN 'БП'
                    WHEN t.global_task_id IS NOT NULL THEN 'Проект'
                    ELSE 'Задача'
                  END AS entity_type
           FROM tasks t
           LEFT JOIN task_history th ON th.task_id = t.id AND th.change_description = 'Дедлайн истёк'
           LEFT JOIN users u ON u.id = t.created_by
           LEFT JOIN task_assignments ta ON ta.task_id = t.id
           LEFT JOIN users u_assignee ON u_assignee.id = ta.user_id
           LEFT JOIN global_tasks gt ON gt.id = t.global_task_id
           WHERE t.completed_at IS NULL
             AND t.deadline IS NOT NULL
             AND t.status IS DISTINCT FROM 'done'
             AND t.deadline < (CAST($1 AS TIMESTAMPTZ) AT TIME ZONE '${APP_TZ}')
             AND t.business_process_instance_id IS NULL
             AND t.id NOT IN (SELECT task_id FROM bp_task_process_links)
             ${overdueDepFilter} ${overdueUserFilter}
           ORDER BY t.deadline ASC`,
          overdueParams
        )
        return res.json(r.rows.map((row) => ({
          id: row.id,
          title: row.title,
          createdAt: row.created_at,
          deadline: row.deadline,
          completedAt: row.completed_at,
          authorName: [row.author_last, row.author_first].filter(Boolean).join(' ') || '—',
          projectTitle: row.project_title,
          assignees: row.assignees || '—',
          status: row.completed_at ? 'Выполнено' : taskStatusLabel(row.task_status),
          entityType: row.entity_type || 'Задача',
        })))
      }

      return res.status(400).json({ error: 'Укажите type: projects, tasks, processes или overdue' })
    } catch (err) {
      console.error('getAnalyticsDetail:', err)
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  }
}

module.exports = {
  getAnalyticsSummary,
  getAnalyticsDepartments,
  getAnalyticsEmployees,
  getBusinessProcessesList,
  getBusinessProcessNodes,
  getBusinessProcessEntities,
  getBottlenecksByParticipants,
  getBottlenecksByDepartments,
  getAnalyticsDetail,
}
