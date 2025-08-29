import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../../../../config'
import axios from 'axios'
import Toastify from 'toastify-js'
import { FaRegSave } from 'react-icons/fa'
import { MdCancelPresentation } from 'react-icons/md'
import './accountActivation.scss'

const ChangePassword = ({ isOpen, onClose, userId }) => {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      resetForm()
    }
  }, [isOpen])

  const handleSave = async () => {
    if (!/^(?=.*[a-zA-Z]{6,})[a-zA-Z\d]{6,}$/.test(password)) {
      setError(
        'Пароль должен содержать не менее 6 латинских букв и может включать цифры.'
      )
      return
    }

    try {
      const response = await axios.put(
        `${API_BASE_URL}5000/api/users/${userId}/change-password`,
        { newPassword: password }
      )

      if (response.status === 200) {
        Toastify({
          text: 'Пароль успешно изменен!',
          close: true,
          backgroundColor:
            'linear-gradient(to right,rgba(10, 243, 88, 0.81), #96c93d)',
        }).showToast()
        resetForm()
        onClose()
      }
    } catch (error) {
      Toastify({
        text: `Ошибка при изменении пароля:', ${error}`,
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
      setError(error)
    }
  }

  const resetForm = () => {
    setPassword('')
    setError('')
  }

  if (!isOpen) return null

  return (
    <div className="password-modal-overlay">
      <div className="password-modal-content">
        <h3>Смена пароля для пользователя ID: {userId}</h3>
        <input
          className="password-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Введите новый пароль..."
        />
        {error && (
          <p style={{ color: 'red' }} className="error-message">
            {error}
          </p>
        )}
        <div className="icon-password-container">
          <FaRegSave
            className="icon password-modal-icon"
            onClick={handleSave}
          />
          <MdCancelPresentation
            className="icon password-modal-icon"
            onClick={onClose}
          />
        </div>
      </div>
    </div>
  )
}

export default ChangePassword
