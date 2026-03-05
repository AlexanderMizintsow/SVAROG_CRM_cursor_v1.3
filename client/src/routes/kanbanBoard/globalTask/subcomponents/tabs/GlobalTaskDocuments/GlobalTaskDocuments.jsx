// GlobalTaskDocuments.jsx
import { useEffect } from 'react'
import { API_BASE_URL } from '../../../../../../../config'
import axios from 'axios'
import ProjectDocumentsList from './ProjectDocumentsList'
import './GlobalTaskDocuments.scss'

const GlobalTaskDocuments = ({ taskId, setAttachments, attachments }) => {
  const fetchAttachments = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}5000/api/tasks/${taskId}/attachments`
      )
      setAttachments(response.data.attachments)
    } catch (error) {
      console.error('Ошибка загрузки вложений:', error)
    }
  }

  useEffect(() => {
    if (taskId) {
      fetchAttachments()
    }
  }, [taskId])

  return (
    <div className="global-task-document__footer-file-view">
      <ProjectDocumentsList attachments={attachments} />
    </div>
  )
}

export default GlobalTaskDocuments
