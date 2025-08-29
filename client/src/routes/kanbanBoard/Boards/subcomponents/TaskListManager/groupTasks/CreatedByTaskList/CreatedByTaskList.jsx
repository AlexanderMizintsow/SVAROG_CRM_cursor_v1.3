import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { Box } from '@mui/material'
import Quill from 'quill'
import { API_BASE_URL } from '../../../../../../../../config'
import useUserStore from '../../../../../../../store/userStore'
import useTasksManageStore from '../../../../../../../store/useTasksManageStore'
import useTaskStateTracker from '../../../../../../../store/useTaskStateTracker'
import { stripHtmlTags, formatDate } from '../../../taskUtils'
import Toastify from 'toastify-js'
import TaskFiltersHeader from './TaskFiltersHeader'
import TaskRenderer from './TaskRenderer'
import TaskModals from './TaskModals'

const CreatedByTaskList = ({ tasks, userId, handleTaskAccept, refreshTasks }) => {
  const { user, users } = useUserStore()
  const [updatedTasks] = useState(tasks)
  const { unreadMessages, addUnreadMessage, resetUnreadMessages } = useTasksManageStore()
  const [openConfirmationDialog, setOpenConfirmationDialog] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState(null)
  const [openChatModals, setOpenChatModals] = useState({})
  const [isEditing, setIsEditing] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [quillInstance, setQuillInstance] = useState(null)
  const [assignedUserIds, setAssignedUserIds] = useState([])

  // Добавляем новые состояния для подзадач
  const [hasSubtasks, setHasSubtasks] = useState({})
  const [allSubtasksCompleted, setAllSubtasksCompleted] = useState({})
  const [isCheckingSubtasks, setIsCheckingSubtasks] = useState({})
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState(false)
  const [currentHierarchyTaskId, setCurrentHierarchyTaskId] = useState(null)
  const [openDeadlineDialog, setOpenDeadlineDialog] = useState(false)
  const [currentTaskForDeadline, setCurrentTaskForDeadline] = useState(null)
  const [deadlineDialogProps, setDeadlineDialogProps] = useState({
    open: false,
    initialDate: '',
  })
  // состояния для выбора нового исполнителя
  const [openReplaceUserModal, setOpenReplaceUserModal] = useState(false)
  const [selectedTaskForReplacement, setSelectedTaskForReplacement] = useState(null)
  const [selectedNewUserId, setSelectedNewUserId] = useState('')

  // Новые состояния для современного интерфейса
  const [filteredTasks, setFilteredTasks] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedPriority, setSelectedPriority] = useState('all')
  const [selectedAssignee, setSelectedAssignee] = useState('all')
  const [viewMode, setViewMode] = useState('cards') // cards, list
  const [sortBy, setSortBy] = useState('deadline')
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  const removeTask = useTaskStateTracker((state) => state.removeTask)

  useEffect(() => {
    setFilteredTasks(tasks)
  }, [tasks])

  // Фильтрация задач
  useEffect(() => {
    let filtered = [...tasks]

    // Поиск
    if (searchTerm) {
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stripHtmlTags(task.description).toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Фильтр по статусу
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'overdue') {
        filtered = filtered.filter(
          (task) => task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done'
        )
      } else if (selectedStatus === 'without_deadline') {
        filtered = filtered.filter((task) => !task.deadline || task.deadline === 'Не указан')
      } else {
        filtered = filtered.filter((task) => task.status === selectedStatus)
      }
    }

    // Фильтр по приоритету
    if (selectedPriority !== 'all') {
      filtered = filtered.filter((task) => task.priority === selectedPriority)
    }

    // Фильтр по исполнителю
    if (selectedAssignee !== 'all') {
      filtered = filtered.filter((task) =>
        task.assigned_user_ids.includes(parseInt(selectedAssignee))
      )
    }

    // Сортировка
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'deadline':
          return new Date(a.deadline) - new Date(b.deadline)
        case 'priority': {
          const priorityOrder = { Высокий: 3, Средний: 2, Низкий: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        }
        case 'created':
          return new Date(b.created_at) - new Date(a.created_at)
        default:
          return 0
      }
    })

    setFilteredTasks(filtered)
  }, [tasks, searchTerm, selectedStatus, selectedPriority, selectedAssignee, sortBy])

  // Статистика задач
  const getTaskStats = () => {
    const stats = {
      total: filteredTasks.length,
      pending: filteredTasks.filter((t) => t.status === 'pending').length,
      doing: filteredTasks.filter((t) => t.status === 'doing').length,
      done: filteredTasks.filter((t) => t.status === 'done').length,
      overdue: filteredTasks.filter((t) => new Date(t.deadline) < new Date() && t.status !== 'done')
        .length,
    }
    return stats
  }

  const stats = getTaskStats()

  const checkForSubtasks = useCallback(async (taskId) => {
    try {
      setIsCheckingSubtasks((prev) => ({ ...prev, [taskId]: true }))
      const response = await axios.get(`${API_BASE_URL}5000/api/tasks/${taskId}/has-subtasks`)
      setHasSubtasks((prev) => ({ ...prev, [taskId]: response.data.has_subtasks }))
      setAllSubtasksCompleted((prev) => ({ ...prev, [taskId]: response.data.all_completed }))
    } catch (error) {
      console.error('Error checking subtasks:', error)
    } finally {
      setIsCheckingSubtasks((prev) => ({ ...prev, [taskId]: false }))
    }
  }, [])

  const handleOpenHierarchy = (taskId) => {
    setCurrentHierarchyTaskId(taskId)
    setIsHierarchyModalOpen(true)
  }

  const handleCloseHierarchy = () => {
    setIsHierarchyModalOpen(false)
    setCurrentHierarchyTaskId(null)
  }

  useEffect(() => {
    updatedTasks.forEach((task) => {
      checkForSubtasks(task.task_id)
    })
  }, [updatedTasks, checkForSubtasks])

  useEffect(() => {}, [openChatModals])
  // Загружаем состояние уведомлений из localStorage при монтировании компонента
  useEffect(() => {
    const savedUnreadMessages = JSON.parse(localStorage.getItem('unreadMessagesCreate')) || []
    savedUnreadMessages.forEach((taskId) => {
      addUnreadMessage(taskId)
    })
  }, [addUnreadMessage])

  // Сохраняем состояние уведомлений в localStorage при изменении
  useEffect(() => {
    const currentUnreadMessages = Array.from(unreadMessages)
    localStorage.setItem('unreadMessagesCreate', JSON.stringify(currentUnreadMessages))
  }, [unreadMessages])

  const handleChatModal = useCallback(
    (taskId) => {
      setOpenChatModals((prev) => ({
        ...prev,
        [taskId]: !prev[taskId],
      }))

      if (openChatModals[taskId]) {
        resetUnreadMessages(taskId)
      }
      useTaskStateTracker.getState().resetAuthorMessage(taskId, userId)
    },
    [openChatModals, resetUnreadMessages, userId]
  )

  const handleOpenConfirmationDialog = (taskId) => {
    setCurrentTaskId(taskId)
    setOpenConfirmationDialog(true) // Открываем диалог
  }

  const handleConfirmation = (comment) => {
    if (currentTaskId) {
      handleTaskAccept(currentTaskId, userId, false, comment)
      removeTask(currentTaskId)
    }
    setOpenConfirmationDialog(false) // Закрываем диалог
  }

  const handleEditDescription = (task) => {
    setNewDescription(task.description) // Не используем stripHtmlTags!
    setCurrentTaskId(task.task_id)
    setAssignedUserIds(task.assigned_user_ids)
    setIsEditing(true)
  }

  const updateTaskDescription = async (taskId, newDescription, assignedUserIds) => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}5000/api/tasks/editing/description/${taskId}`,
        {
          newDescription,
          assignedUserIds,
        }
      )
      return response.data
    } catch (error) {
      console.error('Ошибка при обновлении описания задачи:', error)
      throw error
    }
  }

  // Функция для сохранения описания задачи
  const handleSaveDescription = async (assignedUserIds) => {
    if (!currentTaskId || !newDescription) return
    try {
      await updateTaskDescription(currentTaskId, newDescription, assignedUserIds)
      Toastify({
        text: 'Описание задачи успешно обновлено',
        duration: 3000,
        close: true,
        style: {
          background: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()
      await refreshTasks() // Обновляем задачи после успешного сохранения
    } catch (error) {
      console.error('Ошибка при сохранении описания:', error)
      Toastify({
        text: 'Ошибка при обновлении описания',
        duration: 3000,
        close: true,
        style: {
          background: 'linear-gradient(to right, #ff5f6d, #ffc371)',
        },
      }).showToast()
    } finally {
      setIsEditing(false)
      setNewDescription('')
    }
  }

  const handleOpenDeadlineDialog = (task) => {
    setCurrentTaskForDeadline(task)
    const formatDateForInput = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      const tzOffset = date.getTimezoneOffset() * 60000
      const correctedDate = new Date(date.getTime() - tzOffset)
      return correctedDate.toISOString().slice(0, 16)
    }

    setDeadlineDialogProps({
      open: true,
      initialDate: formatDateForInput(task.deadline),
    })
    setOpenDeadlineDialog(true)
  }

  const handleUpdateDeadline = async (comment, newDeadline) => {
    if (!currentTaskForDeadline) return

    try {
      const localDate = new Date(newDeadline)
      const formattedDate = new Date(
        Date.UTC(
          localDate.getFullYear(),
          localDate.getMonth(),
          localDate.getDate(),
          localDate.getHours(),
          localDate.getMinutes(),
          localDate.getSeconds()
        )
      ).toISOString()

      await axios.patch(
        `${API_BASE_URL}5000/api/tasks/${currentTaskForDeadline.task_id}/deadline`,
        {
          responder_id: user.id,
          response_comment: comment,
          new_deadline: newDeadline,
        }
      )

      Toastify({
        text: `Новый срок исполнения задачи: ${formatDate(formattedDate)}`,
        duration: 5000,
        close: true,
        style: {
          background: 'linear-gradient(to right, #800080, #DA70D6)',
        },
      }).showToast()
      await refreshTasks() // Обновляем задачи после успешного обновления
    } catch (error) {
      console.error('Ошибка при обновлении срока:', error)
      Toastify({
        text: 'Ошибка при обновлении срока выполнения',
        duration: 3000,
        close: true,
        style: {
          background: 'linear-gradient(to right, #ff5f6d, #ffc371)',
        },
      }).showToast()
    } finally {
      setOpenDeadlineDialog(false)
      setDeadlineDialogProps((prev) => ({ ...prev, open: false }))
    }
  }

  // Функция для замены исполнителя
  const replaceTaskUser = async (taskId, oldUserId, newUserId) => {
    try {
      await axios.put(`${API_BASE_URL}5000/api/tasks/${taskId}/replace-assignee`, {
        task_id: taskId,
        old_user_id: oldUserId,
        new_user_id: newUserId,
      })

      Toastify({
        text: `Исполнитель задачи успешно изменен`,
        duration: 3000,
        close: true,
        style: {
          background: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()
      await refreshTasks() // Обновляем задачи после успешной замены
    } catch (error) {
      console.error('Ошибка при замене исполнителя:', error)
      Toastify({
        text: `Ошибка при замене исполнителя`,
        duration: 3000,
        close: true,
        style: {
          background: 'linear-gradient(to right, #ff5f6d, #ffc371)',
        },
      }).showToast()
    }
  }

  // Обработчик открытия модального окна замены исполнителя
  const handleOpenReplaceUserModal = (task) => {
    setSelectedTaskForReplacement(task)
    setSelectedNewUserId('')
    setOpenReplaceUserModal(true)
  }

  // Обработчик подтверждения замены
  const handleConfirmReplaceUser = () => {
    if (!selectedTaskForReplacement || !selectedNewUserId) return

    const oldUserId = selectedTaskForReplacement.assigned_user_ids[0] // предполагаем, что исполнитель один
    replaceTaskUser(selectedTaskForReplacement.task_id, oldUserId, selectedNewUserId)
    setOpenReplaceUserModal(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header с фильтрами */}
      <TaskFiltersHeader
        stats={stats}
        isFiltersOpen={isFiltersOpen}
        setIsFiltersOpen={setIsFiltersOpen}
        viewMode={viewMode}
        setViewMode={setViewMode}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        selectedPriority={selectedPriority}
        setSelectedPriority={setSelectedPriority}
        sortBy={sortBy}
        setSortBy={setSortBy}
        selectedAssignee={selectedAssignee}
        setSelectedAssignee={setSelectedAssignee}
        users={users}
        updatedTasks={updatedTasks}
      />

      {/* Рендеринг задач */}
      <Box sx={{ px: 3 }}>
        <TaskRenderer
          filteredTasks={filteredTasks}
          viewMode={viewMode}
          users={users}
          unreadMessages={unreadMessages}
          hasSubtasks={hasSubtasks}
          isCheckingSubtasks={isCheckingSubtasks}
          allSubtasksCompleted={allSubtasksCompleted}
          openChatModals={openChatModals}
          user={user}
          userId={userId}
          setSelectedAssignee={setSelectedAssignee}
          handleEditDescription={handleEditDescription}
          handleOpenDeadlineDialog={handleOpenDeadlineDialog}
          handleOpenReplaceUserModal={handleOpenReplaceUserModal}
          handleChatModal={handleChatModal}
          handleTaskAccept={handleTaskAccept}
          removeTask={removeTask}
          handleOpenConfirmationDialog={handleOpenConfirmationDialog}
          handleOpenHierarchy={handleOpenHierarchy}
          resetUnreadMessages={resetUnreadMessages}
        />
      </Box>

      {/* Все модальные окна */}
      <TaskModals
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        newDescription={newDescription}
        setNewDescription={setNewDescription}
        quillInstance={quillInstance}
        setQuillInstance={setQuillInstance}
        currentTaskId={currentTaskId}
        assignedUserIds={assignedUserIds}
        handleSaveDescription={handleSaveDescription}
        openConfirmationDialog={openConfirmationDialog}
        setOpenConfirmationDialog={setOpenConfirmationDialog}
        handleConfirmation={handleConfirmation}
        isHierarchyModalOpen={isHierarchyModalOpen}
        setIsHierarchyModalOpen={setIsHierarchyModalOpen}
        currentHierarchyTaskId={currentHierarchyTaskId}
        handleCloseHierarchy={handleCloseHierarchy}
        openDeadlineDialog={openDeadlineDialog}
        setOpenDeadlineDialog={setOpenDeadlineDialog}
        deadlineDialogProps={deadlineDialogProps}
        setDeadlineDialogProps={setDeadlineDialogProps}
        handleUpdateDeadline={handleUpdateDeadline}
        openReplaceUserModal={openReplaceUserModal}
        setOpenReplaceUserModal={setOpenReplaceUserModal}
        selectedTaskForReplacement={selectedTaskForReplacement}
        selectedNewUserId={selectedNewUserId}
        setSelectedNewUserId={setSelectedNewUserId}
        handleConfirmReplaceUser={handleConfirmReplaceUser}
        users={users}
      />
    </Box>
  )
}

export default CreatedByTaskList
