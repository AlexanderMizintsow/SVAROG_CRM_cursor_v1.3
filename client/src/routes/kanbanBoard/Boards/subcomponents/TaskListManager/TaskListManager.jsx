import { useEffect, useState, useMemo, useCallback } from 'react'
import { Box, Typography } from '@mui/material'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../../config'
import useUserStore from '../../../../../store/userStore'
import useTasksManageStore from '../../../../../store/useTasksManageStore'
import ApproverTaskList from './groupTasks/ApproverTaskList'
import VisibleTaskList from './groupTasks/VisibleTaskList'
import CreatedByTaskList from './groupTasks/CreatedByTaskList/CreatedByTaskList'
import SearchBar from '../../../../../components/searchBar/SearchBar'
import MiniProjectStrip from './MiniProjectStrip'
import { getLocalMonthDateRangeYyyyMmDd } from '../taskUtils'
import styles from './taskListManager.module.scss'

/** Локальная полночь / конец дня для input type="date" (YYYY-MM-DD) — как в GlobalTasksContainer */
function parseLocalDayStartMs(yyyyMmDd) {
  if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return null
  const [y, m, d] = yyyyMmDd.split('-').map((n) => parseInt(n, 10))
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

function parseLocalDayEndMs(yyyyMmDd) {
  if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return null
  const [y, m, d] = yyyyMmDd.split('-').map((n) => parseInt(n, 10))
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}

/** Сначала недавно завершённые (completed_at), при отсутствии — по дате создания */
function completedTaskSortMs(task) {
  if (task.completed_at) {
    const t = new Date(task.completed_at).getTime()
    if (!Number.isNaN(t)) return t
  }
  if (task.created_at) {
    const t = new Date(task.created_at).getTime()
    if (!Number.isNaN(t)) return t
  }
  return 0
}

const TaskListManager = ({ onClose, onOpenProject, stripRefreshKey }) => {
  const { user } = useUserStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [completedDateFrom, setCompletedDateFrom] = useState(
    () => getLocalMonthDateRangeYyyyMmDd().from
  )
  const [completedDateTo, setCompletedDateTo] = useState(
    () => getLocalMonthDateRangeYyyyMmDd().to
  )
  const [completedSearch, setCompletedSearch] = useState('')
  const { fetchTasksManager, tasksManager, fetchCompletedTasks, completedTasks, isLoading } =
    useTasksManageStore()
  const [approvalStatus, setApprovalStatus] = useState({})
  const [expandedGroups, setExpandedGroups] = useState({
    approver: true,
    visible: true,
  })
  /** Вкладки «Созданные» / «Завершённые» (когда есть хотя бы одна из групп) */
  const [createdCompletedTab, setCreatedCompletedTab] = useState('created')
  /** Как в CompletedTaskList: только задачи, где пользователь в исполнителях */
  const [showMyCompletedTasks, setShowMyCompletedTasks] = useState(true)
  const userId = user?.id
  // Загрузка задач при изменении userId
  useEffect(() => {
    if (userId) {
      fetchTasksManager(userId)
      fetchCompletedTasks(userId, {
        createdFrom: completedDateFrom,
        createdTo: completedDateTo,
      })
    }
  }, [userId, fetchTasksManager, fetchCompletedTasks, completedDateFrom, completedDateTo])

  useEffect(() => {
    const saved = localStorage.getItem('showMyTasks')
    if (saved !== null) {
      try {
        setShowMyCompletedTasks(JSON.parse(saved))
      } catch {
        /* ignore */
      }
    }
  }, [])

  const handleShowMyCompletedChange = useCallback((e) => {
    const checked = e.target.checked
    setShowMyCompletedTasks(checked)
    localStorage.setItem('showMyTasks', JSON.stringify(checked))
  }, [])

  // Инициализация состояния утверждения при загрузке задач
  useEffect(() => {
    if (tasksManager && tasksManager.length > 0) {
      const initialApprovalStatus = {}
      tasksManager.forEach((task) => {
        const currentApprover = task.approver_user_ids?.find(
          (approver) => approver.approver_id === userId
        )
        if (currentApprover) {
          initialApprovalStatus[task.task_id] = currentApprover.is_approved
        }
      })
      setApprovalStatus(initialApprovalStatus)
    }
  }, [tasksManager, userId])

  const filterTasks = (tasks) => {
    if (!searchTerm) return tasks
    return tasks.filter((task) => {
      const titleMatch = task.title.toLowerCase().includes(searchTerm.toLowerCase())
      const descriptionMatch = task.description.toLowerCase().includes(searchTerm.toLowerCase())
      return titleMatch || descriptionMatch
    })
  }

  const completedBaseList = useMemo(() => {
    const completed = [...(completedTasks || [])]
    if (Array.isArray(tasksManager)) {
      tasksManager.forEach((task) => {
        if (task.is_completed) {
          completed.push(task)
        }
      })
    }
    return completed
  }, [completedTasks, tasksManager])

  const completedTasksFiltered = useMemo(() => {
    let list = completedBaseList

    if (completedDateFrom || completedDateTo) {
      const fromMs = completedDateFrom ? parseLocalDayStartMs(completedDateFrom) : null
      const toMs = completedDateTo ? parseLocalDayEndMs(completedDateTo) : null
      list = list.filter((task) => {
        if (!task.created_at) return false
        const created = new Date(task.created_at).getTime()
        if (Number.isNaN(created)) return false
        if (fromMs != null && created < fromMs) return false
        if (toMs != null && created > toMs) return false
        return true
      })
    }

    const q = completedSearch.trim()
    if (q) {
      const words = q.split(/\s+/).filter(Boolean)
      list = list.filter((task) => {
        const title = (task.title || '').toLowerCase()
        const desc = (task.description || '').toLowerCase()
        const hay = `${title} ${desc}`
        return words.every((w) => hay.includes(w.toLowerCase()))
      })
    }

    return [...list].sort((a, b) => completedTaskSortMs(b) - completedTaskSortMs(a))
  }, [completedBaseList, completedDateFrom, completedDateTo, completedSearch])

  const completedTasksForCards = useMemo(() => {
    if (!userId) return completedTasksFiltered
    if (!showMyCompletedTasks) return completedTasksFiltered
    return completedTasksFiltered.filter((task) =>
      Array.isArray(task.assigned_user_ids) && task.assigned_user_ids.includes(userId)
    )
  }, [completedTasksFiltered, showMyCompletedTasks, userId])

  const completedMonthDefault = getLocalMonthDateRangeYyyyMmDd()
  const hasCompletedExtraFilters = Boolean(
    completedSearch.trim() ||
      completedDateFrom !== completedMonthDefault.from ||
      completedDateTo !== completedMonthDefault.to
  )

  const clearCompletedExtraFilters = useCallback(() => {
    const { from, to } = getLocalMonthDateRangeYyyyMmDd()
    setCompletedDateFrom(from)
    setCompletedDateTo(to)
    setCompletedSearch('')
  }, [])

  // Функция для обновления статуса утверждения
  const approval = async (taskId, userId, approv) => {
    const newApprovalStatus = !approv

    // Обновляем состояние локально
    setApprovalStatus((prev) => ({
      ...prev,
      [taskId]: newApprovalStatus,
    }))

    try {
      await axios.patch(
        `${API_BASE_URL}5000/api/task/approv/${taskId}/${userId}/${newApprovalStatus}`
      )
    } catch (error) {
      console.error('Ошибка при утверждении задачи:', error)

      setApprovalStatus((prev) => ({
        ...prev,
        [taskId]: approv,
      }))
    }
  }

  const handleTaskAccept = async (taskId, userId, isDone, comment = null) => {
    try {
      const data = {
        comment: comment || null, // Если comment не передан, будет null
      }

      await axios.patch(`${API_BASE_URL}5000/api/task/accept/${taskId}/${userId}/${isDone}`, data)
    } catch (error) {
      console.error('Ошибка при завершении задачи:', error)
    }
  }

  // Группировка задач
  const groupedTasks = {
    approver: [],
    visible: [],
    created_by: [],
    completed: completedTasks || [],
  }

  if (Array.isArray(tasksManager)) {
    tasksManager.forEach((task) => {
      if (task.approver_user_ids?.some((approver) => approver.approver_id === user.id)) {
        groupedTasks.approver.push(task)
      } else if (task.created_by === user.id) {
        groupedTasks.created_by.push(task)
      } else if (task.visibility_user_ids?.includes(user.id)) {
        groupedTasks.visible.push(task)
      }

      if (task.is_completed) {
        groupedTasks.completed.push(task)
      }
    })
  }

  const hasCreatedBySection = groupedTasks.created_by.length > 0
  const hasCompletedSection = groupedTasks.completed.length > 0
  const showCreatedCompletedTabs = hasCreatedBySection || hasCompletedSection
  const activeCreatedCompletedTab =
    hasCreatedBySection && !hasCompletedSection
      ? 'created'
      : !hasCreatedBySection && hasCompletedSection
        ? 'completed'
        : createdCompletedTab

  const toggleGroup = (group) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }))
  }

  const refreshTasks = async () => {
    if (userId) {
      await fetchTasksManager(userId)
      await fetchCompletedTasks(userId, {
        createdFrom: completedDateFrom,
        createdTo: completedDateTo,
      })
    }
  }

  if (isLoading) {
    return <Typography className={styles.loading}>Загрузка...</Typography>
  }

  return (
    <Box className={styles.container}>
      <Box className={styles.close} onClick={onClose}>
        &times;
      </Box>
      <Box className={styles.scrollContent}>
      {groupedTasks.approver.length > 0 && (
        <Box>
          <Box onClick={() => toggleGroup('approver')} style={{ cursor: 'pointer' }}>
            <Typography variant="h6" className={styles.taskTitle}>
              Задачи на утверждение {expandedGroups.approver ? '▼' : '▲'}
            </Typography>
          </Box>
          {expandedGroups.approver && (
            <ApproverTaskList
              tasks={groupedTasks.approver}
              approvalStatus={approvalStatus}
              userId={userId}
              onApproval={approval}
            />
          )}
        </Box>
      )}
          {showCreatedCompletedTabs && (
            <Box className={styles.createdCompletedTabs}>
              <div className={styles.tabsBar} role="tablist" aria-label="Созданные и завершённые задачи">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCreatedCompletedTab === 'created'}
                  className={`${styles.tabButton} ${
                    activeCreatedCompletedTab === 'created' ? styles.tabButtonActive : ''
                  }`}
                  onClick={() => setCreatedCompletedTab('created')}
                >
                  Созданные задачи
                  {hasCreatedBySection ? ` (${groupedTasks.created_by.length})` : ''}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCreatedCompletedTab === 'completed'}
                  className={`${styles.tabButton} ${
                    activeCreatedCompletedTab === 'completed' ? styles.tabButtonActive : ''
                  }`}
                  onClick={() => setCreatedCompletedTab('completed')}
                >
                  Завершённые задачи
                  {hasCompletedSection ? ` (${groupedTasks.completed.length})` : ''}
                </button>
              </div>

              {activeCreatedCompletedTab === 'created' && (
                <Box className={styles.tabPanel} role="tabpanel">
                  <div className={styles.createdTabSearch}>
                    <SearchBar
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                      placeholder="Поиск созданных задач..."
                      transform="0"
                    />
                  </div>
                  {hasCreatedBySection ? (
                    <CreatedByTaskList
                      tasks={filterTasks(groupedTasks.created_by)}
                      approvalStatus={approvalStatus}
                      userId={userId}
                      handleTaskAccept={handleTaskAccept}
                      refreshTasks={refreshTasks}
                      onOpenProject={onOpenProject}
                    />
                  ) : (
                    <Typography className={styles.tabEmpty}>Нет созданных задач</Typography>
                  )}
                </Box>
              )}

              {activeCreatedCompletedTab === 'completed' && (
                <Box className={styles.tabPanel} role="tabpanel">
                  <div className={styles.completedExtra}>
                    <div className={styles.completedDateRange}>
                      <span className={styles.completedFilterLabel}>Создано:</span>
                      <label className={styles.completedDateField}>
                        <span className={styles.completedDateFieldLabel}>с</span>
                        <input
                          type="date"
                          value={completedDateFrom}
                          onChange={(e) => setCompletedDateFrom(e.target.value)}
                          className={styles.completedDateInput}
                        />
                      </label>
                      <label className={styles.completedDateField}>
                        <span className={styles.completedDateFieldLabel}>по</span>
                        <input
                          type="date"
                          value={completedDateTo}
                          onChange={(e) => setCompletedDateTo(e.target.value)}
                          className={styles.completedDateInput}
                        />
                      </label>
                    </div>
                    <div className={styles.completedSearchWrap}>
                      <label
                        className={styles.completedSearchLabel}
                        htmlFor="task-list-manager-completed-search"
                      >
                        Поиск:
                      </label>
                      <input
                        id="task-list-manager-completed-search"
                        type="search"
                        value={completedSearch}
                        onChange={(e) => setCompletedSearch(e.target.value)}
                        placeholder="Название или описание…"
                        className={styles.completedSearchInput}
                        autoComplete="off"
                      />
                    </div>
                    {hasCompletedExtraFilters && (
                      <button
                        type="button"
                        className={styles.completedFilterReset}
                        onClick={clearCompletedExtraFilters}
                      >
                        Сбросить период и поиск
                      </button>
                    )}
                  </div>
                  <label className={styles.completedMyTasksCheck}>
                    <input
                      type="checkbox"
                      checked={showMyCompletedTasks}
                      onChange={handleShowMyCompletedChange}
                    />
                    <span>Показывать только мои выполненные задачи</span>
                  </label>
                  {hasCompletedSection ? (
                    <CreatedByTaskList
                      tasks={completedTasksForCards}
                      approvalStatus={approvalStatus}
                      userId={userId}
                      handleTaskAccept={handleTaskAccept}
                      refreshTasks={refreshTasks}
                      onOpenProject={onOpenProject}
                      completedArchiveMode
                    />
                  ) : (
                    <Typography className={styles.tabEmpty}>Нет завершённых задач</Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
      {groupedTasks.visible.length > 0 && (
        <Box>
          <Box onClick={() => toggleGroup('visible')} style={{ cursor: 'pointer' }}>
            <Typography variant="h6" className={styles.taskTitle}>
              Видимые задачи {expandedGroups.visible ? '▼' : '▲'}
            </Typography>
          </Box>
          {expandedGroups.visible && (
            <VisibleTaskList
              tasks={groupedTasks.visible}
              approvalStatus={approvalStatus}
            />
          )}
        </Box>
      )}
      </Box>
      <MiniProjectStrip onOpenProject={onOpenProject} refreshTrigger={stripRefreshKey} />
    </Box>
  )
}

export default TaskListManager
