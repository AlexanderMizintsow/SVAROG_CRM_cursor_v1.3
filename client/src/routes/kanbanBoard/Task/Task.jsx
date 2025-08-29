import { useState, forwardRef, useCallback, useEffect, useMemo } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import { ReactFlowProvider } from 'react-flow-renderer'
import Tooltip from '@mui/material/Tooltip'
import Toastify from 'toastify-js'
import useElapsedTime, { formatDate } from '../../../utils/useElapsedTime'
import { Box, Modal } from '@mui/material'
import { FcHighPriority, FcLowPriority, FcMediumPriority } from 'react-icons/fc'
import { FcMindMap, FcAbout } from 'react-icons/fc'
import { getTimeAndPriority, getUserNames } from './utils/taskUtils'
import { RxWidth } from 'react-icons/rx'
import { TbUserCheck, TbUserScreen, TbUserEdit, TbSubtask } from 'react-icons/tb'
import { MdHistoryEdu, MdAutorenew } from 'react-icons/md'
import { FaHashtag, FaFile } from 'react-icons/fa'
import { CiTimer } from 'react-icons/ci'
import useUserStore from '../../../store/userStore'
import TaskModal from './subcomponents/TaskModal'
import Attachments from './subcomponents/Attachments'
import CommentsTaskModal from './subcomponents/commentsTaskModal/CommentsTaskModal'
import ChatTaskModal from './subcomponents/chatTaskModal/chatTaskModal'
import useTasksManageStore from '../../../store/useTasksManageStore'
import useTasksStore from '../../../store/useTasksStore'
import TaskActions from './subcomponents/TaskActions'
import ConfirmationDialog from '../../../components/confirmationDialog/ConfirmationDialog'
import SubTaskHierarchy from './subcomponents/subTaskHierarchy/SubTaskHierarchy'
import useTaskStateTracker from '../../../store/useTaskStateTracker'
import './Task.scss'

