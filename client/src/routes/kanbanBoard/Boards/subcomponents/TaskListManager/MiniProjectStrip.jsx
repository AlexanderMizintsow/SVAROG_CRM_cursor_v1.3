import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { API_BASE_URL } from '../../../../../../config'
import io from 'socket.io-client'
import useUserStore from '../../../../../store/userStore'
import useTaskStateTracker from '../../../../../store/useTaskStateTracker'
import { FaComments } from 'react-icons/fa'
import { MdOutlinePendingActions, MdWarning } from 'react-icons/md'
import { handleGlobalTaskChangedPayload } from '../../../globalTask/utils/projectNotificationsHandler'
import { PiCalendarDotsDuotone } from 'react-icons/pi'
import { FcMindMap } from 'react-icons/fc'
import { getRemainingDays } from '../../../globalTask/utils/globalTaskUtils'
import {
  filterVisibleProjects,
  sortMiniProjects,
  getProjectCreatorId,
  SPLIT_STORAGE_KEY,
  readStoredSplitPercent,
  MIN_SPLIT_PERCENT,
  MAX_SPLIT_PERCENT,
} from './miniProjectStripUtils'
import styles from './MiniProjectStrip.module.scss'

const MiniProjectStrip = ({ onOpenProject, refreshTrigger }) => {
  const { user } = useUserStore()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [splitPercent, setSplitPercent] = useState(readStoredSplitPercent)
  const userId = user?.id
  const socketRef = useRef(null)
  const leftScrollRef = useRef(null)
  const rightScrollRef = useRef(null)
  const splitContainerRef = useRef(null)
  const isResizingRef = useRef(false)
  const splitPercentRef = useRef(splitPercent)
  const projectChatUnread = useTaskStateTracker((s) => s.projectChatUnread)
  const projectBlinkGreen = useTaskStateTracker((s) => s.projectBlinkGreen)
  const projectBlinkYellow = useTaskStateTracker((s) => s.projectBlinkYellow)
  const clearProjectCardViewed = useTaskStateTracker((s) => s.clearProjectCardViewed)

  useEffect(() => {
    splitPercentRef.current = splitPercent
  }, [splitPercent])

  const fetchProjects = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}5000/api/global-tasks-all?userId=${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('Ошибка загрузки проектов')
      const data = await response.json()
      setProjects(Array.isArray(data) ? data : [])

      const TERMINAL = ['Завершено', 'Провал', 'Удален']
      const now = Date.now()
      const store = useTaskStateTracker.getState()
      ;(Array.isArray(data) ? data : []).forEach((task) => {
        if (!task?.id || TERMINAL.includes(task?.status)) return
        const deadline = task.deadline ? new Date(task.deadline).getTime() : null
        if (!deadline || deadline >= now) return
        if (store.projectDeadlineNotified[task.id]) return
        store.addProjectNotification(task.id, task.title || 'Проект', 'deadline_expired')
        store.setProjectDeadlineNotified(task.id)
      })
    } catch (err) {
      console.error('MiniProjectStrip fetch:', err)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects, refreshTrigger])

  useEffect(() => {
    if (!userId) return

    const socket = io(`${API_BASE_URL}5000`, {
      query: { userId },
      transports: ['websocket'],
    })
    socketRef.current = socket

    const handleGlobalTaskChanged = (payload) => {
      if (typeof payload === 'object' && payload?.globalTaskId != null) {
        handleGlobalTaskChangedPayload(payload, userId)
      }
      fetchProjects()
    }

    socket.on('globalTaskChanged', handleGlobalTaskChanged)

    return () => {
      socket.off('globalTaskChanged', handleGlobalTaskChanged)
      socket.disconnect()
      socketRef.current = null
    }
  }, [userId, fetchProjects])

  const { projectsByOthers, myProjects } = useMemo(() => {
    const visible = filterVisibleProjects(projects, userId)
    const sorted = sortMiniProjects(visible, userId, projectBlinkGreen, projectBlinkYellow)
    const others = []
    const mine = []
    sorted.forEach((task) => {
      if (getProjectCreatorId(task) === userId) {
        mine.push(task)
      } else {
        others.push(task)
      }
    })
    return { projectsByOthers: others, myProjects: mine }
  }, [projects, userId, projectBlinkGreen, projectBlinkYellow])

  const getPriorityLabel = (p) => {
    switch (p) {
      case 'high':
        return 'Высокий'
      case 'medium':
        return 'Средний'
      case 'low':
        return 'Низкий'
      default:
        return p || '—'
    }
  }

  const formatDeadline = (deadline) => {
    if (!deadline) return '—'
    try {
      const d = new Date(deadline)
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return '—'
    }
  }

  const getUserTasksTooltip = (task) => {
    const count = Number(task.user_tasks_count) || 0
    if (count === 0) return null
    let titles = task.user_task_titles
    if (typeof titles === 'string') {
      try {
        titles = JSON.parse(titles)
      } catch {
        titles = []
      }
    }
    if (!Array.isArray(titles)) titles = []
    const list = titles.length > 0 ? titles.join(', ') : ''
    return list ? `Ваши задачи в проекте (${count}): ${list}` : `Ваши задачи в проекте: ${count}`
  }

  const attachHorizontalWheel = useCallback((el) => {
    if (!el) return undefined
    const WHEEL_SPEED = 2.2
    const handleWheel = (e) => {
      const canScrollLeft = el.scrollLeft > 0
      const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
      if (!canScrollLeft && !canScrollRight) return
      const delta = e.deltaY || e.deltaX
      if (delta === 0) return
      const step = Math.round(delta * WHEEL_SPEED)
      el.scrollBy({ left: step, behavior: 'smooth' })
      e.preventDefault()
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    const cleanup = attachHorizontalWheel(leftScrollRef.current)
    return cleanup
  }, [attachHorizontalWheel, loading, projectsByOthers.length, splitPercent])

  useEffect(() => {
    const cleanup = attachHorizontalWheel(rightScrollRef.current)
    return cleanup
  }, [attachHorizontalWheel, loading, myProjects.length, splitPercent])

  const startResize = useCallback((clientX) => {
    const container = splitContainerRef.current
    if (!container) return
    isResizingRef.current = true
    document.body.classList.add('mini-project-strip-resizing')

    const updateFromClientX = (x) => {
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0) return
      const pct = ((x - rect.left) / rect.width) * 100
      const clamped = Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, pct))
      setSplitPercent(clamped)
    }

    updateFromClientX(clientX)

    const onMouseMove = (e) => updateFromClientX(e.clientX)
    const onTouchMove = (e) => {
      if (e.touches[0]) updateFromClientX(e.touches[0].clientX)
    }
    const endResize = () => {
      isResizingRef.current = false
      document.body.classList.remove('mini-project-strip-resizing')
      try {
        localStorage.setItem(SPLIT_STORAGE_KEY, String(Math.round(splitPercentRef.current)))
      } catch {
        /* ignore */
      }
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', endResize)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', endResize)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', endResize)
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', endResize)
  }, [])

  const handleResizerMouseDown = (e) => {
    e.preventDefault()
    startResize(e.clientX)
  }

  const handleResizerTouchStart = (e) => {
    if (e.touches[0]) startResize(e.touches[0].clientX)
  }

  const openProject = (task) => {
    if (typeof onOpenProject !== 'function') return
    clearProjectCardViewed(task.id)
    onOpenProject(task)
  }

  const renderProjectCard = (task) => {
    const myResponsible = task.responsibles?.find((r) => r.id === userId)
    const requiresApproval = myResponsible?.requires_approval === true
    const approvalStatus = myResponsible?.approval_status
    const approvalDone = approvalStatus === 'approved'
    const approvalRejected = approvalStatus === 'rejected'
    const isOverdue = task.deadline && new Date(task.deadline) < new Date()
    const completion = task.completion_percentage ?? 0
    const showApprovalBadge = requiresApproval

    return (
      <div
        key={task.id}
        className={`${styles.card} ${projectBlinkGreen[task.id] ? styles.cardBlinkGreen : ''} ${projectBlinkYellow[task.id] ? styles.cardBlinkYellow : ''}`}
        onClick={() => openProject(task)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openProject(task)
          }
        }}
      >
        {projectChatUnread[task.id] && (
          <div className={styles.chatIconUnread} title="Новое сообщение в чате проекта">
            <FaComments />
          </div>
        )}
        <div className={styles.cardHeader}>
          <h4 className={styles.cardTitle} title={task.title}>
            {task.title || 'Без названия'}
          </h4>
          <span className={`${styles.priority} ${styles[`priority--${task.priority || 'medium'}`]}`}>
            {getPriorityLabel(task.priority)}
          </span>
        </div>
        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div
              className={`${styles.progressBar} ${completion >= 100 ? styles.progressBarComplete : ''}`}
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className={styles.progressPercent}>{completion}%</span>
        </div>
        <div className={styles.deadline}>
          <PiCalendarDotsDuotone className={styles.deadlineIcon} />
          {formatDeadline(task.deadline)}
          {task.deadline && getRemainingDays(task.deadline) && (
            <span className={isOverdue ? styles.overdue : styles.remaining}>
              {isOverdue ? ' просрочено' : ` · ${getRemainingDays(task.deadline)}`}
            </span>
          )}
        </div>
        {(Number(task.user_tasks_count) || 0) > 0 && (
          <div className={styles.userTasksWrap} title={getUserTasksTooltip(task)}>
            <FcMindMap className={styles.userTasksIcon} />
            <span className={styles.userTasksCount}>{task.user_tasks_count}</span>
          </div>
        )}
        <div className={styles.actions}>
          {showApprovalBadge && (
            <span
              className={`${styles.actionBadge} ${
                approvalDone ? styles['actionBadge--done'] : approvalRejected ? styles['actionBadge--rejected'] : ''
              }`}
              title={approvalDone ? 'Согласовано' : approvalRejected ? 'Отклонено' : 'Ожидает согласование'}
            >
              <MdOutlinePendingActions />
              {approvalDone ? 'Согласовано' : approvalRejected ? 'Отклонено' : 'Согласование'}
            </span>
          )}
          {isOverdue && (
            <span className={styles.actionBadge} title="Просрочено">
              <MdWarning /> Просрочка
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderPane = (title, tasks, scrollRef, paneClass) => (
    <div className={`${styles.pane} ${paneClass || ''}`}>
      <div className={styles.paneHeader}>
        <span className={styles.paneTitle}>{title}</span>
        <span className={styles.paneCount}>{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <div className={styles.paneEmpty}>Нет проектов</div>
      ) : (
        <div ref={scrollRef} className={styles.scroll}>
          {tasks.map(renderProjectCard)}
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className={styles.strip}>
        <div className={styles.stripTitle}>Проекты</div>
        <div className={styles.loading}>Загрузка проектов...</div>
      </div>
    )
  }

  const totalVisible = projectsByOthers.length + myProjects.length

  if (totalVisible === 0) {
    return (
      <div className={styles.strip}>
        <div className={styles.stripTitle}>Проекты</div>
        <div className={styles.empty}>У вас пока нет проектов в этом списке</div>
      </div>
    )
  }

  return (
    <div className={styles.strip}>
      <div className={styles.stripTitleRow}>
        <div className={styles.stripTitle}>Проекты</div> 
      </div>
      <div ref={splitContainerRef} className={styles.splitContainer}>
        <div className={styles.paneLeft} style={{ width: `${splitPercent}%` }}>
          {renderPane('Создали другие', projectsByOthers, leftScrollRef, styles.paneOthers)}
        </div>
        <div
          className={styles.resizer}
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(splitPercent)}
          aria-valuemin={MIN_SPLIT_PERCENT}
          aria-valuemax={MAX_SPLIT_PERCENT}
          title="Перетащите, чтобы изменить ширину колонок"
          onMouseDown={handleResizerMouseDown}
          onTouchStart={handleResizerTouchStart}
        >
          <span className={styles.resizerGrip} />
        </div>
        <div className={styles.paneRight}>
          {renderPane('Мои проекты', myProjects, rightScrollRef, styles.paneMine)}
        </div>
      </div>
    </div>
  )
}

export default MiniProjectStrip
