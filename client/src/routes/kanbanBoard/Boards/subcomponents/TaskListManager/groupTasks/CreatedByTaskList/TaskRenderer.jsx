import React, { useEffect, useRef, useState } from 'react'
import useTaskStateTracker from '../../../../../../../store/useTaskStateTracker'
import {
  List,
  ListItem,
  ListItemText,
  Typography,
  Divider,
  Paper,
  Box,
  Chip,
  Card,
  CardContent,
  CardActions,
  Grid,
  IconButton,
  Badge,
  Tooltip,
} from '@mui/material'
import { Person, Schedule, Assignment, CheckCircle, Error } from '@mui/icons-material'
import { IoCalendarOutline } from 'react-icons/io5'
import { FcInspection, FcRedo, FcMindMap, FcApproval, FcCancel } from 'react-icons/fc'
import { IoIosChatboxes } from 'react-icons/io'
import { FaEdit } from 'react-icons/fa'
import { LiaUserCogSolid } from 'react-icons/lia'
import { TbSubtask } from 'react-icons/tb'
import { getStatusLabel } from '../../../taskUtils'
import styles from '../../taskListManager.module.scss'
import { getUserNames } from '../../../../../Task/utils/taskUtils'
import ChatTaskModal from '../../../../../Task/subcomponents/chatTaskModal/chatTaskModal'
import Attachments from '../../../../../Task/subcomponents/Attachments'
import TaskCardParticipants from './TaskCardParticipants'
import { handleKnowledgeDescriptionClick } from '../../../../../../knowledgeBase/openKnowledgeLink'
import { enhanceKnowledgeLinksInHtml } from '../../../../../../knowledgeBase/knowledgeLinkUtils'

const kbDescSx = {
  '& a.kb-link, & a[href*="knowledge-base"]': {
    color: '#2563eb',
    fontWeight: 600,
    textDecoration: 'underline',
    cursor: 'pointer',
  },
}

