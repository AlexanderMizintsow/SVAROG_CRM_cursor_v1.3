import { useState, useEffect, forwardRef, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import useElapsedTime, { formatDate } from '../../../utils/useElapsedTime'
import ConfirmationDialog from '../../../components/confirmationDialog/ConfirmationDialog'
import FileUpload from './subcomponents/FileUpload'
import useKanbanStore from '../../../store/useKanbanStore'
import useUserStore from '../../../store/userStore'
import TaskModal from './subcomponents/TaskModal'
import Toastify from 'toastify-js'
import Tooltip from '@mui/material/Tooltip'
import { TbMessage2Share } from 'react-icons/tb'
import { RxWidth } from 'react-icons/rx'
import { FaHashtag, FaFile } from 'react-icons/fa'
import { CiTimer } from 'react-icons/ci'
import { RiDeleteBinLine } from 'react-icons/ri'
import { sanitizeFilename } from '../../../utils/fileUtils'
import './Task.scss'

const TaskNotification = forwardRef(
  ({ task, provided, onComplete, isNotificationColumn, actionIcon }, ref) => {
    const { title, description, priority, createdAt, image, alt, tags, links } = task
    const selectedEmployeeId = useKanbanStore((state) => state.selectedEmployeeId) // id выбранной доски сотрудника
    const { user } = useUserStore()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [files, setFiles] = useState([])
    const [text, setText] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const { hours, minutes } = useElapsedTime(createdAt)
    const [sentMessages, setSentMessages] = useState([])

    const formatSentMessages = (messages) => {
      return (
        <div style={{ maxWidth: '300px' }}>
          {messages.map((message, index) => (
            <div
              key={message.id}
              style={{
                marginBottom: index < messages.length - 1 ? '16px' : '0',
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                <strong>Сообщение:</strong> {message.sent_text}
              </div>
              {message.sent_files && message.sent_files.length > 0 && (
                <div>
                  <strong>Файлы:</strong> {message.sent_files.join(', ')}
                </div>
              )}
              {index < messages.length - 1 && (
                <hr style={{ borderColor: '#e0e0e0', margin: '8px 0' }} />
              )}
            </div>
          ))}
        </div>
      )
    }

    useEffect(() => {
      const fetchSentMessages = async () => {
        try {
          const response = await axios.get(
            `${API_BASE_URL}5000/api/messages-notification-dealer?reminders_id=${task.id}`
          )
          setSentMessages(response.data)
        } catch (error) {
          console.error('Ошибка при получении данных об отправленных сообщениях:', error)
        }
      }

      fetchSentMessages()
    }, [task.id])

    const formatElapsedTime = () => {
      return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`
    }

    const toggleModal = useCallback(() => {
      setIsModalOpen((prev) => !prev)
    }, [])

    const handleComplete = useCallback(() => {
      setIsDialogOpen(true)
    }, [])

    const handleConfirmDelete = useCallback(() => {
      onComplete(task.id)
      setIsDialogOpen(false)
    }, [onComplete, task.id])

    const handleCancelDelete = useCallback(() => {
      setIsDialogOpen(false)
    }, [])

    const isImage = useCallback((link) => {
      return link.match(/\.(jpeg|jpg|gif|png)$/)
    }, [])

    const sendFilesToTelegram = async (formData) => {
      setIsUploading(true)
      try {
        // Добавляем reminders_id в formData для Telegram бота
        formData.append('reminders_id', task.id)

        await axios.post(`${API_BASE_URL}5778/api/sendFiles`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        // Добавляем запись в таблицу sentMessagesNotifications
        const response = await axios.post(`${API_BASE_URL}5000/api/messages-notification-dealer`, {
          reminders_id: task.id, // ID уведомления
          sent_text: text, // Текст, который был отправлен
          sent_files: files.map((file) => sanitizeFilename(file.name)), // Безопасные имена файлов
        })

        Toastify({
          text: `Отправка прошла успешно. Содержание текста: ${text}`,
          duration: 7000,
          backgroundColor: 'green',
        }).showToast()

        return response.data
      } catch (error) {
        Toastify({
          text: 'Ошибка при отправке.',
          duration: 12000,
          backgroundColor: 'red',
        }).showToast()
      } finally {
        setIsUploading(false)
        setFiles([])
      }
    }

    const handleSendFiles = async (text, files) => {
      const chatIdMatch = title.match(/id:(\d+)/)

      if (chatIdMatch && chatIdMatch[1]) {
        const chatId = chatIdMatch[1]

        const formData = new FormData()
        formData.append('chat_id', chatId)

        // Добавляем текстовое сообщение, если оно существует
        if (text) {
          formData.append('text', text)
        }

        // Добавляем файлы, если они существуют
        files.forEach((file) => {
          // Создаем новый File объект с безопасным именем для отправки
          const safeName = sanitizeFilename(file.name)
          if (safeName !== file.name) {
            const safeFile = new File([file], safeName, {
              type: file.type,
              lastModified: file.lastModified,
            })
            formData.append('documents', safeFile)
          } else {
            formData.append('documents', file)
          }
        })

        const newMessage = await sendFilesToTelegram(formData)
        setSentMessages((prevMessages) => [...prevMessages, newMessage])
      } else {
        console.error('Chat ID не найден в заголовке.')
      }
    }

    return (
      <>
        <div
          ref={ref}
          {...(provided ? provided.draggableProps : {})}
          {...(provided ? provided.dragHandleProps : {})}
          className="task"
        >
          <div className="task-header">
            {isNotificationColumn && selectedEmployeeId === user.id && (
              <RiDeleteBinLine
                title="Удалить"
                onClick={handleComplete}
                className="close-button icon-pointer"
                style={{ color: '#FF6F61' }}
              />
            )}
            <RxWidth title="Развернуть" onClick={toggleModal} className="task-expand-icon" />
            {actionIcon}
          </div>
          {image && alt && <img src={image} alt={alt} className="task-image" />}
          <div className="task-tags">
            {tags.length > 0 ? (
              tags.map((tag) => (
                <span
                  key={tag.title}
                  className="task-tag"
                  style={{ backgroundColor: tag.bg, color: tag.text }}
                >
                  {tag.title} {'   '} <FaHashtag />
                </span>
              ))
            ) : (
              <span className="task-tag no-tag">
                БЕЗ ТЭГА <FaHashtag />
              </span>
            )}
          </div>
          <div className="task-details">
            <span className="task-time-reminder">Создано: {formatDate(createdAt)}</span>
            <span className="task-title">{title}</span>
            <div className="task-description" dangerouslySetInnerHTML={{ __html: description }} />
          </div>
          {links && links.length > 0 && (
            <div className="links">
              {links.map((link, index) => {
                const fileName = link.split('/').pop()
                return (
                  <div key={index} className="link-item">
                    {isImage(link) ? (
                      <a href={link} className="link" rel="noopener noreferrer">
                        <img src={link} alt={`Image ${index + 1}`} className="link-image" />
                      </a>
                    ) : (
                      <a href={link} className="link" rel="noopener noreferrer">
                        <FaFile className="file-icon" />
                      </a>
                    )}
                    <a href={link} className="link" rel="noopener noreferrer">
                      {isImage(link) ? `Изображение ${index + 1}` : fileName}
                    </a>
                  </div>
                )
              })}
            </div>
          )}

          {tags.some((tag) => tag.title.toLowerCase() === 'telegram') &&
            selectedEmployeeId === user.id && (
              <FileUpload
                taskId={task.id}
                files={files}
                text={text}
                setText={setText}
                setFiles={setFiles}
                isUploading={isUploading}
                handleSendFiles={handleSendFiles}
              />
            )}
          <div className="task-footer">
            <div className="task-deadline">
              <CiTimer className="task-icon" />
              <span className="task-deadline-text">Прошло: {formatElapsedTime()}</span>
            </div>
            {sentMessages.length > 0 && (
              <Tooltip
                title={<div>{formatSentMessages(sentMessages)}</div>}
                placement="right"
                arrow
              >
                <span>
                  <TbMessage2Share className="pulse" />
                </span>
              </Tooltip>
            )}
          </div>
        </div>

        {isModalOpen && (
          <TaskModal
            onClose={toggleModal}
            image={image}
            alt={alt}
            tags={tags}
            title={title}
            description={description}
            formatElapsedTime={formatElapsedTime}
            priority={priority}
          />
        )}
        <ConfirmationDialog
          open={isDialogOpen}
          onClose={handleCancelDelete}
          onConfirm={handleConfirmDelete}
          title="Подтверждение удаления"
          message="Вы уверены, что хотите удалить это уведомление?"
          btn1="Отмена"
          btn2="Удалить"
        />
      </>
    )
  }
)

TaskNotification.displayName = 'Task'
export default TaskNotification
