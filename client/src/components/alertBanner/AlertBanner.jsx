import React, { useEffect, useRef, useState } from 'react'
import UserStore from '../../store/userStore'
import useTaskStateTracker from '../../store/useTaskStateTracker'
import { FaEnvelope } from 'react-icons/fa'
import { MdDoneOutline, MdClose } from 'react-icons/md'
import GlobalTaskChat from '../../routes/kanbanBoard/globalTask/subcomponents/globalChat/GlobalTaskChat'
import { AiOutlineFileDone } from 'react-icons/ai'
import { MdHistoryEdu, MdFolder } from 'react-icons/md'
import { GiConfirmed } from 'react-icons/gi'
import { FcFlowChart } from 'react-icons/fc'
import { requestNotificationPermission } from '../../utils/browserNotifications'
import ChatTaskModal from '../../routes/kanbanBoard/Task/subcomponents/chatTaskModal/chatTaskModal'
import { API_BASE_URL } from '../../../config'
import axios from 'axios'
import ConfirmationDialog from '../confirmationDialog/ConfirmationDialog'
import { Tooltip, Typography } from '@mui/material'
import { FcInspection, FcRedo } from 'react-icons/fc'
import useExtensionRequestsNotifications from './subcomponents/ExtensionRequestsNotifications'
import './alertBanner.scss'
import useNotificationsTask from './subcomponents/TaskNotifications'
import ReactDOM from 'react-dom'
import {
  getBpNotifications,
  markBpNotificationRead,
  getDecisionRequests,
  respondDecision,
  getAdditionalInfoRequests,
  respondAdditionalInfo,
} from '../../api/businessProcessApi'
import { formatDeadlineDateTime } from '../../routes/kanbanBoard/globalTask/utils/globalTaskUtils'

