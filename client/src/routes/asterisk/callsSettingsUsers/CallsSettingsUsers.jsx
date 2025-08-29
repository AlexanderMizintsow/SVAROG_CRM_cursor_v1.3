import { useState, useEffect } from 'react'
import axios from 'axios'
import { CircularProgress } from '@mui/material'
import './callsSettingsUsers.scss'
import Toastify from 'toastify-js'
import { PiTelegramLogoLight } from 'react-icons/pi'
import { API_BASE_URL } from '../../../../config'
import callsNotificationStore from '../../../store/callsNotificationStore' // Импортируйте Zustand

const CallsSettingsUsers = () => {
  const [isLoading, setLoading] = useState(true)
  const { toggleAppRestart } = callsNotificationStore()
  const [showMissedCallsEmployee, setShowMissedCallsEmployee] = useState(true)
  const [showAcceptedCallsEmployee, setShowAcceptedCallsEmployee] =
    useState(true)
  const [showCallMissedTg, setShowCallMissedTg] = useState(false) // Новое состояние для Telegram
  const [showRemindersCalls, setShowRemindersCalls] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      const userData = JSON.parse(localStorage.getItem('userData'))
      const userId = userData ? userData.id : null

      if (userId) {
        setLoading(true)
        try {
          const missedResponse = await axios.get(
            `${API_BASE_URL}5004/api/calls-settings-missed/${userId}`
          )
          const acceptedResponse = await axios.get(
            `${API_BASE_URL}5004/api/calls-settings-accepted/${userId}`
          )
          const tgResponse = await axios.get(
            `${API_BASE_URL}5004/api/calls-settings-tg/${userId}`
          ) // Запрос для нового поля
          const remindersResponse = await axios.get(
            `${API_BASE_URL}5004/api/calls-settings-reminders/${userId}` // Запрос для нового поля
          )
          setShowMissedCallsEmployee(
            missedResponse.data.showMissedCallsEmployee
          )
          setShowAcceptedCallsEmployee(
            acceptedResponse.data.showAcceptedCallsEmployee
          )
          setShowCallMissedTg(tgResponse.data.showCallMissedTg) // Установка нового значения
          setShowRemindersCalls(remindersResponse.data.showRemindersCalls)
        } catch (error) {
          console.error('Ошибка получения настроек:', error)
        } finally {
          setLoading(false) // Установка загрузки в false
        }
      }
    }

    fetchSettings()
  }, []) // Пустой массив, чтобы выполнить код только при монтировании компонента

  const handleSaveSettings = async () => {
    const userData = JSON.parse(localStorage.getItem('userData'))
    const userId = userData ? userData.id : null

    if (userId) {
      try {
        await axios.put(`${API_BASE_URL}5004/api/calls-settings/${userId}`, {
          showMissedCallsEmployee,
          showAcceptedCallsEmployee,
          showCallMissedTg,
          showRemindersCalls, // Отправляем новое значение
        })

        toggleAppRestart()

        Toastify({
          text: 'Настройки звонков успешно сохранены',
          close: true,
          style: {
            backgroundColor: 'linear-gradient(to right, #007BFF, #0056b3)',
          },

          className: 'info',
        }).showToast()
      } catch (error) {
        console.error('Ошибка при сохранении настроек:', error)
        Toastify({
          text: 'Ошибка при сохранении настроек',
          style: {
            backgroundColor: 'linear-gradient(to right, #ff0000, #ffcccc)',
          },

          className: 'error',
        }).showToast()
      }
    }
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress
          className="progress"
          color="primary"
          size={50}
          variant="indeterminate"
        />
      </div>
    )
  }

  return (
    <div className="calls-settings">
      <h2>Настройки звонков</h2>

      <div className="settings-group">
        <h4>Параметры отображения звонков внутри офиса</h4>
        <label>
          <input
            type="checkbox"
            checked={showMissedCallsEmployee}
            onChange={() => setShowMissedCallsEmployee((prev) => !prev)}
          />
          <span>
            Показывать пропущенные звонки от сотрудников внутри компании
          </span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showAcceptedCallsEmployee}
            onChange={() => setShowAcceptedCallsEmployee((prev) => !prev)}
          />
          <span>
            {' '}
            Показывать принятые звонки от сотрудников внутри компании{' '}
          </span>
        </label>
        <label>
          <h4>Параметры отображения звонков и уведомлений для Telegramm</h4>
          <p className="bot-href">
            {' '}
            <a
              href="https://t.me/svarog_notifications_bot"
              target="_blank"
              rel="noopener noreferrer"
            >
              Написать в бота https://t.me/svarog_notifications_bot{' '}
            </a>{' '}
            <span> Запуск чат-бота:</span>{' '}
            <span className="command">/start</span>
          </p>
          <input
            type="checkbox"
            checked={showCallMissedTg}
            onChange={() => setShowCallMissedTg((prev) => !prev)}
          />
          <span>
            {' '}
            Отображать уведомления пропущенных звонков в чатах Телеграмм{' '}
          </span>
          <PiTelegramLogoLight
            title="При включении данной функции необходимо добавить чат-бот в Телеграмме ..."
            className="icon icon-puls"
            style={{ fontSize: '20px', marginLeft: '15px' }}
          />{' '}
          <span>
            <p>
              (Настройка доступна из чата{' '}
              <span className="command">/пропущенные - </span>,{' '}
              <span className="command">/пропущенные +</span>, )
            </p>
          </span>
        </label>
        <label>
          <h4>Параметры отображения напоминаний для чат-бота</h4>
          <input
            type="checkbox"
            checked={showRemindersCalls}
            onChange={() => setShowRemindersCalls((prev) => !prev)}
          />
          <span>
            Отображать напоминания в чат-бот для уведомлений о звонках
          </span>
        </label>
      </div>

      <button className="save-settings" onClick={handleSaveSettings}>
        Сохранить настройки
      </button>
    </div>
  )
}

export default CallsSettingsUsers
