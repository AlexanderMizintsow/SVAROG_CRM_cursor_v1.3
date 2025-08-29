// Отображение прогресса общего проекта

import { useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import useUserStore from '../../../store/userStore'
import ConfirmationDialog from '../../../components/confirmationDialog/ConfirmationDialog'
import {
  FaCheckCircle,
  FaPause,
  FaTrashAlt,
  FaExclamationTriangle,
  FaSync,
  FaPlay,
} from 'react-icons/fa'
import Toastify from 'toastify-js'
import './styles/GlobalTaskProgress.scss'

const GlobalTaskProgress = ({
  taskId,
  status,
  dueDate,
  completionPercentage,
  onRefresh,
}) => {
  const { user } = useUserStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogOpenPause, setDialogOpenPause] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [confirmProgressDialogOpen, setConfirmProgressDialogOpen] =
    useState(false)
  const userId = user.id

  const handleMarkAsFailed = async (commentValue, actionType) => {
    try {
      // Здесь отправить комментарий на сервер
      await axios.post(
        `${API_BASE_URL}5000/api/global-tasks/${taskId}/comments`,
        {
          user_id: userId,
          comment: commentValue,
        }
      )

      if (actionType === 'Провал') {
        await updateTaskStatus('Провал')
      } else if (actionType === 'Пауза') {
        await updateTaskStatus('Пауза')

        onRefresh(taskId)
      } else if (actionType === 'Продолжить') {
        await updateTaskStatus('Продолжить')
        onRefresh(taskId)
      }

      Toastify({
        text: `Статус проекта успешно изменен`,
        close: true,
        backgroundColor: 'linear-gradient(to right, #8B8000, #FFD700)',
      }).showToast()
    } catch (error) {
      console.error(`Ошибка при смене статуса проекта":`, error)
      Toastify({
        text: 'Произошла ошибка при обновлении статуса, обратитесь к администратору.',
        close: true,
        backgroundColor: 'linear-gradient(to right, #8B0000, #ff0000)',
      }).showToast()
    } finally {
      setDialogOpen(false)
      setDialogOpenPause(false)
    }
  }

  // Calculate remaining days (simplified)
  const today = new Date()
  let remainingDays = 'Дата не указана'
  if (dueDate && typeof dueDate === 'string') {
    try {
      const [day, month, year] = dueDate.split('.')

      if (day && month && year) {
        const isoDateString = `${year}-${month}-${day}` // Формат YYYY-MM-DD
        const due = new Date(isoDateString)

        if (!isNaN(due.getTime())) {
          const diffTime = due - today
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

          remainingDays =
            diffDays > 0
              ? `${diffDays} дней`
              : diffDays === 0
              ? 'Сегодня'
              : 'Просрочено'
        } else {
          remainingDays = 'Некорректная дата'
        }
      } else {
        remainingDays = 'Некорректный формат даты' // Если split не дал 3 части
      }
    } catch (error) {
      console.error('Ошибка при парсинге даты dueDate:', error)
      remainingDays = 'Ошибка даты' // В случае любой другой ошибки парсинга
    }
  }
  const updateTaskStatus = async (status) => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}5000/api/update/global-tasks/${taskId}/status`,
        { status, userId }
      )

      // Обновляем локальное состояние статуса и прогресса
    } catch (error) {
      console.error('Ошибка при обновлении задачи:', error)
    }
  }

  const handleDelete = async () => {
    try {
      await axios.delete(
        `${API_BASE_URL}5000/api/global-tasks/delete/${taskId}`
      )

      onRefresh(taskId)
      Toastify({
        text: 'Проект был удален!',
        close: true,
        backgroundColor: 'linear-gradient(to right, #8B8000, #FFD700)',
      }).showToast()
    } catch (error) {
      console.error('Ошибка при удалении задачи:', error)
      Toastify({
        text: 'Произошла ошибка при обновлении статуса, обратитесь к администратору.',
        close: true,
        backgroundColor: 'linear-gradient(to right, #8B0000, #ff0000)',
      }).showToast()
    } finally {
      setDeleteDialogOpen(false) // Закрываем диалог удаления
    }
  }

  const handleOpenConfirmProgress = () => {
    setConfirmProgressDialogOpen(true)
  }

  const handleConfirmAsComplete = async () => {
    try {
      await updateTaskStatus('Завершено')
      Toastify({
        text: 'Проект успешно завершен',
        close: true,
        backgroundColor: 'linear-gradient(to right, #006400, #00FF00)',
      }).showToast()
    } catch (error) {
      console.error('Ошибка при обновлении статуса:', error)
      Toastify({
        text: 'Произошла ошибка при обновлении статуса, обратитесь к администратору.',
        close: true,
        backgroundColor: 'linear-gradient(to right, #8B0000, #ff0000)',
      }).showToast()
    } finally {
      setConfirmProgressDialogOpen(false)
    }
  }

  return (
    <div className="global-task-progress">
      <div className="global-task-progress__header">
        <span className="global-task-progress__label">Прогресс выполнения</span>
        <div className="global-task-progress__status-container">
          <span
            className={`global-task-progress__percent ${
              completionPercentage >= 100
                ? 'global-task-progress__percent--completed'
                : 'global-task-progress__percent--in-progress'
            }`}
          >
            {completionPercentage}%
          </span>
        </div>
      </div>
      <div className="global-task-progress__track">
        <div
          className="global-task-progress__bar"
          style={{
            width: `${completionPercentage}%`,
            background:
              completionPercentage >= 100
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          }}
        ></div>
      </div>
      <div className="global-task-progress__dates">
        <span>Начало</span>
        <span>Завершение </span>
      </div>

      <div className="global-task-progress__controller">
        <div className="global-task-progress__controller-extra-actions">
          <button
            disabled={completionPercentage < 100}
            className="global-task-progress__controller-button global-task-progress__controller-button--complete"
            onClick={handleOpenConfirmProgress}
          >
            <FaCheckCircle className="global-task-progress__controller-icon" />
            Отметить выполненной
          </button>

          {status === 'Пауза' ? (
            <button
              onClick={() => setDialogOpenPause(true)}
              className="global-task-progress__controller-button global-task-progress__controller-button--play"
            >
              <FaPlay className="global-task-progress__controller-icon" />
              Продолжить проект
            </button>
          ) : (
            <button
              onClick={() => setDialogOpenPause(true)}
              className="global-task-progress__controller-button global-task-progress__controller-button--pause"
            >
              <FaPause className="global-task-progress__controller-icon" />
              Поставить на паузу
            </button>
          )}
          <button
            className="global-task-progress__controller-button global-task-progress__controller-button--delete"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <FaTrashAlt className="global-task-progress__controller-icon" />
            Удалить проект
          </button>
          <button
            className="global-task-progress__controller-button global-task-progress__controller-button--delete"
            onClick={() => setDialogOpen(true)}
          >
            <FaExclamationTriangle className="global-task-progress__controller-icon" />
            Пометить как неудачу
          </button>
          <button
            className="global-task-progress__controller-button global-task-progress__controller-button--sync"
            onClick={() => onRefresh(taskId)}
          >
            <FaSync className="global-task-progress__controller-icon" />
            Обновить
          </button>
        </div>
      </div>
      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить эту задачу?"
        btn1="Отмена"
        btn2="Удалить"
      />
      <ConfirmationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleMarkAsFailed}
        title="Подтверждение действия"
        message="Вы уверены, что хотите пометить задачу как неудачную?"
        btn1="Отмена"
        btn2="Подтвердить"
        comment={true}
        actionType="Провал"
      />
      <ConfirmationDialog
        open={dialogOpenPause}
        onClose={() => setDialogOpenPause(false)}
        onConfirm={handleMarkAsFailed}
        title="Подтверждение действия"
        message={
          status === 'Пауза'
            ? 'Вы уверены, что хотите запустить проект?'
            : 'Вы уверены, что хотите поставить проект на паузу?'
        }
        btn1="Отмена"
        btn2="Подтвердить"
        comment={true}
        actionType={status === 'Пауза' ? 'Продолжить' : 'Пауза'}
      />
      <ConfirmationDialog
        open={confirmProgressDialogOpen}
        onClose={() => setConfirmProgressDialogOpen(false)}
        onConfirm={handleConfirmAsComplete}
        title="Подтверждение выполнения"
        message="Вы уверены, что хотите отметить проект как выполненный?"
        btn1="Отмена"
        btn2="Подтвердить"
      />
    </div>
  )
}

export default GlobalTaskProgress
