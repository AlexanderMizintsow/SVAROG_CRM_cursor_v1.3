import { useState } from 'react'
import { Tooltip } from '@mui/material'
import { API_BASE_URL } from '../../../config'
import './modalEmailToken.scss'

function ModalEmailToken({
  isOpen,
  onClose,
  title,
  content,
  inputText,
  inputVisible = false,
  onOk,
  onCancel,
}) {
  const [inputValue, setInputValue] = useState(inputText || '')

  const handleInputChange = (event) => {
    setInputValue(event.target.value)
  }

  const handleOk = async () => {
    try {
      const userDataString = localStorage.getItem('userData')
      const userData = userDataString ? JSON.parse(userDataString) : null
      const userId = userData ? userData.id : null

      if (userId) {
        const response = await fetch(`${API_BASE_URL}5001/save-email-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, emailToken: inputValue }),
        })

        if (!response.ok) {
          throw new Error('Failed to save email token')
        }
      }

      onOk && onOk(inputValue) // Call onOk if provided
      onClose()
    } catch (error) {
      console.error('Error saving email token:', error)
    }
  }

  const handleCancel = () => {
    onCancel && onCancel() // Call onCancel if provided
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-email-token-overlay" onClick={onClose}>
      <div className="modal-email-token-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-email-token-header">
          <Tooltip
            arrow
            color="neutral"
            size="lg"
            title="Токен от почты — это уникальный код, необходимый для доступа к вашей почте через сторонние приложения. Он используется вместо пароля, чтобы повысить безопасность и упростить интеграцию. Токен позволяет приложению взаимодействовать с вашей почтой, не зная вашего пароля, обеспечивая доступ только к необходимым функциям.
              Создать токен вы сможете в настройках вашей почты. Что бы перейти к ним нажмите на текст <почты> выделенный цветом!
              После того как токен будет создан, скопируйте его и вставьте в поле. Токен имеет вид (RxfRSeye8zgfyVUhiAtg). Далее необходимо выйти из приложения, обновить страницу и снова войти - почта будет работать из приложения."
          >
            <span className="modal-question">?</span>
          </Tooltip>
          <h2 className="modal-email-token-title">{title}</h2>
          <button type="button" className="modal-email-token-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-email-token-body">
          <p>
            Введите токен для своей почты. Его можно создать в настройках
            вашей{' '}
            <a
              href="https://account.mail.ru/user/2-step-auth/passwords?back_url=https%3A%2F%2Fid.mail.ru%2Fsecurity"
              target="_blank"
              rel="noopener noreferrer"
            >
              почты
            </a>
          </p>

          {inputVisible && (
            <div className="modal-email-token-input-wrap">
              <input
                type="text"
                id="modal-input-field"
                value={inputValue}
                onChange={handleInputChange}
                className="modal-email-token-input"
              />
            </div>
          )}
          <div className="modal-email-token-buttons">
            <button type="button" className="modal-email-token-btn cancel" onClick={handleCancel}>
              Отмена
            </button>
            {inputValue && (
              <button type="button" className="modal-email-token-btn ok" onClick={handleOk}>
                Ок
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModalEmailToken
