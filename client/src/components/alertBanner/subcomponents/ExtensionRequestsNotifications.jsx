import { useEffect, useState } from 'react'
import { FcExpired } from 'react-icons/fc'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import ConfirmationDialog from '../../confirmationDialog/ConfirmationDialog'
import './ExtensionRequestsNotifications.scss'

const useExtensionRequestsNotifications = ({ extensionRequests, currentUserId, onUpdate }) => {
  const [openRejectDialog, setOpenRejectDialog] = useState(false)
  const [currentRequestId, setCurrentRequestId] = useState(null)
  const [openApproveDialog, setOpenApproveDialog] = useState(false)
  const [currentProposedDeadline, setCurrentProposedDeadline] = useState(null)
  const [approveDialogProps, setApproveDialogProps] = useState({
    open: false,
    initialDate: '',
  })

  const handleApproveConfirm = async (comment, newDeadline) => {
    try {
      // Преобразуем дату к локальному времени перед отправкой
      const localDate = new Date(newDeadline)
      const formattedDate = new Date(
        Date.UTC(
          localDate.getFullYear(),
          localDate.getMonth(),
          localDate.getDate(),
          localDate.getHours(),
          localDate.getMinutes(),
          localDate.getSeconds()
        )
      ).toISOString()
      await axios.patch(
        `${API_BASE_URL}5000/api/tasks/extension-requests/${currentRequestId}/approve`,
        {
          responder_id: currentUserId,
          response_comment: comment,
          new_deadline: formattedDate,
        }
      )
      onUpdate()
      setOpenApproveDialog(false)
    } catch (error) {
      console.error('Ошибка при одобрении запроса:', error)
    }
  }

  const handleApproveClick = (requestId, proposedDeadline, e) => {
    e.stopPropagation()
    e.preventDefault()

    setCurrentRequestId(requestId)
    setCurrentProposedDeadline(proposedDeadline)
    setOpenApproveDialog(true)
  }

  const handleRejectClick = (requestId, e) => {
    e.stopPropagation()
    setCurrentRequestId(requestId)
    setOpenRejectDialog(true)
  }

  const handleRejectConfirm = async (comment) => {
    try {
      await axios.patch(
        `${API_BASE_URL}5000/api/tasks/extension-requests/${currentRequestId}/reject`,
        {
          responder_id: currentUserId,
          response_comment: comment,
        }
      )
      onUpdate()
      setOpenRejectDialog(false)
    } catch (error) {
      console.error('Ошибка при отклонении запроса:', error)
    }
  }

  useEffect(() => {
    if (openApproveDialog) {
      const formatDateForInput = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        // Корректируем часовой пояс
        const tzOffset = date.getTimezoneOffset() * 60000
        const correctedDate = new Date(date.getTime() - tzOffset)
        return correctedDate.toISOString().slice(0, 16)
      }

      setApproveDialogProps({
        open: true,
        initialDate: formatDateForInput(currentProposedDeadline),
      })
    } else {
      setApproveDialogProps((prev) => ({ ...prev, open: false }))
    }
  }, [openApproveDialog, currentProposedDeadline])

  const notifications = Object.values(extensionRequests).map((request) => ({
    key: `extension-request-${request.id}`,
    text: (
      <div className="extension-request-container">
        <div className="extension-request-border" />
        <span className="extension-request-title">
          Запрос на продление срока для задачи &ldquo;{request.task_title}
          &ldquo; от {request.requester_first_name} {request.requester_last_name}
        </span>
        <div className="extension-request-reason">
          <strong>Причина:</strong>{' '}
          {request.reason || <span className="extension-request-no-reason">не указана</span>}
        </div>
        {request.request_date && (
          <div className="extension-request-date">
            <strong>Задача создана:</strong> {new Date(request.request_date).toLocaleString()}
          </div>
        )}
        {request.deadline && (
          <div className="extension-request-date">
            <strong>Утвержденный ранее срок:</strong> {new Date(request.deadline).toLocaleString()}
          </div>
        )}
        {request.new_proposed_deadline && (
          <div className="extension-request-date">
            <strong>Предлагаемый срок:</strong>{' '}
            {new Date(request.new_proposed_deadline).toLocaleString()}
          </div>
        )}
        <div className="extension-request-buttons">
          <button
            className="extension-approve-btn"
            onClick={(e) => handleApproveClick(request.id, request.new_proposed_deadline, e)}
          >
            Одобрить
          </button>
          <button
            className="extension-reject-btn"
            onClick={(e) => handleRejectClick(request.id, e)}
          >
            Отклонить
          </button>
        </div>
      </div>
    ),
    icon: <FcExpired className="extension-request-icon" />,
    taskId: request.task_id,
  }))

  return {
    notifications,
    rejectDialog: (
      <ConfirmationDialog
        open={openRejectDialog}
        onClose={() => setOpenRejectDialog(false)}
        onConfirm={handleRejectConfirm}
        title="Отклонить запрос на продление"
        message="Укажите причину отклонения запроса:"
        btn1="Отмена"
        btn2="Подтвердить"
        comment={true}
      />
    ),
    approveDialog: (
      <ConfirmationDialog
        open={approveDialogProps.open}
        onClose={() => {
          setOpenApproveDialog(false)
          setApproveDialogProps((prev) => ({ ...prev, open: false }))
        }}
        onConfirm={handleApproveConfirm}
        title="Одобрить запрос на продление"
        message="Проверьте новый срок выполнения задачи:"
        btn1="Отмена"
        btn2="Подтвердить"
        comment={true}
        dateInput={true}
        actionType="approve"
        initialDate={approveDialogProps.initialDate}
      />
    ),
  }
}

export default useExtensionRequestsNotifications
