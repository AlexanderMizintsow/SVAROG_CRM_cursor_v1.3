import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../../config'
import './commentsModal.scss'
import { stripHtmlTags } from '../../../Boards/subcomponents/taskUtils'

const CommentsTaskModal = ({ task, userId, taskId, open, onClose }) => {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')

  // Получить комментарии для задачи
  useEffect(() => {
    if (open) {
      axios
        .get(`${API_BASE_URL}5000/api/tasks/${task.id}/comments`)
        .then((response) => setComments(response.data))
        .catch((error) =>
          console.error('Ошибка при получении комментариев:', error)
        )
    }
  }, [open, task.id])

  // Добавить новый комментарий
  const handleAddComment = () => {
    if (newComment.trim()) {
      axios
        .post(`${API_BASE_URL}5000/api/tasks/${task.id}/comments`, {
          userId: userId,
          comment: newComment,
        })
        .then((response) => {
          setComments([response.data, ...comments])
          setNewComment('')
        })
        .catch((error) =>
          console.error('Ошибка при добавлении комментария:', error)
        )
    }
  }

  if (!open) return null

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="task-modal-title">Комментарии к задаче</h2>
        <div className="task-modal-body">
          <div className="task-comment-input-section">
            <textarea
              className="task-comment-input"
              placeholder="Новый комментарий"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button
              className="task-add-comment-button"
              onClick={handleAddComment}
            >
              Добавить
            </button>

            <div className="task-info">
              <h3>{task.title}</h3>

              <p>{stripHtmlTags(task.description)}</p>
            </div>
          </div>
          <div className="task-comments-list">
            {comments.map((comment) => (
              <div key={comment.id} className="task-comment-item">
                <p className="task-comment-text">{comment.comment}</p>

                <p className="task-comment-meta">
                  {new Date(comment.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommentsTaskModal
