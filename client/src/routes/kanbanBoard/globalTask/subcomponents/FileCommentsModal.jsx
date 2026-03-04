import { useState, useEffect } from 'react'
import { FaTimes } from 'react-icons/fa'
import './FileCommentsModal.scss'

const FileCommentsModal = ({ open, files = [], fileUrls = [], taskId, onClose, onConfirm }) => {
  const [comments, setComments] = useState([])

  useEffect(() => {
    if (open && files.length > 0) {
      setComments(files.map(() => ''))
    }
  }, [open, files])

  const handleCommentChange = (index, value) => {
    setComments((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleConfirm = () => {
    onConfirm(comments)
    onClose()
  }

  if (!open) return null

  return (
    <div className="file-comments-modal-overlay" onClick={onClose}>
      <div className="file-comments-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-comments-modal__header">
          <h3 className="file-comments-modal__title">Комментарии к файлам</h3>
          <button type="button" className="file-comments-modal__close" onClick={onClose} aria-label="Закрыть">
            <FaTimes />
          </button>
        </div>
        <p className="file-comments-modal__hint">Введите комментарий для каждого файла (или оставьте пустым)</p>
        <div className="file-comments-modal__list">
          {files.map((file, index) => (
            <label key={index} className="file-comments-modal__row">
              <span className="file-comments-modal__filename">{file.name}</span>
              <input
                type="text"
                className="file-comments-modal__input"
                value={comments[index] ?? ''}
                onChange={(e) => handleCommentChange(index, e.target.value)}
                placeholder="Комментарий"
              />
            </label>
          ))}
        </div>
        <div className="file-comments-modal__actions">
          <button type="button" className="file-comments-modal__btn-cancel" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="file-comments-modal__btn-confirm" onClick={handleConfirm}>
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}

export default FileCommentsModal
