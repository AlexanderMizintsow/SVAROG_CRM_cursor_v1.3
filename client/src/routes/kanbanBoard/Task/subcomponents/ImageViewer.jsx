/**
 * Лайтбокс для просмотра изображений. Работает в браузере и в десктопе (Electron).
 * Закрытие: клик по оверлею, кнопка ×, Escape.
 * Рендер через портал в body выполняется в Attachments — это уменьшает мерцание при перерисовках родителя.
 */
import { useEffect, useRef } from 'react'
import { FaDownload } from 'react-icons/fa'
import './ImageViewer.scss'

const ImageViewer = ({ imageUrl, imageName, onClose, onDownload }) => {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div
      className="image-viewer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
    >
      <div className="image-viewer-box" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="image-viewer-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
        <img
          src={imageUrl}
          alt={imageName || 'Изображение'}
          className="image-viewer-img"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="image-viewer-footer">
          <span className="image-viewer-name" title={imageName}>
            {imageName}
          </span>
          {typeof onDownload === 'function' && (
            <button
              type="button"
              className="image-viewer-download"
              onClick={(e) => {
                e.stopPropagation()
                onDownload()
              }}
            >
              <FaDownload />
              Скачать
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageViewer
