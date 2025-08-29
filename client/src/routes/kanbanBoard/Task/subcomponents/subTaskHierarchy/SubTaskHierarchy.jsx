import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../../config'
import './subTaskHierarchy.scss'
import { getUserNames } from '../../utils/taskUtils'
import useUserStore from '../../../../../store/userStore'
import { getStatusLabelTask } from '../../../Boards/subcomponents/taskUtils'

const SubTaskHierarchy = ({ taskId, onClose }) => {
  const { user, users } = useUserStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tasks, setTasks] = useState([])

  const statusColors = {
    backlog: '#9e9e9e',
    todo: '#1976d2',
    doing: '#2196f3',
    wait: '#ff8f00',
    pause: '#9c27b0',
    done: '#388e3c',
    final: '#2e7d32',
    completed: '#4CAF50',
    default: '#555',
  }

  const levelColors = [
    '#4a90e2', // Уровень 0
    '#6a5acd', // Уровень 1
    '#ff7f50', // Уровень 2
    '#20b2aa', // Уровень 3
    '#da70d6', // Уровень 4
    '#ff6347', // Уровень 5
  ]

  // Функция для определения статуса задачи
  const getTaskStatus = (task) => {
    // Если задача полностью завершена
    if (task.is_completed) return 'completed'
    // Если задача в статусе "done" (ожидает одобрения)
    if (task.status?.toLowerCase() === 'done') return 'done'
    // Для всех остальных статусов
    return task.status?.toLowerCase()
  }

  // Функция для получения текста статуса
  const getStatusText = (task) => {
    if (task.is_completed) return 'Завершена'
    if (task.status?.toLowerCase() === 'done') return 'Ожидает одобрения'
    return getStatusLabelTask(task.status)
  }

  // Функция для построения иерархии из плоского списка
  const buildHierarchy = (items) => {
    const rootItems = []
    const itemMap = {}

    items.forEach((item) => {
      itemMap[item.id] = { ...item, children: [] }
    })

    items.forEach((item) => {
      if (item.parent_id && itemMap[item.parent_id]) {
        itemMap[item.parent_id].children.push(itemMap[item.id])
      } else {
        rootItems.push(itemMap[item.id])
      }
    })

    return rootItems
  }

  // Функция для вычисления уровней в иерархии
  const calculateLevels = (items, level = 0) => {
    return items.map((item) => ({
      ...item,
      level,
      children: calculateLevels(item.children, level + 1),
    }))
  }

  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/tasks/hierarchy/${taskId}`)
        const hierarchy = buildHierarchy(response.data)
        const tasksWithLevels = calculateLevels(hierarchy)
        setTasks(tasksWithLevels)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchHierarchy()
  }, [taskId])

  const renderTask = (task) => {
    const taskStatus = getTaskStatus(task)
    const statusText = getStatusText(task)
    const isCompleted = task.is_completed
    const isAwaitingApproval = task.status?.toLowerCase() === 'done' && !task.is_completed
    const hasChildren = task.children && task.children.length > 0

    return (
      <div
        key={task.id}
        className={`task-node level-${task.level} 
          ${isCompleted ? 'completed' : ''} 
          ${isAwaitingApproval ? 'awaiting-approval' : ''}
          ${hasChildren ? 'has-children' : ''}`}
        style={{
          '--border-color': levelColors[task.level] || '#4a90e2',
          borderLeftColor: levelColors[task.level] || '#4a90e2',
          marginLeft: `${task.level * 20}px`,
        }}
      >
        <div className="task-header">
          <span className="task-title">
            <span className="level-badge" style={{ backgroundColor: levelColors[task.level] }}>
              Ур. {task.level}
            </span>
            {task.title.replace(/^[├│└─\s]+/, '')}
          </span>
          <span
            className="task-status"
            style={{
              backgroundColor: statusColors[taskStatus] || statusColors.default,
              ...(isCompleted && {
                fontWeight: 'bold',
                boxShadow: '0 0 0 2px rgba(76, 175, 80, 0.3)',
              }),
              ...(isAwaitingApproval && {
                fontWeight: 'bold',
                boxShadow: '0 0 0 2px rgba(56, 142, 60, 0.3)',
              }),
            }}
          >
            {statusText}
          </span>
        </div>
        <div className="task-meta">
          {task.author_name && <div>Автор: {getUserNames([task.created_by], users)}</div>}
          {task.assignees?.length > 0 && (
            <div>Исполнители: {getUserNames(task.assignees, users)}</div>
          )}
          {task.deadline && <div>Срок: {new Date(task.deadline).toLocaleDateString()}</div>}
        </div>

        {hasChildren && (
          <div className="task-children">
            {task.children.map((child) => (
              <div key={child.id} className="child-container">
                {renderTask(child)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="loading-spinner">Загрузка...</div>
  if (error) return <div className="error-message">Ошибка: {error}</div>
  if (!tasks.length) return <div className="empty-message">Нет данных для отображения</div>

  return (
    <div className="task-hierarchy-container">
      <div className="header">
        <h2>Иерархия задач</h2>
        <div className="legend">
          {levelColors.map((color, i) => (
            <span key={i} style={{ backgroundColor: color }}>
              Уровень {i}
            </span>
          ))}
        </div>
        <button onClick={onClose} className="close-button">
          ×
        </button>
      </div>

      <div className="hierarchy-view">{tasks.map((task) => renderTask(task))}</div>
    </div>
  )
}

export default SubTaskHierarchy