const AlertBanner = () => {
  // ==================== Инициализация состояний и хуков ====================
  const { user } = UserStore()
  const currentUserId = user ? user.id : null
  const electronAPI = window.electronAPI || null

  // ==================== Состояния компонента ====================
  const [selectedGlobalTask, setSelectedGlobalTask] = useState(null)
  const [selectedAuthorTask, setSelectedAuthorTask] = useState(null)
  const [processedTaskIds, setProcessedTaskIds] = useState(new Set())
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [messageType, setMessageType] = useState(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [prevNotificationsCount, setPrevNotificationsCount] = useState(0)
  const [openConfirmationDialog, setOpenConfirmationDialog] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState(null)
  const [bpNotifications, setBpNotifications] = useState([])
  const [decisionRequests, setDecisionRequests] = useState([])
  const [additionalInfoRequests, setAdditionalInfoRequests] = useState([])
  const notifications = []

  // Запросы на принятие решения (блок «Принятие решения»)
  if (currentUserId && Array.isArray(decisionRequests) && decisionRequests.length > 0) {
    decisionRequests.forEach((dr) => {
      const buttons = Array.isArray(dr.buttons) ? dr.buttons : []
      notifications.push({
        key: `decision-${dr.id}`,
        text: (
          <div className="alert-banner__decision">
            <div className="alert-banner__decision-header">
              <b>БП: {dr.process_name || 'Процесс'}</b>
              {dr.initiator_name && <span className="alert-banner__decision-initiator">Инициатор: {dr.initiator_name}</span>}
            </div>
            <div className="alert-banner__decision-message">{dr.message}</div>
            {buttons.length > 0 && (
              <div className="alert-banner__decision-buttons">
                {buttons.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="alert-banner__decision-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDecisionButtonClick(dr.instance_id, dr.node_id, b.id, dr.id)
                    }}
                  >
                    {b.label || b.id}
                  </button>
                ))}
              </div>
            )}
          </div>
        ),
        icon: <FcFlowChart style={{ fontSize: '16px' }} />,
      })
    })
  }

  // Запросы на заполнение «Доп. информация»
  if (currentUserId && Array.isArray(additionalInfoRequests) && additionalInfoRequests.length > 0) {
    additionalInfoRequests.forEach((r) => {
      const required = Array.isArray(r.required_keys) ? r.required_keys : []
      notifications.push({
        key: `addinfo-${r.id}`,
        text: (
          <AdditionalInfoRequestCard
            request={r}
            requiredKeys={required}
            currentUserId={currentUserId}
            onSubmit={async (values) => {
              await respondAdditionalInfo(r.instance_id, {
                node_id: r.node_id,
                user_id: currentUserId,
                values,
              })
              setAdditionalInfoRequests((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== r.id) : []))
            }}
          />
        ),
        icon: <FcFlowChart style={{ fontSize: '16px' }} />,
      })
    })
  }

  // Уведомления БП (in-app)
  if (currentUserId && Array.isArray(bpNotifications) && bpNotifications.length > 0) {
    bpNotifications.forEach((n) => {
      notifications.push({
        key: `bp-${n.id}`,
        text: (
          <span>
            <b>БП</b>
            {n.title ? `: ${n.title}. ` : ': '}
            {n.message}
          </span>
        ),
        icon: <FcFlowChart style={{ fontSize: '16px' }} />,
      })
    })
  }

  // ==================== Получение данных из store ====================
  const removeTask = useTaskStateTracker((state) => state.removeTask)
  const removeNotificationTask = useTaskStateTracker((state) => state.removeNotificationTask)
  const notificationsTask = useTaskStateTracker((state) => state.notificationsTask)
  const extensionRequests = useTaskStateTracker((state) => state.extensionRequests)
  const fetchExtensionRequests = useTaskStateTracker((state) => state.fetchExtensionRequests)
  const assigneeMessages = useTaskStateTracker((state) => state.assigneeMessages)
  const authorMessages = useTaskStateTracker((state) => state.authorMessages)
  const approvals = useTaskStateTracker((state) => state.approvals)
  const tasks = useTaskStateTracker((state) => state.tasks)
  const globalNotifications = useTaskStateTracker((state) => state.globalNotifications)
  const projectNotifications = useTaskStateTracker((state) => state.projectNotifications)
  const descriptionChangeNotifications = useTaskStateTracker((state) => state.notifications)
  const removeGlobalTaskNotification = useTaskStateTracker((state) => state.removeGlobalTaskNotification)
  const removeProjectNotification = useTaskStateTracker((state) => state.removeProjectNotification)

  // ==================== Вспомогательные хуки ====================
  const { notifications: taskNotifications, handleTaskNotificationClick } = useNotificationsTask({
    notificationsTask,
    currentUserId,
    fetchUnreadNotifications: useTaskStateTracker((state) => state.fetchUnreadNotifications),
  })

  const {
    notifications: extensionNotifications,
    rejectDialog,
    approveDialog,
  } = useExtensionRequestsNotifications({
    extensionRequests,
    currentUserId,
    onUpdate: () => fetchExtensionRequests(currentUserId),
  })

  // ==================== Эффекты ====================

  // BPE in-app уведомления и запросы на принятие решения
  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false

    const load = async () => {
      try {
        const [notifList, decList, addInfoList] = await Promise.all([
          getBpNotifications(currentUserId),
          getDecisionRequests(currentUserId).catch(() => []),
          getAdditionalInfoRequests(currentUserId).catch(() => []),
        ])
        if (cancelled) return
        setBpNotifications(Array.isArray(notifList) ? notifList : [])
        setDecisionRequests(Array.isArray(decList) ? decList : [])
        setAdditionalInfoRequests(Array.isArray(addInfoList) ? addInfoList : [])
      } catch (e) {
        // не ломаем AlertBanner из-за проблем BPE
      }
    }

    load()
    const t = setInterval(load, 15000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [currentUserId])

  // Карточка запроса «Доп. информация» (локальный компонент для AlertBanner)
  function AdditionalInfoRequestCard({ request, requiredKeys, currentUserId, onSubmit }) {
    const [values, setValues] = useState(() => {
      const obj = {}
      ;(requiredKeys || []).forEach((k) => { obj[k] = '' })
      return obj
    })
    const [isSending, setIsSending] = useState(false)
    const prompt = request?.prompt_text || 'Заполните доп. информацию'
    const processName = request?.process_name || 'Процесс'
    const initiatorName = request?.initiator_name || ''

    return (
      <div className="alert-banner__decision">
        <div className="alert-banner__decision-header">
          <b>БП: {processName}</b>
          {initiatorName && <span className="alert-banner__decision-initiator">Инициатор: {initiatorName}</span>}
        </div>
        <div className="alert-banner__decision-message" style={{ whiteSpace: 'pre-wrap' }}>{prompt}</div>

        <div className="alert-banner__decision-buttons" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {(requiredKeys || []).map((k) => (
            <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontFamily: 'monospace', minWidth: 120 }}>{k}</span>
              <input
                type="text"
                value={values[k] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...(prev || {}), [k]: e.target.value }))}
                style={{ flex: '1 1 auto' }}
                placeholder="значение"
              />
            </div>
          ))}

          <button
            type="button"
            className="alert-banner__decision-btn"
            disabled={isSending}
            onClick={async (e) => {
              e.stopPropagation()
              setIsSending(true)
              try {
                await onSubmit(values || {})
              } catch (err) {
                console.error('respondAdditionalInfo:', err)
              } finally {
                setIsSending(false)
              }
            }}
            style={{ marginTop: 10, alignSelf: 'flex-start' }}
          >
            Заполнить
          </button>
        </div>
      </div>
    )
  }

  const handleDecisionButtonClick = async (instanceId, nodeId, buttonId, requestId) => {
    if (!currentUserId) return
    try {
      await respondDecision(instanceId, {
        node_id: nodeId,
        button_id: buttonId,
        user_id: currentUserId,
      })
      setDecisionRequests((prev) => (Array.isArray(prev) ? prev.filter((r) => r.id !== requestId) : []))
    } catch (e) {
      console.error('respondDecision:', e)
    }
  }

  useEffect(() => {
    if (currentUserId) {
      fetchExtensionRequests(currentUserId)
    }
  }, [currentUserId, fetchExtensionRequests])

  // Пример отправки уведомления
  const sendNotification = (title, text) => {
    if (electronAPI && typeof electronAPI.sendNotification === 'function') {
      electronAPI.sendNotification(title, text)
    } else {
      console.log('Electron API недоступен')
    }
  }

  // Проверка наличия новых сообщений для исполнителя ***********************************************************

  const hasNewAssigneeMessage =
    currentUserId !== null &&
    Object.values(assigneeMessages).some((messagesByTask) => messagesByTask[currentUserId] === true)

  // Генерируем содержимое уведомлений для исполнителя
  if (hasNewAssigneeMessage) {
    Object.entries(assigneeMessages).forEach(([taskId, messages]) => {
      if (messages[currentUserId]) {
        notifications.push({
          key: `assigneeMessage-${taskId}`,
          text: `Новое сообщение в задачах от Автора для задачи `,
          icon: <FaEnvelope style={{ fontSize: '16px' }} />,
          taskId: taskId,
        })
      }
    })
  }

  // Отправка уведомления при наличии новых сообщений
  useEffect(() => {
    if (hasNewAssigneeMessage) {
      sendNotification('Задачи/Сообщение', 'Новое сообщение в задачах от Автора')
    }
  }, [hasNewAssigneeMessage])

  //*********************************************************************************** */
  // Проверка наличия новых сообщений для автора ***********************************************************
  const hasNewAuthorMessages =
    currentUserId !== null &&
    Object.values(authorMessages).some((messagesByTask) => messagesByTask[currentUserId] === true)

  if (hasNewAuthorMessages) {
    Object.entries(authorMessages).forEach(([taskId, messages]) => {
      if (messages[currentUserId]) {
        notifications.push({
          key: `authorMessage-${taskId}`,
          text: `Новое сообщение в задачах от Исполнителя задачи`,
          icon: <FaEnvelope style={{ cursor: 'pointer', fontSize: '16px' }} />,
          taskId: taskId,
        })
      }
    })
  }
  // Использование функции в AlertBanner

  // Проверка наличия новых согласований ***********************************************************
  const hasPendingApproval =
    currentUserId !== null &&
    Object.values(approvals).some((approverData) => approverData[currentUserId] === false)

  if (hasPendingApproval) {
    notifications.push({
      key: 'approval',
      text: 'Есть задачи, требующие вашего согласования',
      icon: <AiOutlineFileDone style={{ fontSize: '16px' }} />,
    })
  }

  // Уведомление о необходимости принятия задачи или отклонения
  const taskCount = Object.keys(tasks).length

  const hasTasks = taskCount > 0

  //  ********************************************************************************

  if (hasTasks) {
    Object.keys(tasks).forEach((taskId) => {
      const task = tasks[taskId]

      notifications.push({
        key: `task-decision-${taskId}`,
        text: (
          <div>
            <span>Исполнитель завершил задачу. Примите решение по задаче: {task.title}</span>
            {task.status === 'done' && (
              <span style={{ marginLeft: '10px' }}>
                <Tooltip
                  title={<Typography fontSize="0.9rem">Подтвердить выполнение задачи</Typography>}
                  placement="top"
                  arrow
                >
                  <span>
                    <FcInspection
                      style={{ cursor: 'pointer', marginRight: '5px', fontSize: '16px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTaskAccept(taskId, currentUserId, true)
                        removeTask(taskId)
                      }}
                    />
                  </span>
                </Tooltip>
                <Tooltip
                  title={<Typography fontSize="0.9rem">Вернуть на доработку</Typography>}
                  placement="top"
                  arrow
                >
                  <span>
                    <FcRedo
                      style={{ cursor: 'pointer', fontSize: '16px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenConfirmationDialog(taskId)
                      }}
                    />
                  </span>
                </Tooltip>
              </span>
            )}
          </div>
        ),
        icon: <MdDoneOutline style={{ color: '#00FF00', fontSize: '16px' }} />,
        taskId: taskId,
      })
    })
  }

  // Проверка наличия глобальных уведомлений
  const hasGlobalNotifications = Object.keys(globalNotifications).length > 0

  // Отобразить уведомление, если есть
  Object.entries(globalNotifications).forEach(([taskId, { title }]) => {
    notifications.push({
      key: `global-${taskId}`,
      text: `Сообщение по проекту: ${title}`,
      icon: <FaEnvelope style={{ fontSize: '16px' }} />,
      taskId,
      title,
    })
  })

  // Уведомления по проектам (создание, участники, статус, итоговые решения, дедлайн, подзадачи, почтовые сообщения)
  const projectNotificationLabels = {
    created: 'Создан проект',
    participant_added: 'Вас добавили в проект',
    participant_removed: 'Вас исключили из проекта',
    status: 'Изменён статус проекта',
    deleted: 'Проект удалён',
    progress_100: 'Прогресс проекта 100%',
    final_solution_added: 'Добавлено итоговое решение по проекту',
    final_solution_updated: 'Изменено итоговое решение по проекту',
    final_solution_deleted: 'Удалено итоговое решение по проекту',
    project_email_message: 'Почтовое сообщение по проекту',
    deadline_expired: 'Истёк срок по проекту',
    deadline_set: 'Установлен срок проекта',
    subtask_added: 'Вам назначена подзадача в проекте',
  }
  Object.entries(projectNotifications).forEach(([key, { globalTaskId, title, type, deadline: notifDeadline }]) => {
    let label = projectNotificationLabels[type] || 'Проект'
    if (type === 'deadline_set' && notifDeadline) {
      const formatted = formatDeadlineDateTime(notifDeadline)
      label = formatted ? `Установлен срок проекта до ${formatted}` : 'Установлен срок проекта'
    }
    notifications.push({
      key: `project-msg-${key}`,
      text: `${label}: ${title || 'Без названия'}`,
      icon: type === 'project_email_message' ? <FaEnvelope style={{ fontSize: '16px', color: '#6366f1' }} /> : <MdFolder style={{ fontSize: '16px', color: '#6366f1' }} />,
      taskId: globalTaskId,
      title: title || 'Проект',
      projectNotificationKey: key,
      projectNotificationType: type,
    })
  })

  // Отобразить уведомления, если есть
  Object.entries(descriptionChangeNotifications).forEach(([key, { title, taskId }]) => {
    notifications.push({
      key,
      text: `Изменение описания задачи: ${title}`,
      icon: <MdHistoryEdu style={{ fontSize: '16px', color: 'orange' }} />,
      taskId,
    })
  })

  const allNotifications = [
    ...notifications,
    ...taskNotifications,
    ...extensionNotifications,
  ]

  const handleBpNotificationClick = async (key) => {
    const id = Number(String(key).replace('bp-', ''))
    if (!id) return
    try {
      await markBpNotificationRead(id)
    } catch (e) {
      // даже если не отметилось, локально убираем, чтобы не мешало
    }
    setBpNotifications((prev) => (Array.isArray(prev) ? prev.filter((n) => n.id !== id) : []))
  }

  useEffect(() => {
    const totalNotifications = allNotifications.length
    if (totalNotifications > prevNotificationsCount) {
      setIsCollapsed(false)
    }
    setPrevNotificationsCount(totalNotifications)
  }, [allNotifications])

  // ******************************************************************* Браузерные уведомления *****************************************

  useEffect(() => {
    if (hasNewAuthorMessages) {
      sendNotification('Задача', `Новое сообщение в задачах от Исполнителя задачи`)
    }
  }, [hasNewAuthorMessages])

  // useEffect для отправки уведомлений о глобальных задачах
  useEffect(() => {
    if (hasGlobalNotifications) {
      Object.entries(globalNotifications).forEach(([taskId, { title }]) => {
        sendNotification('Проект', `Сообщение по проекту ${title}`)
      })
    }
  }, [globalNotifications])

  // Десктоп/браузер: уведомления по проектам (создание, статус, дедлайн и т.д.)
  const projectNotifKeysRef = useRef(new Set())
  useEffect(() => {
    Object.entries(projectNotifications).forEach(([key, { title, type, deadline: notifDeadline }]) => {
      if (projectNotifKeysRef.current.has(key)) return
      projectNotifKeysRef.current.add(key)
      let label = projectNotificationLabels[type] || 'Проект'
      if (type === 'deadline_set' && notifDeadline) {
        const formatted = formatDeadlineDateTime(notifDeadline)
        label = formatted ? `Установлен срок проекта до ${formatted}` : 'Установлен срок проекта'
      }
      const text = `${label}: ${title || 'Без названия'}`
      sendNotification('Проект', text)
    })
  }, [projectNotifications])

  useEffect(() => {
    if (hasTasks) {
      Object.keys(tasks).forEach((taskId) => {
        if (!processedTaskIds.has(taskId)) {
          sendNotification(
            'Задача',
            `Исполнитель завершил задачу, примите решение по задаче: ${tasks[taskId].title}`
          )
          processedTaskIds.add(taskId)
        }
      })
      setProcessedTaskIds(new Set(processedTaskIds))
    }
  }, [tasks])

  // Добавляем новый useEffect для отправки уведомления о согласованиях
  useEffect(() => {
    if (hasPendingApproval) {
      sendNotification('Задача', 'Есть задачи, требующие Вашего согласования')
    }
  }, [hasPendingApproval])

  // ==================== Обработчики событий ==================== ==================== ==================== ==================== ====================

  // Переключение состояния свернуто/развернуто
  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev)
  }

  // Обработчик клика по глобальному уведомлению
  const handleGlobalNotificationClick = ({ taskId, title }) => {
    setSelectedGlobalTask({ taskId, title })
  }

  // Закрыть/прочитать все уведомления в баннере (в основном те, которые действительно имеют "read"-семантику)
  const handleCloseAllNotifications = async () => {
    if (!currentUserId) return

    try {
      // 1) BPE in-app уведомления: помечаем прочитанными на сервере
      const bpIds = Array.isArray(bpNotifications) ? bpNotifications.map((n) => n?.id).filter(Boolean) : []
      await Promise.all(
        bpIds.map(async (id) => {
          try {
            await markBpNotificationRead(id)
          } catch (_) {
            // даже если сервер не ответил — всё равно очистим локально, чтобы баннер не мешал
          }
        })
      )
      setBpNotifications([])
    } catch (_) {
      // не ломаем UI
    }

    try {
      // 2) Уведомления задач: помечаем прочитанными на сервере и чистим локальный стор
      const ids = notificationsTask && typeof notificationsTask === 'object' ? Object.keys(notificationsTask) : []
      await Promise.all(
        ids.map(async (id) => {
          try {
            await axios.patch(`${API_BASE_URL}5000/api/notifications/${id}/read`)
          } catch (_) {
            // игнорируем ошибки "прочтения"
          } finally {
            removeNotificationTask(id)
          }
        })
      )
    } catch (_) {
      // не ломаем UI
    }

    // 3) Локальные in-app уведомления проекта/чата/изменения описания: просто убираем из сторa
    try {
      Object.keys(projectNotifications || {}).forEach((key) => removeProjectNotification(key))
      Object.keys(globalNotifications || {}).forEach((taskId) => removeGlobalTaskNotification(taskId))
      Object.keys(descriptionChangeNotifications || {}).forEach((key) =>
        useTaskStateTracker.getState().removeNotification(key)
      )
    } catch (_) {
      // не ломаем UI
    }

    // закрываем активные карточки/модалки, если они открыты из баннера
    setSelectedGlobalTask(null)
    setSelectedAuthorTask(null)
    setSelectedTaskId(null)
    setMessageType(null)
    setCurrentTaskId(null)
    setOpenConfirmationDialog(false)
  }

  // Обработчик клика по уведомлению от автора
  const handleAuthorNotificationClick = async (taskId) => {
    try {
      const task = await fetchTaskById(taskId)
      setSelectedTaskId(taskId)
      setSelectedAuthorTask(task)
    } catch (error) {
      console.error('Ошибка при получении задачи:', error)
    }
  }

  // Удаление уведомления
  const handleRemoveNotification = (key) => {
    useTaskStateTracker.getState().removeNotification(key)
  }

  // Сброс статуса сообщения (для автора/исполнителя)
  const handleResetMessage = (taskId, userId) => {
    if (messageType === 'authorMessage-') {
      useTaskStateTracker.getState().resetAuthorMessage(taskId, userId)
    }
    if (messageType === 'assigneeMessage-') {
      useTaskStateTracker.getState().resetAssigneeMessage(taskId, userId)
    }
  }

  // Подтверждение выполнения задачи
  const handleConfirmation = (comment) => {
    if (currentTaskId) {
      handleTaskAccept(currentTaskId, currentUserId, false, comment)
      removeTask(currentTaskId)
    }
    setOpenConfirmationDialog(false)
  }

  // Открытие диалога подтверждения
  const handleOpenConfirmationDialog = (taskId) => {
    setCurrentTaskId(taskId)
    setOpenConfirmationDialog(true)
  }

  // Принятие задачи (подтверждение/возврат)
  const handleTaskAccept = async (taskId, userId, isDone, comment = null) => {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}5000/api/task/accept/${taskId}/${userId}/${isDone}`,
        { comment }
      )

      if (electronAPI) {
        electronAPI.send('task-decision', { taskId, isDone })
      }

      if (isDone) {
        setProcessedTaskIds((prev) => new Set(prev).add(taskId))
      }

      return response.data
    } catch (error) {
      console.error('Ошибка при принятии решения:', {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      })
      throw error
    }
  }

  // Получение задачи по ID
  const fetchTaskById = async (taskId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/tasks/${taskId}`)
      return response.data
    } catch (error) {
      console.error('Ошибка при получении задачи:', error)
      throw error
    }
  }

  // Клик по уведомлению «Исполнитель завершил задачу. Примите решение…»
  const handleTaskDecisionNotificationClick = async (taskId) => {
    if (!taskId) return
    try {
      const task = await fetchTaskById(taskId)
      const globalTaskId = task?.global_task_id ?? task?.global_taskId
      const {
        setTaskDecisionNavigate,
        setSubtaskBlinkYellow,
        setTaskCardBlinkYellow,
      } = useTaskStateTracker.getState()

      if (globalTaskId) {
        setTaskDecisionNavigate({ type: 'project', globalTaskId, highlightSubtaskId: String(taskId) })
        setSubtaskBlinkYellow(taskId)
      } else {
        setTaskDecisionNavigate({ type: 'taskList', taskId: String(taskId) })
        setTaskCardBlinkYellow(taskId)
      }
      window.dispatchEvent(new CustomEvent('task-decision-navigate'))
    } catch (err) {
      console.error('Ошибка при открытии задачи по уведомлению:', err)
    }
  }

  return (
    <div
      className={`alert-banner ${allNotifications.length > 0 ? 'show' : ''} ${
        isCollapsed ? '' : 'collapse-btn-banner-show'
      }`}
    >
      <div className="banner-header">
        {allNotifications.length > 0 && (
          <>
            {isCollapsed && allNotifications.length > 0 && (
              <span className="collapse-title">Уведомления ({allNotifications.length})</span>
            )}
            <button
              type="button"
              className="alert-banner-close-all"
              onClick={(e) => {
                e.stopPropagation()
                handleCloseAllNotifications()
              }}
              title="Прочитать все уведомления"
              aria-label="Прочитать все уведомления"
            >
              <MdClose />
            </button>
            <button onClick={toggleCollapse} className="collapse-btn">
              {isCollapsed ? 'Развернуть' : 'Свернуть'}
            </button>
          </>
        )}
      </div>
      <div className="alert-banner-scrollable">
        {!isCollapsed &&
        (notifications.length > 0 ||
          extensionNotifications.length > 0 ||
          taskNotifications.length > 0) ? (
          <div className="notifications-container">
            {[...allNotifications].map(({ key, text, icon, taskId, title, projectNotificationKey, projectNotificationType }) => (
              <div
                className="alert-banner-content"
                key={key}
                style={{
                  cursor:
                    key.startsWith('global-') ||
                    key.startsWith('project-msg-') ||
                    key.startsWith('task-decision-') ||
                    key === 'approval'
                      ? 'pointer'
                      : undefined,
                }}
                onClick={() => {
                  if (key.startsWith('global-')) {
                    handleGlobalNotificationClick({ taskId, title })
                  } else if (key.startsWith('project-msg-')) {
                    const projectClickTypes = [
                      'progress_100',
                      'created',
                      'participant_added',
                      'status',
                      'final_solution_added',
                      'final_solution_updated',
                      'final_solution_deleted',
                      'project_email_message',
                      'deadline_expired',
                      'deadline_set',
                    ]
                    if (projectClickTypes.includes(projectNotificationType) && taskId) {
                      const { setTaskDecisionNavigate } = useTaskStateTracker.getState()
                      setTaskDecisionNavigate({ type: 'project', globalTaskId: taskId })
                      window.dispatchEvent(new CustomEvent('task-decision-navigate'))
                    }
                    if (projectNotificationKey) removeProjectNotification(projectNotificationKey)
                  } else if (key.startsWith('bp-')) {
                    handleBpNotificationClick(key)
                  } else if (key.startsWith('authorMessage-')) {
                    handleAuthorNotificationClick(taskId)
                    setMessageType('authorMessage-')
                  } else if (key.startsWith('assigneeMessage-')) {
                    handleAuthorNotificationClick(taskId)
                    setMessageType('assigneeMessage-')
                  } else if (key.startsWith('task-notification-')) {
                    handleTaskNotificationClick(taskId)
                  } else if (key.startsWith('task-decision-')) {
                    handleTaskDecisionNotificationClick(taskId)
                  } else if (key === 'approval') {
                    // Открываем вкладку "На утверждение" в менеджере задач
                    const { setTaskDecisionNavigate, setTaskCardBlinkYellow } = useTaskStateTracker.getState()
                    const pendingTaskId =
                      Object.keys(approvals || {}).find(
                        (taskId) =>
                          approvals?.[taskId]?.[currentUserId] === false ||
                          approvals?.[taskId]?.[String(currentUserId)] === false
                      ) || null
                    if (pendingTaskId) setTaskCardBlinkYellow(pendingTaskId)
                    setTaskDecisionNavigate({ type: 'taskList', initialTab: 'approver' })
                    window.dispatchEvent(new CustomEvent('task-decision-navigate'))
                  }
                }}
              >
                <div className="notification-content">
                  <span
                    className={`alert-banner-icon ${key.startsWith('global-') ? 'global' : ''} ${
                      key.startsWith('assigneeMessage-') || key.startsWith('authorMessage-')
                        ? 'icon-yellow'
                        : ''
                    }`}
                  >
                    {icon}
                  </span>
                  <div className="notification-text-wrapper">
                    {typeof text === 'string' ? (
                      <span className="notification-text">{text}</span>
                    ) : (
                      <div className="notification-text">{text}</div>
                    )}
                  </div>
                </div>
                {key.startsWith('description-change-') && (
                  <GiConfirmed
                    className="alert-banner-button"
                    onClick={() => handleRemoveNotification(key)}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <span> </span>
        )}
      </div>
      {/* Кнопка для разворачивания, если свернуто */}
      {isCollapsed && allNotifications.length > 0 && (
        <div className="collapsed-indicator" onClick={toggleCollapse}>
          Показать уведомления
        </div>
      )}
      {/* глобальный таск, открыть чат */}
      {selectedGlobalTask &&
        ReactDOM.createPortal(
          <GlobalTaskChat
            key={selectedGlobalTask.taskId}
            globalTaskId={selectedGlobalTask.taskId}
            title={selectedGlobalTask.title}
            onClick={() => setSelectedGlobalTask(null)}
          />,
          document.body
        )}
      {selectedAuthorTask &&
        ReactDOM.createPortal(
          <ChatTaskModal
            task={selectedAuthorTask}
            onClose={() => {
              setSelectedAuthorTask(null)
              handleResetMessage(selectedTaskId, currentUserId)
              setSelectedTaskId(null)
            }}
            isOpen={!!selectedAuthorTask}
            currentUser={currentUserId}
          />,
          document.body
        )}
      <ConfirmationDialog
        open={openConfirmationDialog}
        onClose={() => setOpenConfirmationDialog(false)}
        onConfirm={handleConfirmation}
        title="Вернуть задачу на доработку"
        message="Введите комментарий для возвращения задачи на доработку:"
        btn1="Отмена"
        btn2="Подтвердить"
        comment={true}
      />
      {rejectDialog}
      {approveDialog}
    </div>
  )
}

export default AlertBanner
//1
