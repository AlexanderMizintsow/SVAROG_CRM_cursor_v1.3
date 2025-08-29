import { useEffect, useState } from 'react'
import useUserStore from '../../store/userStore'
import { FaEnvelope, FaUser } from 'react-icons/fa'
import { PiEyeBold, PiEyeClosed } from 'react-icons/pi'
import axios from 'axios'
import Toastify from 'toastify-js'
import { API_BASE_URL } from '../../../config'
import 'toastify-js/src/toastify.css'
import './loginregister.scss'

const LoginRegister = ({ isConnectBD }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const { setUser } = useUserStore()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [forgotPassword, setForgotPassword] = useState(false) // State to manage forgot password mode
  const [resetEmail, setResetEmail] = useState('')

  //  "Запомнить меня"
  useEffect(() => {
    if (localStorage.getItem('rememberMe') === 'true') {
      setUsername(localStorage.getItem('username') || '')
      setPassword(localStorage.getItem('password') || '')
      setRememberMe(true)
    }
  }, [])

  // Обновление состояния при изменении галочки "Запомнить меня"
  const handleRememberMeChange = (e) => {
    const isChecked = e.target.checked
    setRememberMe(isChecked)
    if (isChecked) {
      localStorage.setItem('username', username)
      localStorage.setItem('password', password)
      localStorage.setItem('rememberMe', 'true')
    } else {
      localStorage.removeItem('username')
      localStorage.removeItem('password')
      localStorage.setItem('rememberMe', 'false')
    }
  }

  // Регистрация нового пользователя
  const handleRegister = async (e) => {
    e.preventDefault()
    //   setUsername('')
    //setPassword('')

    try {
      const response = await axios.post(`${API_BASE_URL}5000/register`, {
        username,
        password,
        email, // Добавлено поле электронной почты
      })

      Toastify({
        text: response.data.message,
        close: true,
        style: {
          background: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()
    } catch (error) {
      Toastify({
        text: error.response.data,
        close: true,
        style: {
          background: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        },

        className: 'error',
      }).showToast()
    }
  }

  // Вход пользователя
  const handleLogin = async (e) => {
    e.preventDefault()

    try {
      const response = await axios.post(`${API_BASE_URL}5000/login`, {
        username,
        password,
      })

      // Проверка успешного ответа от сервера
      if (response.status === 200 && response.data.user) {
        // Извлечение данных пользователя из ответа сервера
        const { user, token } = response.data

        // Сохранение данных пользователя в Zustand store
        setUser({
          id: user.id,
          username: user.username,
          role_assigned: user.role_assigned,
          role: user.role_name,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          middle_name: user.middle_name,
          birth_date: user.birth_date,
          role_id: user.role_id,
          role_name: user.role_name,
          token: user.token,
          position: user.position,
        })

        // Сохранение токена в localStorage для последующих запросов
        localStorage.setItem('token', token)
        localStorage.setItem('userData', JSON.stringify(user))
        // Отображение уведомления об успешном входе
        Toastify({
          text: 'Вход выполнен успешно',
          newWindow: true,
          close: true,
          gravity: 'bottom',
          position: 'right',
          background: 'linear-gradient(to right, #11b09b, #96c93d)',
          stopOnFocus: true, // Предотвращает закрытие уведомления при наведении курсора
        }).showToast()

        await axios.post(`${API_BASE_URL}5000/update-status`, {
          userId: user.id,
          status: 'online', // или 'offline'
        })
      }
    } catch (error) {
      // Обработка ошибок и отображение уведомления об ошибке
      Toastify({
        text: error.response ? error.response.data : 'Ошибка входа',
        newWindow: true,
        close: true,
        background: 'linear-gradient(to right, #ff5f6d, #ffc371)',
        stopOnFocus: true,
      }).showToast()
    }
  }

  // Запрос на восстановления пароля
  const handleForgotPassword = async (e) => {
    e.preventDefault()

    try {
      const response = await axios.post(`${API_BASE_URL}5000/forgot-password`, {
        email: resetEmail,
      })

      Toastify({
        text: response.data.message,
        close: true,
        style: {
          background: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()

      // Reset form after successful request
      setResetEmail('')
      setForgotPassword(false)
    } catch (error) {
      Toastify({
        text: error.response.data,
        close: true,
        style: {
          background: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        },
      }).showToast()
    }
  }

  // Переключение между регистрацией и входом
  const [action, setAction] = useState('')
  const registerLink = () => {
    setAction('active')
  }
  const loginLink = () => {
    setAction('')
  }

  // Переключение на форму восстановления пароля
  const toggleForgotPassword = () => {
    //  setForgotPassword(true)
  }

  return (
    <div className="loginregister">
      <div style={{ position: 'absolute', bottom: '0', right: '15px' }}>
        {isConnectBD !== 'Connected' ? (
          <p style={{ color: 'red', fontSize: '21px' }}>База данных не подключена</p>
        ) : null}
      </div>
      <div className={`wrapper ${action}`}>
        <div className="form-box login">
          {!forgotPassword ? (
            <form action="" onSubmit={handleLogin}>
              <h1>Авторизация</h1>
              <div className="input-box">
                <input
                  type="text"
                  placeholder="Логин"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <FaUser className="icon" />
              </div>
              <div className="input-box">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                {showPassword ? (
                  <PiEyeBold
                    className="icon password-icon"
                    onClick={() => setShowPassword((prev) => !prev)}
                  />
                ) : (
                  <PiEyeClosed
                    className="icon password-icon"
                    onClick={() => setShowPassword((prev) => !prev)}
                  />
                )}
              </div>

              <div className="remember-forgot">
                <label>
                  <input type="checkbox" checked={rememberMe} onChange={handleRememberMeChange} />
                  Запомнить меня
                </label>
                {/*<a href="#" onClick={toggleForgotPassword}>
                  Забыли пароль?
                </a>*/}
              </div>

              <button type="submit">Войти</button>

              <div className="register-link">
                <p>У вас нет учетной записи?</p>
                <a href="#" onClick={registerLink}>
                  Регистрация
                </a>
              </div>
            </form>
          ) : (
            <form action="" onSubmit={handleForgotPassword}>
              <h1>Восстановления пароля</h1>
              <div className="input-box">
                <input
                  type="email"
                  placeholder="Введите ваш email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
                <FaEnvelope className="icon" />
              </div>

              <button type="submit">Отправить</button>

              <div className="register-link">
                <a href="#" onClick={() => setForgotPassword(false)}>
                  Вернуться назад
                </a>
              </div>
            </form>
          )}
        </div>

        <div className="form-box register">
          <form action="" onSubmit={handleRegister}>
            <h1>Регистрация</h1>

            <div>
              <div className="input-box">
                <input
                  type="text"
                  placeholder="Логин"
                  title="Введите пароль латинскими символами"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <FaUser className="icon" />
              </div>
              <div className="input-box">
                <input
                  type="email"
                  placeholder="Почта"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <FaEnvelope className="icon" />
              </div>

              <div className="input-box">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Пароль"
                  title="Введите пароль латинскими символами"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {showPassword ? (
                  <PiEyeBold
                    className="icon password-icon"
                    onClick={() => setShowPassword((prev) => !prev)}
                  />
                ) : (
                  <PiEyeClosed
                    className="icon password-icon"
                    onClick={() => setShowPassword((prev) => !prev)}
                  />
                )}
              </div>
            </div>

            <button type="submit">Зарегистрироваться</button>
            <div className="register-link">
              <p>Уже зарегистрированы?</p>
              <a href="#" onClick={loginLink}>
                Авторизоваться
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginRegister
