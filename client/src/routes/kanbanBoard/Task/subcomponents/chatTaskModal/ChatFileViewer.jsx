import React, { useState } from 'react'
import axios from 'axios'
import { FaDownload, FaEye, FaFile, FaImage } from 'react-icons/fa'
import { API_BASE_URL } from '../../../../../../config'
import './ChatFileViewer.scss'

const ChatFileViewer = ({ files, messageId, taskId }) => {
  const [selectedImage, setSelectedImage] = useState(null)

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Б'
    const k = 1024
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return <FaImage />
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
      // Используем fileUrl если он есть, иначе формируем URL из file_path
      let downloadUrl
      if (file.fileUrl) {
        downloadUrl = file.fileUrl
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
      link.setAttribute('download', file.original_name || file.name)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error)
      // Fallback: открываем в новой вкладке
      if (file.fileUrl) {
        window.open(file.fileUrl, '_blank')
      }
    }
  }

  const openImageModal = (file) => {
    setSelectedImage(file)
  }

  const closeImageModal = () => {
    setSelectedImage(null)
  }

  return (
    <>
      <div className="message-files">
        {files.map((file, index) => (
          <div key={index} className="message-file">
            {file.type?.startsWith('image/') || file.is_image ? (
              // Изображение
              <div className="file-image" onClick={() => openImageModal(file)}>
                <img
                  src={
                    file.preview || file.fileUrl || `${API_BASE_URL}5000/api/task${file.file_path}`
                  }
                  alt={file.original_name || file.name}
                  className="image-preview"
                  style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'cover' }}
                />
                <div className="image-overlay">
                  <FaEye className="view-icon" />
                  <span>Просмотреть</span>
                </div>
              </div>
            ) : (
              // Документ
              <div className="file-document">
                <div className="file-icon">{getFileIcon(file.type)}</div>
                <div className="file-info">
                  <div className="file-name">{file.original_name || file.name}</div>
                  <div className="file-size">{formatFileSize(file.file_size || file.size)}</div>
                </div>
                <div className="file-actions">
                  <button
                    className="action-btn download-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadFile(file)
                    }}
                    title="Скачать файл"
                  >
                    <FaDownload />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Модальное окно для просмотра изображений */}
      {selectedImage && (
        <div className="image-modal-overlay" onClick={closeImageModal}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={closeImageModal}>
              ×
            </button>
            <img
              src={
                selectedImage.preview ||
                selectedImage.fileUrl ||
                `${API_BASE_URL}5000/api/task${selectedImage.file_path}`
              }
              alt={selectedImage.original_name || selectedImage.name}
              className="modal-image"
            />
            <div className="image-info">
              <span className="image-name">
                {selectedImage.original_name || selectedImage.name}
              </span>
              <button className="download-image-btn" onClick={() => downloadFile(selectedImage)}>
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

export default ChatFileViewer
