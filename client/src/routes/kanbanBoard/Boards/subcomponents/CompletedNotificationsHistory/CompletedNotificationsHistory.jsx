import React, { useState, useEffect } from 'react'
import axios from 'axios'

import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  FaDownload,
  FaEye,
  FaTimes,
  FaSearch,
  FaFilter,
  FaSort,
  FaSortUp,
  FaSortDown,
} from 'react-icons/fa'
import './CompletedNotificationsHistory.scss'
import { API_BASE_URL } from '../../../../../../config'

const CompletedNotificationsHistory = ({ isOpen, onClose, userId }) => {
  const [completedNotifications, setCompletedNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDealer, setSelectedDealer] = useState('')
  const [sortField, setSortField] = useState('completed_at')
  const [sortDirection, setSortDirection] = useState('desc')
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [dealers, setDealers] = useState([])
  const [fileLoadingStates, setFileLoadingStates] = useState({})
  const [fileAvailabilityStates, setFileAvailabilityStates] = useState({})
  const [isRefreshingFiles, setIsRefreshingFiles] = useState(false)
  const [networkError, setNetworkError] = useState(false)
  const [connectionRestored, setConnectionRestored] = useState(false)

  useEffect(() => {
    if (isOpen && userId) {
      fetchCompletedNotifications()
      fetchDealers()
    }
  }, [isOpen, userId])

  const fetchCompletedNotifications = async () => {
    setLoading(true)
    try {
      const response = await axios.get(
        `${API_BASE_URL}5004/api/completed-notifications?userId=${userId}`
      )
      setCompletedNotifications(response.data)
    } catch (error) {
      console.error('Ошибка при получении истории завершенных уведомлений:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDealers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5004/api/dealers`)
      setDealers(response.data)
    } catch (error) {
      console.error('Ошибка при получении списка дилеров:', error)
    }
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field) => {
    if (sortField !== field) return <FaSort />
    return sortDirection === 'asc' ? <FaSortUp /> : <FaSortDown />
  }

  const filteredAndSortedNotifications = completedNotifications
    .filter((notification) => {
      const matchesSearch =
        notification.dealer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.request_description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDealer = !selectedDealer || notification.dealer_name === selectedDealer
      return matchesSearch && matchesDealer
    })
    .sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]

      if (sortField === 'completed_at' || sortField === 'created_at') {
        aValue = new Date(aValue)
        bValue = new Date(bValue)
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'dd.MM.yyyy HH:mm', { locale: ru })
    } catch {
      return 'Неверная дата'
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return 'Размер неизвестен'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Функция для проверки доступности файла
  const checkFileAvailability = async (fileName) => {
    if (!fileName) {
      console.warn('checkFileAvailability: fileName не указан')
      return false
    }

    // Проверяем, что имя файла не содержит только подчеркивания или другие некорректные символы
    if (fileName.replace(/[_.-]/g, '').trim() === '') {
      console.warn(`checkFileAvailability: некорректное имя файла: "${fileName}"`)
      return false
    }

    try {
      console.log(`Проверяем доступность файла: "${fileName}"`)

      // Проверяем доступность файла через HEAD запрос
      const response = await axios.head(`${API_BASE_URL}5000/api/task/download/${fileName}`, {
        timeout: 5000,
      })

      console.log(`Файл "${fileName}" доступен, статус: ${response.status}`)
      return response.status === 200
    } catch (error) {
      if (error.response?.status === 404) {
        console.warn(`Файл "${fileName}" не найден на сервере (404)`)
      } else if (error.code === 'ECONNABORTED') {
        console.warn(`Превышено время ожидания при проверке файла "${fileName}"`)
      } else {
        console.error(`Ошибка при проверке файла "${fileName}":`, error)
      }
      return false
    }
  }

  // Функция для скачивания файла
  const handleDownloadFile = async (fileName) => {
    if (!fileName) {
      alert('Ошибка: имя файла не указано')
      return
    }

    try {
      // Проверяем доступность файла перед скачиванием
      const isAvailable = await checkFileAvailability(fileName)
      if (!isAvailable) {
        alert('Файл недоступен для скачивания. Возможно, он был удален или перемещен.')
        return
      }

      // Создаем URL для скачивания
      const downloadUrl = `${API_BASE_URL}5000/api/task/download/${fileName}`

      // Создаем временную ссылку и кликаем по ней
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Обновляем статус файла
      setFileAvailabilityStates((prev) => ({
        ...prev,
        [fileName]: true,
      }))
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error)

      if (error.code === 'ECONNABORTED') {
        alert('Превышено время ожидания. Проверьте подключение к интернету.')
      } else if (error.response?.status === 404) {
        alert('Файл не найден на сервере. Возможно, он был удален.')
      } else if (error.response?.status === 500) {
        alert('Ошибка сервера при скачивании файла. Попробуйте позже.')
      } else {
        alert('Произошла ошибка при скачивании файла. Проверьте подключение к интернету.')
      }
    }
  }

  // Функция для просмотра файла
  const handleViewFile = async (fileName) => {
    if (!fileName) {
      alert('Ошибка: имя файла не указано')
      return
    }

    try {
      // Проверяем доступность файла перед просмотром
      const isAvailable = await checkFileAvailability(fileName)
      if (!isAvailable) {
        alert('Файл недоступен для просмотра. Возможно, он был удален или перемещен.')
        return
      }

      // Создаем URL для просмотра
      const viewUrl = `${API_BASE_URL}5000/api/task/uploads/${fileName}`

      // Открываем файл в новой вкладке
      window.open(viewUrl, '_blank')

      // Обновляем статус файла
      setFileAvailabilityStates((prev) => ({
        ...prev,
        [fileName]: true,
      }))
    } catch (error) {
      console.error('Ошибка при просмотре файла:', error)

      if (error.code === 'ECONNABORTED') {
        alert('Превышено время ожидания. Проверьте подключение к интернету.')
      } else if (error.response?.status === 404) {
        alert('Файл не найден на сервере. Возможно, он был удален.')
      } else if (error.response?.status === 500) {
        alert('Ошибка сервера при просмотре файла. Попробуйте позже.')
      } else {
        alert('Произошла ошибка при просмотре файла. Проверьте подключение к интернету.')
      }
    }
  }

  // Функция для открытия детального просмотра уведомления
  const handleViewDetails = async (notification) => {
    setSelectedNotification(notification)
    console.log('Открываем детали уведомления:', notification)

    // Проверяем доступность всех файлов в выбранном уведомлении
    if (notification.messages && notification.messages.length > 0) {
      console.log('Сообщения уведомления:', notification.messages)

      const allFiles = notification.messages
        .filter((message) => message.sent_files && message.sent_files.length > 0)
        .flatMap((message) => message.sent_files)

      console.log('Все файлы для проверки:', allFiles)

      if (allFiles.length > 0) {
        // Проверяем доступность каждого файла
        const fileAvailabilityPromises = allFiles.map(async (fileName) => {
          console.log(`Проверяем файл: "${fileName}"`)
          const isAvailable = await checkFileAvailability(fileName)
          return { fileName, isAvailable }
        })

        const results = await Promise.all(fileAvailabilityPromises)
        console.log('Результаты проверки файлов:', results)

        // Обновляем состояния доступности файлов
        const newAvailabilityStates = {}
        results.forEach(({ fileName, isAvailable }) => {
          newAvailabilityStates[fileName] = isAvailable
        })

        setFileAvailabilityStates((prev) => ({
          ...prev,
          ...newAvailabilityStates,
        }))
      }
    }
  }

  // Функция для обновления статусов файлов
  const refreshFileStatuses = async () => {
    if (!selectedNotification) return

    setIsRefreshingFiles(true)
    setNetworkError(false)

    try {
      // Получаем все файлы из выбранного уведомления
      const allFiles = selectedNotification.messages
        .filter((message) => message.sent_files && message.sent_files.length > 0)
        .flatMap((message) => message.sent_files)

      if (allFiles.length > 0) {
        // Проверяем доступность каждого файла
        const fileAvailabilityPromises = allFiles.map(async (fileName) => {
          const isAvailable = await checkFileAvailability(fileName)
          return { fileName, isAvailable }
        })

        const results = await Promise.all(fileAvailabilityPromises)

        // Обновляем состояния доступности файлов
        const newAvailabilityStates = {}
        results.forEach(({ fileName, isAvailable }) => {
          newAvailabilityStates[fileName] = isAvailable
        })

        setFileAvailabilityStates((prev) => ({
          ...prev,
          ...newAvailabilityStates,
        }))

        // Проверяем, есть ли недоступные файлы
        const unavailableCount = results.filter((result) => !result.isAvailable).length

        if (unavailableCount === 0) {
          setConnectionRestored(true)
          setTimeout(() => setConnectionRestored(false), 5000)
        }
      }
    } catch (error) {
      console.error('Ошибка при обновлении статусов файлов:', error)
      setNetworkError(true)
    } finally {
      setIsRefreshingFiles(false)
    }
  }

  // Функция для закрытия детального просмотра
  const closeDetails = () => {
    setSelectedNotification(null)
    setFileAvailabilityStates({})
    setFileLoadingStates({})
    setNetworkError(false)
    setConnectionRestored(false)
    setIsRefreshingFiles(false)
  }

  // Функция для извлечения оригинального имени файла (убирает временную метку)
  const extractOriginalFileName = (filename) => {
    if (!filename) return 'Без имени'

    // Убираем временную метку в начале файла (например, "1755765158740-")
    const match = filename.match(/^\d+-(.+)$/)
    if (match) {
      return match[1]
    }
    return filename
  }

  // Функция для получения полного имени файла (с временной меткой для технических операций)
  const getFullFileName = (filename) => {
    return filename || 'Без имени'
  }

  if (!isOpen) return null

  return (
    <div className="completed-notifications-history-overlay">
      <div className="completed-notifications-history-modal">
        <div className="modal-header">
          <h2>История завершенных уведомлений</h2>
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="filters-section">
          <div className="search-filter">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Поиск по дилеру или описанию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="dealer-filter">
            <FaFilter className="filter-icon" />
            <select value={selectedDealer} onChange={(e) => setSelectedDealer(e.target.value)}>
              <option value="">Все дилеры</option>
              {dealers.map((dealer) => (
                <option key={dealer.id} value={dealer.name}>
                  {dealer.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="notifications-table">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('dealer_name')}>
                  Дилер {getSortIcon('dealer_name')}
                </th>
                <th onClick={() => handleSort('request_description')}>
                  Описание {getSortIcon('request_description')}
                </th>
                <th onClick={() => handleSort('priority')}>Приоритет {getSortIcon('priority')}</th>
                <th onClick={() => handleSort('created_at')}>
                  Создано {getSortIcon('created_at')}
                </th>
                <th onClick={() => handleSort('completed_at')}>
                  Завершено {getSortIcon('completed_at')}
                </th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="loading">
                    Загрузка...
                  </td>
                </tr>
              ) : filteredAndSortedNotifications.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data">
                    Нет завершенных уведомлений
                  </td>
                </tr>
              ) : (
                filteredAndSortedNotifications.map((notification) => (
                  <tr key={notification.id}>
                    <td>{notification.dealer_name}</td>
                    <td className="description-cell">
                      <div className="description-text">
                        {notification.request_description.length > 100
                          ? `${notification.request_description.substring(0, 100)}...`
                          : notification.request_description}
                      </div>
                    </td>
                    <td>
                      <span className={`priority-badge priority-${notification.priority}`}>
                        {notification.priority}
                      </span>
                    </td>
                    <td>{formatDate(notification.created_at)}</td>
                    <td>{formatDate(notification.completed_at)}</td>
                    <td>
                      <button
                        className="action-button view-button"
                        onClick={() => handleViewDetails(notification)}
                        title="Просмотр деталей"
                      >
                        <FaEye />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Модальное окно с деталями */}
        {selectedNotification && (
          <div className="details-modal-overlay">
            <div className="details-modal">
              <div className="details-header">
                <div className="header-content">
                  <h3>📋 Детали уведомления</h3>
                  <div className="notification-meta">
                    <span className="dealer-badge">{selectedNotification.dealer_name}</span>
                    <span className={`priority-badge priority-${selectedNotification.priority}`}>
                      {selectedNotification.priority}
                    </span>
                  </div>
                </div>
                <button className="close-button" onClick={closeDetails}>
                  <FaTimes />
                </button>
              </div>

              <div className="details-content">
                {/* Основная информация */}
                <div className="detail-section main-info">
                  <div className="section-header">
                    <h4>📌 Основная информация</h4>
                  </div>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Описание:</span>
                      <span className="info-value">{selectedNotification.request_description}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Создано:</span>
                      <span className="info-value">
                        {formatDate(selectedNotification.created_at)}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Завершено:</span>
                      <span className="info-value">
                        {formatDate(selectedNotification.completed_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Временная шкала событий */}
                <div className="detail-section timeline-section">
                  <div className="section-header-with-actions">
                    <h4>⏰ Временная шкала событий</h4>
                    <button
                      className="refresh-button"
                      onClick={refreshFileStatuses}
                      title="Обновить статус файлов"
                      disabled={isRefreshingFiles}
                    >
                      {isRefreshingFiles ? (
                        <span className="loading-spinner">⏳</span>
                      ) : (
                        '🔄 Обновить'
                      )}
                    </button>
                  </div>

                  {selectedNotification.messages && selectedNotification.messages.length > 0 ? (
                    <div className="timeline-container">
                      {(() => {
                        // Получаем уникальные сообщения (без дублирования)
                        const uniqueMessages = new Map()
                        selectedNotification.messages.forEach((message) => {
                          const messageKey = `${message.sent_text || ''}_${(
                            message.sent_files || []
                          ).join(',')}`
                          if (!uniqueMessages.has(messageKey)) {
                            uniqueMessages.set(messageKey, message)
                          }
                        })

                        return Array.from(uniqueMessages.values())
                          .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at))
                          .map((message, index) => {
                            const hasText = message.sent_text && message.sent_text.trim()
                            const hasFiles = message.sent_files && message.sent_files.length > 0

                            // Получаем уникальные файлы для этого сообщения
                            const uniqueFiles = new Map()
                            if (hasFiles) {
                              message.sent_files.forEach((fileName) => {
                                const originalName = extractOriginalFileName(fileName)
                                if (!uniqueFiles.has(originalName)) {
                                  uniqueFiles.set(originalName, fileName)
                                }
                              })
                            }

                            return (
                              <div key={index} className="timeline-item">
                                <div className="timeline-marker">
                                  <div className="marker-dot"></div>
                                  <div className="marker-line"></div>
                                </div>

                                <div className="timeline-content">
                                  <div className="timeline-header">
                                    <span className="timeline-time">
                                      {formatDate(message.sent_at)}
                                    </span>
                                    <div className="timeline-actions">
                                      {hasText && (
                                        <span className="action-badge text-badge">📝 Текст</span>
                                      )}
                                      {hasFiles && (
                                        <span className="action-badge files-badge">
                                          📎 Файлы ({uniqueFiles.size})
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Текстовое сообщение */}
                                  {hasText && (
                                    <div className="message-text-container">
                                      <div className="text-content">
                                        <span className="text-label">Сообщение:</span>
                                        <span className="text-value">{message.sent_text}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Файлы */}
                                  {hasFiles && (
                                    <div className="files-container">
                                      <div className="files-header">
                                        <span className="files-label">Прикрепленные файлы:</span>
                                        <div className="files-summary">
                                          {(() => {
                                            const uniqueFileNames = Array.from(uniqueFiles.values())
                                            const availableFiles = uniqueFileNames.filter(
                                              (fileName) =>
                                                fileAvailabilityStates[fileName] === true
                                            ).length
                                            const unavailableFiles = uniqueFileNames.filter(
                                              (fileName) =>
                                                fileAvailabilityStates[fileName] === false
                                            ).length
                                            const uncheckedFiles =
                                              uniqueFileNames.length -
                                              availableFiles -
                                              unavailableFiles

                                            return (
                                              <span className="files-status">
                                                {availableFiles > 0 && (
                                                  <span className="available">
                                                    ✓ {availableFiles}
                                                  </span>
                                                )}
                                                {unavailableFiles > 0 && (
                                                  <span className="unavailable">
                                                    ✗ {unavailableFiles}
                                                  </span>
                                                )}
                                                {uncheckedFiles > 0 && (
                                                  <span className="unchecked">
                                                    ? {uncheckedFiles}
                                                  </span>
                                                )}
                                              </span>
                                            )
                                          })()}
                                        </div>
                                      </div>

                                      <div className="files-list">
                                        {Array.from(uniqueFiles.values()).map(
                                          (fileName, fileIndex) => {
                                            const isAvailable = fileAvailabilityStates[fileName]
                                            const isLoading = fileLoadingStates[`check_${fileName}`]
                                            const isInvalidFileName =
                                              !fileName ||
                                              fileName.replace(/[_.-]/g, '').trim() === ''

                                            return (
                                              <div key={fileIndex} className="file-item">
                                                <div className="file-info">
                                                  <span
                                                    className={`file-name ${
                                                      isInvalidFileName ? 'invalid-filename' : ''
                                                    }`}
                                                  >
                                                    {extractOriginalFileName(fileName) ||
                                                      'Без имени'}
                                                    {isInvalidFileName && (
                                                      <span
                                                        className="invalid-filename-warning"
                                                        title="Некорректное имя файла"
                                                      >
                                                        ⚠️
                                                      </span>
                                                    )}
                                                  </span>

                                                  <div className="file-status">
                                                    {isInvalidFileName ? (
                                                      <span className="status-invalid">
                                                        ⚠️ Некорректное имя файла
                                                      </span>
                                                    ) : isLoading ? (
                                                      <span className="status-checking">
                                                        Проверка доступности...
                                                      </span>
                                                    ) : isAvailable === true ? (
                                                      <span className="status-available">
                                                        ✓ Доступен
                                                      </span>
                                                    ) : isAvailable === false ? (
                                                      <span className="status-unavailable">
                                                        ✗ Недоступен
                                                      </span>
                                                    ) : (
                                                      <span className="status-unknown">
                                                        ? Не проверен
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>

                                                <div className="file-actions">
                                                  <button
                                                    className="action-button download-button"
                                                    onClick={() => handleDownloadFile(fileName)}
                                                    disabled={
                                                      isAvailable === false ||
                                                      isLoading ||
                                                      isInvalidFileName
                                                    }
                                                    title={
                                                      isInvalidFileName
                                                        ? 'Некорректное имя файла'
                                                        : isAvailable === false
                                                        ? 'Файл недоступен'
                                                        : isLoading
                                                        ? 'Проверка доступности...'
                                                        : 'Скачать файл'
                                                    }
                                                  >
                                                    {isLoading ? (
                                                      <span className="loading-spinner">⏳</span>
                                                    ) : (
                                                      '📥'
                                                    )}
                                                  </button>
                                                  <button
                                                    className="action-button view-button"
                                                    onClick={() => handleViewFile(fileName)}
                                                    disabled={
                                                      isAvailable === false ||
                                                      isLoading ||
                                                      isInvalidFileName
                                                    }
                                                    title={
                                                      isInvalidFileName
                                                        ? 'Некорректное имя файла'
                                                        : isAvailable === false
                                                        ? 'Файл недоступен'
                                                        : isLoading
                                                        ? 'Проверка доступности...'
                                                        : 'Просмотреть файл'
                                                    }
                                                  >
                                                    {isLoading ? (
                                                      <span className="loading-spinner">⏳</span>
                                                    ) : (
                                                      '👁️'
                                                    )}
                                                  </button>
                                                </div>
                                              </div>
                                            )
                                          }
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                      })()}
                    </div>
                  ) : (
                    <div className="no-messages">
                      <span className="no-messages-icon">📭</span>
                      <span className="no-messages-text">Нет отправленных сообщений</span>
                    </div>
                  )}
                </div>

                {/* Сетевые уведомления */}
                {(networkError || connectionRestored) && (
                  <div className="network-notifications">
                    {networkError && (
                      <div className="network-error-info">
                        <span className="error-icon">⚠️</span>
                        <span>Проблемы с подключением к серверу. Файлы могут быть недоступны.</span>
                        <button
                          className="retry-button"
                          onClick={refreshFileStatuses}
                          disabled={isRefreshingFiles}
                        >
                          {isRefreshingFiles ? (
                            <span className="loading-spinner">⏳</span>
                          ) : (
                            '🔄 Повторить'
                          )}
                        </button>
                      </div>
                    )}
                    {connectionRestored && (
                      <div className="connection-restored-info">
                        <span className="success-icon">✅</span>
                        <span>Подключение к серверу восстановлено!</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CompletedNotificationsHistory
