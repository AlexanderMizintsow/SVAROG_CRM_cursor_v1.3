// Вкладка подзадачи для отображений задачи каждого участника
import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import { FaTasks, FaPlus } from 'react-icons/fa'
import { TbSubtask } from 'react-icons/tb'
import { FcInspection, FcRedo } from 'react-icons/fc'
import UserStore from '../../../store/userStore'
import useTaskStateTracker from '../../../store/useTaskStateTracker'
import AddModal from '../Modals/AddModal'
import SubTaskHierarchy from '../Task/subcomponents/subTaskHierarchy/SubTaskHierarchy'
import {
  getStatusClass,
  getResponsibleAvatarColorClass,
  getResponsibleColorClass,
  getStatusLabelTask,
} from '../Boards/subcomponents/taskUtils'
import './styles/GlobalTaskSubtasks.scss'

const GlobalTaskSubtasks = ({ taskId, refreshSubTask, isReadOnly, userId, onRefresh }) => {
  const { user } = UserStore()
  const removeTask = useTaskStateTracker((s) => s.removeTask)
  const subtaskBlinkYellow = useTaskStateTracker((s) => s.subtaskBlinkYellow)
  const tableContainerRef = useRef(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [subtasks, setSubtasks] = useState([]) // Состояние для хранения подзадач
  const [isLoading, setIsLoading] = useState(true) // Состояние для индикации загрузки
  const [error, setError] = useState(null) // Состояние для ошибок
  const [hierarchyTaskId, setHierarchyTaskId] = useState(null)
  const [returnDialog, setReturnDialog] = useState({ open: false, taskId: null, comment: '' })
  const currentUserId = userId != null ? userId : (user ? user.id : null)

  const canConfirmSubtask = (subtask) => {
    if (isReadOnly || !currentUserId) return false
    if (subtask.status !== 'done' || subtask.is_completed) return false
    const authorId = subtask.author?.id ?? subtask.created_by
    if (authorId == null) return false
    return String(authorId) === String(currentUserId)
  }

  const clearSubtaskBlinkYellow = useTaskStateTracker((s) => s.clearSubtaskBlinkYellow)

  const handleConfirmSubtask = async (subtaskId, isAccepted, comment = '') => {
    if (!currentUserId) return
    try {
      await axios.patch(
        `${API_BASE_URL}5000/api/task/accept/${subtaskId}/${currentUserId}/${isAccepted}`,
        { comment: comment || null }
      )
      clearSubtaskBlinkYellow(subtaskId)
      removeTask(String(subtaskId))
      onRefresh?.(taskId)
      setReturnDialog({ open: false, taskId: null, comment: '' })
    } catch (err) {
      console.error('Ошибка при принятии решения по задаче:', err)
    }
  }

  const handleOpenReturnDialog = (subtaskId) => {
    setReturnDialog({ open: true, taskId: subtaskId, comment: '' })
  }

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

  useEffect(() => {
    const highlightedId = Object.keys(subtaskBlinkYellow)[0]
    if (!highlightedId || !tableContainerRef.current) return
    const row = tableContainerRef.current.querySelector(`tr[data-subtask-id="${highlightedId}"]`)
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [subtaskBlinkYellow, subtasks.length])

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

  const handleOpenHierarchy = (subtaskId) => {
    setHierarchyTaskId(subtaskId)
  }

  const handleCloseHierarchy = () => {
    setHierarchyTaskId(null)
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
        {!isReadOnly && (
        <button
          className="global-task-subtasks__add-button"
          onClick={handleOpenAddModal}
        >
          <FaPlus className="global-task-subtasks__add-icon" /> Добавить
          подзадачу
        </button>
        )}
      </div>

      <div className="global-task-subtasks__table-container" ref={tableContainerRef}>
        <table>
          <thead>
            <tr>
              <th>Статус</th>
              <th>Наименование задачи</th>
              <th>Исполнитель</th>
              <th>Автор задачи</th>
              <th>Срок</th>
              <th className="global-task-subtasks__th-actions">Иерархия</th>
              {!isReadOnly && <th className="global-task-subtasks__th-actions">Действия</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={!isReadOnly ? 8 : 7}
                  style={{ textAlign: 'center', padding: '1rem' }}
                >
                  Загрузка подзадач...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td
                  colSpan={!isReadOnly ? 8 : 7}
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
                <tr
                  key={subtask.id}
                  className={
                    subtaskBlinkYellow[String(subtask.id)] && canConfirmSubtask(subtask)
                      ? 'global-task-subtasks__row--blink-yellow'
                      : ''
                  }
                  data-subtask-id={subtask.id}
                >
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
                  <td>
                    {subtask.author ? (
                      <div
                        className={`global-task-subtasks__responsible ${getResponsibleAvatarColorClass(
                          subtask.author.color
                        )}`}
                      >
                        <div
                          className={`global-task-subtasks__responsible-avatar ${getResponsibleColorClass(
                            subtask.author.color
                          )}`}
                        >
                          {subtask.author.initials}
                        </div>
                        <div className="global-task-subtasks__responsible-name">
                          {subtask.author.name}
                        </div>
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td>{formatDate(subtask.deadline)}</td>
                  <td className="global-task-subtasks__td-actions">
                    <button
                      type="button"
                      className="global-task-subtasks__hierarchy-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenHierarchy(subtask.id)
                      }}
                      title="Иерархия подзадачи"
                    >
                      <TbSubtask className="global-task-subtasks__hierarchy-icon" />
                    </button>
                  </td>
                  {!isReadOnly && (
                    <td className="global-task-subtasks__td-actions">
                      {canConfirmSubtask(subtask) ? (
                        <div className="global-task-subtasks__confirm-actions">
                          <button
                            type="button"
                            className="global-task-subtasks__confirm-btn global-task-subtasks__confirm-btn--ok"
                            onClick={() => {
                              handleConfirmSubtask(subtask.id, true)
                            }}
                            title="Подтвердить выполнение задачи"
                          >
                            <FcInspection size={18} />
                          </button>
                          <button
                            type="button"
                            className="global-task-subtasks__confirm-btn global-task-subtasks__confirm-btn--redo"
                            onClick={() => handleOpenReturnDialog(subtask.id)}
                            title="Вернуть на доработку"
                          >
                            <FcRedo size={18} />
                          </button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                </tr>
              ))}
            {!isLoading && !error && subtasks.length === 0 && (
              <tr>
                <td
                  colSpan={!isReadOnly ? 8 : 7}
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

      {hierarchyTaskId != null && (
        <div className="global-task-subtasks__hierarchy-overlay">
          <SubTaskHierarchy taskId={hierarchyTaskId} onClose={handleCloseHierarchy} />
        </div>
      )}

      {returnDialog.open && (
        <div className="global-task-subtasks__return-overlay" role="dialog">
          <div className="global-task-subtasks__return-modal">
            <h4>Вернуть на доработку</h4>
            <p>Укажите причину возврата (комментарий):</p>
            <textarea
              value={returnDialog.comment}
              onChange={(e) =>
                setReturnDialog((s) => ({ ...s, comment: e.target.value }))
              }
              rows={4}
              placeholder="Комментарий для исполнителя..."
            />
            <div className="global-task-subtasks__return-btns">
              <button
                type="button"
                onClick={() => handleConfirmSubtask(returnDialog.taskId, false, returnDialog.comment)}
              >
                Вернуть
              </button>
              <button
                type="button"
                onClick={() => setReturnDialog({ open: false, taskId: null, comment: '' })}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GlobalTaskSubtasks
//1
