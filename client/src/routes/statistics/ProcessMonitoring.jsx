import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../config'
import { MdAssessment, MdFilterList, MdDateRange, MdRefresh, MdHelpOutline } from 'react-icons/md'
import { FaChartPie, FaTable, FaUsers, FaBriefcase, FaTasks, FaExclamationTriangle } from 'react-icons/fa'
import { FcFlowChart } from 'react-icons/fc'
import { FcDepartment  } from 'react-icons/fc'
import HelpModalProcessMonitoring from './HelpModalProcessMonitoring'
import './ProcessMonitoring.scss'

/** Временно: в блоке «Просрочки» показывать все задачи с дедлайном и колонки «Дедлайн», «Сейчас», «Просрочен?» для отладки. */
const DEBUG_OVERDUE = false

const PieChart = ({ data, size = 180, title, description, emptyLabel }) => {
  const emptyHint = emptyLabel || title ? `Нет данных по: «${title}»` : 'Нет данных'
  if (!data || data.length === 0) {
    return (
      <div className="process-monitoring__pie-chart">
        <div className="process-monitoring__pie-wrap process-monitoring__pie-wrap--empty" style={{ width: size, height: size }}>
          <div className="process-monitoring__pie-empty">
            <span className="process-monitoring__pie-empty-title">{title || 'Диаграмма'}</span>
            <span className="process-monitoring__pie-empty-hint">{emptyHint}</span>
          </div>
        </div>
        {title && <div className="process-monitoring__pie-title">{title}</div>}
        {description && <div className="process-monitoring__pie-description">{description}</div>}
      </div>
    )
  }
  const total = data.reduce((s, d) => s + (d.value || 0), 0)
  if (total === 0) {
    return (
      <div className="process-monitoring__pie-chart">
        <div className="process-monitoring__pie-wrap process-monitoring__pie-wrap--empty" style={{ width: size, height: size }}>
          <div className="process-monitoring__pie-empty">
            <span className="process-monitoring__pie-empty-title">{title || 'Диаграмма'}</span>
            <span className="process-monitoring__pie-empty-hint">{emptyHint}</span>
          </div>
        </div>
        {title && <div className="process-monitoring__pie-title">{title}</div>}
        {description && <div className="process-monitoring__pie-description">{description}</div>}
      </div>
    )
  }
  let acc = 0
  const gradient = data
    .map((d) => {
      const p = ((d.value || 0) / total) * 100
      const start = acc
      acc += p
      return `${d.color || '#6b7280'} ${start}% ${acc}%`
    })
    .join(', ')
  return (
    <div className="process-monitoring__pie-chart">
      <div
        className="process-monitoring__pie-ring"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${gradient})`,
        }}
      >
        <div className="process-monitoring__pie-hole">
          <span className="process-monitoring__pie-total">{total}</span>
        </div>
      </div>
      {title && <div className="process-monitoring__pie-title">{title}</div>}
      {description && <div className="process-monitoring__pie-description">{description}</div>}
      <ul className="process-monitoring__pie-legend">
        {data.map((d, i) => (
          <li key={i}>
            <span className="process-monitoring__legend-dot" style={{ background: d.color }} />
            <span>{d.label}</span>
            <span className="process-monitoring__legend-value">
              {d.value} ({total ? ((d.value / total) * 100).toFixed(0) : 0}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const ProcessMonitoring = () => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    departmentId: '',
    userId: '',
  })
  const [displayMode, setDisplayMode] = useState('charts') // charts | tables
  const [bpProcessesList, setBpProcessesList] = useState([])
  const [selectedBpId, setSelectedBpId] = useState('')
  const [bpNodes, setBpNodes] = useState([])
  const [loadingBpNodes, setLoadingBpNodes] = useState(false)
  const [bottlenecksParticipants, setBottlenecksParticipants] = useState([])
  const [bottlenecksDepartments, setBottlenecksDepartments] = useState([])
  const [loadingBottlenecks, setLoadingBottlenecks] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailType, setDetailType] = useState('')
  const [detailItems, setDetailItems] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailStatusFilter, setDetailStatusFilter] = useState('В работе')
  /** При DEBUG_OVERDUE: момент «сейчас» при открытии просрочек (ISO), для колонки «Сейчас (клиент)». */
  const [overdueDebugNow, setOverdueDebugNow] = useState(null)
  /** Список задач «в работе» (при фильтре «В работе») — для расчёта просрочки на клиенте и списка «Просрочки» без лишнего запроса. */
  const [tasksInProgressList, setTasksInProgressList] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [generalStats, setGeneralStats] = useState(false)
  const [statusFilter, setStatusFilter] = useState('in_progress')
  const [isHelpOpen, setHelpOpen] = useState(false)

  /** Как в карточке Задачи и Менеджере: просрочка = дедлайн прошёл, задача не завершена. */
  const isOverdue = useCallback((task) =>
    task.deadline &&
    new Date(task.deadline) < new Date() &&
    task.status !== 'done' &&
    !task.completedAt
  , [])

  const loadDepartments = useCallback(async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}5000/api/analytics/departments`)
      setDepartments(r.data || [])
    } catch (e) {
      console.error('Ошибка загрузки отделов:', e)
    }
  }, [])

  const loadEmployees = useCallback(async (departmentId) => {
    try {
      const url = departmentId
        ? `${API_BASE_URL}5000/api/analytics/employees?departmentId=${departmentId}`
        : `${API_BASE_URL}5000/api/analytics/employees`
      const r = await axios.get(url)
      setEmployees(r.data || [])
    } catch (e) {
      console.error('Ошибка загрузки сотрудников:', e)
    }
  }, [])

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setTasksInProgressList([])
    try {
      const params = new URLSearchParams()
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      if (filters.departmentId) params.set('departmentId', filters.departmentId)
      if (filters.userId) params.set('userId', filters.userId)
      if (!generalStats && statusFilter) params.set('statusFilter', statusFilter)
      params.set('clientNow', new Date().toISOString())
      const summaryParams = params.toString()
      const isInProgress = !generalStats && statusFilter === 'in_progress'
      /** При «В работе» — список для срезов и просрочки; при «Общая статистика» — список «в работе» только для расчёта просрочки в карте и диаграмме. */
      const needTasksListForOverdue = isInProgress || generalStats
      const requests = [axios.get(`${API_BASE_URL}5000/api/analytics/summary?${summaryParams}`)]
      if (needTasksListForOverdue) {
        const tasksListParams = new URLSearchParams()
        tasksListParams.set('type', 'tasks')
        tasksListParams.set('statusFilter', 'in_progress')
        if (filters.dateFrom) tasksListParams.set('dateFrom', filters.dateFrom)
        if (filters.dateTo) tasksListParams.set('dateTo', filters.dateTo)
        if (filters.departmentId) tasksListParams.set('departmentId', filters.departmentId)
        if (filters.userId) tasksListParams.set('userId', filters.userId)
        requests.push(axios.get(`${API_BASE_URL}5000/api/analytics/detail?${tasksListParams}`))
      }
      const results = await Promise.all(requests)
      const summaryData = results[0].data || {}
      const rawList = needTasksListForOverdue && Array.isArray(results[1]?.data) ? results[1].data : []
      setTasksInProgressList(rawList)
      if (summaryData.summary?.byCategory?.tasks) {
        const overdueCount = rawList.filter(isOverdue).length
        if (isInProgress) {
          const TASK_STATUS_IDS = ['backlog', 'todo', 'wait', 'doing', 'done', 'pause']
          const byStatusInProgress = {}
          TASK_STATUS_IDS.forEach((sid) => { byStatusInProgress[sid] = 0 })
          rawList.forEach((task) => {
            if (!isOverdue(task)) {
              const s = (task.status && TASK_STATUS_IDS.includes(task.status)) ? task.status : 'backlog'
              byStatusInProgress[s] = (byStatusInProgress[s] || 0) + 1
            }
          })
          summaryData.summary.byCategory.tasks = {
            ...summaryData.summary.byCategory.tasks,
            overdue: overdueCount,
            byStatusInProgress,
          }
        } else if (generalStats) {
          summaryData.summary.byCategory.tasks = {
            ...summaryData.summary.byCategory.tasks,
            overdue: overdueCount,
          }
        }
      }
      setData(summaryData)
    } catch (e) {
      console.error('Ошибка загрузки аналитики:', e)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [filters.dateFrom, filters.dateTo, filters.departmentId, filters.userId, generalStats, statusFilter, isOverdue])

  const loadBpProcessesList = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      const r = await axios.get(`${API_BASE_URL}5000/api/analytics/business-processes/list?${params}`)
      setBpProcessesList(r.data || [])
      setSelectedBpId((prev) => {
        const stillExists = (r.data || []).some((p) => String(p.id) === String(prev))
        return stillExists ? prev : ''
      })
    } catch (e) {
      console.error('Ошибка загрузки списка БП:', e)
      setBpProcessesList([])
      setSelectedBpId('')
    }
  }, [filters.dateFrom, filters.dateTo])

  const loadBpNodes = useCallback(async () => {
    if (!selectedBpId) {
      setBpNodes([])
      return
    }
    setLoadingBpNodes(true)
    try {
      const params = new URLSearchParams()
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      const r = await axios.get(
        `${API_BASE_URL}5000/api/analytics/business-processes/${selectedBpId}/nodes?${params}`
      )
      setBpNodes(r.data || [])
    } catch (e) {
      console.error('Ошибка загрузки узлов БП:', e)
      setBpNodes([])
    } finally {
      setLoadingBpNodes(false)
    }
  }, [selectedBpId, filters.dateFrom, filters.dateTo])

  const loadBottlenecks = useCallback(async () => {
    if (!selectedBpId) {
      setBottlenecksParticipants([])
      setBottlenecksDepartments([])
      return
    }
    setLoadingBottlenecks(true)
    try {
      const params = new URLSearchParams()
      params.set('scope', 'process')
      params.set('processId', selectedBpId)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      const base = `${API_BASE_URL}5000/api/analytics/bottlenecks`
      const [pRes, dRes] = await Promise.all([
        axios.get(`${base}/participants?${params}`),
        axios.get(`${base}/departments?${params}`),
      ])
      setBottlenecksParticipants(pRes.data || [])
      setBottlenecksDepartments(dRes.data || [])
    } catch (e) {
      console.error('Ошибка загрузки узких мест по участникам/отделам:', e)
      setBottlenecksParticipants([])
      setBottlenecksDepartments([])
    } finally {
      setLoadingBottlenecks(false)
    }
  }, [selectedBpId, filters.dateFrom, filters.dateTo])

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadDepartments()
      await loadEmployees(filters.departmentId || undefined)
      await loadSummary()
      await loadBpProcessesList()
      await loadBpNodes()
      await loadBottlenecks()
    } finally {
      setRefreshing(false)
    }
  }, [
    loadDepartments,
    loadEmployees,
    loadSummary,
    loadBpProcessesList,
    loadBpNodes,
    loadBottlenecks,
    filters.departmentId,
  ])

  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  useEffect(() => {
    loadEmployees(filters.departmentId || undefined)
  }, [filters.departmentId, loadEmployees])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (data) loadBpProcessesList()
  }, [data, loadBpProcessesList])

  useEffect(() => {
    loadBpNodes()
  }, [loadBpNodes])

  useEffect(() => {
    loadBottlenecks()
  }, [loadBottlenecks])

  const applyFilters = (next) => {
    setFilters((p) => ({ ...p, ...next }))
  }

  const fetchDetail = useCallback(
    async (type, detailStatus) => {
      setDetailLoading(true)
      setOverdueDebugNow(null)
      try {
        const params = new URLSearchParams()
        let requestType = type
        if (type === 'overdue' && DEBUG_OVERDUE) {
          requestType = 'tasks'
          params.set('statusFilter', 'in_progress')
        }
        params.set('type', requestType)
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
        if (filters.dateTo) params.set('dateTo', filters.dateTo)
        if (filters.departmentId) params.set('departmentId', filters.departmentId)
        if (filters.userId) params.set('userId', filters.userId)
        if (!generalStats && statusFilter) params.set('statusFilter', statusFilter)
        if (type === 'projects' && detailStatus) params.set('status', detailStatus)
        if (type === 'overdue' && !DEBUG_OVERDUE) params.set('clientNow', new Date().toISOString())
        const r = await axios.get(`${API_BASE_URL}5000/api/analytics/detail?${params}`)
        const raw = Array.isArray(r.data) ? r.data : []
        if (type === 'overdue' && DEBUG_OVERDUE) {
          const withDeadline = raw.filter((row) => row.deadline)
          setDetailItems(
            withDeadline.map((row) => ({
              ...row,
              entityType: row.projectTitle ? 'Проект' : 'Задача',
            }))
          )
          setOverdueDebugNow(new Date().toISOString())
        } else {
          setDetailItems(raw)
        }
      } catch (e) {
        console.error('Ошибка загрузки детализации:', e)
        setDetailItems([])
      } finally {
        setDetailLoading(false)
      }
    },
    [filters.dateFrom, filters.dateTo, filters.departmentId, filters.userId, generalStats, statusFilter]
  )

  const openDetail = useCallback(
    async (type) => {
      setDetailType(type)
      setDetailOpen(true)
      const projectsDetailStatus = statusFilter === 'completed' ? 'Завершено' : 'В работе'
      setDetailStatusFilter(type === 'projects' ? projectsDetailStatus : '')
      if (type === 'overdue' && tasksInProgressList.length > 0) {
        setDetailItems(
          tasksInProgressList.filter(isOverdue).map((row) => ({
            ...row,
            entityType: row.projectTitle ? 'Проект' : 'Задача',
          }))
        )
        setOverdueDebugNow(DEBUG_OVERDUE ? new Date().toISOString() : null)
        setDetailLoading(false)
        return
      }
      setDetailItems([])
      const detailStatus = type === 'projects' ? projectsDetailStatus : undefined
      await fetchDetail(type, detailStatus)
    },
    [fetchDetail, statusFilter, tasksInProgressList, isOverdue]
  )

  const detailTitles = {
    projects: 'Проекты',
    tasks: 'Задачи',
    processes: 'Бизнес-процессы',
    overdue: 'Просрочки',
  }
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
  /** Дата и время для отображения дедлайна в блоке «Задачи» (чтобы видеть, какое время приходит с сервера). */
  const formatDateWithTime = (d) =>
    d
      ? new Date(d).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : '—'

  const s = data?.summary?.byCategory || {}
  const projects = s.projects || {}
  const bp = s.businessProcesses || {}
  const tasks = s.tasks || {}

  const statusFilterActive = !generalStats && statusFilter
  /** При фильтре «В работе»: только не завершённые; при «Завершено»: только завершённая группа. */
  const projectsCardValue = statusFilterActive
    ? (statusFilter === 'in_progress'
      ? (projects.total ?? 0)
      : (projects.completed || 0) + (projects.failed || 0) + (projects.deleted || 0))
    : (projects.total ?? 0)
  const projectsCardDetail = statusFilterActive
    ? (statusFilter === 'in_progress'
      ? ((projects.onPause || 0) > 0 ? `На паузе: ${projects.onPause}` : 'не завершённые')
      : `Завершено: ${projects.completed ?? 0}, Удалено: ${projects.deleted ?? 0}, Неудача: ${projects.failed ?? 0}`)
    : `завершено: ${projects.completed ?? 0}`

  const tasksCardValue = statusFilterActive
    ? (statusFilter === 'in_progress' ? (tasks.total ?? 0) : (tasks.completed ?? 0))
    : (tasks.total ?? 0)
  const tasksCardDetail = statusFilterActive
    ? (statusFilter === 'in_progress' ? 'в работе (отдельные и подзадачи)' : 'выполнено')
    : `отдельные и подзадачи; завершено: ${tasks.completed ?? 0}`

  /** В карточке и диаграммах БП — только число экземпляров (без проектов из БП). */
  const bpCardValue = statusFilterActive
    ? (statusFilter === 'in_progress' ? (bp.running ?? 0) : (bp.completed || 0) + (bp.failed || 0))
    : (bp.instances ?? 0)
  const categoryPieData = [
    { label: 'Проекты', value: statusFilterActive ? (statusFilter === 'in_progress' ? (projects.total || 0) : (projects.completed || 0) + (projects.failed || 0) + (projects.deleted || 0)) : (projects.total || 0), color: '#3b82f6' },
    { label: 'Бизнес-процессы', value: bpCardValue, color: '#8b5cf6' },
    { label: 'Задачи', value: statusFilterActive ? (statusFilter === 'in_progress' ? (tasks.total || 0) : (tasks.completed || 0)) : (tasks.total || 0), color: '#10b981' },
  ].filter((d) => d.value > 0)

  const projectsPieData = statusFilterActive
    ? (statusFilter === 'completed'
      ? [
          { label: 'Завершено', value: projects.completed || 0, color: '#10b981' },
          { label: 'Провал', value: projects.failed || 0, color: '#ef4444' },
          { label: 'Удалено', value: projects.deleted || 0, color: '#6b7280' },
        ].filter((d) => d.value > 0)
      : [
          { label: 'На паузе', value: projects.onPause || 0, color: '#f59e0b' },
          { label: 'В работе', value: Math.max(0, (projects.total || 0) - (projects.onPause || 0)), color: '#3b82f6' },
        ].filter((d) => d.value > 0))
    : [
        { label: 'Завершено', value: projects.completed || 0, color: '#10b981' },
        { label: 'В работе', value: Math.max(0, (projects.total || 0) - (projects.completed || 0) - (projects.failed || 0) - (projects.deleted || 0) - (projects.onPause || 0)), color: '#3b82f6' },
        { label: 'На паузе', value: projects.onPause || 0, color: '#f59e0b' },
        { label: 'Провал', value: projects.failed || 0, color: '#ef4444' },
        { label: 'Удалено', value: projects.deleted || 0, color: '#6b7280' },
      ].filter((d) => d.value > 0)

  const bpPieData = statusFilterActive
    ? (statusFilter === 'completed'
      ? [
          { label: 'Завершено', value: bp.completed || 0, color: '#10b981' },
          { label: 'Провал', value: bp.failed || 0, color: '#ef4444' },
        ].filter((d) => d.value > 0)
      : [{ label: 'В работе', value: bpCardValue, color: '#3b82f6' }].filter((d) => d.value > 0))
    : [
        { label: 'Завершено', value: bp.completed || 0, color: '#10b981' },
        { label: 'В работе', value: bp.running || 0, color: '#3b82f6' },
        { label: 'Провал', value: bp.failed || 0, color: '#ef4444' },
      ].filter((d) => d.value > 0)

  // Подписи статусов канбана для диаграммы «Задачи» при фильтре «В работе»
  const TASK_STATUS_LABELS = {
    backlog: 'Список задач',
    todo: 'К выполнению',
    wait: 'В ожидании',
    doing: 'В процессе',
    done: 'Выполнено (ожидает одобрения)',
    pause: 'Приостановлено',
  }
  const TASK_STATUS_ORDER = ['backlog', 'todo', 'wait', 'doing', 'done', 'pause']
  const TASK_STATUS_COLORS = {
    backlog: '#94a3b8',
    todo: '#3b82f6',
    wait: '#f59e0b',
    doing: '#10b981',
    done: '#8b5cf6',
    pause: '#64748b',
  }
  const tasksPieData = statusFilterActive
    ? (statusFilter === 'completed'
      ? [
          { label: 'Выполнено', value: tasks.completed || 0, color: '#10b981' },
          { label: 'Просрочено', value: tasks.overdue || 0, color: '#ef4444' },
        ].filter((d) => d.value > 0)
      : (() => {
          const byStatus = tasks.byStatusInProgress || {}
          const slices = []
          if ((tasks.overdue || 0) > 0) {
            slices.push({ label: 'Просрочка', value: tasks.overdue || 0, color: '#ef4444' })
          }
          TASK_STATUS_ORDER.forEach((sid) => {
            const v = byStatus[sid] || 0
            if (v > 0) slices.push({ label: TASK_STATUS_LABELS[sid] || sid, value: v, color: TASK_STATUS_COLORS[sid] || '#6b7280' })
          })
          return slices
        })())
    : [
        { label: 'Выполнено', value: tasks.completed || 0, color: '#10b981' },
        { label: 'Просрочено', value: tasks.overdue || 0, color: '#ef4444' },
        { label: 'В работе', value: Math.max(0, (tasks.total || 0) - (tasks.completed || 0) - (tasks.overdue || 0)), color: '#3b82f6' },
      ].filter((d) => d.value > 0)

  const formatSeconds = (sec) => {
    if (sec == null) return '—'
    if (sec < 1) return sec > 0 ? `${Number(sec).toFixed(1)} с` : '0 с'
    if (sec < 60) return `${Number(sec).toFixed(1)} с`
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    return s ? `${m} мин ${s} с` : `${m} мин`
  }

  const byDept = data?.byDepartment || []
  const departmentPieData = byDept
    .filter((d) => (d.projectsCount || 0) + (d.tasksCount || 0) > 0)
    .map((d, i) => ({
      label: d.departmentName || `Отдел ${d.departmentId}`,
      value: (d.projectsCount || 0) + (d.tasksCount || 0),
      color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'][i % 5],
    }))

  const loadByAuthor = data?.loadByAuthorDepartment || []
  const loadByAuthorPieData = loadByAuthor
    .filter((d) => (d.value || 0) > 0)
    .map((d, i) => ({
      label: d.authorDepartmentName || 'Без отдела',
      value: d.value || 0,
      color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'][i % 7],
    }))

  return (
   <div className="content-process-monitoring">
    <div className="process-monitoring">
      <header className="process-monitoring__header">
        <div className="process-monitoring__header-row">
          <h1 className="process-monitoring__title">
            <MdAssessment className="process-monitoring__title-icon" />
            Мониторинг процессов
          </h1>
          <button
            type="button"
            className="process-monitoring__help-btn"
            onClick={() => setHelpOpen(true)}
            title="Справка по разделу"
          >
            <MdHelpOutline /> Справка
          </button>
        </div>
        <p className="process-monitoring__subtitle">
          Нагрузка по отделам и сотрудникам, узкие места, просрочки. Карточки сверху кликабельны — по нажатию открывается список проектов, задач, экземпляров БП или просроченных с учётом текущих фильтров.
        </p>
      </header>

      <section className="process-monitoring__filters">
        <div className="process-monitoring__filters-row">
          <MdFilterList className="process-monitoring__filters-icon" />
          <span className="process-monitoring__filters-label">Период и фильтры</span>
        </div>
        <div className="process-monitoring__filters-grid">
          <div className="process-monitoring__filter-group">
            <label>
              <MdDateRange /> С
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => applyFilters({ dateFrom: e.target.value })}
            />
          </div>
          <div className="process-monitoring__filter-group">
            <label>По</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => applyFilters({ dateTo: e.target.value })}
            />
          </div>
          <div className="process-monitoring__filter-group">
            <label><FcDepartment /> Отдел</label>
            <select
              value={filters.departmentId}
              onChange={(e) => applyFilters({ departmentId: e.target.value, userId: '' })}
            >
              <option value="">Все</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="process-monitoring__filter-group">
            <label><FaUsers /> Сотрудник</label>
            <select
              value={filters.userId}
              onChange={(e) => applyFilters({ userId: e.target.value })}
            >
              <option value="">Все</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} {emp.departmentName ? `(${emp.departmentName})` : ''}</option>
              ))}
            </select>
          </div>  
             <div className="process-monitoring__filter-group process-monitoring__filter-group--checkbox">
            <label>
              <input
                type="checkbox"
                checked={generalStats}
                onChange={(e) => setGeneralStats(e.target.checked)}
              />
              <span>Общая статистика</span>
            </label> 
            <span className="process-monitoring__filter-hint">Включает все статусы</span>
          </div>
          {!generalStats && (
            <div className="process-monitoring__filter-group">
              <label>Статус</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                title="Показывать только «В работе» или только «Завершено» (в т.ч. Провал, Удален)"
              >
                <option value="in_progress">В работе</option>
                <option value="completed">Завершено</option>
              </select>
            </div>
          )}
        </div>
        <div className="process-monitoring__view-toggle">
          <button
            type="button"
            className={displayMode === 'charts' ? 'active' : ''}
            onClick={() => setDisplayMode('charts')}
          >
            <FaChartPie /> Графики
          </button>
          <button
            type="button"
            className={displayMode === 'tables' ? 'active' : ''}
            onClick={() => setDisplayMode('tables')}
          >
            <FaTable /> Таблицы
          </button>
          <button
            type="button"
            className="process-monitoring__refresh-btn"
            onClick={refreshAll}
            disabled={refreshing}
            title="Обновить все данные с учётом текущих фильтров"
          >
            <MdRefresh className={refreshing ? 'process-monitoring__refresh-icon--spin' : ''} />
            {refreshing ? 'Обновление…' : 'Обновить'}
          </button>
        </div>
      </section>

      {loading ? (
        <div className="process-monitoring__loading">Загрузка данных…</div>
      ) : !data ? (
        <div className="process-monitoring__error">Не удалось загрузить аналитику</div>
      ) : (
        <>
          <section className="process-monitoring__summary-cards">
            <button
              type="button"
              className="process-monitoring__card process-monitoring__card--projects"
              onClick={() => openDetail('projects')}
              title="Нажмите, чтобы открыть список проектов"
            >
              <FaBriefcase className="process-monitoring__card-icon" />
              <div className="process-monitoring__card-body">
                <span className="process-monitoring__card-label">Проекты</span>
                <span className="process-monitoring__card-value">{projectsCardValue}</span>
                <span className="process-monitoring__card-detail">{projectsCardDetail}</span>
              </div>
            </button>
            <button
              type="button"
              className="process-monitoring__card process-monitoring__card--bp"
              onClick={() => openDetail('processes')}
              title="Нажмите, чтобы открыть список экземпляров БП"
            >
              <FcFlowChart className="process-monitoring__card-icon" />
              <div className="process-monitoring__card-body">
                <span className="process-monitoring__card-label">Бизнес-процессы</span>
                <span className="process-monitoring__card-value">{bpCardValue}</span>
                <span className="process-monitoring__card-detail">задач в БП: {bp.tasksFromBP ?? 0}</span>
              </div>
            </button>
            <button
              type="button"
              className="process-monitoring__card process-monitoring__card--tasks"
              onClick={() => openDetail('tasks')}
              title="Нажмите, чтобы открыть список задач"
            >
              <FaTasks className="process-monitoring__card-icon" />
              <div className="process-monitoring__card-body">
                <span className="process-monitoring__card-label">Задачи</span>
                <span className="process-monitoring__card-value">{tasksCardValue}</span>
                <span className="process-monitoring__card-detail">{tasksCardDetail}</span>
              </div>
            </button>
            {(generalStats || statusFilter !== 'completed') && (
            <button
              type="button"
              className="process-monitoring__card process-monitoring__card--overdue"
              onClick={() => openDetail('overdue')}
              title="Просроченные задачи (дедлайн прошёл). Проекты в этот счёт не входят. Нажмите — список."
            >
              <FaExclamationTriangle className="process-monitoring__card-icon" />
              <div className="process-monitoring__card-body">
                <span className="process-monitoring__card-label">Просрочки</span>
                <span className="process-monitoring__card-value">{tasks.overdue ?? 0}</span>
                <span className="process-monitoring__card-detail">только задачи с просроченным дедлайном</span>
              </div>
            </button>
            )}
          </section>

          {displayMode === 'charts' && (
            <section className="process-monitoring__charts">
              <h2 className="process-monitoring__section-title">Круговые диаграммы</h2>
              <p className="process-monitoring__charts-desc">
                {statusFilterActive ? `Показано только: ${statusFilter === 'in_progress' ? 'В работе' : 'Завершено'}. Ниже — детализация по категориям.` : 'Сводка по категориям. Ниже — детализация по проектам, задачам и БП.'}
              </p>
              <div className="process-monitoring__charts-grid">
                <PieChart data={categoryPieData} title="По категориям" size={200} description={statusFilterActive ? (statusFilter === 'in_progress' ? 'В работе' : 'Завершено') : null} />
                <PieChart data={projectsPieData} title="Проекты" size={200} />
                <PieChart data={tasksPieData} title="Задачи" size={200} />
                <PieChart data={bpPieData} title="Бизнес-процессы" size={200} />
                <PieChart
                  data={departmentPieData}
                  title="Загрузка по отделам"
                  description="По исполнителям: проекты (отдел — автор или ответственный), задачи (отдел — исполнитель)"
                  size={200}
                />
                {(filters.departmentId || filters.userId) && (
                  <PieChart
                    data={loadByAuthorPieData}
                    title="Кто создаёт нагрузку"
                    description="При выбранном отделе/сотруднике — доли отделов-авторов задач и проектов (направление нагрузки на исполнителя)"
                    size={200}
                    emptyLabel="Кто создаёт нагрузку"
                  />
                )}
              </div>
            </section>
          )}

          {displayMode === 'tables' && (
            <section className="process-monitoring__tables">
              <h2 className="process-monitoring__section-title">По отделам</h2>
              <div className="process-monitoring__table-block">
                <h3>Проекты и задачи</h3>
                <div className="process-monitoring__table-wrap">
                  <table className="process-monitoring__table">
                    <thead>
                      <tr>
                        <th>Отдел</th>
                        <th>Проекты</th>
                        <th>Задачи</th>
                        <th>Просрочки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byDept.map((row) => (
                        <tr key={row.departmentId}>
                          <td>{row.departmentName}</td>
                          <td>{row.projectsCount ?? 0}</td>
                          <td>{row.tasksCount ?? 0}</td>
                          <td className={row.overdueCount > 0 ? 'process-monitoring__cell--overdue' : ''}>
                            {row.overdueCount ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="process-monitoring__table-block">
                <h3>По сотрудникам</h3>
                <div className="process-monitoring__table-wrap">
                  <table className="process-monitoring__table">
                    <thead>
                      <tr>
                        <th>Сотрудник</th>
                        <th>Отдел</th>
                        <th>Проекты</th>
                        <th>{!statusFilter ? 'Задачи' : statusFilter === 'completed' ? 'Выполнено задач' : 'Задач в работе'}</th>
                        <th>Просрочки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.byEmployee || []).map((row) => (
                        <tr key={row.userId}>
                          <td>{row.userName}</td>
                          <td>{row.departmentName}</td>
                          <td>{row.projectsCount ?? 0}</td>
                          <td>{row.tasksCount ?? row.tasksCompleted ?? 0}</td>
                          <td className={row.tasksOverdue > 0 ? 'process-monitoring__cell--overdue' : ''}>
                            {row.tasksOverdue ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          <section className="process-monitoring__bp-detail">
            <h2 className="process-monitoring__section-title">
              <FcFlowChart /> Детали по бизнес-процессам
            </h2>
            <p className="process-monitoring__bp-detail-desc">
              Где уходит время: для каждого этапа считаются — время самого этапа, задачи БП (связанные с узлом), активность по проектам (чат/история), задачи и подзадачи внутри проектов этого этапа, ожидание ответов по почте. Узкое место — этапы с наибольшим суммарным временем. В колонке «Где время» — подсказка с разбивкой.
            </p>
            <div className="process-monitoring__bp-detail-select-wrap">
              <label className="process-monitoring__bp-detail-label">Бизнес-процесс</label>
              <select
                className="process-monitoring__bp-detail-select"
                value={selectedBpId}
                onChange={(e) => setSelectedBpId(e.target.value)}
              >
                <option value="">— Выберите процесс —</option>
                {bpProcessesList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (экз.: {p.instancesTotal}, завершено: {p.instancesCompleted})
                  </option>
                ))}
              </select>
            </div>
            {selectedBpId && (
              <>
              <div className="process-monitoring__bp-nodes-block">
                {loadingBpNodes ? (
                  <div className="process-monitoring__loading">Загрузка этапов…</div>
                ) : bpNodes.length === 0 ? (
                  <div className="process-monitoring__bp-nodes-empty">Нет данных по узлам за выбранный период</div>
                ) : (
                  <>
                    {(() => {
                      const combinedScore = (n) =>
                        n.combinedTotalSeconds != null
                          ? n.combinedTotalSeconds
                          : (n.totalSeconds || 0) + (n.taskTimeTotalSeconds || 0) + (n.projectTimeTotalSeconds || 0) + (n.tasksInProjectsTotalSeconds || 0) + (n.mailWaitTotalSeconds || 0)
                      const sorted = [...bpNodes].sort((a, b) => combinedScore(b) - combinedScore(a))
                      const withTime = sorted.filter((n) => combinedScore(n) > 0)
                      const bottleneckNodeId = withTime.length > 0 ? withTime[0].nodeId : null
                      return (
                        <div className="process-monitoring__table-wrap">
                          <table className="process-monitoring__table process-monitoring__table--nodes">
                            <thead>
                              <tr>
                                <th>Этап</th>
                                <th>Проходов</th>
                                <th>Ср./макс/всего время этапа</th>
                                <th>Задач</th>
                                <th>С дедл.</th>
                                <th>Просрочено</th>
                                <th>Авторы</th>
                                <th>Исполн.</th>
                                <th>Время в задачах БП</th>
                                <th>Проектов</th>
                                <th>Завершено</th>
                                <th>Ответств.</th>
                                <th>Ожид. соглас.</th>
                                <th>Док.</th>
                                <th>Время по проектам</th>
                                <th>Задачи в проектах</th>
                                <th>Почта (раундов)</th>
                                <th>Ожидание почты</th>
                                <th title="Разбивка: этап, задачи БП, проекты, задачи в проектах, почта">Где время</th>
                                <th title="Один этап с максимальным суммарным временем (этап + задачи + проекты + почта). При ускорении этого этапа узким местом станет следующий по времени">Узкое место</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bpNodes.map((node) => (
                                <tr
                                  key={node.nodeId}
                                  className={bottleneckNodeId === node.nodeId ? 'process-monitoring__row--bottleneck' : ''}
                                >
                                  <td>{node.nodeLabel || node.nodeId}</td>
                                  <td>{node.passCount ?? 0}</td>
                                  <td>
                                    {formatSeconds(node.avgSeconds)} / {formatSeconds(node.maxSeconds)} / {formatSeconds(node.totalSeconds)}
                                  </td>
                                  <td>{node.tasksCount ?? 0}</td>
                                  <td>{node.tasksWithDeadline ?? 0}</td>
                                  <td className={(node.tasksOverdue || 0) > 0 ? 'process-monitoring__cell--overdue' : ''}>
                                    {node.tasksOverdue ?? 0}
                                  </td>
                                  <td>{node.authorsCount ?? 0}</td>
                                  <td>{node.assigneesCount ?? 0}</td>
                                  <td>{formatSeconds(node.taskTimeTotalSeconds)}</td>
                                  <td>{node.projectsCount ?? 0}</td>
                                  <td>{node.projectsCompleted ?? 0}</td>
                                  <td>{node.responsiblesCount ?? 0}</td>
                                  <td>{(node.approvalPendingCount || 0) > 0 ? node.approvalPendingCount : '—'}</td>
                                  <td>{node.docsCount ?? 0}</td>
                                  <td>{formatSeconds(node.projectTimeTotalSeconds)}</td>
                                  <td title={`${node.tasksInProjectsCount ?? 0} шт.`}>
                                    {(node.tasksInProjectsCount ?? 0) > 0 ? `${node.tasksInProjectsCount} · ${formatSeconds(node.tasksInProjectsTotalSeconds)}` : '—'}
                                  </td>
                                  <td>{node.mailRoundsCount ?? 0}</td>
                                  <td>{formatSeconds(node.mailWaitTotalSeconds)}</td>
                                  <td
                                    className="process-monitoring__breakdown-cell"
                                    title={
                                      node.timeBreakdown
                                        ? [
                                            `Этап: ${formatSeconds(node.timeBreakdown.nodeSeconds)}`,
                                            `Задачи БП: ${formatSeconds(node.timeBreakdown.tasksBpSeconds)}`,
                                            `Проекты (активность): ${formatSeconds(node.timeBreakdown.projectsSeconds)}`,
                                            `Задачи в проектах: ${formatSeconds(node.timeBreakdown.tasksInProjectsSeconds)}`,
                                            `Почта: ${formatSeconds(node.timeBreakdown.mailSeconds)}`,
                                            `Итого: ${formatSeconds(node.timeBreakdown.totalSeconds)}`,
                                          ].join('\n')
                                        : ''
                                    }
                                  >
                                    {node.timeBreakdown ? (
                                      <span className="process-monitoring__breakdown-short">
                                        {[
                                          formatSeconds(node.timeBreakdown.nodeSeconds),
                                          formatSeconds(node.timeBreakdown.tasksBpSeconds),
                                          formatSeconds(node.timeBreakdown.projectsSeconds),
                                          formatSeconds(node.timeBreakdown.tasksInProjectsSeconds),
                                          formatSeconds(node.timeBreakdown.mailSeconds),
                                        ].join(' + ')}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td title={bottleneckNodeId === node.nodeId ? 'Самый долгий этап процесса по суммарному времени' : ''}>
                                    {bottleneckNodeId === node.nodeId ? (
                                      <span className="process-monitoring__bottleneck-badge">Да</span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
              {!loadingBottlenecks && (bottlenecksParticipants.length > 0 || bottlenecksDepartments.length > 0) && (
                <div className="process-monitoring__bottlenecks">
                  <h3 className="process-monitoring__bottlenecks-title">Кто тормозит выполнение</h3>
                  <p className="process-monitoring__bp-detail-desc">
                    По задачам этого процесса: кто из исполнителей и какой отдел дольше всего выполняют задачи (среднее и суммарное время, просрочки). Детализация показывает, на что именно ушло время: задачи, подзадачи, проекты, почта.
                  </p>
                  {bottlenecksParticipants.length > 0 && (
                    <div className="process-monitoring__table-block">
                      <h4>По участникам</h4>
                      <div className="process-monitoring__table-wrap">
                        <table className="process-monitoring__table">
                          <thead>
                            <tr>
                              <th>Участник</th>
                              <th>Отдел</th>
                              <th>Задач</th>
                              <th>Выполнено</th>
                              <th>Ср. время</th>
                              <th>Всего время</th>
                              <th>Просрочено</th>
                              <th>Детализация (на что время)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bottlenecksParticipants.map((row) => {
                              const b = row.breakdown || {}
                              const parts = []
                              if ((b.task?.count ?? 0) > 0 || (b.task?.totalSeconds ?? 0) > 0) parts.push(`Задача: ${b.task?.count ?? 0} (${formatSeconds(b.task?.totalSeconds)})`)
                              if ((b.subtask?.count ?? 0) > 0 || (b.subtask?.totalSeconds ?? 0) > 0) parts.push(`Подзадача: ${b.subtask?.count ?? 0} (${formatSeconds(b.subtask?.totalSeconds)})`)
                              if ((b.project?.count ?? 0) > 0 || (b.project?.totalSeconds ?? 0) > 0) parts.push(`Проект: ${b.project?.count ?? 0} (${formatSeconds(b.project?.totalSeconds)})`)
                              if ((b.mail?.rounds ?? 0) > 0 || (b.mail?.totalSeconds ?? 0) > 0) parts.push(`Почта: ${b.mail?.rounds ?? 0} отв. (${formatSeconds(b.mail?.totalSeconds)})`)
                              return (
                                <tr key={row.userId}>
                                  <td>{row.userName}</td>
                                  <td>{row.departmentName}</td>
                                  <td>{row.tasksCount ?? 0}</td>
                                  <td>{row.tasksCompleted ?? 0}</td>
                                  <td>{formatSeconds(row.avgDurationSeconds)}</td>
                                  <td>{formatSeconds(row.totalDurationSeconds)}</td>
                                  <td className={(row.overdueCount || 0) > 0 ? 'process-monitoring__cell--overdue' : ''}>{row.overdueCount ?? 0}</td>
                                  <td className="process-monitoring__breakdown-cell">{parts.length ? parts.join('; ') : '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {bottlenecksDepartments.length > 0 && (
                    <div className="process-monitoring__table-block">
                      <h4>По отделам</h4>
                      <div className="process-monitoring__table-wrap">
                        <table className="process-monitoring__table">
                          <thead>
                            <tr>
                              <th>Отдел</th>
                              <th>Задач</th>
                              <th>Выполнено</th>
                              <th>Ср. время</th>
                              <th>Всего время</th>
                              <th>Просрочено</th>
                              <th>Детализация (на что время)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bottlenecksDepartments.map((row) => {
                              const b = row.breakdown || {}
                              const parts = []
                              if ((b.task?.count ?? 0) > 0 || (b.task?.totalSeconds ?? 0) > 0) parts.push(`Задача: ${b.task?.count ?? 0} (${formatSeconds(b.task?.totalSeconds)})`)
                              if ((b.subtask?.count ?? 0) > 0 || (b.subtask?.totalSeconds ?? 0) > 0) parts.push(`Подзадача: ${b.subtask?.count ?? 0} (${formatSeconds(b.subtask?.totalSeconds)})`)
                              if ((b.project?.count ?? 0) > 0 || (b.project?.totalSeconds ?? 0) > 0) parts.push(`Проект: ${b.project?.count ?? 0} (${formatSeconds(b.project?.totalSeconds)})`)
                              if ((b.mail?.rounds ?? 0) > 0 || (b.mail?.totalSeconds ?? 0) > 0) parts.push(`Почта: ${b.mail?.rounds ?? 0} отв. (${formatSeconds(b.mail?.totalSeconds)})`)
                              return (
                                <tr key={row.departmentId}>
                                  <td>{row.departmentName}</td>
                                  <td>{row.tasksCount ?? 0}</td>
                                  <td>{row.tasksCompleted ?? 0}</td>
                                  <td>{formatSeconds(row.avgDurationSeconds)}</td>
                                  <td>{formatSeconds(row.totalDurationSeconds)}</td>
                                  <td className={(row.overdueCount || 0) > 0 ? 'process-monitoring__cell--overdue' : ''}>{row.overdueCount ?? 0}</td>
                                  <td className="process-monitoring__breakdown-cell">{parts.length ? parts.join('; ') : '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </>
            )}
          </section>
        </>
      )}

      <HelpModalProcessMonitoring open={isHelpOpen} onClose={() => setHelpOpen(false)} />

      {detailOpen && (
        <div className="process-monitoring__detail-overlay" onClick={() => setDetailOpen(false)} role="presentation">
          <div className="process-monitoring__detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="process-monitoring__detail-header">
              <h3>
                {detailTitles[detailType] || detailType}
                {detailType === 'overdue' && DEBUG_OVERDUE && (
                  <span className="process-monitoring__detail-debug-hint"> (отладка: все с дедлайном)</span>
                )}
              </h3>
              <button type="button" className="process-monitoring__detail-close" onClick={() => setDetailOpen(false)} aria-label="Закрыть">
                ×
              </button>
            </div>
            <p className="process-monitoring__detail-filters-hint">
              Список по текущим фильтрам: период{filters.dateFrom || filters.dateTo ? ' (С–По)' : ''}
              {filters.departmentId ? ', отдел' : ''}
              {filters.userId ? ', сотрудник' : ''}.
            </p>
            {detailType === 'projects' && (
              <div className="process-monitoring__detail-status-filter">
                <label>Статус:</label>
                <select
                  value={detailStatusFilter}
                  onChange={(e) => {
                    const v = e.target.value
                    setDetailStatusFilter(v)
                    fetchDetail('projects', v || undefined)
                  }}
                >
                  <option value="В работе">В работе</option>
                  <option value="Все">Все</option>
                  <option value="Завершено">Завершено</option>
                  <option value="Пауза">На паузе</option>
                  <option value="Провал">Провал</option>
                  <option value="Удален">Удален</option>
                </select>
              </div>
            )}
            {detailLoading ? (
              <div className="process-monitoring__detail-loading">Загрузка…</div>
            ) : detailItems.length === 0 ? (
              <div className="process-monitoring__detail-empty">Нет записей по выбранным фильтрам</div>
            ) : (
              <div className="process-monitoring__detail-table-wrap">
                <table className="process-monitoring__table">
                  <thead>
                    <tr>
                      {detailType === 'projects' && (
                        <>
                          <th>Название</th>
                          <th>Статус</th>
                          <th>Задачи</th>
                          <th>Автор</th>
                          <th>Создан</th>
                          <th>Дедлайн</th>
                          <th>Дата завершения / провала / удаления</th>
                          <th>Источник</th>
                        </>
                      )}
                      {detailType === 'tasks' && (
                        <>
                          <th>Название</th>
                          <th>Проект</th>
                          <th>Автор</th>
                          <th>Исполнитель</th>
                          <th>Статус</th>
                          <th>Создана</th>
                          <th>Выполнена</th>
                          <th>Дедлайн</th>
                          <th>Источник</th>
                        </>
                      )}
                      {detailType === 'processes' && (
                        <>
                          <th>Процесс</th>
                          <th>Инициатор</th>
                          <th>Начало</th>
                          <th>Завершение</th>
                          <th>Статус</th>
                          <th>Проекты</th>
                          <th>Задачи</th>
                        </>
                      )}
                      {detailType === 'overdue' && (
                        <>
                          <th>Тип</th>
                          <th>Название</th>
                          <th>Проект</th>
                          <th>Автор</th>
                          <th>Исполнитель</th>
                          <th>Статус</th>
                          <th>Создана</th>
                          <th>Дедлайн (дата и время)</th>
                          {DEBUG_OVERDUE && (
                            <>
                              <th>Сейчас (клиент)</th>
                              <th>Просрочен?</th>
                            </>
                          )}
                          <th>Выполнена</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {detailType === 'projects' &&
                      detailItems.map((row) => (
                        <tr key={row.id}>
                          <td>{row.title || '—'}</td>
                          <td>{row.status || '—'}</td>
                          <td className="process-monitoring__cell-tasks">
                            {row.taskCount != null && row.taskCount > 0 ? (
                              <span title={row.taskTitles || undefined}>{row.taskCount}</span>
                            ) : (
                              row.taskCount === 0 ? '0' : '—'
                            )}
                          </td>
                          <td>{row.authorName}</td>
                          <td>{formatDate(row.createdAt)}</td>
                          <td>{formatDate(row.deadline)}</td>
                          <td>
                            {['Завершено', 'Провал', 'Удален'].includes(row.status)
                              ? formatDate(row.updatedAt)
                              : '—'}
                          </td>
                          <td>{row.fromBP ? 'Создано из БП' : '—'}</td>
                        </tr>
                      ))}
                    {detailType === 'tasks' &&
                      detailItems.map((row) => (
                        <tr key={row.id}>
                          <td>{row.title || '—'}</td>
                          <td>{row.projectTitle || '—'}</td>
                          <td>{row.authorName}</td>
                          <td>{row.assignees || '—'}</td>
                          <td>{row.status || '—'}</td>
                          <td>{formatDate(row.createdAt)}</td>
                          <td>{row.completedAt ? formatDate(row.completedAt) : '—'}</td>
                          <td>{formatDateWithTime(row.deadline)}</td>
                          <td>{row.fromBP ? 'Создано из БП' : '—'}</td>
                        </tr>
                      ))}
                    {detailType === 'processes' &&
                      detailItems.map((row) => (
                        <tr key={row.id}>
                          <td>{row.processName || '—'}</td>
                          <td>{row.initiatorName}</td>
                          <td>{row.startedAt ? formatDate(row.startedAt) : '—'}</td>
                          <td>{row.finishedAt ? formatDate(row.finishedAt) : '—'}</td>
                          <td>{row.status || '—'}</td>
                          <td className="process-monitoring__cell-tasks" title={row.projectTitles || undefined}>
                            {row.projectCount != null ? row.projectCount : '—'}
                          </td>
                          <td className="process-monitoring__cell-tasks" title={row.taskTitles || undefined}>
                            {row.taskCount != null ? row.taskCount : '—'}
                          </td>
                        </tr>
                      ))}
                    {detailType === 'overdue' &&
                      detailItems.map((row) => {
                        const nowForCompare = overdueDebugNow ? new Date(overdueDebugNow) : new Date()
                        const isOverdue =
                          row.deadline &&
                          new Date(row.deadline) < nowForCompare &&
                          row.status !== 'done' &&
                          !row.completedAt
                        return (
                          <tr key={row.id}>
                            <td>{row.entityType || 'Задача'}</td>
                            <td>{row.title || '—'}</td>
                            <td>{row.projectTitle || '—'}</td>
                            <td>{row.authorName}</td>
                            <td>{row.assignees || '—'}</td>
                            <td>{row.status || '—'}</td>
                            <td>{formatDate(row.createdAt)}</td>
                            <td className={isOverdue ? 'process-monitoring__cell--overdue' : ''} title={row.deadline || ''}>
                              {formatDateWithTime(row.deadline)}
                            </td>
                            {DEBUG_OVERDUE && (
                              <>
                                <td title={overdueDebugNow || ''}>{overdueDebugNow ? formatDateWithTime(overdueDebugNow) : '—'}</td>
                                <td className={isOverdue ? 'process-monitoring__cell--overdue' : ''}>{isOverdue ? 'Да' : 'Нет'}</td>
                              </>
                            )}
                            <td>{row.completedAt ? formatDate(row.completedAt) : '—'}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

export default ProcessMonitoring