const TaskRenderer = ({
  filteredTasks,
  viewMode,
  users,
  unreadMessages,
  hasSubtasks,
  isCheckingSubtasks,
  allSubtasksCompleted,
  openChatModals,
  user,
  userId,
  setSelectedAssignee,
  handleEditDescription,
  handleOpenDeadlineDialog,
  handleOpenReplaceUserModal,
  handleChatModal,
  handleTaskAccept,
  removeTask,
  handleOpenConfirmationDialog,
  handleOpenHierarchy,
  resetUnreadMessages,
  projectTitles = {},
  onOpenProject,
  completedArchiveMode = false,
  /** Двойной клик по карточке/строке — полное описание (вкладка «Созданные» и при необходимости др.) */
  openFullDescriptionOnDoubleClick = true,
  approverMode = false,
  approvalStatus = {},
  onApproval,
}) => {
  const taskCardBlinkYellow = useTaskStateTracker((s) => s.taskCardBlinkYellow)
  const clearTaskCardBlinkYellow = useTaskStateTracker((s) => s.clearTaskCardBlinkYellow)
  const cardRefs = useRef({})
  const [descriptionModalTask, setDescriptionModalTask] = useState(null)

  useEffect(() => {
    if (!descriptionModalTask) return
    const onKey = (e) => {
      if (e.key === 'Escape') setDescriptionModalTask(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [descriptionModalTask])

  useEffect(() => {
    const highlightedId = Object.keys(taskCardBlinkYellow)[0]
    if (!highlightedId || !cardRefs.current[highlightedId]) return
    cardRefs.current[highlightedId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [taskCardBlinkYellow, filteredTasks.length])

  // Проверка просроченности
  const isTaskOverdue = (deadline, status) => {
    if (!deadline) return false // Нет даты — не просрочена
    const deadlineDate = new Date(deadline)
    if (isNaN(deadlineDate.getTime())) return false // Не валидная дата — не просрочена
    return deadlineDate < new Date() && status !== 'done'
  }

  // Получение цвета приоритета
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Высокий':
        return '#f44336'
      case 'Средний':
        return '#ff9800'
      case 'Низкий':
        return '#4caf50'
      default:
        return '#9e9e9e'
    }
  }

  // Получение иконки статуса
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Schedule />
      case 'doing':
        return <Assignment />
      case 'done':
        return <CheckCircle />
      default:
        return <Assignment />
    }
  }

  const formatDateOnly = (value) => {
    if (!value) return 'Не указана'
    const date = new Date(value)
    if (isNaN(date.getTime())) return 'Не указана'
    return date.toLocaleDateString()
  }

  const showAttachments = (task) =>
    Array.isArray(task.attachments) &&
    task.attachments.length > 0 &&
    (approverMode || !task.global_task_id)

  const renderApproverStatus = (task) => {
    if (!approverMode) return null
    const isApproved = !!approvalStatus[task.task_id]
    return (
      <Box mt={1} mb={1}>
        <Typography variant="body2" component="span">
          Утверждение:{' '}
          {isApproved ? (
            <span style={{ color: 'green' }}>
              Утверждено <FcApproval style={{ fontSize: 20, verticalAlign: 'middle' }} />
            </span>
          ) : (
            <span style={{ color: '#c62828' }}>
              Не утверждено{' '}
              <Tooltip title="Нажмите, чтобы утвердить задачу" arrow placement="top">
                <span
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer', verticalAlign: 'middle' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (typeof onApproval !== 'function') return
                    useTaskStateTracker.getState().setApproval(task.task_id, userId, true)
                    onApproval(task.task_id, userId, approvalStatus[task.task_id])
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      if (typeof onApproval !== 'function') return
                      useTaskStateTracker.getState().setApproval(task.task_id, userId, true)
                      onApproval(task.task_id, userId, approvalStatus[task.task_id])
                    }
                  }}
                >
                  <FcCancel className={`${styles.icon} ${styles.neonPulse}`} style={{ fontSize: 22 }} />
                </span>
              </Tooltip>
            </span>
          )}
        </Typography>
      </Box>
    )
  }

  const renderChatButton = (taskId, size = 18) => (
    <Tooltip title="Чат задачи — переписка и история">
      <IconButton
        size="small"
        onClick={() => handleChatModal(taskId)}
        color={unreadMessages.has(taskId) ? 'error' : 'default'}
      >
        <IoIosChatboxes size={size} />
      </IconButton>
    </Tooltip>
  )

  // Рендер карточки задачи
  const renderTaskCard = (task) => {
    const isArchive = completedArchiveMode
    const allowDescDblClick = openFullDescriptionOnDoubleClick || isArchive
    const isOverdue = !isArchive && isTaskOverdue(task.deadline, task.status)
    const hasConfirmButtons = !isArchive && task.status === 'done'
    const canBeHighlighted = approverMode || hasConfirmButtons
    const isHighlighted = canBeHighlighted && taskCardBlinkYellow[String(task.task_id)]

    return (
      <Grid
        item
        xs={12}
        sm={6}
        lg={4}
        key={task.task_id}
        ref={(el) => {
          if (el) cardRefs.current[task.task_id] = el
        }}
      >
        <Card
          className={isHighlighted ? styles.cardBlinkYellow : undefined}
          title={allowDescDblClick ? 'Двойной клик — полное описание' : undefined}
          onDoubleClick={
            allowDescDblClick
              ? () =>
                  setDescriptionModalTask({
                    title: task.title,
                    description: task.description || '',
                  })
              : undefined
          }
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
            boxShadow: isOverdue ? '0 4px 8px rgba(244, 67, 54, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'box-shadow 0.2s ease-in-out',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
            ...(allowDescDblClick ? { cursor: 'pointer' } : {}),
          }}
        >
          <CardContent sx={{ flexGrow: 1, pb: 1 }}>
            {/* Заголовок и статус */}
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {task.title}
              </Typography>
              <Chip
                icon={getStatusIcon(isArchive ? 'done' : task.status)}
                label={isArchive ? 'Завершено' : getStatusLabel(task.status)}
                size="small"
                color={
                  isArchive || task.status === 'done'
                    ? 'success'
                    : task.status === 'doing'
                    ? 'primary'
                    : 'default'
                }
              />
            </Box>

            {/* Описание */}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 2,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                ...kbDescSx,
              }}
              onClick={(e) => handleKnowledgeDescriptionClick(e, userId || user?.id)}
              dangerouslySetInnerHTML={{
                __html: enhanceKnowledgeLinksInHtml(task.description || ''),
              }}
            />

            {/* Приоритет */}
            <Box mb={2}>
              <Chip
                label={`${task.priority} приоритет`}
                size="small"
                sx={{
                  backgroundColor: `${getPriorityColor(task.priority)}20`,
                  color: getPriorityColor(task.priority),
                  fontWeight: 500,
                }}
              />
            </Box>

            {/* Исполнитель */}
            <Box display="flex" alignItems="center" mb={2}>
              <Person sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
              <Typography
                variant="body2"
                sx={
                  isArchive
                    ? { color: 'text.secondary' }
                    : {
                        cursor: 'pointer',
                        '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                      }
                }
                onClick={
                  isArchive
                    ? undefined
                    : () => setSelectedAssignee(task.assigned_user_ids[0]?.toString() || 'all')
                }
              >
                {getUserNames(task.assigned_user_ids, users)}
              </Typography>
            </Box>

            {!isArchive ? (
              /* Дедлайн */
              <Box display="flex" alignItems="center" mb={2}>
                <Schedule
                  sx={{
                    fontSize: 18,
                    mr: 1,
                    color: isOverdue ? 'error.main' : 'text.secondary',
                  }}
                />
                <Typography
                  variant="body2"
                  color={isOverdue ? 'error.main' : 'text.secondary'}
                  sx={{ fontWeight: isOverdue ? 600 : 400 }}
                >
                  {task.deadline && !isNaN(new Date(task.deadline).getTime()) ? (
                    new Date(task.deadline).toLocaleDateString()
                  ) : (
                    <span style={{ color: 'orange' }}> Не указан </span>
                  )}
                  {isOverdue && ' (Просрочено)'}
                </Typography>
              </Box>
            ) : (
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Дата создания: {formatDateOnly(task.created_at)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Дата переноса в &quot;Выполнено&quot;: {formatDateOnly(task.done_moved_at)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Дата финального завершения: {formatDateOnly(task.completed_at)}
                </Typography>
              </Box>
            )}

            {/* Подзадачи */}
            {hasSubtasks[task.task_id] && !isCheckingSubtasks[task.task_id] && (
              <Box display="flex" alignItems="center" mb={1}>
                <Tooltip
                  title={
                    allSubtasksCompleted[task.task_id]
                      ? 'Все подзадачи завершены'
                      : 'Связь с задачами'
                  }
                >
                  <IconButton
                    size="small"
                    onClick={() => handleOpenHierarchy(task.task_id)}
                    sx={{
                      color: allSubtasksCompleted[task.task_id] ? 'success.main' : 'text.secondary',
                      p: 0.5,
                    }}
                  >
                    <TbSubtask size={20} />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" color="text.secondary" ml={1}>
                  Подзадачи
                </Typography>
              </Box>
            )}

            <TaskCardParticipants task={task} users={users} />

            {renderApproverStatus(task)}

            {/* Значок «Задача проекта» */}
            {task.global_task_id && (
              <Box display="flex" alignItems="center" mb={1}>
                <Tooltip title={projectTitles[task.global_task_id] || `Проект #${task.global_task_id}`}>
                  <Chip
                    icon={<FcMindMap style={{ fontSize: 16 }} />}
                    label={projectTitles[task.global_task_id] || `Проект #${task.global_task_id}`}
                    size="small"
                    onClick={
                      typeof onOpenProject === 'function'
                        ? () => onOpenProject({ id: task.global_task_id, title: projectTitles[task.global_task_id] })
                        : undefined
                    }
                    sx={{
                      cursor: typeof onOpenProject === 'function' ? 'pointer' : 'default',
                      maxWidth: '100%',
                      '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                    }}
                  />
                </Tooltip>
              </Box>
            )}

            {/* Вложения */}
            {showAttachments(task) && (
              <Box mb={1} className={styles.taskCardAttachments}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Вложения
                </Typography>
                <Attachments attachments={task.attachments} compact />
              </Box>
            )}

            {/* Уведомления */}
            {unreadMessages.has(task.task_id) && (
              <Box display="flex" alignItems="center">
                <Badge color="error" variant="dot">
                  <Typography variant="caption" color="error.main" fontWeight={600}>
                    Новые сообщения
                  </Typography>
                </Badge>
              </Box>
            )}
          </CardContent>

          {isArchive ? (
            <Box className={styles.taskCardArchiveActions}>
              {renderChatButton(task.task_id)}
              <Typography variant="caption" color="text.secondary">
                Переписка и история согласования
              </Typography>
            </Box>
          ) : approverMode ? (
            <CardActions sx={{ pt: 0, px: 2, pb: 2 }}>
              <Box display="flex" alignItems="center" gap={1}>
                {renderChatButton(task.task_id)}
                <Typography variant="caption" color="text.secondary">
                  Чат задачи
                </Typography>
              </Box>
            </CardActions>
          ) : (
            <CardActions sx={{ pt: 0, px: 2, pb: 2 }}>
              <Box display="flex" justifyContent="space-between" width="100%" alignItems="center">
                <Box display="flex" gap={1}>
                  <Tooltip title="Редактировать описание">
                    <IconButton size="small" onClick={() => handleEditDescription(task)}>
                      <FaEdit size={16} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Изменить срок исполнения">
                    <IconButton size="small" onClick={() => handleOpenDeadlineDialog(task)}>
                      <IoCalendarOutline size={16} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Заменить исполнителя">
                    <IconButton size="small" onClick={() => handleOpenReplaceUserModal(task)}>
                      <LiaUserCogSolid size={18} />
                    </IconButton>
                  </Tooltip>

                  {renderChatButton(task.task_id)}
                </Box>

                {task.status === 'done' && (
                  <Box display="flex" gap={1}>
                    <Tooltip title="Подтвердить выполнение">
                      <IconButton
                        size="small"
                        onClick={() => {
                          clearTaskCardBlinkYellow(task.task_id)
                          handleTaskAccept(task.task_id, userId, true)
                          removeTask(task.task_id)
                        }}
                        sx={{ color: 'success.main' }}
                      >
                        <FcInspection size={20} />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Вернуть на доработку">
                      <IconButton
                        size="small"
                        onClick={() => {
                          clearTaskCardBlinkYellow(task.task_id)
                          handleOpenConfirmationDialog(task.task_id)
                        }}
                        sx={{ color: 'warning.main' }}
                      >
                        <FcRedo size={20} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            </CardActions>
          )}
        </Card>
      </Grid>
    )
  }

  // Рендер строки таблицы
  const renderTaskListItem = (task) => {
    const isArchive = completedArchiveMode
    const allowDescDblClick = openFullDescriptionOnDoubleClick || isArchive
    const isOverdue = !isArchive && isTaskOverdue(task.deadline, task.status)
    const hasConfirmButtons = !isArchive && task.status === 'done'
    const canBeHighlighted = approverMode || hasConfirmButtons
    const isHighlighted = canBeHighlighted && taskCardBlinkYellow[String(task.task_id)]

    return (
      <React.Fragment key={task.task_id}>
        <ListItem
          ref={(el) => {
            if (el) cardRefs.current[task.task_id] = el
          }}
          className={isHighlighted ? styles.cardBlinkYellow : undefined}
          title={allowDescDblClick ? 'Двойной клик — полное описание' : undefined}
          onDoubleClick={
            allowDescDblClick
              ? () =>
                  setDescriptionModalTask({
                    title: task.title,
                    description: task.description || '',
                  })
              : undefined
          }
          sx={{
            borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
            backgroundColor: isOverdue ? 'rgba(244, 67, 54, 0.05)' : 'inherit',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            },
            ...(allowDescDblClick ? { cursor: 'pointer' } : {}),
          }}
        >
          <ListItemText
            primary={
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {task.title}
                </Typography>
                <Box display="flex" gap={1} alignItems="center">
                  <Chip
                    icon={getStatusIcon(isArchive ? 'done' : task.status)}
                    label={isArchive ? 'Завершено' : getStatusLabel(task.status)}
                    size="small"
                    color={
                      isArchive || task.status === 'done'
                        ? 'success'
                        : task.status === 'doing'
                        ? 'primary'
                        : 'default'
                    }
                  />
                  <Chip
                    label={task.priority}
                    size="small"
                    sx={{
                      backgroundColor: `${getPriorityColor(task.priority)}20`,
                      color: getPriorityColor(task.priority),
                      fontWeight: 500,
                    }}
                  />
                </Box>
              </Box>
            }
            secondary={
              <>
                <Box display="flex" alignItems="flex-start" mb={1}>
                  {!isArchive && !approverMode && (
                    <IconButton
                      size="small"
                      onClick={() => handleEditDescription(task)}
                      sx={{ mt: -0.5, mr: 1 }}
                    >
                      <FaEdit size={14} />
                    </IconButton>
                  )}
                  <Typography
                    variant="body2"
                    onClick={(e) => handleKnowledgeDescriptionClick(e, userId || user?.id)}
                    dangerouslySetInnerHTML={{
                      __html: enhanceKnowledgeLinksInHtml(task.description || ''),
                    }}
                    sx={{
                      flex: 1,
                      ...kbDescSx,
                      ...(isArchive
                        ? {
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }
                        : {}),
                    }}
                  />
                </Box>

                {!isArchive ? (
                  <Box display="flex" alignItems="center" mb={1}>
                    {!approverMode && (
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDeadlineDialog(task)}
                        sx={{ mr: 1 }}
                      >
                        <IoCalendarOutline size={14} />
                      </IconButton>
                    )}
                    <Typography
                      variant="caption"
                      color={isOverdue ? 'error.main' : 'text.secondary'}
                      sx={{ fontWeight: isOverdue ? 600 : 400 }}
                    >
                      Дедлайн:{' '}
                      {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Не указан'}
                      {isOverdue && ' (Просрочено)'}
                    </Typography>
                  </Box>
                ) : (
                  <Box mb={1.5}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Дата создания: {formatDateOnly(task.created_at)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Дата переноса в &quot;Выполнено&quot;: {formatDateOnly(task.done_moved_at)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Дата финального завершения: {formatDateOnly(task.completed_at)}
                    </Typography>
                  </Box>
                )}

                <Box display="flex" alignItems="center" mb={2}>
                  {!isArchive && !approverMode && (
                    <IconButton
                      size="small"
                      onClick={() => handleOpenReplaceUserModal(task)}
                      sx={{ mr: 1 }}
                    >
                      <LiaUserCogSolid size={16} />
                    </IconButton>
                  )}
                  <Typography
                    variant="caption"
                    sx={
                      isArchive || approverMode
                        ? { color: 'text.secondary' }
                        : {
                            cursor: 'pointer',
                            '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                          }
                    }
                    onClick={
                      isArchive || approverMode
                        ? undefined
                        : () =>
                            setSelectedAssignee(task.assigned_user_ids[0]?.toString() || 'all')
                    }
                  >
                    Исполнитель: {getUserNames(task.assigned_user_ids, users)}
                  </Typography>
                </Box>

                <TaskCardParticipants task={task} users={users} />

                {renderApproverStatus(task)}

                {task.global_task_id && (
                  <Box display="flex" alignItems="center" mb={1}>
                    <Tooltip title={projectTitles[task.global_task_id] || `Проект #${task.global_task_id}`}>
                      <Chip
                        icon={<FcMindMap style={{ fontSize: 14 }} />}
                        label={projectTitles[task.global_task_id] || `Проект #${task.global_task_id}`}
                        size="small"
                        onClick={
                          typeof onOpenProject === 'function'
                            ? () => onOpenProject({ id: task.global_task_id, title: projectTitles[task.global_task_id] })
                            : undefined
                        }
                        sx={{
                          cursor: typeof onOpenProject === 'function' ? 'pointer' : 'default',
                          maxWidth: 240,
                          '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                        }}
                      />
                    </Tooltip>
                  </Box>
                )}

                {showAttachments(task) && (
                  <Box mb={1} className={styles.taskCardAttachments}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      Вложения
                    </Typography>
                    <Attachments attachments={task.attachments} compact />
                  </Box>
                )}

                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={2}>
                    {hasSubtasks[task.task_id] && !isCheckingSubtasks[task.task_id] && (
                      <Tooltip
                        title={
                          allSubtasksCompleted[task.task_id]
                            ? 'Все подзадачи завершены'
                            : 'Связь с задачами'
                        }
                      >
                        <IconButton
                          size="small"
                          onClick={() => handleOpenHierarchy(task.task_id)}
                          sx={{
                            color: allSubtasksCompleted[task.task_id]
                              ? 'success.main'
                              : 'text.secondary',
                          }}
                        >
                          <TbSubtask size={20} />
                        </IconButton>
                      </Tooltip>
                    )}

                    {renderChatButton(task.task_id)}

                    {unreadMessages.has(task.task_id) && (
                      <Typography variant="caption" color="error.main" fontWeight={600}>
                        (Новые сообщения)
                      </Typography>
                    )}
                  </Box>

                  {!isArchive && !approverMode && task.status === 'done' && (
                    <Box display="flex" gap={1}>
                      <Tooltip title="Подтвердить выполнение задачи">
                        <IconButton
                          size="small"
                          onClick={() => {
                            handleTaskAccept(task.task_id, userId, true)
                            removeTask(task.task_id)
                          }}
                          sx={{ color: 'success.main' }}
                        >
                          <FcInspection size={20} />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Вернуть на доработку">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenConfirmationDialog(task.task_id)}
                          sx={{ color: 'warning.main' }}
                        >
                          <FcRedo size={20} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              </>
            }
          />
        </ListItem>
        <Divider />

        {openChatModals[task.task_id] && (
          <ChatTaskModal
            task={task}
            onClose={() => handleChatModal(task.task_id)}
            isOpen={openChatModals[task.task_id]}
            currentUser={user.id}
            onMessageRead={() => resetUnreadMessages(task.task_id)}
          />
        )}
      </React.Fragment>
    )
  }

  if (filteredTasks.length === 0) {
    return (
      <Paper sx={{ p: 6, textAlign: 'center' }}>
        <Error sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Задачи не найдены
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Попробуйте изменить фильтры или критерии поиска
        </Typography>
      </Paper>
    )
  }

  const descriptionModal = descriptionModalTask && (
    <div
      className={styles.descriptionModalBackdrop}
      onClick={() => setDescriptionModalTask(null)}
      role="presentation"
    >
      <div
        className={styles.descriptionModalPanel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-description-modal-title"
      >
        <div className={styles.descriptionModalHeader}>
          <h3 id="task-description-modal-title" className={styles.descriptionModalTitle}>
            {descriptionModalTask.title}
          </h3>
          <button
            type="button"
            className={styles.descriptionModalClose}
            onClick={() => setDescriptionModalTask(null)}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div
          className={styles.descriptionModalBody}
          onClick={(e) => handleKnowledgeDescriptionClick(e, userId || user?.id)}
          dangerouslySetInnerHTML={{
            __html: enhanceKnowledgeLinksInHtml(descriptionModalTask.description || ''),
          }}
        />
      </div>
    </div>
  )

  return (
    <>
      {descriptionModal}
      {viewMode === 'cards' ? (
        <Grid container spacing={3}>
          {filteredTasks.map(renderTaskCard)}
          {filteredTasks.map(
            (task) =>
              openChatModals[task.task_id] && (
                <ChatTaskModal
                  key={`chat-${task.task_id}`}
                  task={task}
                  onClose={() => handleChatModal(task.task_id)}
                  isOpen={openChatModals[task.task_id]}
                  currentUser={user.id}
                  onMessageRead={() => resetUnreadMessages(task.task_id)}
                />
              )
          )}
        </Grid>
      ) : (
        <Paper sx={{ borderRadius: 2 }}>
          <List>{filteredTasks.map(renderTaskListItem)}</List>
        </Paper>
      )}
    </>
  )
}

export default TaskRenderer
