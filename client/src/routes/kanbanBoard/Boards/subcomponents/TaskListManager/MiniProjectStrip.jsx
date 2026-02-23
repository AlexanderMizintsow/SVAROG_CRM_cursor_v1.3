import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE_URL } from '../../../../../../config'
import io from 'socket.io-client'
import useUserStore from '../../../../../store/userStore'
import useTaskStateTracker from '../../../../../store/useTaskStateTracker'
import { FaEye, FaComments } from 'react-icons/fa'
import { MdOutlinePendingActions, MdWarning } from 'react-icons/md'
import { handleGlobalTaskChangedPayload } from '../../../globalTask/utils/projectNotificationsHandler'
import { PiCalendarDotsDuotone } from 'react-icons/pi'
import { FcMindMap } from 'react-icons/fc'
import { getRemainingDays } from '../../../globalTask/utils/globalTaskUtils'
import styles from './MiniProjectStrip.module.scss'

const MiniProjectStrip = ({ onOpenProject, refreshTrigger }) => {
  const { user } = useUserStore()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const userId = user?.id
  const socketRef = useRef(null)
  const projectChatUnread = useTaskStateTracker((s) => s.projectChatUnread)
  const projectBlinkGreen = useTaskStateTracker((s) => s.projectBlinkGreen)
  const projectBlinkYellow = useTaskStateTracker((s) => s.projectBlinkYellow)
  const clearProjectCardViewed = useTaskStateTracker((s) => s.clearProjectCardViewed)

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

  // realtime: обновлять мини-карточки у участников сразу
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

  if (loading) {
    return (
      <div className={styles.strip}>
        <div className={styles.stripTitle}>Проекты</div>
        <div className={styles.loading}>Загрузка проектов...</div>
      </div>
    )
  }

  const visibleProjects = projects.filter((task) => {
    const creatorId = typeof task.created_by === 'object' && task.created_by != null ? task.created_by.id : task.created_by
    const isCreator = creatorId === userId
    const isResponsible = task.responsibles && task.responsibles.some((r) => r.id === userId)
    return isCreator || isResponsible
  })

  return (
    <div className={styles.strip}>
      <div className={styles.stripTitle}>Проекты</div>
      {visibleProjects.length === 0 ? (
        <div className={styles.empty}>У вас пока нет проектов в этом списке</div>
      ) : (
      <div className={styles.scroll}>
        {visibleProjects.map((task) => {
          const myResponsible = task.responsibles?.find((r) => r.id === userId)
          const requiresApproval = myResponsible?.requires_approval === true
          const approvalStatus = myResponsible?.approval_status
          const approvalDone = approvalStatus === 'approved'
          const approvalRejected = approvalStatus === 'rejected'
          const isOverdue = task.deadline && new Date(task.deadline) < new Date()
          const completion = task.completion_percentage ?? 0
          // Бейдж «Задачи» в мини-карточке не показываем: в API нет данных «есть ли у пользователя подзадачи в проекте»
          // Показываем только: Согласование (если требуется) и Просрочка
          const showApprovalBadge = requiresApproval
          const needsApprovalAction = requiresApproval && !approvalDone && !approvalRejected
          const hasActions = needsApprovalAction || isOverdue
          const showEye = !hasActions

          return (
            <div
              key={task.id}
              className={`${styles.card} ${projectBlinkGreen[task.id] ? styles.cardBlinkGreen : ''} ${projectBlinkYellow[task.id] ? styles.cardBlinkYellow : ''}`}
              onClick={() => {
                if (typeof onOpenProject === 'function') {
                  clearProjectCardViewed(task.id)
                  onOpenProject(task)
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (typeof onOpenProject === 'function') {
                    clearProjectCardViewed(task.id)
                    onOpenProject(task)
                  }
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
        })}
      </div>
      )}
    </div>
  )
}

export default MiniProjectStrip
