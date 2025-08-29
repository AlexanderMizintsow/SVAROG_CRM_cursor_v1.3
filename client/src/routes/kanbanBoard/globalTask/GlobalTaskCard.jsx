// Главная карта проекта
import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import {
  FaExclamationCircle,
  FaBullseye,
  FaInfoCircle,
  FaUsers,
  FaPaperclip,
  FaEllipsisH,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa'
import { MdCalendarMonth, MdAccessTime } from 'react-icons/md'
import useUserStore from '../../../store/userStore'
import {
  getPriorityClass,
  getPriorityLabel,
  getPriorityColorClass,
  getResponsibleColorClass,
  getResponsibleTextColorClass,
  getRemainingDays,
} from './utils/globalTaskUtils'
import ResponsibleSelector from './subcomponents/ResponsibleSelector'
import GoalsEditor from './subcomponents/GoalsEditor'
import AdditionalInfoEditor from './subcomponents/AdditionalInfoEditor'
import './styles/GlobalTaskCard.scss'

const GlobalTaskCard = ({
  task,
  onPrevious, // Обработчик для предыдущей задачи
  onNext, // Обработчик для следующей задачи
  hasPrevious, // Флаг: есть ли предыдущая задача
  hasNext, // Флаг: есть ли следующая задача
  setAttachments,
  onRefresh,
}) => {
  const cardRef = useRef(null)
  const { user } = useUserStore()
  const containerRef = useRef(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const buttonRef = useRef(null)
  const [isModalOpenResponsibles, setIsModalOpenResponsibles] = useState(false)
  const [isGoalsEditorOpen, setIsGoalsEditorOpen] = useState(false)
  const [isAdditionalInfoEditorOpen, setIsAdditionalInfoEditorOpen] =
    useState(false)
  // Обработчик открытия редактора целей
  const handleOpenGoalsEditor = () => setIsGoalsEditorOpen(true)
  const handleCloseGoalsEditor = () => setIsGoalsEditorOpen(false)
  //  для доп. инфо:
  const handleOpenAdditionalInfoEditor = () =>
    setIsAdditionalInfoEditorOpen(true)
  const handleCloseAdditionalInfoEditor = () =>
    setIsAdditionalInfoEditorOpen(false)
  const {
    id,
    title,
    description,
    priority,
    deadline,
    goals,
    additional_info,
    responsibles,
  } = task
  const responsiblesRef = useRef(null)
  const goalsRef = useRef(null)
  const additionalInfoRef = useRef(null)
  const userId = user.id

  let remainingDays = getRemainingDays(deadline)

  // Обработчики закрытия при клике вне
  useEffect(() => {
    if (!isModalOpenResponsibles) return

    const handleClickOutside = (event) => {
      if (
        responsiblesRef.current &&
        !responsiblesRef.current.contains(event.target)
      ) {
        setIsModalOpenResponsibles(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isModalOpenResponsibles])

  useEffect(() => {
    if (!isGoalsEditorOpen) return

    const handleClickOutside = (event) => {
      if (goalsRef.current && !goalsRef.current.contains(event.target)) {
        handleCloseGoalsEditor()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isGoalsEditorOpen])

  useEffect(() => {
    if (!isAdditionalInfoEditorOpen) return

    const handleClickOutside = (event) => {
      if (
        additionalInfoRef.current &&
        !additionalInfoRef.current.contains(event.target)
      ) {
        handleCloseAdditionalInfoEditor()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isAdditionalInfoEditorOpen])

  // Эффект для поиска родительского контейнера
  useEffect(() => {
    const container = cardRef.current?.closest('.global-task-page__container')
    if (container) {
      containerRef.current = container
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  const fetchAttachments = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}5000/api/tasks/${id}/attachments`
      )
      setAttachments(response.data.attachments)
    } catch (error) {
      console.error('Ошибка загрузки вложений:', error)
    }
  }

  // Реализация handleAddFile
  const handleAddFile = useCallback(
    async (taskId) => {
      // Создаем input для выбора файлов
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true // Разрешаем выбрать несколько файлов
      input.onchange = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length > 0) {
          try {
            // Создаем FormData для загрузки файлов
            const formData = new FormData()
            files.forEach((file) => {
              formData.append('files', file)
            })

            // Отправляем файлы на сервер
            const uploadResponse = await axios.post(
              `${API_BASE_URL}5000/api/upload`,
              formData,
              {
                headers: {
                  'Content-Type': 'multipart/form-data',
                },
              }
            )

            const fileUrls = uploadResponse.data.fileUrls
            const comments = files.map((file, index) => {
              return prompt(`Введите комментарий для файла ${file.name}:`)
            })

            // Добавляем файлы к задаче
            await Promise.all(
              fileUrls.map((url, index) =>
                axios.post(`${API_BASE_URL}5000/api/tasks/attachment/add`, {
                  task_id: taskId,
                  file_url: url,
                  file_type: files[index].type,
                  comment_file: comments[index],
                  name_file: files[index].name,
                  uploaded_by: userId,
                  tableType: 'global',
                })
              )
            )
            fetchAttachments()
          } catch (error) {
            console.error('Ошибка при добавлении файлов:', error)
            alert('Произошла ошибка при добавлении файлов.')
          }
        }
      }
      input.click()
    },
    [userId]
  )

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev)
  }

  return (
    <div
      ref={cardRef}
      className={`global-task-card ${getPriorityClass(priority)} `}
    >
      {/* Priority Label */}
      <div
        className={`global-task-card__priority-label ${getPriorityColorClass(
          priority
        )}`}
      >
        <FaExclamationCircle className="global-task-card__priority-icon" />
        {getPriorityLabel(priority)}
      </div>

      {/* Navigation Arrows */}
      <button
        className="global-task-card__nav-arrow global-task-card__nav-arrow--left"
        onClick={onPrevious}
        disabled={!hasPrevious}
      >
        <FaChevronLeft />
      </button>
      <button
        className="global-task-card__nav-arrow global-task-card__nav-arrow--right"
        onClick={onNext}
        disabled={!hasNext}
      >
        <FaChevronRight />
      </button>

      <div className="global-task-card__content">
        <div className="global-task-card__main-info">
          <h2 className="global-task-card__title">{title}</h2>
          <p className="global-task-card__description">{description}</p>

          {/* Цели */}
          <div className="global-task-card__goals">
            {goals.filter((goal) => goal.trim() !== '').length > 0 ? ( // Проверяем, есть ли непустые цели
              <>
                <h3 className="global-task-card__section-title">
                  <FaBullseye className="global-task-card__section-icon global-task-card__section-icon--blue" />{' '}
                  Цели задачи
                </h3>
                <div className="global-task-card__section-content">
                  <ul>
                    {goals
                      .filter((goal) => goal.trim() !== '')
                      .map(
                        (
                          goal,
                          index // Фильтруем и отображаем только непустые цели
                        ) => (
                          <li
                            key={index}
                            className="global-task-card__goal-item"
                          >
                            {goal}
                          </li>
                        )
                      )}
                  </ul>
                </div>
              </>
            ) : (
              <>
                <h3 className="global-task-card__section-title">
                  <FaBullseye className="global-task-card__section-icon global-task-card__section-icon--blue" />{' '}
                  Цели задачи
                </h3>
                <div className="global-task-card__section-content">
                  Цели установлены не были
                </div>
              </>
            )}
          </div>

          {/* Additional Info */}
          <div className="global-task-card__additional-info">
            <h3 className="global-task-card__section-title">
              <FaInfoCircle className="global-task-card__section-icon global-task-card__section-icon--purple" />{' '}
              Дополнительная информация
            </h3>
            <div className="global-task-card__section-content global-task-card__additional-info-grid">
              {/* Добавляем проверку на additionalInfo */}
              {additional_info && Object.keys(additional_info).length > 0 ? (
                Object.entries(additional_info).map(([key, value]) => (
                  <div key={key}>
                    <div className="global-task-card__additional-info-label">
                      {key}
                    </div>
                    <div className="global-task-card__additional-info-value">
                      {value}
                    </div>
                  </div>
                ))
              ) : (
                <p>Дополнительная информация отсутствует.</p>
              )}
            </div>
          </div>

          {/* Responsibles */}
          <div className="global-task-card__responsibles">
            <h3 className="global-task-card__section-title">
              <FaUsers className="global-task-card__section-icon global-task-card__section-icon--green" />{' '}
              Ответственные
            </h3>
            <div className="global-task-card__responsible-list">
              {responsibles.map((resp, index) => (
                <div
                  key={index}
                  className={`global-task-card__responsible-item ${
                    resp.color === 'blue'
                      ? 'global-task-card__responsible-item--blue'
                      : resp.color === 'purple'
                      ? 'global-task-card__responsible-item--purple'
                      : resp.color === 'green'
                      ? 'global-task-card__responsible-item--green'
                      : 'global-task-card__responsible-item--default'
                  }`}
                >
                  <div
                    className={`global-task-card__responsible-avatar ${getResponsibleColorClass(
                      resp.color
                    )}`}
                  >
                    {resp.initials}
                  </div>
                  <div>
                    <div className="global-task-card__responsible-name">
                      {resp.name}
                    </div>
                    <div
                      className={`global-task-card__responsible-role ${getResponsibleTextColorClass(
                        resp.color
                      )}`}
                    >
                      {resp.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="global-task-card__footer">
        <div className="global-task-card__footer-info">
          <div className="global-task-card__footer-item">
            <MdCalendarMonth className="global-task-card__footer-icon" />
            <span>
              Срок:{' '}
              {deadline
                ? new Date(deadline).toLocaleDateString('ru-RU')
                : 'Дата не указана'}
            </span>
          </div>
          {deadline && (
            <div className="global-task-card__footer-item">
              <MdAccessTime className="global-task-card__footer-icon" />
              <span>Осталось: {remainingDays}</span>
            </div>
          )}
        </div>

        <div className="global-task-card__footer-actions">
          <button className="global-task-card__footer-button">
            <FaPaperclip onClick={() => handleAddFile(id)} />{' '}
            {/*Логика добавления к карточке файлов*/}
          </button>
          <button
            className="global-task-card__footer-button"
            onClick={toggleMenu}
            ref={buttonRef}
          >
            <FaEllipsisH />
          </button>{' '}
          {isMenuOpen && (
            <div className="context-menu" ref={menuRef}>
              <ul>
                <li
                  onClick={() => {
                    setIsModalOpenResponsibles(true) // Открываем модальное окно
                  }}
                >
                  Добавить ответственного
                </li>
                <li onClick={handleOpenGoalsEditor}>Добавить цели</li>
                <li onClick={handleOpenAdditionalInfoEditor}>
                  Добавить доп. инфо
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {isModalOpenResponsibles && (
        <div ref={responsiblesRef}>
          <ResponsibleSelector
            responsibles={responsibles}
            onClose={() => setIsModalOpenResponsibles(false)}
            globalTaskId={id}
            onRefresh={onRefresh}
          />
        </div>
      )}

      {isGoalsEditorOpen && (
        <div ref={goalsRef}>
          <GoalsEditor
            currentGoals={goals}
            onCancel={handleCloseGoalsEditor}
            globalTaskId={id}
            onClose={() => setIsGoalsEditorOpen(false)}
            onRefresh={onRefresh}
          />
        </div>
      )}

      {isAdditionalInfoEditorOpen && (
        <div ref={additionalInfoRef}>
          <AdditionalInfoEditor
            currentInfo={additional_info}
            globalTaskId={id}
            onCancel={handleCloseAdditionalInfoEditor}
            onClose={() => setIsAdditionalInfoEditorOpen(false)}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  )
}

export default GlobalTaskCard
