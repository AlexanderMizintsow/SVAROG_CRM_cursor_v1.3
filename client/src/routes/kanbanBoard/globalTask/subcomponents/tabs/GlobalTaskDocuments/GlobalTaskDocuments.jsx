// GlobalTaskDocuments.jsx
import { useEffect } from 'react'
import { API_BASE_URL } from '../../../../../../../config'
import axios from 'axios'
import Attachments from '../../../../Task/subcomponents/Attachments'
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
      <Attachments attachments={attachments} />
    </div>
  )
}

export default GlobalTaskDocuments
