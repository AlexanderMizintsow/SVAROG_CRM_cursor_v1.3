import { API_BASE_URL } from '../../../../../../../config'
import { FaFile, FaFileImage } from 'react-icons/fa'
import './ProjectDocumentsList.scss'

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
  if (!attachments || attachments.length === 0) return null

  const handleFileDownload = async (fileUrl, fileName) => {
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
  }

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

            return (
              <tr key={att.id} className="project-documents-list__row">
                <td>
                  <button
                    type="button"
                    className="project-documents-list__file-link"
                    onClick={() => handleFileDownload(fileUrl, fileName)}
                  >
                    {isImage ? (
                      <FaFileImage className="project-documents-list__file-icon" />
                    ) : (
                      <FaFile className="project-documents-list__file-icon" />
                    )}
                    {fileName}
                  </button>
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
    </div>
  )
}

export default ProjectDocumentsList
