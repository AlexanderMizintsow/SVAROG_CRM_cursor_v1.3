import React, { useState, useEffect } from 'react'
import { FaDownload, FaEye, FaFile, FaImage, FaTimes, FaSearch } from 'react-icons/fa'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../../config'
import './ChatFileManager.scss'

const ChatFileManager = ({ isOpen, onClose, taskId, currentUserId, messages }) => {
  const [files, setFiles] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('my-files') // Новая вкладка для разделения файлов

  // Загрузка файлов чата
  useEffect(() => {
    if (isOpen && taskId) {
      fetchChatFiles()
    }
  }, [isOpen, taskId])

  const fetchChatFiles = async () => {
    setLoading(true)
    try {
      // Загружаем файлы из новой таблицы chat_files
      const response = await axios.get(`${API_BASE_URL}5000/api/chat-files/${taskId}`)
      console.log('📁 Файлы из chat-files:', response.data)

      if (response.data.files && response.data.files.length > 0) {
        const formattedFiles = response.data.files.map((file) => ({
          id: file.id,
          original_name: file.original_name,
          file_path: file.file_path,
          file_url: `${API_BASE_URL}5000/api/task${file.file_path}`,
          file_type: file.file_type,
          file_size: file.file_size,
          is_image: file.is_image,
          sender_name: file.sender_name,
          created_at: file.created_at,
          uploaded_by: file.sender_id,
        }))
        setFiles(formattedFiles)
      } else {
        // Если файлов нет в chat_files, используем файлы из сообщений
        const filesFromMessages = messages
          .filter((msg) => msg.files && msg.files.length > 0)
          .flatMap((msg) =>
            msg.files.map((file) => ({
              id: `${msg.id}-${file.name}`,
              original_name: file.name,
              file_path: file.fileUrl
                ? file.fileUrl.replace(`${API_BASE_URL}5000/api/task`, '')
                : null,
              file_url: file.fileUrl,
              file_type: file.type,
              file_size: file.size,
              is_image: file.is_image,
              sender_name: msg.sender_name,
              created_at: msg.timestamp,
              uploaded_by: msg.sender_id,
            }))
          )
        setFiles(filesFromMessages)
      }
    } catch (error) {
      console.error('Ошибка при загрузке файлов чата:', error)
      // Fallback: используем файлы из сообщений
      const filesFromMessages = messages
        .filter((msg) => msg.files && msg.files.length > 0)
        .flatMap((msg) =>
          msg.files.map((file) => ({
            id: `${msg.id}-${file.name}`,
            original_name: file.name,
            file_path: file.fileUrl
              ? file.fileUrl.replace(`${API_BASE_URL}5000/api/task`, '')
              : null,
            file_url: file.fileUrl,
            file_type: file.type,
            file_size: file.size,
            is_image: file.is_image,
            sender_name: msg.sender_name,
            created_at: msg.timestamp,
            uploaded_by: msg.sender_id,
          }))
        )
      setFiles(filesFromMessages)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Б'
    const k = 1024
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileType, isImage) => {
    if (isImage) return <FaImage />
    if (fileType.includes('pdf')) return <FaFile />
    if (fileType.includes('word') || fileType.includes('document')) return <FaFile />
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return <FaFile />
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return <FaFile />
    if (fileType.includes('text')) return <FaFile />
    if (fileType.includes('zip') || fileType.includes('rar')) return <FaFile />
    return <FaFile />
  }

  const downloadFile = async (file) => {
    try {
      // Используем file_url если он есть, иначе формируем URL из file_path
      let downloadUrl
      if (file.file_url) {
        downloadUrl = file.file_url
      } else if (file.file_path) {
        downloadUrl = `${API_BASE_URL}5000/api/task${file.file_path}`
      } else {
        console.error('Нет URL для скачивания файла')
        return
      }

      const response = await axios.get(downloadUrl, {
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', file.original_name)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error)
      // Fallback: открываем в новой вкладке
      if (file.file_url) {
        window.open(file.file_url, '_blank')
      }
    }
  }

  const openImageModal = (file) => {
    setSelectedFile(file)
    setShowImageModal(true)
  }

  const closeImageModal = () => {
    setShowImageModal(false)
    setSelectedFile(null)
  }

  // Фильтрация и поиск файлов
  const filteredFiles = files.filter((file) => {
    // Фильтр по вкладкам (мои файлы / файлы от других)
    if (activeTab === 'my-files' && file.uploaded_by !== currentUserId) return false
    if (activeTab === 'others-files' && file.uploaded_by === currentUserId) return false

    // Фильтр по типу
    if (filter === 'images' && !file.is_image) return false
    if (filter === 'documents' && file.is_image) return false

    // Поиск по названию
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const fileName = file.original_name.toLowerCase()
      const senderName = file.sender_name.toLowerCase()
      return fileName.includes(query) || senderName.includes(query)
    }

    return true
  })

  // Разделение файлов по отправителям для статистики
  const myFiles = files.filter((file) => file.uploaded_by === currentUserId)
  const othersFiles = files.filter((file) => file.uploaded_by !== currentUserId)

  const handleClose = () => {
    setSearchQuery('')
    setFilter('all')
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div className="file-manager-overlay" onClick={handleClose}>
        <div className="file-manager-modal" onClick={(e) => e.stopPropagation()}>
          <div className="file-manager-header">
            <h3>Менеджер файлов чата</h3>
            <button className="close-btn" onClick={handleClose}>
              <FaTimes />
            </button>
          </div>

          <div className="file-manager-controls">
            <div className="tabs-container">
              <button
                className={`tab-btn ${activeTab === 'my-files' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-files')}
              >
                Мои файлы ({myFiles.length})
              </button>
              <button
                className={`tab-btn ${activeTab === 'others-files' ? 'active' : ''}`}
                onClick={() => setActiveTab('others-files')}
              >
                Файлы от других ({othersFiles.length})
              </button>
            </div>

            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Поиск по названию файла или отправителю..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Все файлы</option>
              <option value="images">Изображения</option>
              <option value="documents">Документы</option>
            </select>
          </div>

          <div className="files-container">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <span>Загрузка файлов...</span>
              </div>
            ) : filteredFiles.length > 0 ? (
              <div className="files-grid">
                {filteredFiles.map((file) => (
                  <div key={file.id} className="file-card">
                    <div className="file-preview">
                      {file.is_image ? (
                        <div className="image-preview" onClick={() => openImageModal(file)}>
                          <img
                            src={file.file_url || `${API_BASE_URL}5000/api/task${file.file_path}`}
                            alt={file.original_name}
                          />
                          <div className="preview-overlay">
                            <FaEye />
                          </div>
                        </div>
                      ) : (
                        <div className="document-preview">
                          {getFileIcon(file.file_type, file.is_image)}
                        </div>
                      )}
                    </div>

                    <div className="file-info">
                      <div className="file-name" title={file.original_name}>
                        {file.original_name}
                      </div>
                      <div className="file-details">
                        <span className="file-size">{formatFileSize(file.file_size)}</span>
                        <span className="file-sender">{file.sender_name}</span>
                        <span className="file-date">
                          {new Date(file.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>

                    <div className="file-actions">
                      {file.is_image && (
                        <button
                          className="action-btn view-btn"
                          onClick={() => openImageModal(file)}
                          title="Просмотреть"
                        >
                          <FaEye />
                        </button>
                      )}
                      <button
                        className="action-btn download-btn"
                        onClick={() => downloadFile(file)}
                        title="Скачать"
                      >
                        <FaDownload />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <FaFile className="empty-icon" />
                <span>Файлы не найдены</span>
                {searchQuery && (
                  <span className="search-hint">Попробуйте изменить поисковый запрос</span>
                )}
              </div>
            )}
          </div>

          <div className="file-manager-footer">
            <div className="files-summary">
              <span>Всего файлов: {files.length}</span>
              <span>Мои файлы: {myFiles.length}</span>
              <span>Файлы от других: {othersFiles.length}</span>
              <span>Показано: {filteredFiles.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно для просмотра изображений */}
      {showImageModal && selectedFile && (
        <div className="image-modal-overlay" onClick={closeImageModal}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-image-modal" onClick={closeImageModal}>
              <FaTimes />
            </button>
            <img
              src={selectedFile.file_url || `${API_BASE_URL}5000/api/task${selectedFile.file_path}`}
              alt={selectedFile.original_name}
            />
            <div className="image-info">
              <span>{selectedFile.original_name}</span>
              <button onClick={() => downloadFile(selectedFile)}>
                <FaDownload />
                Скачать
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ChatFileManager
