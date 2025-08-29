import { FaTimes } from 'react-icons/fa'
import './TaskModal.scss'

const TaskModal = ({ onClose, image, alt, title, description }) => {
  return (
    <div className="task-modal open" onClick={onClose}>
      <div className="task-modal-content open" onClick={(e) => e.stopPropagation()}>
        <FaTimes className="close-button icon-pointer" onClick={onClose} />

        {image && alt && <img src={image} alt={alt} className="task-image" loading="lazy" />}

        <div className="task-details">
          <span className="task-title">{title}</span>
          <div className="task-title-content" dangerouslySetInnerHTML={{ __html: description }} />
        </div>

        <div className="task-footer"></div>
      </div>
    </div>
  )
}

export default TaskModal
