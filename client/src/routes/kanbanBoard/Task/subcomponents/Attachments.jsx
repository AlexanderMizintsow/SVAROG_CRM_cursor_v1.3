import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE_URL } from '../../../../../config'
import { FaFile, FaDownload, FaExternalLinkAlt, FaFileImage } from 'react-icons/fa'
import ImageViewer from './ImageViewer'
import './attachments.scss'

const isPdf = (fileType, fileName) => {
  if (fileType && (fileType === 'application/pdf' || fileType.includes('pdf'))) return true
  return fileName && fileName.toLowerCase().endsWith('.pdf')
}

/**
 * Формирует URL файла. Один и тот же код для веба и десктопа (Electron).
 */
const getFileUrl = (filePath) => {
  if (!filePath) return ''
  const base = `${API_BASE_URL}5000/api/task`
  const path = filePath.startsWith('/') ? filePath : `/${filePath}`
  return encodeURI(`${base}${path}`)
}

const Attachments = ({ attachments, compact = false }) => {
  const [viewingImage, setViewingImage] = useState(null)
  const handleCloseViewer = useCallback(() => setViewingImage(null), [])

  const handleDownload = useCallback(async (fileUrl, fileName) => {
    try {
      const response = await fetch(fileUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'file'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Ошибка при скачивании файла:', err)
      window.open(fileUrl, '_blank', 'noopener,noreferrer')
    }
  }, [])

  if (!attachments || attachments.length === 0) return null

  return (
    <div className="attachments">
      {attachments.map((attachment, index) => {
        const isImage = attachment.file_type && attachment.file_type.startsWith('image/')
        const fileUrl = getFileUrl(attachment.file_url)
        const fileName = attachment.name_file || `Файл ${index + 1}`
        const comment = attachment.comment_file

        return (
          <div
            key={index}
            className="attachment-item"
            title={comment ? `${fileName} — ${comment}` : fileName}
          >
            {isImage && !compact ? (
              <>
                <button
                  type="button"
                  className="attachment-thumb-wrap"
                  onClick={() => setViewingImage({ fileUrl, fileName })}
                  aria-label={`Просмотреть ${fileName}`}
                >
                  <img
                    src={fileUrl}
                    alt=""
                    className="attachment-thumb"
                    loading="lazy"
                  />
                  <span className="attachment-thumb-label">Просмотр</span>
                </button>
                <div className="attachment-meta">
                  <span className="attachment-name" title={fileName}>
                    {fileName}
                  </span>
                  <button
                    type="button"
                    className="attachment-download-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownload(fileUrl, fileName)
                    }}
                    title="Скачать"
                    aria-label={`Скачать ${fileName}`}
                  >
                    <FaDownload />
                  </button>
                </div>
              </>
            ) : isImage && compact ? (
              <div className="attachment-file-row">
                <FaFileImage className="attachment-file-icon" aria-hidden />
                <span className="attachment-name" title={fileName}>
                  {fileName}
                </span>
                <div className="attachment-file-actions">
                  <button
                    type="button"
                    className="attachment-open-btn"
                    onClick={() => setViewingImage({ fileUrl, fileName })}
                    title="Просмотреть"
                    aria-label={`Просмотреть ${fileName}`}
                  >
                    <FaExternalLinkAlt />
                  </button>
                  <button
                    type="button"
                    className="attachment-download-btn"
                    onClick={() => handleDownload(fileUrl, fileName)}
                    title="Скачать"
                    aria-label={`Скачать ${fileName}`}
                  >
                    <FaDownload />
                  </button>
                </div>
              </div>
            ) : (
              <div className="attachment-file-row">
                <FaFile className="attachment-file-icon" aria-hidden />
                <span className="attachment-name" title={fileName}>
                  {fileName}
                </span>
                <div className="attachment-file-actions">
                  {isPdf(attachment.file_type, fileName) && (
                    <button
                      type="button"
                      className="attachment-open-btn"
                      onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}
                      title="Открыть PDF"
                      aria-label={`Открыть ${fileName}`}
                    >
                      <FaExternalLinkAlt />
                    </button>
                  )}
                  <button
                    type="button"
                    className="attachment-download-btn"
                    onClick={() => handleDownload(fileUrl, fileName)}
                    title="Скачать"
                    aria-label={`Скачать ${fileName}`}
                  >
                    <FaDownload />
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {viewingImage &&
        createPortal(
          <ImageViewer
            imageUrl={viewingImage.fileUrl}
            imageName={viewingImage.fileName}
            onClose={handleCloseViewer}
            onDownload={() => {
              handleDownload(viewingImage.fileUrl, viewingImage.fileName)
            }}
          />,
          document.body
        )}
    </div>
  )
}

export default Attachments
