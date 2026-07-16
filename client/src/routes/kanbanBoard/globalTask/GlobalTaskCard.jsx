// Главная карта проекта
import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import {
  FaExclamationCircle,
  FaBullseye,
  FaInfoCircle,
  FaUsers,
  FaPaperclip,
  FaEllipsisH,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa'
import { MdEmail, MdSettings } from 'react-icons/md'
import { MdCalendarMonth, MdAccessTime } from 'react-icons/md'
import useUserStore from '../../../store/userStore'
import {
  getPriorityClass,
  getPriorityLabel,
  getPriorityColorClass,
  getResponsibleColorClass,
  getResponsibleTextColorClass,
  getRemainingDays,
  formatDeadlineDateTime,
} from './utils/globalTaskUtils'
import ResponsibleSelector from './subcomponents/ResponsibleSelector'
import GoalsEditor from './subcomponents/GoalsEditor'
import AdditionalInfoEditor from './subcomponents/AdditionalInfoEditor'
import FinalSolutionsBlock from './subcomponents/FinalSolutionsBlock'
import FinalSolutionModal from './subcomponents/FinalSolutionModal'
import SendProjectMailModal from './subcomponents/SendProjectMailModal'
import FileCommentsModal from './subcomponents/FileCommentsModal'
import SignatureTemplateModal from './subcomponents/SignatureTemplateModal'
import './styles/GlobalTaskCard.scss'

const GlobalTaskCard = ({
  task,
  attachments = [],
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  setAttachments,
  onRefresh,
  onDocumentsUpdated,
  isReadOnly,
}) => {
  const cardRef = useRef(null)
  const { user } = useUserStore()
  const containerRef = useRef(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const buttonRef = useRef(null)
  const [isModalOpenResponsibles, setIsModalOpenResponsibles] = useState(false)
  const [isGoalsEditorOpen, setIsGoalsEditorOpen] = useState(false)
  const [isAdditionalInfoEditorOpen, setIsAdditionalInfoEditorOpen] =
    useState(false)
  const [isFinalSolutionModalOpen, setIsFinalSolutionModalOpen] = useState(false)
  const [approvalModal, setApprovalModal] = useState({ open: false, status: null })
  const [approvalComment, setApprovalComment] = useState('')
  const [approvalSubmitting, setApprovalSubmitting] = useState(false)
  const [sendMailModalOpen, setSendMailModalOpen] = useState(false)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [fileCommentsModal, setFileCommentsModal] = useState({
    open: false,
    files: [],
    fileUrls: [],
    taskId: null,
  })
  // Обработчик открытия редактора целей
  const handleOpenGoalsEditor = () => setIsGoalsEditorOpen(true)
  const handleCloseGoalsEditor = () => setIsGoalsEditorOpen(false)
  //  для доп. инфо:
  const handleOpenAdditionalInfoEditor = () =>
    setIsAdditionalInfoEditorOpen(true)
  const handleCloseAdditionalInfoEditor = () =>
    setIsAdditionalInfoEditorOpen(false)
  const {
    id,
    title,
    description,
    priority,
    deadline,
    goals,
    additional_info,
    responsibles,
    final_solutions,
  } = task
  const solutionsList = Array.isArray(final_solutions) ? final_solutions : []
  const responsiblesRef = useRef(null)
  const goalsRef = useRef(null)
  const additionalInfoRef = useRef(null)
  const userId = user?.id
  const authorId = typeof task.created_by === 'object' ? task.created_by?.id : task.created_by
  const isAuthor = authorId != null && String(authorId) === String(userId)
  const [removingResponsibleId, setRemovingResponsibleId] = useState(null)

  const myApprovalResponsible = responsibles?.find(
    (r) => r.id === userId && r.requires_approval === true
  )

  const handleOpenApprovalModal = (status) => {
    setApprovalComment('')
    setApprovalModal({ open: true, status })
  }

  const handleCloseApprovalModal = () => {
    setApprovalModal({ open: false, status: null })
    setApprovalComment('')
  }

  const handleSubmitApproval = async () => {
    if (!approvalModal.status || !approvalComment.trim()) return
    setApprovalSubmitting(true)
    try {
      await axios.post(
        `${API_BASE_URL}5000/api/global-tasks/${id}/approval`,
        {
          status: approvalModal.status,
          comment: approvalComment.trim(),
          userId,
        },
        { headers: { 'Content-Type': 'application/json' } }
      )
      handleCloseApprovalModal()
      if (typeof onRefresh === 'function') onRefresh(id)
    } catch (err) {
      console.error('Ошибка согласования:', err)
      alert(err.response?.data?.error || 'Не удалось сохранить согласование')
    } finally {
      setApprovalSubmitting(false)
    }
  }

  const handleRemoveResponsible = async (responsibleUserId) => {
    if (!isAuthor) return
    setRemovingResponsibleId(responsibleUserId)
    try {
      await axios.delete(
        `${API_BASE_URL}5000/api/global-tasks/${id}/responsibles/${responsibleUserId}`,
        { data: { requesterId: userId } }
      )
      if (typeof onRefresh === 'function') onRefresh(id)
    } catch (err) {
      const msg = err.response?.data?.error || 'Не удалось исключить участника'
      alert(msg)
    } finally {
      setRemovingResponsibleId(null)
    }
  }

  let remainingDays = getRemainingDays(deadline)

  // Обработчики закрытия при клике вне
  useEffect(() => {
    if (!isModalOpenResponsibles) return

    const handleClickOutside = (event) => {
      if (
        responsiblesRef.current &&
        !responsiblesRef.current.contains(event.target)
      ) {
        setIsModalOpenResponsibles(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isModalOpenResponsibles])

  useEffect(() => {
    if (!isGoalsEditorOpen) return

    const handleClickOutside = (event) => {
      if (goalsRef.current && !goalsRef.current.contains(event.target)) {
        handleCloseGoalsEditor()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isGoalsEditorOpen])

  useEffect(() => {
    if (!isAdditionalInfoEditorOpen) return

    const handleClickOutside = (event) => {
      if (
        additionalInfoRef.current &&
        !additionalInfoRef.current.contains(event.target)
      ) {
        handleCloseAdditionalInfoEditor()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isAdditionalInfoEditorOpen])

  // Эффект для поиска родительского контейнера
  useEffect(() => {
    const container = cardRef.current?.closest('.global-task-page__container')
    if (container) {
      containerRef.current = container
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  const fetchAttachments = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}5000/api/tasks/${id}/attachments`
      )
      setAttachments(response.data.attachments)
    } catch (error) {
      console.error('Ошибка загрузки вложений:', error)
    }
  }

  const handleFileCommentsConfirm = useCallback(
    async (comments) => {
      const { files, fileUrls, taskId: tid } = fileCommentsModal
      if (!tid || !fileUrls?.length || !files?.length) return
      try {
        await Promise.all(
          fileUrls.map((url, index) =>
            axios.post(`${API_BASE_URL}5000/api/tasks/attachment/add`, {
              task_id: tid,
              file_url: url,
              file_type: files[index].type || 'application/octet-stream',
              comment_file: comments[index] ?? '',
              name_file: files[index].name,
              uploaded_by: userId,
              tableType: 'global',
            })
          )
        )
        fetchAttachments()
        setFileCommentsModal({ open: false, files: [], fileUrls: [], taskId: null })
      } catch (error) {
        console.error('Ошибка при добавлении файлов:', error)
        setFileCommentsModal({ open: false, files: [], fileUrls: [], taskId: null })
      }
    },
    [fileCommentsModal, userId]
  )

  const handleAddFile = useCallback(
    async (taskId) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.onchange = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length > 0) {
          try {
            const formData = new FormData()
            files.forEach((file) => formData.append('files', file))
            const uploadResponse = await axios.post(
              `${API_BASE_URL}5000/api/upload`,
              formData,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            )
            const fileUrls = uploadResponse.data.fileUrls
            setFileCommentsModal({ open: true, files, fileUrls, taskId })
          } catch (error) {
            console.error('Ошибка при загрузке файлов:', error)
          }
        }
      }
      input.click()
    },
    []
  )

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev)
  }

  return (
    <div
      ref={cardRef}
      className={`global-task-card ${getPriorityClass(priority)} `}
    >
      {/* Priority Label */}
      <div
        className={`global-task-card__priority-label ${getPriorityColorClass(
          priority
        )}`}
      >
        <FaExclamationCircle className="global-task-card__priority-icon" />
        {getPriorityLabel(priority)}
      </div>

      {/* Navigation Arrows */}
      <button
        className="global-task-card__nav-arrow global-task-card__nav-arrow--left"
        onClick={onPrevious}
        disabled={!hasPrevious}
      >
        <FaChevronLeft />
      </button>
      <button
        className="global-task-card__nav-arrow global-task-card__nav-arrow--right"
        onClick={onNext}
        disabled={!hasNext}
      >
        <FaChevronRight />
      </button>

      <div className="global-task-card__content">
        <div className="global-task-card__main-info">
          <h2 className="global-task-card__title">{title}</h2>
          <div className="global-task-card__description-row">
            <p className="global-task-card__description">{description}</p>
            {!isReadOnly && (
              <div className="global-task-card__mail-btns">
                <button
                  type="button"
                  className="global-task-card__mail-btn"
                  onClick={() => setSendMailModalOpen(true)}
                  title="Отправить описание проекта на почту"
                >
                  <MdEmail />
                </button>
                <button
                  type="button"
                  className="global-task-card__mail-btn global-task-card__mail-btn--settings"
                  onClick={() => setSignatureModalOpen(true)}
                  title="Настройки подписи к письму"
                >
                  <MdSettings />
                </button>
              </div>
            )}
          </div>

          {/* Итоговые решения */}
          {solutionsList.length > 0 && (
            <FinalSolutionsBlock
              solutions={solutionsList}
              globalTaskId={id}
              onRefresh={onRefresh}
              onDocumentsUpdated={onDocumentsUpdated}
              isReadOnly={isReadOnly}
              projectTitle={title}
            />
          )}

          {/* Цели */}
          <div className="global-task-card__goals">
            {goals.filter((goal) => goal.trim() !== '').length > 0 ? ( // Проверяем, есть ли непустые цели
              <>
                <h3 className="global-task-card__section-title">
                  <FaBullseye className="global-task-card__section-icon global-task-card__section-icon--blue" />{' '}
                  Цели задачи
                </h3>
                <div className="global-task-card__section-content">
                  <ul>
                    {goals
                      .filter((goal) => goal.trim() !== '')
                      .map(
                        (
                          goal,
                          index // Фильтруем и отображаем только непустые цели
                        ) => (
                          <li
                            key={index}
                            className="global-task-card__goal-item"
                          >
                            {goal}
                          </li>
                        )
                      )}
                  </ul>
                </div>
              </>
            ) : (
              <>
                <h3 className="global-task-card__section-title">
                  <FaBullseye className="global-task-card__section-icon global-task-card__section-icon--blue" />{' '}
                  Цели задачи
                </h3>
                <div className="global-task-card__section-content">
                  Цели установлены не были
                </div>
              </>
            )}
          </div>

          {/* Additional Info */}
          <div className="global-task-card__additional-info">
            <h3 className="global-task-card__section-title">
              <FaInfoCircle className="global-task-card__section-icon global-task-card__section-icon--purple" />{' '}
              Дополнительная информация
            </h3>
            <div className="global-task-card__section-content global-task-card__additional-info-grid">
              {/* Добавляем проверку на additionalInfo */}
              {additional_info && Object.keys(additional_info).length > 0 ? (
                Object.entries(additional_info).map(([key, value]) => (
                  <div key={key}>
                    <div className="global-task-card__additional-info-label">
                      {key}
                    </div>
                    <div className="global-task-card__additional-info-value">
                      {value}
                    </div>
                  </div>
                ))
              ) : (
                <p>Дополнительная информация отсутствует.</p>
              )}
            </div>
          </div>

          {/* Responsibles */}
          <div className="global-task-card__responsibles">
            <h3 className="global-task-card__section-title">
              <FaUsers className="global-task-card__section-icon global-task-card__section-icon--green" />{' '}
              Ответственные
            </h3>
            <div className="global-task-card__responsible-list">
              {responsibles.map((resp, index) => (
                <div
                  key={resp.id != null ? resp.id : index}
                  className={`global-task-card__responsible-item ${
                    resp.color === 'blue'
                      ? 'global-task-card__responsible-item--blue'
                      : resp.color === 'purple'
                      ? 'global-task-card__responsible-item--purple'
                      : resp.color === 'green'
                      ? 'global-task-card__responsible-item--green'
                      : 'global-task-card__responsible-item--default'
                  }`}
                >
                  <div
                    className={`global-task-card__responsible-avatar ${getResponsibleColorClass(
                      resp.color
                    )}`}
                  >
                    {resp.initials}
                  </div>
                  <div className="global-task-card__responsible-main">
                    <div className="global-task-card__responsible-name">
                      {resp.name}
                    </div>
                    <div
                      className={`global-task-card__responsible-role ${getResponsibleTextColorClass(
                        resp.color
                      )}`}
                    >
                      {resp.role}
                      {resp.requires_approval && (
                        <span className="global-task-card__approval-badge">
                          {' · '}
                          {resp.approval_status === 'approved'
                            ? 'Согласовано'
                            : resp.approval_status === 'rejected'
                            ? 'Отклонено'
                            : 'Ожидает'}
                        </span>
                      )}
                    </div>
                    {resp.requires_approval && resp.approval_comment && (
                      <div className="global-task-card__approval-comment">
                        {resp.approval_comment}
                      </div>
                    )}
                    {!isReadOnly && resp.id === userId && resp.requires_approval && (
                      <div className="global-task-card__approval-actions">
                        <button
                          type="button"
                          className="global-task-card__approval-btn global-task-card__approval-btn--approve"
                          onClick={() => handleOpenApprovalModal('approved')}
                        >
                          Согласовано
                        </button>
                        <button
                          type="button"
                          className="global-task-card__approval-btn global-task-card__approval-btn--reject"
                          onClick={() => handleOpenApprovalModal('rejected')}
                        >
                          Отклонено
                        </button>
                      </div>
                    )}
                    {!isReadOnly && isAuthor && (
                      <button
                        type="button"
                        className="global-task-card__remove-responsible-btn"
                        onClick={() => handleRemoveResponsible(resp.id)}
                        disabled={removingResponsibleId === resp.id}
                        title="Исключить из проекта"
                      >
                        {removingResponsibleId === resp.id ? '…' : 'Исключить'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {approvalModal.open && (
              <div className="global-task-card__approval-overlay">
                <div className="global-task-card__approval-modal">
                  <h4>
                    {approvalModal.status === 'approved'
                      ? 'Согласование'
                      : 'Отклонение'}
                  </h4>
                  <p className="global-task-card__approval-hint">
                    Укажите причину (комментарий):
                  </p>
                  <textarea
                    className="global-task-card__approval-textarea"
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Обязательно укажите комментарий"
                    rows={4}
                  />
                  <div className="global-task-card__approval-modal-actions">
                    <button
                      type="button"
                      className="global-task-card__approval-btn global-task-card__approval-btn--cancel"
                      onClick={handleCloseApprovalModal}
                      disabled={approvalSubmitting}
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      className={
                        approvalModal.status === 'approved'
                          ? 'global-task-card__approval-btn global-task-card__approval-btn--approve'
                          : 'global-task-card__approval-btn global-task-card__approval-btn--reject'
                      }
                      onClick={handleSubmitApproval}
                      disabled={approvalSubmitting || !approvalComment.trim()}
                    >
                      {approvalSubmitting ? 'Сохранение…' : 'Подтвердить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="global-task-card__footer">
        <div className="global-task-card__footer-info">
          <div className="global-task-card__footer-item">
            <MdCalendarMonth className="global-task-card__footer-icon" />
            <span>
              Срок:{' '}
              {formatDeadlineDateTime(deadline) || 'Дата не указана'}
            </span>
          </div>
          {deadline && (
            <div className="global-task-card__footer-item">
             { /* <MdAccessTime className="global-task-card__footer-icon" />
             <span>Осталось: {remainingDays}</span>*/}
            </div>
          )}
        </div>

        {!isReadOnly && (
        <div className="global-task-card__footer-actions">
          <button className="global-task-card__footer-button">
            <FaPaperclip onClick={() => handleAddFile(id)} />{' '}
          </button>
          <button
            className="global-task-card__footer-button"
            onClick={toggleMenu}
            ref={buttonRef}
          >
            <FaEllipsisH />
          </button>{' '}
          {isMenuOpen && (
            <div className="context-menu" ref={menuRef}>
              <ul>
                <li
                  onClick={() => {
                    setIsModalOpenResponsibles(true)
                  }}
                >
                  Добавить ответственного
                </li>
                <li onClick={handleOpenGoalsEditor}>Добавить цели</li>
                <li onClick={handleOpenAdditionalInfoEditor}>
                  Добавить доп. инфо
                </li>
                <li onClick={() => setIsFinalSolutionModalOpen(true)}>
                  Итоговое решение
                </li>
              </ul>
            </div>
          )}
        </div>
        )}
      </div>

      {isModalOpenResponsibles && (
        <div ref={responsiblesRef}>
          <ResponsibleSelector
            responsibles={responsibles}
            onClose={() => setIsModalOpenResponsibles(false)}
            globalTaskId={id}
            onRefresh={onRefresh}
            projectDeadline={deadline}
          />
        </div>
      )}

      {isGoalsEditorOpen && (
        <div ref={goalsRef}>
          <GoalsEditor
            currentGoals={goals}
            onCancel={handleCloseGoalsEditor}
            globalTaskId={id}
            onClose={() => setIsGoalsEditorOpen(false)}
            onRefresh={onRefresh}
          />
        </div>
      )}

      {isAdditionalInfoEditorOpen && (
        <div ref={additionalInfoRef}>
          <AdditionalInfoEditor
            currentInfo={additional_info}
            globalTaskId={id}
            onCancel={handleCloseAdditionalInfoEditor}
            onClose={() => setIsAdditionalInfoEditorOpen(false)}
            onRefresh={onRefresh}
          />
        </div>
      )}

      {isFinalSolutionModalOpen && (
        <FinalSolutionModal
          globalTaskId={id}
          mode="add"
          onClose={() => setIsFinalSolutionModalOpen(false)}
          onSaved={() => {
            setIsFinalSolutionModalOpen(false)
            if (typeof onRefresh === 'function') onRefresh(id)
          }}
        />
      )}

      <SendProjectMailModal
        open={sendMailModalOpen}
        onClose={() => setSendMailModalOpen(false)}
        task={task}
        attachments={attachments}
        userId={userId}
        onRefresh={onRefresh}
      />

      <FileCommentsModal
        open={fileCommentsModal.open}
        files={fileCommentsModal.files}
        fileUrls={fileCommentsModal.fileUrls}
        taskId={fileCommentsModal.taskId}
        onClose={() => setFileCommentsModal({ open: false, files: [], fileUrls: [], taskId: null })}
        onConfirm={handleFileCommentsConfirm}
      />

      <SignatureTemplateModal
        open={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        userId={userId}
      />
    </div>
  )
}

export default GlobalTaskCard
