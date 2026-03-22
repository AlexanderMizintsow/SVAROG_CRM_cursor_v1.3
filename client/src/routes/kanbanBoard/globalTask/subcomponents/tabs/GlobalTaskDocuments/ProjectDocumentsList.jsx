import { useState, useCallback } from 'react'
import { API_BASE_URL } from '../../../../../../../config'
import { FaFile, FaFileImage, FaDownload, FaExternalLinkAlt } from 'react-icons/fa'
import ImageViewer from '../../../../Task/subcomponents/ImageViewer'
import './ProjectDocumentsList.scss'

const isPdf = (fileType, fileName) => {
  if (fileType && (fileType === 'application/pdf' || fileType.includes('pdf'))) return true
  return fileName && fileName.toLowerCase().endsWith('.pdf')
}

function formatDateTime(str) {
  if (!str) return '—'
  try {
    const d = new Date(str)
    if (isNaN(d.getTime())) return str
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return str
  }
}

function getSourceLabel(source) {
  if (source === 'task') return 'Из карточки задачи'
  return 'Из карточки проекта'
}

function getUploaderName(att) {
  const first = att.uploader_first_name || ''
  const last = att.uploader_last_name || ''
  const name = `${last} ${first}`.trim()
  return name || 'Неизвестно'
}

const ProjectDocumentsList = ({ attachments }) => {
  const [viewingImage, setViewingImage] = useState(null)

  const handleFileDownload = useCallback(async (fileUrl, fileName) => {
    try {
      const response = await fetch(fileUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'Файл'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Ошибка при скачивании:', error)
      window.open(fileUrl, '_blank', 'noopener,noreferrer')
    }
  }, [])

  if (!attachments || attachments.length === 0) return null

  return (
    <div className="project-documents-list">
      <table className="project-documents-list__table">
        <thead>
          <tr>
            <th>Файл</th>
            <th>Кто добавил</th>
            <th>Дата и время</th>
            <th>Откуда</th>
          </tr>
        </thead>
        <tbody>
          {attachments.map((att) => {
            const isImage = att.file_type?.startsWith('image/')
            const fileUrl = encodeURI(`${API_BASE_URL}5000/api/task${att.file_url}`)
            const fileName = att.name_file || 'Файл'
            const source = att.source || 'project'
            const pdf = isPdf(att.file_type, fileName)

            return (
              <tr key={att.id} className="project-documents-list__row">
                <td>
                  <div className="project-documents-list__file-cell">
                    {isImage ? (
                      <>
                        <button
                          type="button"
                          className="project-documents-list__thumb-wrap"
                          onClick={() => setViewingImage({ fileUrl, fileName })}
                          title="Просмотреть"
                        >
                          <img src={fileUrl} alt="" className="project-documents-list__thumb" loading="lazy" />
                        </button>
                        <span className="project-documents-list__file-name" title={fileName}>{fileName}</span>
                        <button
                          type="button"
                          className="project-documents-list__action-btn project-documents-list__action-btn--download"
                          onClick={() => handleFileDownload(fileUrl, fileName)}
                          title="Скачать"
                        >
                          <FaDownload />
                        </button>
                      </>
                    ) : (
                      <>
                        <FaFile className="project-documents-list__file-icon" />
                        <span className="project-documents-list__file-name" title={fileName}>{fileName}</span>
                        {pdf && (
                          <button
                            type="button"
                            className="project-documents-list__action-btn project-documents-list__action-btn--open"
                            onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}
                            title="Открыть PDF"
                          >
                            <FaExternalLinkAlt />
                          </button>
                        )}
                        <button
                          type="button"
                          className="project-documents-list__action-btn project-documents-list__action-btn--download"
                          onClick={() => handleFileDownload(fileUrl, fileName)}
                          title="Скачать"
                        >
                          <FaDownload />
                        </button>
                      </>
                    )}
                  </div>
                  {att.comment_file && (
                    <div className="project-documents-list__comment">{att.comment_file}</div>
                  )}
                </td>
                <td>{getUploaderName(att)}</td>
                <td>{formatDateTime(att.created_at)}</td>
                <td>{getSourceLabel(source)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {viewingImage && (
        <ImageViewer
          imageUrl={viewingImage.fileUrl}
          imageName={viewingImage.fileName}
          onClose={() => setViewingImage(null)}
          onDownload={() => {
            handleFileDownload(viewingImage.fileUrl, viewingImage.fileName)
          }}
        />
      )}
    </div>
  )
}

export default ProjectDocumentsList
