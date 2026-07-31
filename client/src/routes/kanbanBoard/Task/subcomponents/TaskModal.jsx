import { FaTimes } from 'react-icons/fa'
import Attachments from './Attachments'
import useUserStore from '../../../../store/userStore'
import { handleKnowledgeDescriptionClick } from '../../../knowledgeBase/openKnowledgeLink'
import { enhanceKnowledgeLinksInHtml } from '../../../knowledgeBase/knowledgeLinkUtils'
import './TaskModal.scss'

const TaskModal = ({ onClose, image, alt, title, description, attachments }) => {
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0
  const { user } = useUserStore()
  const userId = user?.id

  return (
    <div className="task-modal open" onClick={onClose}>
      <div className="task-modal-content open" onClick={(e) => e.stopPropagation()}>
        <FaTimes className="close-button icon-pointer" onClick={onClose} />

        {image && alt && <img src={image} alt={alt} className="task-image" loading="lazy" />}

        <div className="task-details">
          <span className="task-title">{title}</span>
          <div
            className="task-title-content"
            onClick={(e) => handleKnowledgeDescriptionClick(e, userId)}
            dangerouslySetInnerHTML={{
              __html: enhanceKnowledgeLinksInHtml(description),
            }}
          />
        </div>

        {hasAttachments && (
          <div className="task-modal-attachments">
            <h4 className="task-modal-attachments-title">Вложения</h4>
            <Attachments attachments={attachments} />
          </div>
        )}

        <div className="task-footer"></div>
      </div>
    </div>
  )
}

export default TaskModal
