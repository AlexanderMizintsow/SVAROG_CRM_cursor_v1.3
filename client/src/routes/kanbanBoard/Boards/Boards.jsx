import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Task from '../Task/Task'
import { Box, Modal } from '@mui/material'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { getRandomColors } from '../helpers/getRandomColors'
import useRemindersStore from '../../../store/useRemindersStore'
import UserStore from '../../../store/userStore'
import useKanbanStore from '../../../store/useKanbanStore'
import useCompleteNotifications from './subcomponents/useCompleteNotifications'
import useTasksStore from '../../../store/useTasksStore'
import {
  initialColumns,
  filterTasks,
  sortTasks,
  handleDragEnd,
  handleConfirm,
  handleCancel,
} from './subcomponents/taskUtils'
import NotificationManager from './NotificationManager/NotificationManager'
import DealerGroup from './subcomponents/dealerGroup/DealerGroup'
import SearchBar from '../../../components/searchBar/SearchBar'
import { AiOutlineFundProjectionScreen } from 'react-icons/ai'
import { FcTreeStructure, FcParallelTasks } from 'react-icons/fc'
import { IoAddOutline } from 'react-icons/io5'
import { MdOutlineEditNotifications } from 'react-icons/md'
import { FaTasks } from 'react-icons/fa'
import CompletedNotificationsHistory from './subcomponents/CompletedNotificationsHistory/CompletedNotificationsHistory'
const ContextMenuBoard = React.lazy(() => import('../Boards/ContextMenuBoard/ContextMenuBoard'))
const ConfirmationDialog = React.lazy(() =>
  import('../../../components/confirmationDialog/ConfirmationDialog')
)
const BoardSidebar = React.lazy(() => import('../sidebar/BoardSidebar'))
const AddModal = React.lazy(() => import('../Modals/AddModal'))
import TaskListManager from './subcomponents/TaskListManager/TaskListManager'
import './Boards.scss'
import GlobalTasksContainer from '../globalTask/GlobalTasksContainer'
import { IoMdNotificationsOff } from 'react-icons/io'

