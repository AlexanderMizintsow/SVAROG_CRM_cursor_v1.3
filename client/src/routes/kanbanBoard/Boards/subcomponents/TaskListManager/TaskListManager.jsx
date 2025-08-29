import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../../config'
import useUserStore from '../../../../../store/userStore'
import useTasksManageStore from '../../../../../store/useTasksManageStore'
import ApproverTaskList from './groupTasks/ApproverTaskList'
import VisibleTaskList from './groupTasks/VisibleTaskList'
import CreatedByTaskList from './groupTasks/CreatedByTaskList/CreatedByTaskList'
import CompletedTaskList from './groupTasks/CompletedTaskList'
import SearchBar from '../../../../../components/searchBar/SearchBar'
import styles from './taskListManager.module.scss'

const TaskListManager = ({ onClose }) => {
  const { user } = useUserStore()
  const [searchTerm, setSearchTerm] = useState('')
  const { fetchTasksManager, tasksManager, fetchCompletedTasks, completedTasks, isLoading } =
    useTasksManageStore()
  const [approvalStatus, setApprovalStatus] = useState({})
  const [expandedGroups, setExpandedGroups] = useState({
    approver: true,
    visible: true,
    created_by: true,
    completed: true,
  })
  const userId = user?.id
  // Загрузка задач при изменении userId
  useEffect(() => {
    if (userId) {
      fetchTasksManager(userId)
      fetchCompletedTasks(userId)
    }
  }, [userId, fetchTasksManager, fetchCompletedTasks])

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

  const toggleGroup = (group) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }))
  }

  const refreshTasks = async () => {
    if (userId) {
      await fetchTasksManager(userId)
      await fetchCompletedTasks(userId)
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
      <SearchBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        placeholder="Поиск задач..."
      />
      {groupedTasks.approver.length > 0 && (
        <Box>
          <Box onClick={() => toggleGroup('approver')} style={{ cursor: 'pointer' }}>
            <Typography variant="h6" className={styles.taskTitle}>
              Задачи на утверждение {expandedGroups.approver ? '▼' : '▲'}
            </Typography>
          </Box>
          {expandedGroups.approver && (
            <ApproverTaskList
              tasks={filterTasks(groupedTasks.approver)}
              approvalStatus={approvalStatus}
              userId={userId}
              onApproval={approval}
            />
          )}
        </Box>
      )}
      {groupedTasks.created_by.length > 0 && (
        <Box>
          <Box onClick={() => toggleGroup('created_by')} style={{ cursor: 'pointer' }}>
            <Typography variant="h6" className={styles.taskTitle}>
              Созданные задачи {expandedGroups.created_by ? '▼' : '▲'}
            </Typography>
          </Box>
          {expandedGroups.created_by && (
            <CreatedByTaskList
              tasks={filterTasks(groupedTasks.created_by)}
              approvalStatus={approvalStatus}
              userId={userId}
              handleTaskAccept={handleTaskAccept}
              refreshTasks={refreshTasks}
            />
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
              tasks={filterTasks(groupedTasks.visible)}
              approvalStatus={approvalStatus}
            />
          )}
        </Box>
      )}
      {groupedTasks.completed.length > 0 && (
        <Box>
          <Box onClick={() => toggleGroup('completed')} style={{ cursor: 'pointer' }}>
            <Typography variant="h6" className={styles.taskTitle}>
              Завершенные задачи {expandedGroups.completed ? '▼' : '▲'}
            </Typography>
          </Box>
          {expandedGroups.completed && (
            <CompletedTaskList
              tasks={filterTasks(groupedTasks.completed)}
              approvalStatus={approvalStatus}
            />
          )}
        </Box>
      )}
    </Box>
  )
}

export default TaskListManager
