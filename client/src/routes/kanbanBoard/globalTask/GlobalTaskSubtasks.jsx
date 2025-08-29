// Вкладка подзадачи для отображений задачи каждого участника
import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import { FaTasks, FaPlus } from 'react-icons/fa'
import UserStore from '../../../store/userStore'
import AddModal from '../Modals/AddModal'
import {
  getStatusClass,
  getResponsibleAvatarColorClass,
  getResponsibleColorClass,
  getStatusLabelTask,
} from '../Boards/subcomponents/taskUtils'
import './styles/GlobalTaskSubtasks.scss'

const GlobalTaskSubtasks = ({ taskId, refreshSubTask }) => {
  // subtasks теперь не нужен как пропс, будем получать их внутри
  const { user } = UserStore()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [subtasks, setSubtasks] = useState([]) // Состояние для хранения подзадач
  const [isLoading, setIsLoading] = useState(true) // Состояние для индикации загрузки
  const [error, setError] = useState(null) // Состояние для ошибок
  const userId = user ? user.id : null

  const fetchSubtasks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await axios.get(
        `${API_BASE_URL}5000/api/tasks/subtasks/${taskId}`
      )
      setSubtasks(response.data)
    } catch (err) {
      console.error('Ошибка при загрузке подзадач:', err)
      setError('Не удалось загрузить подзадачи.')
      setSubtasks([])
    } finally {
      setIsLoading(false)
    }
  }, [taskId, setIsLoading, setError, setSubtasks])

  useEffect(() => {
    if (!taskId) {
      setIsLoading(false)
      return
    }
    fetchSubtasks()
  }, [taskId, fetchSubtasks, refreshSubTask])

  // Функция для открытия модального окна
  const handleOpenAddModal = () => {
    setIsAddModalOpen(true)
  }

  // Функция для закрытия модального окна
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false)
    // После закрытия модального окна (предполагая, что задача была добавлена)
    // вызываем повторную загрузку подзадач для обновления списка
    if (taskId) {
      const fetchSubtasks = async () => {
        try {
          const response = await axios.get(
            `${API_BASE_URL}5000/api/tasks/subtasks/${taskId}`
          )
          setSubtasks(response.data)
        } catch (err) {
          console.error('Ошибка при обновлении подзадач:', err)
        }
      }
      fetchSubtasks()
    }
  }

  // Функция для форматирования даты
  const formatDate = (dateString) => {
    if (!dateString) return 'Не указан'
    try {
      const date = new Date(dateString)

      return date.toLocaleDateString('ru-RU') // Пример: 21.11.2023
    } catch (e) {
      console.error('Ошибка форматирования даты:', e)
      return 'Неверный формат даты'
    }
  }

  return (
    <div className="global-task-subtasks">
      <div className="global-task-subtasks__header">
        <h3 className="global-task-subtasks__title">
          <FaTasks className="global-task-subtasks__title-icon" /> Подзадачи
        </h3>
        <button
          className="global-task-subtasks__add-button"
          onClick={handleOpenAddModal}
        >
          <FaPlus className="global-task-subtasks__add-icon" /> Добавить
          подзадачу
        </button>
      </div>

      <div className="global-task-subtasks__table-container">
        <table>
          <thead>
            <tr>
              <th>Статус</th>
              <th>Наименование задачи</th>
              <th>Исполнитель</th>
              <th>Срок</th>
              {/*<th>Действия</th>*/}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan="5"
                  style={{ textAlign: 'center', padding: '1rem' }}
                >
                  Загрузка подзадач...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td
                  colSpan="4"
                  style={{ textAlign: 'center', padding: '1rem', color: 'red' }}
                >
                  {error}
                </td>
              </tr>
            )}
            {!isLoading &&
              !error &&
              subtasks.length > 0 &&
              subtasks.map((subtask) => (
                <tr key={subtask.id}>
                  <td>
                    <span
                      className={`global-task-subtasks__status ${getStatusClass(
                        subtask.status
                      )}`}
                    >
                      {!subtask.is_completed
                        ? getStatusLabelTask(subtask.status)
                        : getStatusLabelTask('final')}
                    </span>
                  </td>
                  <td>
                    <div className="global-task-subtasks__name">
                      {subtask.title}
                    </div>
                  </td>
                  <td>
                    {/* Отображаем ответственного. */}
                    {subtask.responsible ? (
                      <div
                        className={`global-task-subtasks__responsible ${getResponsibleAvatarColorClass(
                          subtask.responsible.color
                        )}`}
                      >
                        <div
                          className={`global-task-subtasks__responsible-avatar ${getResponsibleColorClass(
                            subtask.responsible.color
                          )}`}
                        >
                          {subtask.responsible.initials}
                        </div>
                        <div className="global-task-subtasks__responsible-name">
                          {subtask.responsible.name}
                        </div>
                      </div>
                    ) : (
                      <span>Не назначен</span>
                    )}
                  </td>
                  <td>{formatDate(subtask.deadline)}</td>{' '}
                </tr>
              ))}
            {!isLoading && !error && subtasks.length === 0 && (
              <tr>
                <td
                  colSpan="5" // Изменено на 5, так как у нас 5 колонок
                  style={{
                    textAlign: 'center',
                    padding: '1rem',
                    color: '#6b7280',
                  }}
                >
                  Нет подзадач для этой задачи.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Рендерим AddModal */}
      <AddModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        setOpen={setIsAddModalOpen}
        userId={userId}
        globalTaskId={taskId}
      />
    </div>
  )
}

export default GlobalTaskSubtasks
//1
