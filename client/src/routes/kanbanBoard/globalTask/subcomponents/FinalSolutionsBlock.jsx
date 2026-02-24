import { useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import useUserStore from '../../../../store/userStore'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import FinalSolutionModal from './FinalSolutionModal'
import ReplyToThreadModal from './ReplyToThreadModal'
import './FinalSolutionsBlock.scss'

function formatDateTime(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function extractEmail(fromStr) {
  if (!fromStr || typeof fromStr !== 'string') return ''
  const m = fromStr.match(/<([^>]+)>/)
  return m ? m[1].trim() : fromStr.trim()
}

const canSeeUnpublishedReply = (user) => {
  return user?.role_name === 'Администратор' || user?.position === 'Диспетчер'
}

const FinalSolutionsBlock = ({
  solutions,
  globalTaskId,
  onRefresh,
  isReadOnly,
  projectTitle,
}) => {
  const { user } = useUserStore()
  const userId = user?.id
  const canSeeAll = canSeeUnpublishedReply(user)
  const rawList = Array.isArray(solutions) ? solutions : []
  const list = rawList.filter(
    (s) => !s?.is_from_supplier_reply || s?.is_published || canSeeAll
  )
  const [currentPage, setCurrentPage] = useState(1)
  const [modal, setModal] = useState({ open: false, mode: 'add', solution: null })
  const [replyModal, setReplyModal] = useState({ open: false, solution: null })
  const [editMessageModal, setEditMessageModal] = useState({ open: false, messageIndex: null, body: '' })

  const totalPages = Math.max(1, list.length)
  const currentIndex = Math.min(currentPage - 1, list.length - 1)
  const currentSolution = list[currentIndex] || null

  const threadMessages = Array.isArray(currentSolution?.thread_messages)
    ? currentSolution.thread_messages
    : []
  const isEmailThread = currentSolution?.is_from_supplier_reply && threadMessages.length > 0

  const lastMessageId = threadMessages.length > 0
    ? (threadMessages[threadMessages.length - 1].message_id || '')
    : ''
  const lastTheyReplied = [...threadMessages]
    .reverse()
    .find((m) => m.role === 'they_replied' && !m.is_deleted)
  const replyToEmail =
    lastTheyReplied?.from_email ||
    (lastTheyReplied?.from ? extractEmail(lastTheyReplied.from) : '') ||
    (typeof lastTheyReplied?.from === 'string' ? lastTheyReplied.from : '')

  const isEdited = (s) => {
    if (!s?.updated_at || !s?.created_at) return false
    return new Date(s.updated_at).getTime() > new Date(s.created_at).getTime()
  }

  const canEdit = (s) =>
    !s?.is_from_supplier_reply && !isReadOnly && userId != null && String(s?.user_id) === String(userId)

  const handleDelete = async (solutionId) => {
    if (!window.confirm('Удалить это итоговое решение?')) return
    try {
      await axios.delete(
        `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/final-solutions/${solutionId}`,
        { data: { userId } }
      )
      onRefresh?.(globalTaskId)
      setCurrentPage((p) => Math.max(1, Math.min(p, totalPages - 1)))
    } catch (err) {
      console.error('Ошибка удаления итогового решения:', err)
      alert(err.response?.data?.error || 'Не удалось удалить')
    }
  }

  const handleSaved = () => {
    onRefresh?.(globalTaskId)
  }

  const handlePublish = async (solutionId) => {
    try {
      await axios.put(
        `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/final-solutions/${solutionId}/publish`,
        { userId }
      )
      onRefresh?.(globalTaskId)
    } catch (err) {
      console.error('Ошибка публикации итогового решения:', err)
      alert(err.response?.data?.error || 'Не удалось опубликовать')
    }
  }

  const handleDownloadAttachment = (attachmentId) => {
    const url = `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/final-solutions/${currentSolution.id}/attachments/${attachmentId}/download`
    window.open(url, '_blank')
  }

  const handleAddAttachmentToProject = async (attachmentId) => {
    try {
      await axios.post(
        `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/final-solutions/${currentSolution.id}/attachments/${attachmentId}/add-to-project`,
        { userId }
      )
      onRefresh?.(globalTaskId)
    } catch (err) {
      console.error('Ошибка добавления вложения в проект:', err)
      alert(err.response?.data?.error || 'Не удалось добавить в документы')
    }
  }

  const patchThreadMessage = async (messageIndex, patch) => {
    try {
      await axios.patch(
        `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/final-solutions/${currentSolution.id}/thread-messages/${messageIndex}`,
        { userId, ...patch }
      )
      onRefresh?.(globalTaskId)
    } catch (err) {
      console.error('Ошибка обновления сообщения:', err)
      alert(err.response?.data?.error || 'Не удалось обновить')
    }
  }

  const handlePublishMessage = (messageIndex) => {
    patchThreadMessage(messageIndex, { is_published: true })
  }
  const handleUnpublishMessage = (messageIndex) => {
    patchThreadMessage(messageIndex, { is_published: false })
  }
  const handleDeleteMessage = (messageIndex) => {
    if (!window.confirm('Удалить это сообщение из переписки?')) return
    patchThreadMessage(messageIndex, { is_deleted: true })
  }
  const handleEditMessage = (messageIndex, body) => {
    setEditMessageModal({ open: true, messageIndex, body: body || '' })
  }
  const handleSaveEditMessage = async () => {
    const { messageIndex, body } = editMessageModal
    if (messageIndex == null) return
    await patchThreadMessage(messageIndex, { body: body.trim() })
    setEditMessageModal({ open: false, messageIndex: null, body: '' })
  }

  if (list.length === 0) return null

  return (
    <div className="final-solutions-block">
      <h3 className="final-solutions-block__title">Итоговые решения</h3>
      <div className="final-solutions-block__card">
        {currentSolution && (
          <>
            {isEmailThread ? (
              <div className="final-solutions-block__thread">
                {threadMessages.map((msg, idx) => {
                  if (msg.is_deleted) return null
                  const visible = canSeeAll || (msg.is_published !== false)
                  if (!visible) return null
                  return (
                    <div
                      key={idx}
                      className={`final-solutions-block__thread-msg final-solutions-block__thread-msg--${msg.role || 'they_replied'}`}
                    >
                      <div className="final-solutions-block__thread-msg-head">
                        <span className="final-solutions-block__thread-msg-author">
                          {msg.role === 'we_sent' ? 'Мы' : (msg.from || 'Получатель')}
                        </span>
                        <span className="final-solutions-block__thread-msg-date">
                          {formatDateTime(msg.date)}
                        </span>
                      </div>
                      <div className="final-solutions-block__thread-msg-body">
                        {msg.body}
                      </div>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="final-solutions-block__thread-attachments">
                          {msg.attachments.map((att) => (
                            <div key={att.id} className="final-solutions-block__thread-att">
                              <span>{att.filename || 'Файл'}</span>
                              {canSeeAll && (
                                <>
                                  <button
                                    type="button"
                                    className="final-solutions-block__thread-att-btn"
                                    onClick={() => handleDownloadAttachment(att.id)}
                                  >
                                    Скачать
                                  </button>
                                  <button
                                    type="button"
                                    className="final-solutions-block__thread-att-btn final-solutions-block__thread-att-btn--add"
                                    onClick={() => handleAddAttachmentToProject(att.id)}
                                  >
                                    В документы проекта
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {!isReadOnly && canSeeAll && (
                        <div className="final-solutions-block__thread-msg-actions">
                          {(msg.is_published === false) && (
                            <button
                              type="button"
                              className="final-solutions-block__thread-action final-solutions-block__thread-action--publish"
                              onClick={() => handlePublishMessage(idx)}
                            >
                              Опубликовать
                            </button>
                          )}
                          {(msg.is_published !== false) && (
                            <button
                              type="button"
                              className="final-solutions-block__thread-action final-solutions-block__thread-action--unpublish"
                              onClick={() => handleUnpublishMessage(idx)}
                            >
                              Снять с публикации
                            </button>
                          )}
                          <button
                            type="button"
                            className="final-solutions-block__thread-action final-solutions-block__thread-action--edit"
                            onClick={() => handleEditMessage(idx, msg.body)}
                          >
                            Редактировать
                          </button>
                          <button
                            type="button"
                            className="final-solutions-block__thread-action final-solutions-block__thread-action--delete"
                            onClick={() => handleDeleteMessage(idx)}
                          >
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <>
                <div className="final-solutions-block__content">
                  {currentSolution.content}
                </div>
                <div className="final-solutions-block__meta">
                  <span className="final-solutions-block__author">
                    {currentSolution.author_name || 'Участник'}
                  </span>
                  {isEdited(currentSolution) && (
                    <span className="final-solutions-block__edited">
                      отредактировано {formatDateTime(currentSolution.updated_at)}
                    </span>
                  )}
                </div>
              </>
            )}

            {!isReadOnly && canSeeAll && isEmailThread && (
              <div className="final-solutions-block__actions">
                <button
                  type="button"
                  className="final-solutions-block__action-btn final-solutions-block__action-btn--reply"
                  onClick={() => setReplyModal({ open: true, solution: currentSolution })}
                >
                  Ответить
                </button>
              </div>
            )}
            {!isReadOnly && canEdit(currentSolution) && !isEmailThread && (
              <div className="final-solutions-block__actions">
                <button
                  type="button"
                  className="final-solutions-block__action-btn final-solutions-block__action-btn--edit"
                  onClick={() =>
                    setModal({
                      open: true,
                      mode: 'edit',
                      solution: currentSolution,
                    })
                  }
                >
                  Редактировать
                </button>
                <button
                  type="button"
                  className="final-solutions-block__action-btn final-solutions-block__action-btn--delete"
                  onClick={() => handleDelete(currentSolution.id)}
                >
                  Удалить
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="final-solutions-block__pagination">
          <button
            type="button"
            className="final-solutions-block__page-arrow"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <FaChevronLeft />
          </button>
          <div className="final-solutions-block__page-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                type="button"
                className={`final-solutions-block__page-num ${
                  currentPage === num ? 'final-solutions-block__page-num--active' : ''
                }`}
                onClick={() => setCurrentPage(num)}
              >
                {num}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="final-solutions-block__page-arrow"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <FaChevronRight />
          </button>
        </div>
      )}

      {modal.open && (
        <FinalSolutionModal
          globalTaskId={globalTaskId}
          mode={modal.mode}
          initialContent={modal.solution?.content}
          solutionId={modal.solution?.id}
          onClose={() => setModal({ open: false, mode: 'add', solution: null })}
          onSaved={handleSaved}
          isEmailThread={modal.isEmailThread}
        />
      )}

      {replyModal.open && replyModal.solution && (
        <ReplyToThreadModal
          open={replyModal.open}
          onClose={() => setReplyModal({ open: false, solution: null })}
          globalTaskId={globalTaskId}
          solutionId={replyModal.solution.id}
          toEmail={replyToEmail}
          inReplyToMessageId={lastMessageId}
          projectTitle={projectTitle}
          userId={userId}
          onSent={handleSaved}
        />
      )}

      {editMessageModal.open && (
        <div className="final-solutions-block__edit-msg-overlay" role="dialog" aria-modal="true">
          <div className="final-solutions-block__edit-msg-modal">
            <h4 className="final-solutions-block__edit-msg-title">Редактировать сообщение</h4>
            <textarea
              className="final-solutions-block__edit-msg-textarea"
              value={editMessageModal.body}
              onChange={(e) =>
                setEditMessageModal((s) => ({ ...s, body: e.target.value }))
              }
              rows={8}
            />
            <div className="final-solutions-block__edit-msg-btns">
              <button
                type="button"
                className="final-solutions-block__action-btn final-solutions-block__action-btn--edit"
                onClick={handleSaveEditMessage}
              >
                Сохранить
              </button>
              <button
                type="button"
                className="final-solutions-block__action-btn final-solutions-block__action-btn--delete"
                onClick={() => setEditMessageModal({ open: false, messageIndex: null, body: '' })}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FinalSolutionsBlock
