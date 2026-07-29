import { useEffect, useState, useMemo, useCallback } from 'react'
import { Box, Typography } from '@mui/material'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../../config'
import useUserStore from '../../../../../store/userStore'
import useTasksManageStore from '../../../../../store/useTasksManageStore'
import VisibleTaskList from './groupTasks/VisibleTaskList'
import CreatedByTaskList from './groupTasks/CreatedByTaskList/CreatedByTaskList'
import SearchBar from '../../../../../components/searchBar/SearchBar'
import MiniProjectStrip from './MiniProjectStrip'
import { getLocalMonthDateRangeYyyyMmDd } from '../taskUtils'
import styles from './taskListManager.module.scss'
import './taskListManagerDark.scss'

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

const TASK_LIST_TABS = [
  { id: 'created', label: 'Созданные' },
  { id: 'completed', label: 'Завершённые' },
  { id: 'approver', label: 'На утверждение' },
  { id: 'visible', label: 'Видимые' },
]

const COMPLETED_SUB_TABS = [
  { id: 'mine', label: 'Мои выполненные' },
  { id: 'delegated', label: 'Порученные' },
  { id: 'participation', label: 'Участие' },
]

function isUserAssignee(task, userId) {
  if (!userId || !Array.isArray(task.assigned_user_ids)) return false
  const uid = String(userId)
  return task.assigned_user_ids.some((id) => String(id) === uid)
}

function isUserAuthor(task, userId) {
  if (!userId) return false
  return String(task.created_by) === String(userId)
}

function getTaskKey(task) {
  return task.task_id ?? task.id
}

/** Одна задача могла попасть и из completedTasks API, и из tasksManager */
function dedupeTasksById(tasks) {
  const seen = new Set()
  return tasks.filter((task) => {
    const key = getTaskKey(task)
    if (key == null) return true
    const keyStr = String(key)
    if (seen.has(keyStr)) return false
    seen.add(keyStr)
    return true
  })
}

function isUserApproverOrViewer(task, userId) {
  if (!userId) return false
  const uid = String(userId)
  const isApprover = (task.approver_user_ids || []).some(
    (a) => String(a.approver_id) === uid
  )
  const isViewer = (task.visibility_user_ids || []).some((id) => String(id) === uid)
  return isApprover || isViewer
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

const TaskListManager = ({ onClose, onOpenProject, stripRefreshKey, initialActiveTab }) => {
  const { user, users } = useUserStore()
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
  const [activeTaskListTab, setActiveTaskListTab] = useState(initialActiveTab || 'created')
  const [completedSubTab, setCompletedSubTab] = useState('mine')
  const [selectedDelegateAssigneeId, setSelectedDelegateAssigneeId] = useState(null)
  const userId = user?.id

  useEffect(() => {
    // Внешние навигации (например, по клику в уведомлении) должны указывать нужную вкладку.
    if (initialActiveTab) setActiveTaskListTab(initialActiveTab)
  }, [initialActiveTab])

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
    const savedSubTab = localStorage.getItem('completedSubTab')
    if (savedSubTab === 'mine' || savedSubTab === 'delegated') {
      setCompletedSubTab(savedSubTab)
      return
    }
    const legacy = localStorage.getItem('showMyTasks')
    if (legacy !== null) {
      try {
        setCompletedSubTab(JSON.parse(legacy) ? 'mine' : 'delegated')
      } catch {
        /* ignore */
      }
    }
  }, [])

  const handleCompletedSubTabChange = useCallback((subTabId) => {
    setCompletedSubTab(subTabId)
    localStorage.setItem('completedSubTab', subTabId)
    if (subTabId === 'mine') {
      setSelectedDelegateAssigneeId(null)
    }
  }, [])

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
    return dedupeTasksById(completed)
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

  const completedMineTasks = useMemo(() => {
    if (!userId) return []
    return completedTasksFiltered.filter((task) => isUserAssignee(task, userId))
  }, [completedTasksFiltered, userId])

  /** Порученные: автор, но не исполнитель (если оба — только в «Мои выполненные») */
  const completedDelegatedBase = useMemo(() => {
    if (!userId) return []
    return completedTasksFiltered.filter(
      (task) => isUserAuthor(task, userId) && !isUserAssignee(task, userId)
    )
  }, [completedTasksFiltered, userId])

  /** Завершённые, где вы утверждающий или зритель (не автор и не исполнитель) */
  const completedParticipationTasks = useMemo(() => {
    if (!userId) return []
    return completedTasksFiltered.filter((task) => {
      if (isUserAssignee(task, userId) || isUserAuthor(task, userId)) return false
      return isUserApproverOrViewer(task, userId)
    })
  }, [completedTasksFiltered, userId])

  const completedTabCount = useMemo(
    () => completedTasksFiltered.length,
    [completedTasksFiltered]
  )

  const visibleCompletedSubTabs = useMemo(
    () =>
      COMPLETED_SUB_TABS.filter((sub) => {
        if (sub.id === 'participation') return completedParticipationTasks.length > 0
        return true
      }),
    [completedParticipationTasks.length]
  )

  const delegateAssigneeOptions = useMemo(() => {
    const idSet = new Set()
    completedDelegatedBase.forEach((task) => {
      (task.assigned_user_ids || []).forEach((assigneeId) => {
        if (assigneeId != null && String(assigneeId) !== String(userId)) {
          idSet.add(String(assigneeId))
        }
      })
    })

    return [...idSet]
      .map((idStr) => {
        const numericId = Number(idStr)
        const u = users.find((item) => String(item.id) === idStr)
        return {
          id: Number.isNaN(numericId) ? idStr : numericId,
          lastName: u?.last_name?.trim() || `Исполнитель #${idStr}`,
        }
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'ru'))
  }, [completedDelegatedBase, users, userId])

  useEffect(() => {
    if (
      selectedDelegateAssigneeId != null &&
      !delegateAssigneeOptions.some((o) => String(o.id) === String(selectedDelegateAssigneeId))
    ) {
      setSelectedDelegateAssigneeId(null)
    }
  }, [delegateAssigneeOptions, selectedDelegateAssigneeId])

  const completedDelegatedTasks = useMemo(() => {
    if (selectedDelegateAssigneeId == null) return completedDelegatedBase
    const selected = String(selectedDelegateAssigneeId)
    return completedDelegatedBase.filter((task) =>
      (task.assigned_user_ids || []).some((id) => String(id) === selected)
    )
  }, [completedDelegatedBase, selectedDelegateAssigneeId])

  const completedTasksForCards = useMemo(() => {
    if (completedSubTab === 'mine') return completedMineTasks
    if (completedSubTab === 'delegated') return completedDelegatedTasks
    if (completedSubTab === 'participation') return completedParticipationTasks
    return completedMineTasks
  }, [
    completedSubTab,
    completedMineTasks,
    completedDelegatedTasks,
    completedParticipationTasks,
  ])

  useEffect(() => {
    if (
      completedSubTab === 'participation' &&
      completedParticipationTasks.length === 0
    ) {
      setCompletedSubTab('mine')
    }
  }, [completedSubTab, completedParticipationTasks.length])

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

  const approval = async (taskId, userId, approv) => {
    const newApprovalStatus = !approv

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
        comment: comment || null,
      }

      await axios.patch(`${API_BASE_URL}5000/api/task/accept/${taskId}/${userId}/${isDone}`, data)
    } catch (error) {
      console.error('Ошибка при завершении задачи:', error)
    }
  }

  const groupedTasks = useMemo(() => {
    const groups = {
      approver: [],
      visible: [],
      created_by: [],
      completed: completedBaseList,
    }

    if (Array.isArray(tasksManager)) {
      tasksManager.forEach((task) => {
        if (task.approver_user_ids?.some((approver) => approver.approver_id === user?.id)) {
          groups.approver.push(task)
        } else if (task.created_by === user?.id) {
          groups.created_by.push(task)
        } else if (task.visibility_user_ids?.includes(user?.id)) {
          groups.visible.push(task)
        }
      })
    }

    return groups
  }, [tasksManager, completedBaseList, user?.id])

  const hasApproverSection = groupedTasks.approver.length > 0
  const hasCreatedBySection = groupedTasks.created_by.length > 0
  const hasCompletedSection = completedTabCount > 0
  const hasVisibleSection = groupedTasks.visible.length > 0

  const tabCounts = useMemo(
    () => ({
      approver: groupedTasks.approver.length,
      created: groupedTasks.created_by.length,
      completed: completedTabCount,
      visible: groupedTasks.visible.length,
    }),
    [groupedTasks, completedTabCount]
  )

  const resolvedActiveTab = useMemo(() => {
    const countForTab = (id) => tabCounts[id] ?? 0
    if (countForTab(activeTaskListTab) > 0) return activeTaskListTab
    const firstWithTasks = TASK_LIST_TABS.find((t) => countForTab(t.id) > 0)
    return firstWithTasks?.id ?? activeTaskListTab
  }, [activeTaskListTab, tabCounts])

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
    <Box className={`${styles.container} task-list-manager`}>
      <Box className={styles.close} onClick={onClose}>
        &times;
      </Box>
      <Box className={styles.scrollContent}>
        <Box className={styles.taskListTabs}>
          <div className={styles.tabsBar} role="tablist" aria-label="Разделы листа задач">
            {TASK_LIST_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={resolvedActiveTab === tab.id}
                className={`${styles.tabButton} ${
                  resolvedActiveTab === tab.id ? styles.tabButtonActive : ''
                }`}
                onClick={() => setActiveTaskListTab(tab.id)}
              >
                {tab.label} ({tabCounts[tab.id]})
              </button>
            ))}
          </div>

          {resolvedActiveTab === 'approver' && (
            <Box className={styles.tabPanel} role="tabpanel">
              {hasApproverSection ? (
                <CreatedByTaskList
                  tasks={groupedTasks.approver}
                  userId={userId}
                  handleTaskAccept={handleTaskAccept}
                  refreshTasks={refreshTasks}
                  onOpenProject={onOpenProject}
                  approverMode
                  approvalStatus={approvalStatus}
                  onApproval={approval}
                />
              ) : (
                <Typography className={styles.tabEmpty}>Нет задач на утверждение</Typography>
              )}
            </Box>
          )}

          {resolvedActiveTab === 'created' && (
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

          {resolvedActiveTab === 'completed' && (
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
              <div
                className={styles.completedSubTabs}
                role="tablist"
                aria-label="Завершённые: мои и порученные"
              >
                {visibleCompletedSubTabs.map((sub) => {
                  const count =
                    sub.id === 'mine'
                      ? completedMineTasks.length
                      : sub.id === 'delegated'
                        ? completedDelegatedBase.length
                        : completedParticipationTasks.length
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      role="tab"
                      aria-selected={completedSubTab === sub.id}
                      className={`${styles.completedSubTabButton} ${
                        completedSubTab === sub.id ? styles.completedSubTabButtonActive : ''
                      }`}
                      onClick={() => handleCompletedSubTabChange(sub.id)}
                    >
                      {sub.label} ({count})
                    </button>
                  )
                })}
              </div>

              {completedSubTab === 'delegated' && delegateAssigneeOptions.length > 0 && (
                <div className={styles.completedAssigneeFilters}>
                  <span className={styles.completedAssigneeFiltersLabel}>Исполнитель:</span>
                  <div className={styles.completedAssigneeFiltersButtons}>
                    <button
                      type="button"
                      className={`${styles.completedAssigneeChip} ${
                        selectedDelegateAssigneeId == null
                          ? styles.completedAssigneeChipActive
                          : ''
                      }`}
                      onClick={() => setSelectedDelegateAssigneeId(null)}
                    >
                      Все
                    </button>
                    {delegateAssigneeOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`${styles.completedAssigneeChip} ${
                          String(selectedDelegateAssigneeId) === String(opt.id)
                            ? styles.completedAssigneeChipActive
                            : ''
                        }`}
                        onClick={() => setSelectedDelegateAssigneeId(opt.id)}
                      >
                        {opt.lastName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hasCompletedSection ? (
                completedTasksForCards.length > 0 ? (
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
                  <Typography className={styles.tabEmpty}>
                    {completedSubTab === 'mine'
                      ? 'Нет ваших выполненных задач за выбранный период'
                      : completedSubTab === 'participation'
                        ? 'Нет завершённых задач, где вы утверждающий или зритель'
                        : selectedDelegateAssigneeId != null
                          ? 'Нет порученных задач для выбранного исполнителя'
                          : 'Нет порученных задач за выбранный период'}
                  </Typography>
                )
              ) : (
                <Typography className={styles.tabEmpty}>Нет завершённых задач</Typography>
              )}
            </Box>
          )}

          {resolvedActiveTab === 'visible' && (
            <Box className={styles.tabPanel} role="tabpanel">
              {hasVisibleSection ? (
                <VisibleTaskList tasks={groupedTasks.visible} approvalStatus={approvalStatus} />
              ) : (
                <Typography className={styles.tabEmpty}>Нет видимых задач</Typography>
              )}
            </Box>
          )}
        </Box>
      </Box>
      <MiniProjectStrip onOpenProject={onOpenProject} refreshTrigger={stripRefreshKey} />
    </Box>
  )
}

export default TaskListManager
