// Самый верхний компонент глобальных задач, он же их список
import React, { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../../../../config'
import { MdClose } from 'react-icons/md'
import { FaPlus } from 'react-icons/fa'
import UserStore from '../../../store/userStore'
import GlobalTaskPage from './GlobalTaskPage'
import CreateGlobalTaskForm from './CreateGlobalTaskForm'
import './styles/GlobalTasksContainer.scss'
import axios from 'axios'

const GlobalTasksContainer = ({ onClose }) => {
  const { user } = UserStore()
  const [tasks, setTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshSubTask, setrefreshSubTask] = useState(true)
  const [refreshHistory, setrefreshHistory] = useState([])
  const [error, setError] = useState(null)

  const userId = user ? user.id : null

  // *** Функция для обновление задачи по id ***
  const handleRefreshTask = useCallback(
    async (taskId) => {
      if (!selectedTask) return
      try {
        // Загрузка обновленной задачи через axios
        const response = await axios.get(
          `${API_BASE_URL}5000/api/global-tasks/${taskId}`
        )
        const updatedTask = response.data

        setSelectedTask(updatedTask)

        // Обновление списка задач
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === updatedTask.id ? updatedTask : task
          )
        )

        const historyResponse = await axios.get(
          `${API_BASE_URL}5000/api/global-task/${taskId}/history`
        )
        setrefreshHistory(historyResponse.data)

        setrefreshSubTask((prev) => !prev)
      } catch (error) {
        console.error('Ошибка при обновлении задачи:', error)
      }
    },
    [selectedTask]
  )

  // *** Функция для загрузки задач с бэкенда ***
  const fetchGlobalTasks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `${API_BASE_URL}5000/api/global-tasks-all?userId=${userId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Ошибка HTTP: ${response.status}`)
      }

      const data = await response.json()

      setTasks(data) // Обновляем состояние задач
    } catch (err) {
      console.error('Ошибка при загрузке задач:', err)
    } finally {
      setIsLoading(false)
    }
  }, [userId, setTasks, setIsLoading, setError])

  // *** useEffect для загрузки задач при монтировании компонента ***
  useEffect(() => {
    fetchGlobalTasks() // Вызываем функцию загрузки
  }, [fetchGlobalTasks])

  // Функция для выбора задачи из списка
  const handleSelectTask = useCallback((task) => {
    setSelectedTask(task)
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
        const dataToSend = {
          ...newTaskData,
          created_by: userId, // Передаем ID текущего пользователя как автора
          deadline: newTaskData.deadline
            ? newTaskData.deadline.toISOString()
            : null,
          // goals и additionalInfo должны быть уже в правильном формате (объект/массив) из формы
        }

        // Используем axios для отправки POST-запроса
        const response = await axios.post(
          `${API_BASE_URL}5000/api/create/global-tasks`,
          dataToSend,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )

        // После успешного ответа
        handleCloseCreateForm() // Закрыть форму
        await fetchGlobalTasks() // Обновить список задач
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
          console.error(
            'Ошибка сети или другая ошибка при сохранении:',
            error.request
          )
          alert('Произошла ошибка при отправке данных.')
        } else {
          // Произошла ошибка при настройке запроса
          console.error('Ошибка:', error.message)
          alert('Произошла ошибка при отправке данных.')
        }
      }
    },
    [userId, fetchGlobalTasks, handleCloseCreateForm]
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
      } catch (error) {
        console.error('Ошибка сети или другая ошибка при обновлении:', error)
        // Обработка ошибок
      } finally {
        // Завершаем индикацию сохранения
      }
    },
    [selectedTask]
  )

  // *** Рендеринг в зависимости от состояния ***

  // Если выбрана задача, рендерим GlobalTaskPage
  if (selectedTask) {
    return (
      <GlobalTaskPage
        initialTask={selectedTask}
        tasks={tasks}
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
          <div className="global-tasks-container__loading">
            Загрузка проектов...
          </div>
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
              <FaPlus className="global-tasks-container__create-icon" /> Создать
              проект
            </button>
          </div>
          <div className="global-tasks-container__error">{error}</div>
          {/* Кнопка для повторной попытки загрузки */}
          <button
            onClick={fetchGlobalTasks}
            className="global-tasks-container__retry-button"
          >
            Повторить попытку загрузки
          </button>
        </div>
        {/* Форма создания может быть доступна даже при ошибке загрузки списка */}
        {isCreateFormVisible && (
          <CreateGlobalTaskForm
            onSave={handleSaveNewTask}
            onCancel={handleCloseCreateForm}
          />
        )}
      </div>
    )
  }

  // Если задача не выбрана, нет загрузки и нет ошибки, рендерим список задач
  return (
    <div className="global-tasks-container">
      <div className="global-tasks-container__list-view">
        <div className="global-tasks-container__list-header">
          <h1 className="global-tasks-container__title">Список проектов</h1>
          <button className="close-button" onClick={onClose}>
            <MdClose />
          </button>
          <button
            className="global-tasks-container__create-button"
            onClick={handleOpenCreateForm}
          >
            <FaPlus className="global-tasks-container__create-icon" /> Создать
            проект
          </button>
        </div>

        <div className="global-tasks-container__list">
          {/* Проверяем, есть ли задачи в состоянии `tasks` */}
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <div
                key={task.id}
                className="global-tasks-container__list-item"
                onClick={() => handleSelectTask(task)}
              >
                <h2 style={{ color: 'orange', marginLeft: '23px' }}>
                  {task.status === 'Пауза' ? 'ПРОЕКТ ПРИОСТАНОВЛЕН' : null}
                </h2>
                <div className="global-tasks-container__item-header">
                  <h3 className="global-tasks-container__item-title">
                    {task.title}
                  </h3>
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
                  {task.description
                    ? `${task.description.substring(0, 100)}...`
                    : 'Нет описания'}
                </p>
                <div className="global-tasks-container__item-meta">
                  {/* Предполагаем, что первый ответственный в массиве - главный */}
                  <span>
                    Ответственный:{' '}
                    {task.responsibles && task.responsibles.length > 0
                      ? task.responsibles[0].name || 'Не назначен'
                      : 'Не назначен'}
                  </span>
                  {/* Убедитесь, что task.deadline существует и форматируйте его */}
                  <span>
                    Срок:{' '}
                    {task.deadline
                      ? new Date(task.deadline).toLocaleDateString()
                      : 'Не указан'}
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
            // Сообщение, если задач нет после успешной загрузки
            <div className="global-tasks-container__empty-list">
              Проекты не найдены. Нажмите Создать проект , чтобы добавить новый.
            </div>
          )}
        </div>
      </div>

      {/* Рендерим форму создания задачи, если isCreateFormVisible равно true */}
      {isCreateFormVisible && (
        <CreateGlobalTaskForm
          onSave={handleSaveNewTask}
          onCancel={handleCloseCreateForm}
        />
      )}
    </div>
  )
}

const MemoizedGlobalTasksContainer = React.memo(GlobalTasksContainer)
MemoizedGlobalTasksContainer.displayName = 'GlobalTasksContainer'

export default MemoizedGlobalTasksContainer
