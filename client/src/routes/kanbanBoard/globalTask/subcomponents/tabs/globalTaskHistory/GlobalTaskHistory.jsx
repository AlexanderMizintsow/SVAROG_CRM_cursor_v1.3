import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { FaHistory } from 'react-icons/fa'
import { FaPlus } from 'react-icons/fa'
import './GlobalTaskHistory.scss'
import { FaPencilAlt } from 'react-icons/fa'
import { IoMdPause } from 'react-icons/io'
import { IoMdSkipBackward } from 'react-icons/io'
import { IoPlaySkipForwardSharp } from 'react-icons/io5'
import { FaPlay } from 'react-icons/fa'
import { FaQuestion } from 'react-icons/fa'
import { TbSubtask } from 'react-icons/tb'
import { MdDone } from 'react-icons/md'
import { BiSolidError } from 'react-icons/bi'
import { API_BASE_URL } from '../../../../../../../config'
import SearchBar from '../../../../../../components/searchBar/SearchBar'

const GlobalTaskHistory = ({ taskId, refreshHistory }) => {
  const [history, setHistory] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('Сегодня') // 'Сегодня', 'Неделя', 'Месяц', 'Все'м
  const itemsPerPage = 5

  useEffect(() => {
    setHistory(refreshHistory)
  }, [taskId, refreshHistory])

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}5000/api/global-task/${taskId}/history`)
      .then((res) => setHistory(res.data))
      .catch((err) => console.error('Ошибка загрузки истории:', err))
  }, [taskId])

  // Фильтрация по дате
  const filterHistoryByDate = () => {
    const now = new Date()
    return history.filter((event) => {
      const eventDate = new Date(event.created_at)
      if (filterType === 'Все') return true
      if (filterType === 'Сегодня') {
        return now.toDateString() === eventDate.toDateString()
      }
      if (filterType === 'Неделя') {
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay()) // начало недели
        return eventDate >= startOfWeek
      }
      if (filterType === 'Месяц') {
        return (
          now.getFullYear() === eventDate.getFullYear() &&
          now.getMonth() === eventDate.getMonth()
        )
      }
      return true
    })
  }

  const filteredHistory = filterHistoryByDate().filter((event) => {
    if (!searchTerm) return true // если поиск пустой, показываем все
    const searchLower = searchTerm.toLowerCase()
    const eventText = (
      event.event_type +
      (event.description || '') +
      (event.first_name + ' ' + event.last_name || '') +
      // Можно добавить другие поля, если нужно
      JSON.stringify(event.data || {})
    ).toLowerCase()
    return eventText.includes(searchLower)
  })

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage)

  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const pageNumbers = []
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i)
  }

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1)
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
  }

  const handlePageChange = (num) => {
    setCurrentPage(num)
  }

  const handleFilterChange = (type) => {
    setFilterType(type)
    setCurrentPage(1)
  }

  // Определяем иконки и цвета для типов событий
  const getEventIconAndColor = (event_type) => {
    switch (event_type.toLowerCase()) {
      case 'создание':
        return {
          icon: <FaPlus />,
          colorClass: 'bg-indigo',
          colorClassIcon: 'bg-indigo-icon',
        }
      case 'подзадача':
        return {
          icon: <TbSubtask />,
          colorClass: 'bg-yellow',
          colorClassIcon: 'bg-yellow-icon',
        }
      case 'завершение подзадачи':
        return {
          icon: <TbSubtask />,
          colorClass: 'bg-yellow',
          colorClassIcon: 'bg-green-icon',
        }
      case 'обновление':
        return {
          icon: <FaPencilAlt />,
          colorClass: 'bg-indigo',
          colorClassIcon: 'bg-indigo-icon',
        }
      case 'провал':
        return {
          icon: <BiSolidError />,
          colorClass: 'bg-red',
          colorClassIcon: 'bg-red-icon',
        }
      case 'пауза':
        return {
          icon: <IoMdPause />,
          colorClass: 'bg-pause',
          colorClassIcon: 'bg-pause-icon',
        }
      case 'продолжить':
        return {
          icon: <FaPlay />,
          colorClass: 'bg-play',
          colorClassIcon: 'bg-play-icon',
        }
      case 'завершено':
        return {
          icon: <MdDone />,
          colorClass: 'bg-emerald-icon',
          colorClassIcon: 'bg-emerald',
        }
      default:
        return {
          icon: <FaQuestion />,
          colorClass: 'bg-purple-icon',
          colorClassIcon: 'bg-purple',
        }
    }
  }

  return (
    <div className="history-container">
      <div className="card">
        {/* Заголовок */}
        <div className="header">
          <h2 className="title">
            <FaHistory style={{ marginRight: '20px', color: 'blue' }} /> История
            изменений проекта
          </h2>
          <div className="header-buttons">
            <SearchBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              placeholder="Поиск по событиям..."
              transform="0" // или другой трансформ для позиционирования
            />
          </div>
        </div>

        {/* Фильтры по дате и счетчик */}
        <div className="filters">
          <div className="flex date-buttons">
            {['Сегодня', 'Неделя', 'Месяц', 'Все'].map((type) => (
              <button
                key={type}
                className={`date-btn ${filterType === type ? 'active' : ''}`}
                onClick={() => handleFilterChange(type)}
              >
                {type}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="prev-btn"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              <span className="history-next">
                <IoMdSkipBackward /> Назад{' '}
              </span>
            </button>
            <button
              className="next-btn"
              onClick={handleNextPage}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <span className="history-next">
                Вперед <IoPlaySkipForwardSharp />
              </span>
            </button>
          </div>
          <div className="event-count">
            <i className="fas fa-info-circle"></i> Всего событий:{' '}
            <span className="count">{history.length}</span>
          </div>
        </div>

        {/* Список событий */}
        <div className="p-6">
          <div className="events-list">
            {/* Линия времени */}
            {history.length !== 0 && <div className="timeline-line"></div>}
            {history.length === 0 ? (
              <p>Нет данных для отображения</p>
            ) : (
              paginatedHistory.map((event) => {
                const { icon, colorClass, colorClassIcon } =
                  getEventIconAndColor(event.event_type)
                const createdAt = new Date(event.created_at)
                const timeString = `${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString()}`

                const creatorName =
                  event.first_name + ' ' + event.last_name || 'Неизвестный'

                // Детали
                const description = event.description || ''
                const data = event.data || {}

                // Формируем описание
                let eventDetails = ''
                const renderEventDetails = () => {
                  // Проверка, является ли событие строкой
                  if (typeof eventDetails === 'string') {
                    // Проверка на наличие ключевых фраз
                    const isChangeInfo =
                      eventDetails.startsWith(
                        'Добавлена дополнительная информация'
                      ) ||
                      eventDetails.startsWith(
                        'Удалена дополнительная информация'
                      )

                    if (isChangeInfo) {
                      // Разделяем строку по предложениям или запятым
                      // Например, по запятым, чтобы разбить на части
                      const parts = eventDetails.split(/(?<=\.)\s*/) // разбивать по точкам + пробелам

                      return (
                        <div className="change-info-block">
                          {parts.map((part, index) => (
                            <p key={index} className="change-info-part">
                              {part}
                            </p>
                          ))}
                        </div>
                      )
                    } else {
                      // обычное строковое описание
                      return <div className="event-details">{eventDetails}</div>
                    }
                  }

                  // Если это JSX или массив, оставить как есть
                  const isArrayOrJSX =
                    Array.isArray(eventDetails) ||
                    React.isValidElement(eventDetails)
                  if (isArrayOrJSX) {
                    return (
                      <div className="change-summary-block">
                        {React.isValidElement(eventDetails)
                          ? eventDetails
                          : null}
                        {/* Можно оставить как есть или дополнительно обработать */}
                      </div>
                    )
                  }

                  // В остальных случаях — просто строка
                  return <div className="event-details">{eventDetails}</div>
                }

                switch (event.event_type.toLowerCase()) {
                  case 'создание':
                    eventDetails = description || 'Создана новая задача.'
                    break
                  case 'обновление':
                    if (Object.keys(data).length > 0) {
                      eventDetails = Object.entries(data).map(
                        ([key, value]) => (
                          <div key={key} className="diffs">
                            <span className="diff-label">{key}:</span>
                            <div>
                              {Object.entries(value).map(
                                ([changeType, changeVal], idx) => (
                                  <div
                                    key={idx}
                                    className={`diff diff-${changeType}`}
                                  >
                                    <strong>
                                      {changeType === 'old_value'
                                        ? 'Старое'
                                        : 'Новое'}
                                      :
                                    </strong>{' '}
                                    {JSON.stringify(changeVal)}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )
                      )
                    } else {
                      eventDetails = description || 'Обновление'
                    }
                    break
                  case 'завершение':
                    eventDetails = description || 'Задача завершена.'
                    break
                  case 'ошибка':
                    eventDetails = description || 'Произошла ошибка.'
                    break
                  case 'комментарий':
                    eventDetails = description || 'Добавлен комментарий.'
                    break
                  default:
                    eventDetails = description || ''
                }

                return (
                  <div key={event.id} className="history-item">
                    {/* Иконка */}
                    <div className={`event-icon ${colorClassIcon}`}>{icon}</div>
                    {/* Контент */}
                    <div className="event-content">
                      {/* Заголовок и время */}
                      <div className="event-header">
                        <span className="event-title">{event.event_type}</span>
                        <div className="event-time">
                          <i className="far fa-clock"></i> {timeString}
                        </div>
                      </div>
                      {/* Детали */}
                      <div className="event-details">
                        {renderEventDetails()} {/*eventDetails*/}
                      </div>
                      {/* Автор */}
                      <div className="event-author">
                        <div className={`avatar ${colorClass}`}>
                          {creatorName[0]}
                        </div>
                        <span className="author-name">{creatorName}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {/* Пагинация */}
          <div className="pagination">
            <div className="page-numbers">
              {pageNumbers.map((num) => (
                <button
                  key={num}
                  className={`page-number ${
                    currentPage === num ? 'active' : ''
                  }`}
                  onClick={() => handlePageChange(num)}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GlobalTaskHistory