const Boards = () => {
  // Получение состояний из zustand-хранилищ
  const { user } = UserStore()
  const { tasks, fetchTasks } = useTasksStore()
  const { reminders, setReminders } = useRemindersStore()
  const { selectedEmployeeId, setSelectedEmployeeId } = useKanbanStore()
  // Локальные состояния
  const [columns, setColumns] = useState(initialColumns)
  const [searchTerm, setSearchTerm] = useState('')
  const [taskId, setTaskId] = useState(null) // Для хранения выбранного ID задачи
  const [notificationManagerOpen, setNotificationManagerOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [taskToMove, setTaskToMove] = useState(null)
  // Модальные
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [isTaskListManagerOpen, setTaskListManagerOpen] = useState(false)
  const [isGlobalProjectOpen, setGlobalProjectOpen] = useState(false)
  const [isCompletedHistoryOpen, setCompletedHistoryOpen] = useState(false)

  const userId = user ? user.id : null

  useEffect(() => {
    // Перемещаем напоминания из хранилища в уведомления
    const userReminders = reminders.filter((reminder) => reminder.user_id === selectedEmployeeId)
    const reminderItems = userReminders.map((reminder) => ({
      id: reminder.id.toString(), // Используем id из напоминания
      title: reminder.title || 'Напоминание о звонке!',
      description: reminder.comment.replace(/\n/g, '<br />'),
      priority: reminder.priority_notifications,
      deadline: reminder.date_time,
      createdAt: reminder.created_at, // Используем дату создания
      tags: reminder.tags || [{ title: '', ...getRandomColors() }],
      links: reminder.links,
    }))

    setColumns((prevColumns) => ({
      ...prevColumns,
      notifications: {
        ...prevColumns.notifications,
        items: reminderItems,
      },
    }))
    //  console.log('Current reminders:', reminders)
  }, [reminders, selectedEmployeeId])

  // Удаление задачи
  const { handleCompleteTask } = useCompleteNotifications(columns, setColumns, setReminders, userId)

  // Определение колонки для задачи ***********************************************************
  const handleAddTask = useCallback(() => {
    const newBoard = { ...columns }
    Object.keys(newBoard).forEach((columnId) => {
      newBoard[columnId].items = []
    })

    if (!Array.isArray(tasks)) {
      return
    }

    Object.keys(newBoard).forEach((columnId) => {
      newBoard[columnId].items = []
    })

    // Распределяем задачи по колонкам в зависимости от их статуса
    tasks.forEach((task) => {
      const status = task.status // Статус задачи
      if (newBoard[status]) {
        newBoard[status].items.push({
          id: task.task_id.toString(), // Преобразуем ID в строку
          title: task.title,
          description: task.description,
          createdAt: task.created_at,
          created_by: task.created_by,
          deadline: task.deadline,
          priority: task.priority,
          tags: task.tags || [],
          status: task.status,
          global_task_id: task.global_task_id,
          parent_id: task.parent_id,
          root_id: task.root_id,
          assigned_user_ids: task.assigned_user_ids, // исполнитель
          approver_user_ids: task.approver_user_ids,
          visibility_user_ids: task.visibility_user_ids,
          attachments: task.attachments,
          commentsRedo: task.comments_redo,
        })
      }
    })

    setColumns(newBoard) // Обновляем колонки только если данные изменились
  }, [tasks])

  useEffect(() => {
    handleAddTask()
  }, [tasks, handleAddTask])

  useEffect(() => {
    if (userId) {
      fetchTasks(userId).then(() => {
        handleAddTask() // Вызываем handleAddTask после загрузки задач
      })
    }
  }, [userId, fetchTasks])

  const SidebarButton = isSidebarOpen ? FcParallelTasks : FcTreeStructure
  const sidebarTitle = isSidebarOpen ? 'Закрыть боковую панель' : 'Открыть боковую панель'

  // Функция для извлечения имени дилера из строки
  const extractDealerName = (title) => {
    const match = title.match(/\*(.*?)\*/)
    return match ? match[1] : 'Без группы'
  }

  const groupNotificationsByDealer = (notifications) => {
    return notifications.reduce((acc, task) => {
      const dealerName = extractDealerName(task.title)
      if (!acc[dealerName]) {
        acc[dealerName] = []
      }
      acc[dealerName].push(task)
      return acc
    }, {})
  }

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchTasks(selectedEmployeeId) // Вызываем handleAddTask после загрузки задач
    }
  }, [selectedEmployeeId, fetchTasks])

  const handleActionMoveTask = (id) => {
    setTaskId(id)
    setContextMenuOpen(true)
  }

  const handleCloseMenu = () => {
    setContextMenuOpen(false)
  }

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const openNotificationManager = () => {
    setNotificationManagerOpen(true)
  }

  const closeNotificationManager = () => {
    setNotificationManagerOpen(false)
  }

  const openModal = useCallback((columnId) => {
    // alert('Список задач и их создание находится в разработке!!!')
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
  }, [])

  // Обработчик подтверждения в диалоге
  const onConfirm = () => {
    handleConfirm(taskToMove, columns, setColumns, setIsDialogOpen, setTaskToMove)
  }
  // Обработчик отмены в диалоге
  const onCancel = () => {
    handleCancel(taskToMove, columns, setIsDialogOpen, setTaskToMove)
  }

  const toggleTaskListManager = () => {
    setTaskListManagerOpen((prev) => !prev)
  }

  const toggleGlobalProgect = () => {
    setGlobalProjectOpen((prev) => !prev)
  }

  const toggleCompletedHistory = () => {
    setCompletedHistoryOpen((prev) => !prev)
  }

  return (
    <div className="board-content">
      <Suspense fallback={null}>
        <ContextMenuBoard isOpen={contextMenuOpen} onClose={handleCloseMenu} taskId={taskId} />
      </Suspense>
      <div style={{ margin: '12px 0 0 10px' }}>
        <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Поиск ..." />
        <SidebarButton
          className="toggle-sidebar-button"
          title={sidebarTitle}
          onClick={toggleSidebar}
        />
        <MdOutlineEditNotifications
          title="Менеджер уведомлений"
          className="toggle-sidebar-button"
          onClick={openNotificationManager}
        />
        <FaTasks
          title="Лист задач"
          className="toggle-sidebar-button"
          onClick={toggleTaskListManager}
        />
        {
          <AiOutlineFundProjectionScreen
            title="Проекты"
            className="toggle-sidebar-button"
            onClick={toggleGlobalProgect}
          />
        }
        <IoMdNotificationsOff
          title="История завершенных уведомлений"
          className="toggle-sidebar-button"
          onClick={toggleCompletedHistory}
        />
      </div>
      <DragDropContext
        onDragEnd={(result) =>
          handleDragEnd(result, columns, setColumns, setIsDialogOpen, setTaskToMove)
        }
      >
        <div className="home-container">
          {/* Колонка Уведомления */}
          <div className="column-container notifications-column" key="notifications">
            <div className="column notifications-column-body">
              <div className="column-header notifications-header">Уведомления</div>
              {Object.entries(
                groupNotificationsByDealer(
                  sortTasks(columns.notifications.items).filter((task) =>
                    filterTasks(task, searchTerm)
                  )
                )
              ).map(([dealerName, tasks]) => (
                <DealerGroup
                  key={dealerName}
                  dealerName={dealerName}
                  tasks={tasks}
                  handleCompleteTask={handleCompleteTask}
                  handleActionMoveTask={handleActionMoveTask}
                />
              ))}
            </div>
          </div>

          {/* Остальные колонки */}
          {Object.entries(columns)
            .filter(([columnId]) => columnId !== 'notifications')
            .map(([columnId, column]) => (
              <div
                className={`column-container${columnId === 'pause' ? ' pause-column' : ''}`}
                key={columnId}
              >
                <Droppable droppableId={columnId}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="column">
                      <div className="column-header">{column.name}</div>

                      {column.name === 'Список задач' && (
                        <div onClick={() => openModal(columnId)} className="add-task-button">
                          <IoAddOutline className="icon" />
                          Создать задачу
                        </div>
                      )}
                      {column.items.length === 0 ? (
                        <div className="no-tasks"> </div>
                      ) : (
                        column.items
                          .filter((task) => filterTasks(task, searchTerm))
                          .map((task, index) => (
                            <Draggable
                              key={task.id.toString()}
                              draggableId={task.id.toString()}
                              index={index}
                              isDragDisabled={!task.assigned_user_ids.includes(userId)}
                            >
                              {(provided) => (
                                <Task
                                  provided={provided}
                                  task={task}
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  column={column}
                                />
                              )}
                            </Draggable>
                          ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
        </div>
      </DragDropContext>
      <Suspense fallback={null}>
        <AddModal
          isOpen={modalOpen}
          onClose={closeModal}
          setOpen={setModalOpen}
          userId={userId}
          globalTaskId={null}
        />{' '}
      </Suspense>
      {/* Боковое меню */}
      <Suspense fallback={null}>
        <BoardSidebar
          userId={userId}
          selectedEmployeeId={selectedEmployeeId}
          setSelectedEmployeeId={setSelectedEmployeeId}
          isOpen={isSidebarOpen}
          onClose={toggleSidebar}
          isContextMenuOpen={contextMenuOpen}
        />{' '}
      </Suspense>
      {/* Менеджер уведомлений */}
      <NotificationManager isOpen={notificationManagerOpen} onClose={closeNotificationManager} />
      <Suspense fallback={null}>
        <ConfirmationDialog
          open={isDialogOpen}
          onClose={onCancel}
          onConfirm={onConfirm}
          title="Завершение задачи"
          message="Вы уверены, что хотите завершить задачу?"
          btn1="Отмена"
          btn2="Завершить"
        />
      </Suspense>
      <Modal
        open={isTaskListManagerOpen}
        onClose={toggleTaskListManager}
        aria-labelledby="task-list-manager-modal"
        aria-describedby="task-list-manager-modal-description"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            overflow: 'auto',
          }}
        >
          <TaskListManager onClose={toggleTaskListManager} />
        </Box>
      </Modal>
      <Modal
        open={isGlobalProjectOpen}
        onClose={toggleGlobalProgect}
        aria-labelledby="task-list-manager-modal"
        aria-describedby="task-list-manager-modal-description"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            overflow: 'auto',
          }}
        >
          <GlobalTasksContainer onClose={toggleGlobalProgect} />
        </Box>
      </Modal>
      <CompletedNotificationsHistory
        isOpen={isCompletedHistoryOpen}
        onClose={toggleCompletedHistory}
        userId={userId}
      />
    </div>
  )
}

export default Boards
