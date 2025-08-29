import React, { useRef, useState } from 'react'
import { FaImage, FaFile, FaPaperclip } from 'react-icons/fa'
import './ChatFileUploader.scss'

const ChatFileUploader = ({ onSendFiles, onSendImages, isUploading }) => {
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFileSelect = (event, type = 'files') => {
    const files = Array.from(event.target.files)
    if (files.length === 0) return

    if (type === 'images') {
      onSendImages(files)
    } else {
      onSendFiles(files)
    }

    // Сбрасываем значение input для возможности повторного выбора тех же файлов
    event.target.value = ''
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const images = files.filter((file) => file.type.startsWith('image/'))
    const otherFiles = files.filter((file) => !file.type.startsWith('image/'))

    if (images.length > 0) {
      onSendImages(images)
    }
    if (otherFiles.length > 0) {
      onSendFiles(otherFiles)
    }
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  const openImageDialog = () => {
    imageInputRef.current?.click()
  }

  return (
    <div
      className={`chat-file-uploader ${dragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="upload-buttons">
        <button
          className="upload-btn file-btn"
          onClick={openFileDialog}
          disabled={isUploading}
          title="Прикрепить файлы"
        >
          <FaFile />
        </button>
        <button
          className="upload-btn image-btn"
          onClick={openImageDialog}
          disabled={isUploading}
          title="Прикрепить изображения"
        >
          <FaImage />
        </button>
      </div>

      {/* Скрытые input элементы */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => handleFileSelect(e, 'files')}
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.ppt,.pptx"
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        onChange={(e) => handleFileSelect(e, 'images')}
        style={{ display: 'none' }}
        accept="image/*"
      />

      {/* Индикатор перетаскивания */}
      {dragActive && (
        <div className="drag-overlay">
          <div className="drag-content">
            <FaPaperclip className="drag-icon" />
            <span>Отпустите файлы для загрузки</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatFileUploader
