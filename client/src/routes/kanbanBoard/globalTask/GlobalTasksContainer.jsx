// Самый верхний компонент глобальных задач, он же их список
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE_URL } from '../../../../config'
import { MdClose } from 'react-icons/md'
import { FaPlus } from 'react-icons/fa'
import io from 'socket.io-client'
import UserStore from '../../../store/userStore'
import GlobalTaskPage from './GlobalTaskPage'
import CreateGlobalTaskForm from './CreateGlobalTaskForm'
import HelpModalGlobalTask from './subcomponents/HelpModalGlobalTask'
import { formatDeadlineDateTime, getRemainingDays } from './utils/globalTaskUtils'
import { handleGlobalTaskChangedPayload } from './utils/projectNotificationsHandler'
import useTaskStateTracker from '../../../store/useTaskStateTracker'
import './styles/GlobalTasksContainer.scss'
import axios from 'axios'

const TERMINAL_STATUSES = ['Завершено', 'Провал', 'Удален']

const GlobalTasksContainer = ({ onClose, initialTask, initialTaskId, onProjectUpdated }) => {
  const { user } = UserStore()
  const [tasks, setTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshSubTask, setrefreshSubTask] = useState(true)
  const [refreshHistory, setrefreshHistory] = useState([])
  const [error, setError] = useState(null)
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  const [listTab, setListTab] = useState('current') // 'current' | 'completed'
  const [completedFilter, setCompletedFilter] = useState('all') // 'all' | 'completed' | 'failed' | 'deleted'
  const [completedTasks, setCompletedTasks] = useState([])
  const [completedLoading, setCompletedLoading] = useState(false)
  const userId = user ? user.id : null

  // *** Функция для обновление задачи по id ***
  const handleRefreshTask = useCallback(
    async (taskId) => {
      const idToFetch = taskId != null ? taskId : selectedTask?.id
      if (!idToFetch) return
      const isCurrentlyOpen = selectedTask?.id === idToFetch
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/global-tasks/${idToFetch}`)
        const updatedTask = response.data

        if (isCurrentlyOpen) {
          setSelectedTask(updatedTask)
          const historyResponse = await axios.get(
            `${API_BASE_URL}5000/api/global-task/${idToFetch}/history`
          )
          setrefreshHistory(historyResponse.data)
          setrefreshSubTask((prev) => !prev)
        }

        setTasks((prevTasks) => {
          const next = prevTasks.map((task) => (task.id === updatedTask.id ? updatedTask : task))
          if (TERMINAL_STATUSES.includes(updatedTask.status)) {
            return next.filter((t) => t.id !== updatedTask.id)
          }
          return next
        })

        setCompletedTasks((prev) =>
          prev.map((task) => (task.id === updatedTask.id ? updatedTask : task))
        )

        onProjectUpdated?.()
      } catch (err) {
        if (err.response?.status === 404 && isCurrentlyOpen) {
          setTasks((prev) => prev.filter((t) => t.id !== idToFetch))
          setSelectedTask(null)
        }
        console.error('Ошибка при обновлении задачи:', err)
      }
    },
    [selectedTask, onProjectUpdated]
  )

  // *** Функция для загрузки задач с бэкенда ***
  const fetchGlobalTasks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}5000/api/global-tasks-all?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Ошибка HTTP: ${response.status}`)
      }

      const data = await response.json()

      setTasks(data)

      // Уведомление об истечении срока (один раз на проект)
      const now = Date.now()
      const store = useTaskStateTracker.getState()
      ;(Array.isArray(data) ? data : []).forEach((task) => {
        if (!task?.id || TERMINAL_STATUSES.includes(task?.status)) return
        const deadline = task.deadline ? new Date(task.deadline).getTime() : null
        if (!deadline || deadline >= now) return
        if (store.projectDeadlineNotified[task.id]) return
        store.addProjectNotification(task.id, task.title || 'Проект', 'deadline_expired')
        store.setProjectDeadlineNotified(task.id)
      })
    } catch (err) {
      console.error('Ошибка при загрузке задач:', err)
    } finally {
      setIsLoading(false)
    }
  }, [userId, setTasks, setIsLoading, setError])

  const fetchCompletedTasks = useCallback(async () => {
    if (!userId) return
    setCompletedLoading(true)
    try {
      const type = completedFilter === 'all' ? '' : completedFilter
      const url = `${API_BASE_URL}5000/api/global-tasks-completed?userId=${userId}${type ? `&type=${type}` : ''}`
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
      if (!res.ok) throw new Error('Ошибка загрузки')
      const data = await res.json()
      setCompletedTasks(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Ошибка загрузки завершённых проектов:', err)
      setCompletedTasks([])
    } finally {
      setCompletedLoading(false)
    }
  }, [userId, completedFilter])

  useEffect(() => {
    fetchGlobalTasks()
  }, [fetchGlobalTasks])

  useEffect(() => {
    if (listTab === 'completed') fetchCompletedTasks()
  }, [listTab, fetchCompletedTasks])

  // Мгновенное обновление при изменениях по сокету
  const handleRefreshTaskRef = useRef(handleRefreshTask)
  const selectedTaskIdRef = useRef(selectedTask?.id)
  handleRefreshTaskRef.current = handleRefreshTask
  selectedTaskIdRef.current = selectedTask?.id

  useEffect(() => {
    if (!userId) return
    const socket = io(`${API_BASE_URL}5000`, { query: { userId }, transports: ['websocket'] })
    const onChanged = (payload) => {
      const globalTaskId = payload?.globalTaskId ?? payload
      const id = globalTaskId != null ? Number(globalTaskId) : null
      if (!id) return
      handleGlobalTaskChangedPayload(typeof payload === 'object' ? payload : { globalTaskId: id, reason: 'changed' }, userId)
      if (selectedTaskIdRef.current != null && Number(selectedTaskIdRef.current) === id) {
        handleRefreshTaskRef.current(id)
      }
      fetchGlobalTasks()
      fetchCompletedTasks()
    }
    socket.on('globalTaskChanged', onChanged)
    return () => {
      socket.off('globalTaskChanged', onChanged)
      socket.disconnect()
    }
  }, [userId, fetchGlobalTasks, fetchCompletedTasks])

  // Открыть карточку проекта при открытии из мини-карточки (по id, чтобы всегда открывалась выбранная)
  useEffect(() => {
    if (initialTaskId != null && initialTask != null) {
      setSelectedTask(initialTask)
      setTasks((prev) => {
        const has = prev.some((t) => t.id === initialTask.id)
        if (has) return prev
        return [initialTask, ...prev]
      })
    } else if (initialTaskId == null) {
      setSelectedTask(null)
    }
  }, [initialTaskId, initialTask])

  // Функция для выбора задачи из списка (сброс мигания при открытии карточки)
  const handleSelectTask = useCallback((task) => {
    setSelectedTask(task)
    if (task?.id) useTaskStateTracker.getState().clearProjectCardViewed(task.id)
  }, [])

  // Функция для возврата к списку
  const handleBackToList = useCallback(() => {
    setSelectedTask(null)
    fetchGlobalTasks()
  }, [fetchGlobalTasks])

  // Функция для открытия формы создания задачи
  const handleOpenCreateForm = useCallback(() => {
    setIsCreateFormVisible(true)
  }, [])

  // Функция для закрытия формы создания задачи
  const handleCloseCreateForm = useCallback(() => {
    setIsCreateFormVisible(false)
  }, [])

  // *** Функция для сохранения новой задачи (будет вызвана из формы) ***
  // *** Функция для сохранения новой задачи (будет вызвана из формы) ***
  const handleSaveNewTask = useCallback(
    async (newTaskData) => {
      try {
        const { attachmentsFiles, ...rest } = newTaskData || {}
        const dataToSend = {
          ...rest,
          created_by: userId, // Передаем ID текущего пользователя как автора
          deadline: rest?.deadline ? rest.deadline.toISOString() : null,
          // goals и additionalInfo должны быть уже в правильном формате (объект/массив) из формы
        }

        // Используем axios для отправки POST-запроса
        const createRes = await axios.post(`${API_BASE_URL}5000/api/create/global-tasks`, dataToSend, {
          headers: {
            'Content-Type': 'application/json',
          },
        })

        const createdTaskId = createRes?.data?.taskId

        // Если пользователь прикрепил файлы при создании — загружаем их и привязываем к проекту
        if (createdTaskId && attachmentsFiles && Array.isArray(attachmentsFiles) && attachmentsFiles.length > 0) {
          try {
            const formData = new FormData()
            attachmentsFiles.forEach((file) => formData.append('files', file))
            const uploadResponse = await axios.post(`${API_BASE_URL}5000/api/upload`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            })
            const fileUrls = uploadResponse.data?.fileUrls || []

            await Promise.all(
              fileUrls.map((url, index) =>
                axios.post(`${API_BASE_URL}5000/api/tasks/attachment/add`, {
                  task_id: createdTaskId,
                  file_url: url,
                  file_type: attachmentsFiles[index]?.type || 'application/octet-stream',
                  comment_file: null,
                  name_file: attachmentsFiles[index]?.name || `file_${index + 1}`,
                  uploaded_by: userId,
                  tableType: 'global',
                })
              )
            )
          } catch (e) {
            console.error('Ошибка при прикреплении файлов при создании проекта:', e)
            // проект уже создан — не падаем, просто информируем
            alert('Проект создан, но часть файлов не удалось прикрепить.')
          }
        }

        // После успешного ответа
        handleCloseCreateForm() // Закрыть форму
        await fetchGlobalTasks() // Обновить список задач
        onProjectUpdated?.()
      } catch (error) {
        // Обработка ошибок
        if (error.response) {
          // Сервер ответил с кодом состояния, который выходит за пределы диапазона 2xx
          console.error('Ошибка при сохранении задачи:', error.response.data)
          alert(
            `Ошибка при сохранении задачи: ${
              error.response.data.error || error.response.statusText
            }`
          )
        } else if (error.request) {
          // Запрос был сделан, но ответ не был получен
          console.error('Ошибка сети или другая ошибка при сохранении:', error.request)
          alert('Произошла ошибка при отправке данных.')
        } else {
          // Произошла ошибка при настройке запроса
          console.error('Ошибка:', error.message)
          alert('Произошла ошибка при отправке данных.')
        }
      }
    },
    [userId, fetchGlobalTasks, handleCloseCreateForm, onProjectUpdated]
  )

  // *** Функция для обновления существующей задачи ***
  const handleTaskUpdate = useCallback(
    async (updatedTaskData) => {
      // Возможно, добавить состояние для индикации сохранения (например, setIsUpdating)
      try {
        // Вам нужно определить эндпоинт для обновления задачи на бэкенде
        // Предположим, что это PUT или PATCH запрос на /api/global-tasks/:taskId
        const response = await fetch(
          `${API_BASE_URL}5000/api/update/global-tasks/${updatedTaskData.id}`,
          {
            method: 'PUT', // Или 'PATCH'
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedTaskData),
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Ошибка при обновлении задачи:', errorData)
          // Обработка ошибок
          return
        }

        const result = await response.json()

        // Опционально: Обновить локальное состояние `tasks`
        // Это позволит видеть изменения сразу в списке без полной перезагрузки
        setTasks((prevTasks) =>
          prevTasks.map(
            (task) => (task.id === result.id ? result : task) // Заменяем старую задачу на обновленную
          )
        )

        // Если пользователь находится на странице задачи, обновите и там
        if (selectedTask && selectedTask.id === result.id) {
          setSelectedTask(result)
        }
        onProjectUpdated?.()
      } catch (error) {
        console.error('Ошибка сети или другая ошибка при обновлении:', error)
        // Обработка ошибок
      } finally {
        // Завершаем индикацию сохранения
      }
    },
    [selectedTask, onProjectUpdated]
  )

  const taskListForPage =
    tasks.some((t) => t.id === selectedTask?.id) ? tasks : completedTasks

  // Если выбрана задача, рендерим GlobalTaskPage
  if (selectedTask) {
    return (
      <GlobalTaskPage
        initialTask={selectedTask}
        tasks={taskListForPage.length > 0 ? taskListForPage : [selectedTask]}
        onBack={handleBackToList}
        onTaskUpdate={handleTaskUpdate}
        onRefresh={handleRefreshTask}
        refreshHistory={refreshHistory}
        refreshSubTask={refreshSubTask}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="global-tasks-container">
        <div className="global-tasks-container__list-view">
          <div className="global-tasks-container__list-header">
            <h1 className="global-tasks-container__title">Список проектов</h1>
            {/* Кнопку "Создать" можно скрыть или оставить во время загрузки */}
            <button className="global-tasks-container__create-button" disabled>
              Загрузка...
            </button>
          </div>
          <div className="global-tasks-container__loading">Загрузка проектов...</div>
        </div>
      </div>
    )
  }

  // Если произошла ошибка, показываем сообщение об ошибке
  if (error) {
    return (
      <div className="global-tasks-container">
        <div className="global-tasks-container__list-view">
          <div className="global-tasks-container__list-header">
            <h1 className="global-tasks-container__title">Список проектов</h1>
            {/* Кнопку "Создать" можно скрыть или оставить */}
            <button
              className="global-tasks-container__create-button"
              onClick={handleOpenCreateForm}
            >
              <FaPlus className="global-tasks-container__create-icon" /> Создать проект
            </button>
          </div>
          <div className="global-tasks-container__error">{error}</div>
          {/* Кнопка для повторной попытки загрузки */}
          <button onClick={fetchGlobalTasks} className="global-tasks-container__retry-button">
            Повторить попытку загрузки
          </button>
        </div>
        {/* Форма создания может быть доступна даже при ошибке загрузки списка */}
        {isCreateFormVisible && (
          <CreateGlobalTaskForm onSave={handleSaveNewTask} onCancel={handleCloseCreateForm} />
        )}
      </div>
    )
  }

  const displayList = listTab === 'current' ? tasks : completedTasks

  return (
    <div className="global-tasks-container">
      <div className="global-tasks-container__list-view">
        <div className="global-tasks-container__list-header">
          <h1 className="global-tasks-container__title">Список проектов</h1>
          <div className="global-tasks-container__header-buttons">
            <div className="global-tasks-container__tabs">
              <button
                type="button"
                className={`global-tasks-container__tab ${listTab === 'current' ? 'global-tasks-container__tab--active' : ''}`}
                onClick={() => setListTab('current')}
              >
                Текущие
              </button>
              <button
                type="button"
                className={`global-tasks-container__tab ${listTab === 'completed' ? 'global-tasks-container__tab--active' : ''}`}
                onClick={() => setListTab('completed')}
              >
                Завершённые
              </button>
            </div>
            <button
              className="global-tasks-container__help-button"
              onClick={() => setIsHelpModalOpen(true)}
              title="Открыть справку"
            >
              ?
            </button>
            <button className="close-button" onClick={onClose}>
              <MdClose />
            </button>
            {listTab === 'current' && (
              <button
                className="global-tasks-container__create-button"
                onClick={handleOpenCreateForm}
              >
                <FaPlus className="global-tasks-container__create-icon" /> Создать проект
              </button>
            )}
          </div>
        </div>

        {listTab === 'completed' && (
          <div className="global-tasks-container__completed-filters">
            <span className="global-tasks-container__filter-label">Показать:</span>
            {[
              { key: 'all', label: 'Все' },
              { key: 'completed', label: 'Выполненные' },
              { key: 'failed', label: 'Неудача' },
              { key: 'deleted', label: 'Удалённые' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`global-tasks-container__filter-btn ${completedFilter === key ? 'global-tasks-container__filter-btn--active' : ''}`}
                onClick={() => setCompletedFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="global-tasks-container__list">
          {listTab === 'completed' && completedLoading ? (
            <div className="global-tasks-container__loading">Загрузка...</div>
          ) : displayList.length > 0 ? (
            displayList.map((task) => (
              <div
                key={task.id}
                className="global-tasks-container__list-item"
                onClick={() => handleSelectTask(task)}
              >
                <h2 style={{ color: 'orange', marginLeft: '23px' }}>
                  {task.status === 'Пауза' ? 'ПРОЕКТ ПРИОСТАНОВЛЕН' : null}
                  {task.status === 'Завершено' ? 'ВЫПОЛНЕН' : null}
                  {task.status === 'Провал' ? 'НЕУДАЧА' : null}
                  {task.status === 'Удален' ? 'УДАЛЁН' : null}
                </h2>
                <div className="global-tasks-container__item-header">
                  <h3 className="global-tasks-container__item-title">{task.title}</h3>
                  <span
                    className={`global-tasks-container__item-priority global-tasks-container__item-priority--${task.priority}`}
                  >
                    {task.priority === 'high'
                      ? 'Высокий'
                      : task.priority === 'medium'
                      ? 'Средний'
                      : 'Низкий'}
                  </span>
                </div>
                {/* Убедитесь, что task.description существует и используйте безопасный доступ */}
                <p className="global-tasks-container__item-description">
                  {task.description ? `${task.description.substring(0, 100)}...` : 'Нет описания'}
                </p>
                <div className="global-tasks-container__item-meta">
                  {/* Предполагаем, что первый ответственный в массиве - главный */}
                  <span>
                    Ответственный:{' '}
                    {Array.isArray(task.responsibles) && task.responsibles.length > 0
                      ? (task.responsibles[0] && task.responsibles[0].name) || 'Не назначен'
                      : 'Не назначен'}
                  </span>
                  <span>
                    Срок:{' '}
                    {formatDeadlineDateTime(task.deadline) || 'Не указан'}
                    {task.deadline && (
                      <> · Осталось: {getRemainingDays(task.deadline)}</>
                    )}
                  </span>
                </div>
                {/* Прогресс бар в списке */}
                <div className="global-tasks-container__item-progress">
                  <div className="global-tasks-container__item-progress-track">
                    <div
                      className={`global-tasks-container__item-progress-bar global-tasks-container__item-progress-bar--${
                        task.completion_percentage >= 100
                          ? 'completed'
                          : task.completion_percentage > 0
                          ? 'in-progress'
                          : 'new'
                      }`}
                      style={{ width: `${task.completion_percentage || 0}%` }}
                    ></div>
                  </div>
                  <span className="global-tasks-container__item-progress-percent">
                    {task.completion_percentage || 0}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="global-tasks-container__empty-list">
              {listTab === 'current'
                ? 'Проекты не найдены. Нажмите Создать проект, чтобы добавить новый.'
                : 'Нет проектов по выбранному фильтру.'}
            </div>
          )}
        </div>
      </div>

      {/* Рендерим форму создания задачи, если isCreateFormVisible равно true */}
      {isCreateFormVisible && (
        <CreateGlobalTaskForm onSave={handleSaveNewTask} onCancel={handleCloseCreateForm} />
      )}

      {/* Рендерим справку, если isHelpModalOpen равно true */}
      {isHelpModalOpen && (
        <HelpModalGlobalTask open={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
      )}
    </div>
  )
}

const MemoizedGlobalTasksContainer = React.memo(GlobalTasksContainer)
MemoizedGlobalTasksContainer.displayName = 'GlobalTasksContainer'

export default MemoizedGlobalTasksContainer
