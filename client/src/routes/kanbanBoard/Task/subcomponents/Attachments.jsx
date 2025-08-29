import { API_BASE_URL } from '../../../../../config'
import { FaFile, FaFileImage } from 'react-icons/fa'
import Tooltip from '@mui/material/Tooltip'
import './attachments.scss'

const Attachments = ({ attachments }) => {
  if (!attachments || attachments.length === 0) return null

  const handleFileDownload = async (fileUrl, fileName) => {
    try {
      // Получаем файл как blob
      const response = await fetch(fileUrl)
      const blob = await response.blob()

      // Создаем URL для скачивания
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName // Устанавливаем оригинальное имя файла
      document.body.appendChild(a)
      a.click()

      // Очищаем ресурсы
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error)
      // Fallback: открываем в новой вкладке если скачивание не удалось
      window.open(fileUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="attachments">
      {attachments.map((attachment, index) => {
        const isImage = attachment.file_type.startsWith('image/')
        const fileUrl = encodeURI(`${API_BASE_URL}5000/api/task${attachment.file_url}`)
        const fileName = attachment.name_file
        const comment = attachment.comment_file

        return (
          <Tooltip
            key={index}
            title={<div style={{ fontSize: '16px' }}>{comment}</div>}
            placement="right-start"
            arrow
          >
            <div key={index} className="attachment-item">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  handleFileDownload(fileUrl, fileName)
                }}
              >
                {isImage ? <FaFileImage className="file-icon" /> : <FaFile className="file-icon" />}
                {fileName}
              </a>
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

export default Attachments