const Task = forwardRef(({ task, provided, actionIcon, column }, ref) => {
  const {
    id,
    title,
    description,
    created_by, // автор
    deadline,
    priority,
    tags: rawTags,
    global_task_id,
    parent_id, // Added parent_id
    root_id, // Added root_id
    assigned_user_ids, // назначенный
    approver_user_ids,
    visibility_user_ids,
    attachments: initialAttachments,
    createdAt,
    image,
    alt,
    links,
    commentsRedo,
  } = task
  const { user, users } = useUserStore()
  const [isTaskInfoCollapsed, setIsTaskInfoCollapsed] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { remainingTime, priorityClass } = getTimeAndPriority(deadline)
  const { hours, minutes } = useElapsedTime(createdAt)
  const [open, setOpen] = useState(false)
  const [isCommentsModalOpen, setCommentsModalOpen] = useState(false)
  const [isChatModalOpen, setIsChatModalOpen] = useState(false)
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false)
  const { unreadMessages, addUnreadMessage, resetUnreadMessages, updateTaskAttachments } =
    useTasksManageStore()
  const { updateTaskAttachments: updateTasksStoreAttachments } = useTasksStore()
  const [projectTitle, setProjectTitle] = useState('')
  const [projectStatus, setProjectStatus] = useState('')
  const [descriptionHistory, setDescriptionHistory] = useState([])
  const [isSpinning, setIsSpinning] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState(false)
  const [hasSubtasks, setHasSubtasks] = useState(false)
  const [isCheckingSubtasks, setIsCheckingSubtasks] = useState(false)
  const [allSubtasksCompleted, setAllSubtasksCompleted] = useState(false)
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false)
  const [fileCommentDialogOpen, setFileCommentDialogOpen] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [filesToUpload, setFilesToUpload] = useState([])
  // Локальное состояние для вложений, которое обновляется после добавления файлов
  const [attachments, setAttachments] = useState(initialAttachments || [])
  const [dialogConfig, setDialogConfig] = useState({
    title: '',
    message: '',
    type: '',
    onConfirm: () => {},
    onCancel: () => {},
  })

  const userId = user.id

  const isExecutor = assigned_user_ids && assigned_user_ids.includes(userId)

  // Обновляем локальное состояние attachments при изменении task.attachments
  useEffect(() => {
    setAttachments(initialAttachments || [])
  }, [initialAttachments])

  useEffect(() => {
    if (global_task_id) {
      axios
        .get(`${API_BASE_URL}5000/api/global-tasks/${global_task_id}/title`)
        .then((res) => {
          setProjectTitle(res.data.title)
          setProjectStatus(res.data.status)
        })
        .catch((err) => {
          console.error('Ошибка при получении названия проекта', err)
          setProjectTitle('')
        })
    }
  }, [global_task_id])

  useEffect(() => {
    const fetchDescriptionHistory = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/tasks/${task.id}/history`)
        setDescriptionHistory(response.data)
      } catch (error) {
        console.error('Ошибка при получении истории изменений описания задачи:', error)
      }
    }

    fetchDescriptionHistory()
  }, [task.id, task.description])

  // Функция для проверки наличия подзадач
  const checkForSubtasks = useCallback(async () => {
    try {
      setIsCheckingSubtasks(true)
      const response = await axios.get(`${API_BASE_URL}5000/api/tasks/${id}/has-subtasks`)
      setHasSubtasks(response.data.has_subtasks)
      setAllSubtasksCompleted(response.data.all_completed)
    } catch (error) {
      console.error('Error checking subtasks:', error)
    } finally {
      setIsCheckingSubtasks(false)
    }
  }, [id])

  // Проверяем при монтировании и при изменении task.id
  useEffect(() => {
    checkForSubtasks()
  }, [checkForSubtasks])

  // Преобразование истории описания в HTML-строку
  const renderDescriptionHistory = () => {
    return descriptionHistory
      .map((item, index) => {
        return `<div style="margin-bottom: 10px;">
                    <p>${item.previous_description}</p>
                    <small>${new Date(item.updated_at).toLocaleString()}</small>
                    ${index < descriptionHistory.length - 1 ? '<hr />' : ''}
                  </div>`
      })
      .join('') // Объединяем все элементы в одну строку
  }

  // Загружаем состояние уведомлений из localStorage при монтировании компонента
  useEffect(() => {
    const savedUnreadMessages = JSON.parse(localStorage.getItem('unreadMessagesTask')) || []
    savedUnreadMessages.forEach((taskId) => {
      addUnreadMessage(taskId)
    })
  }, [addUnreadMessage])

  const removeUnreadMessageById = (id) => {
    const numericId = Number(id)
    const savedUnreadMessages = JSON.parse(localStorage.getItem('unreadMessagesTask')) || []

    // Фильтруем массив, исключая сообщение с указанным id
    const updatedMessages = savedUnreadMessages.filter((taskId) => {
      //  console.log('Текущий taskId:', taskId, 'Тип taskId:', typeof taskId)
      return taskId !== numericId
    })

    // Сохраняем обновлённый массив обратно в localStorage
    localStorage.setItem('unreadMessagesTask', JSON.stringify(updatedMessages))
    resetUnreadMessages(numericId)
    const newUnreadMessages = new Set(updatedMessages)
    setHasUnreadMessages(newUnreadMessages.has(numericId))
  }

  // Сохраняем состояние уведомлений в localStorage при изменении
  useEffect(() => {
    const currentUnreadMessages = Array.from(unreadMessages)
    localStorage.setItem('unreadMessagesTask', JSON.stringify(currentUnreadMessages))
  }, [unreadMessages])

  useEffect(() => {
    const taskId = Number(id)
    setHasUnreadMessages(unreadMessages.has(taskId))
  }, [unreadMessages, id])

  const tags = typeof rawTags === 'string' ? JSON.parse(rawTags) : []

  const formatElapsedTime = () => {
    return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`
  }

  useEffect(() => {
    useTaskStateTracker.getState().resetAssigneeMessage(task.id, userId)
  }, [isChatModalOpen, task.id, userId])

  const handleChatModal = (taskId) => {
    setIsChatModalOpen((prev) => !prev)
  }

  const toggleModal = useCallback(() => {
    setIsModalOpen((prev) => !prev)
  }, [])

  const isImage = useCallback((link) => {
    return link.match(/\.(jpeg|jpg|gif|png)$/)
  }, [])

  const hasUnapprovedApprovers = useCallback(() => {
    return approver_user_ids && approver_user_ids.some((approver) => !approver.is_approved)
  }, [approver_user_ids])

  const handleAddFile = useCallback(
    async (taskId) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true

      input.onchange = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length > 0) {
          setFilesToUpload(files)
          setCurrentFileIndex(0)
          setFileCommentDialogOpen(true)
        }
      }
      input.click()
    },
    [userId]
  )

  const handleFileCommentConfirm = async (comment) => {
    try {
      const file = filesToUpload[currentFileIndex]
      const formData = new FormData()
      formData.append('files', file)

      const uploadResponse = await axios.post(`${API_BASE_URL}5000/api/upload`, formData)

      const newAttachment = {
        task_id: task.id,
        file_url: uploadResponse.data.fileUrls[0],
        file_type: file.type,
        comment_file: comment,
        name_file: file.name,
        uploaded_by: userId,
        tableType: 'local',
      }

      await axios.post(`${API_BASE_URL}5000/api/tasks/attachment/add`, newAttachment)

      // Обновляем локальное состояние attachments сразу после успешного добавления
      const updatedAttachments = [...attachments, newAttachment]
      setAttachments(updatedAttachments)

      // Обновляем глобальное состояние в store
      updateTaskAttachments(task.id, updatedAttachments)
      updateTasksStoreAttachments(task.id, updatedAttachments)

      if (currentFileIndex < filesToUpload.length - 1) {
        setCurrentFileIndex(currentFileIndex + 1)
      } else {
        setFileCommentDialogOpen(false)
        setFilesToUpload([])
        setCurrentFileIndex(0)
        Toastify({ text: 'Файлы успешно добавлены!' }).showToast()
      }
    } catch (error) {
      console.error('Ошибка при добавлении файла:', error)
      setFileCommentDialogOpen(false)
      setFilesToUpload([])
      setCurrentFileIndex(0)
      Toastify({
        text: 'Ошибка при добавлении файла!',
        style: { background: 'linear-gradient(to right, #ff6b6b, #ff6b6b)' },
      }).showToast()
    }
  }

  // Функция для форматирования комментариев в HTML
  const formatComments = (comments) => {
    if (!comments || comments.length === 0) {
      return false
    }

    return comments.map((comment, index) => (
      <div key={index} style={{ marginBottom: '5px' }}>
        <strong style={{ fontSize: '15px' }}>Комментарий:</strong>{' '}
        <span style={{ fontSize: '21px' }}>{comment.comment_redo} </span> <br />
        <strong>Создано:</strong> {new Date(comment.created_at_redo).toLocaleString()}
      </div>
    ))
  }

  const handleClick = () => {
    setIsSpinning(true)
    setTimeout(() => setIsSpinning(false), 800)
    setExtensionDialogOpen(true)
  }

  const handleConfirm = async (comment, newDeadline) => {
    try {
      await axios.post(`${API_BASE_URL}5000/api/tasks/extension-request`, {
        task_id: task.id,
        requester_id: user.id,
        created_by,
        reason: comment,
        new_proposed_deadline: newDeadline || null,
      })

      Toastify({
        text: `Запрос на продление успешно отправлен!`,
        duration: 3000,
        close: true,
        style: {
          background: 'linear-gradient(to right, #0a3d2b,#0a3d2b)',
        },
      }).showToast()
    } catch (error) {
      console.error('Ошибка при отправке запроса:', error.response?.data?.message || error.message)
    } finally {
      setDialogOpen(false)
    }
  }

  // Обработчик открытия модального окна иерархии
  const handleOpenHierarchy = () => {
    setIsHierarchyModalOpen(true)
  }

  // Обработчик закрытия модального окна
  const handleCloseHierarchy = () => {
    setIsHierarchyModalOpen(false)
  }

  return (
    <>
      <div
        ref={ref}
        {...(provided ? provided.draggableProps : {})}
        {...(provided ? provided.dragHandleProps : {})}
        className={`task ${
          hasUnapprovedApprovers() || column.id === 'done' ? 'disabled-task' : ''
        } ${global_task_id ? 'highlighted' : ''}`}
        onDoubleClick={toggleModal}
      >
        <p>
          {projectStatus === 'Пауза' ? (
            <p
              style={{
                color: 'blue',
                marginLeft: '25px',
                position: 'absolute',
                transform: 'rotate(45deg)',
                transformOrigin: 'left bottom',
                letterSpacing: '4px',
                fontSize: '18px',
                fontWeight: 'bold',
              }}
            >
              ПРОЕКТ ПРИОСТАНОВЛЕН
            </p>
          ) : (
            ''
          )}
        </p>
        <p className="task-id">№:{id}</p>
        <div className="task-header">
          <RxWidth title="Развернуть" onClick={toggleModal} className="task-expand-icon" />
          {actionIcon}
        </div>
        {image && alt && <img src={image} alt={alt} className="task-image" loading="lazy" />}
        <div className="task-tags">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <span
                key={tag.title}
                className="task-tag"
                style={{ backgroundColor: tag.bg, color: tag.text }}
              >
                {tag.title} {'   '} <FaHashtag />
              </span>
            ))
          ) : (
            <span className="task-tag no-tag">
              БЕЗ ТЭГА <FaHashtag />
            </span>
          )}
        </div>
        <div className="task-details">
          <span className="task-time-reminder">Создано: {formatDate(createdAt)}</span>
          <span className="task-title">{title}</span>
          <div className="task-description" dangerouslySetInnerHTML={{ __html: description }} />
        </div>
        {links && links.length > 0 && (
          <div className="links">
            {links.map((link, index) => {
              const fileName = link.split('/').pop()
              return (
                <div key={index} className="link-item">
                  {isImage(link) ? (
                    <a href={link} className="link" rel="noopener noreferrer">
                      <img src={link} alt={`Image ${index + 1}`} className="link-image" />
                    </a>
                  ) : (
                    <a href={link} className="link" rel="noopener noreferrer">
                      <FaFile className="file-icon" />
                    </a>
                  )}
                  <a href={link} className="link" rel="noopener noreferrer">
                    {isImage(link) ? `Изображение ${index + 1}` : fileName}
                  </a>
                </div>
              )
            })}
          </div>
        )}
        <div
          className="task-info-toggle"
          onClick={() => setIsTaskInfoCollapsed(!isTaskInfoCollapsed)}
        >
          {isTaskInfoCollapsed ? '▼' : '▲'}
        </div>
        <div className={`task-info ${isTaskInfoCollapsed ? 'collapsed' : ''}`}>
          <Attachments attachments={attachments} />
          <Tooltip title={getUserNames(created_by, users)} placement="right" arrow>
            <p className="task-participants" style={{ width: 'fit-content' }}>
              Автор задачи: {'  '} <TbUserEdit className="task-participants-icon" />
            </p>
          </Tooltip>

          {visibility_user_ids.filter(Boolean).length > 0 && (
            <Tooltip title={getUserNames(visibility_user_ids, users)} placement="right" arrow>
              <p className="task-participants" style={{ width: 'fit-content' }}>
                Мониторы: {'  '} <TbUserScreen className="task-participants-icon" />
              </p>
            </Tooltip>
          )}

          {approver_user_ids && approver_user_ids.length > 0 && (
            <div className="task-participants">
              Апруверы:{' '}
              {approver_user_ids.map((approver) => (
                <Tooltip
                  key={approver.approver_id}
                  title={getUserNames([approver.approver_id], users)}
                  placement="bottom"
                  arrow
                >
                  <span style={{ width: 'fit-content' }}>
                    <TbUserCheck
                      className="task-participants-icon"
                      style={{
                        color: approver.is_approved ? 'green' : 'red',
                        marginLeft: '3px',
                      }} // Устанавливаем цвет в зависимости от is_approved
                    />
                  </span>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
        <div>
          <Tooltip
            title={`Приоритет ${priority}`}
            placement="bottom"
            arrow
            className="task-priority-icon"
          >
            <div>
              {priority === 'высокий' ? (
                <FcHighPriority />
              ) : priority === 'средний' ? (
                <FcMediumPriority />
              ) : (
                <FcLowPriority />
              )}
            </div>
          </Tooltip>
          {commentsRedo && (
            <Tooltip
              title={<div>{formatComments(commentsRedo)}</div>}
              placement="bottom"
              arrow
              className="task-priority-icon"
            >
              <div style={{ top: '50px' }}>
                <FcAbout />
              </div>
            </Tooltip>
          )}

          {/*Подзадачи */}
          {hasSubtasks && !isCheckingSubtasks && (
            <Tooltip
              title={
                <div>{allSubtasksCompleted ? 'Все подзадачи завершены' : 'Связь с задачами'}</div>
              }
              placement="bottom"
              arrow
            >
              <div className="task-subtask-icon">
                <TbSubtask
                  style={{
                    color: allSubtasksCompleted ? '#4CAF50' : 'inherit',
                    filter: allSubtasksCompleted
                      ? 'drop-shadow(0 0 4px rgba(76, 175, 80, 0.7))'
                      : 'none',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenHierarchy()
                  }}
                />
              </div>
            </Tooltip>
          )}

          {global_task_id && (
            <Tooltip
              title={<div>Задача проекта: {projectTitle}</div>}
              placement="bottom"
              arrow
              className="task-priority-icon"
            >
              <div style={{ top: '75px' }}>
                <FcMindMap />
              </div>
            </Tooltip>
          )}

          {descriptionHistory.length > 0 && (
            <Tooltip
              title={
                <div
                  style={{
                    width: '300px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: renderDescriptionHistory(),
                  }}
                />
              }
              placement="bottom"
              arrow
              className="task-priority-icon"
            >
              <div style={{ top: '75px' }}>
                <MdHistoryEdu />
              </div>
            </Tooltip>
          )}
        </div>
        {formatDate(deadline) && (
          <div style={{ fontSize: '12px' }}>
            Срок выполнения задачи до: <span className="taks-deadline">{formatDate(deadline)}</span>
          </div>
        )}
        {formatDate(deadline) && (
          <div className="task-footer">
            <div className="task-deadline">
              <span
                className={`task-deadline-renew-wrapper ${
                  priorityClass === 'high-priority' ? 'pulse-effect' : ''
                }`}
              >
                <MdAutorenew
                  title="Запросить продление срока исполнения задачи"
                  className={`task-deadline-renew-icon ${isSpinning ? 'spin-on-click' : ''}`}
                  onClick={handleClick}
                />
              </span>
              <CiTimer className="task-icon" />
              <span className="task-deadline-text">{remainingTime}</span>
            </div>
            <div className={`priority-indicator ${priorityClass}`}></div>
          </div>
        )}

        {isExecutor && (
          <>
            <TaskActions
              hasUnreadMessages={hasUnreadMessages}
              onChatClick={() => {
                removeUnreadMessageById(task.id)
                handleChatModal(task.id)
              }}
              onAddFileClick={() => handleAddFile(task.id)}
              onNotesClick={() => setCommentsModalOpen(true)}
              open={open}
              setOpen={setOpen}
              task={task}
              currentUser={userId}
            />
          </>
        )}
      </div>
      {isModalOpen && (
        <TaskModal
          onClose={toggleModal}
          image={image}
          alt={alt}
          tags={tags}
          title={title}
          description={description}
          formatElapsedTime={formatElapsedTime}
          priority={priority}
        />
      )}

      <CommentsTaskModal
        userId={userId}
        task={task}
        taskId={id}
        open={isCommentsModalOpen}
        onClose={() => setCommentsModalOpen(false)}
      />
      {isChatModalOpen && (
        <ChatTaskModal
          task={task}
          onClose={() => setIsChatModalOpen(false)}
          isOpen={isChatModalOpen} // Добавлено
          currentUser={user.id} // Передайте текущего пользователя
        />
      )}
      <ConfirmationDialog
        open={fileCommentDialogOpen || extensionDialogOpen}
        onClose={() => {
          if (fileCommentDialogOpen) setFileCommentDialogOpen(false)
          if (extensionDialogOpen) setExtensionDialogOpen(false)
        }}
        onConfirm={(comment, date) => {
          if (fileCommentDialogOpen) handleFileCommentConfirm(comment)
          if (extensionDialogOpen) handleConfirm(comment, date)
        }}
        title={
          fileCommentDialogOpen
            ? `Комментарий для файла ${filesToUpload[currentFileIndex]?.name || ''}`
            : 'Запрос продления срока'
        }
        message={
          fileCommentDialogOpen
            ? 'Введите комментарий:'
            : 'Укажите причину для продления срока выполнения задачи:'
        }
        btn1="Отмена"
        btn2={fileCommentDialogOpen ? 'Сохранить' : 'Отправить запрос'}
        comment={true}
        dateInput={extensionDialogOpen}
      />

      {isHierarchyModalOpen && (
        <Modal
          open={isHierarchyModalOpen}
          onClose={handleCloseHierarchy}
          aria-labelledby="hierarchy-modal-title"
          aria-describedby="hierarchy-modal-description"
        >
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              maxWidth: '800px',
              bgcolor: 'background.paper',
              boxShadow: 24,
              p: 4,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <ReactFlowProvider>
              <SubTaskHierarchy taskId={id} onClose={handleCloseHierarchy} />
            </ReactFlowProvider>
          </Box>
        </Modal>
      )}
    </>
  )
})

Task.displayName = 'Task'
export default Task
