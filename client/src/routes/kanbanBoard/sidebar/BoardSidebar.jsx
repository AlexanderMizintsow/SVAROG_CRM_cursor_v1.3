import { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import useUserStore from '../../../store/userStore'
import useRemindersStore from '../../../store/useRemindersStore'
import { IoNotificationsOffOutline } from 'react-icons/io5'
import './BoardSidebar.scss'
import useKanbanStore from '../../../store/useKanbanStore'

const BoardSidebar = ({
  userId,
  isOpen,
  onClose,
  selectedEmployeeId,
  setSelectedEmployeeId,
  isContextMenuOpen,
}) => {
  const { user } = useUserStore((state) => state)
  const [isEmployeeListOpen, setEmployeeListOpen] = useState(false)
  const { employeeList } = useKanbanStore((state) => state)
  const { reminders } = useRemindersStore()
  const [showOverdueNotification, setShowOverdueNotification] = useState(false)
  const [showOverdueImplementer, setShowOverdueImplementer] = useState(false)
  const [loading, setLoading] = useState(true)
  const roleConfirm =
    user &&
    ['Администратор', 'Руководитель отдела', 'Директор'].includes(
      user?.role_name
    )

  useEffect(() => {
    const fetchSettings = async () => {
      if (userId) {
        setLoading(true)
        try {
          const response = await axios.get(
            `${API_BASE_URL}5004/api/settings-overdue-notification/${userId}`
          )
          setShowOverdueNotification(response.data.showoverduenotification) // Получение значения из ответа
          setShowOverdueImplementer(response.data.showoverdueimplementer) // Получение значения из ответа
        } catch (error) {
          console.error('Ошибка получения настроек:', error)
        } finally {
          setLoading(false)
        }
      }
    }

    fetchSettings()
  }, [userId])

  const handleToggleOverdueNotification = async () => {
    if (userId !== null) {
      try {
        // Обновляем состояние локально
        setShowOverdueNotification((prev) => !prev)
        await axios.post(
          `${API_BASE_URL}5004/api/settings-overdue-notification-update/${userId}`,
          {
            showOverdueNotification: !showOverdueNotification,
          }
        )
      } catch (error) {
        console.error('Ошибка сохранения настроек:', error)
      }
    }
  }
  const handleToggleOverdueImplementer = async () => {
    if (userId !== null) {
      try {
        setShowOverdueImplementer((prev) => !prev)
        await axios.post(
          `${API_BASE_URL}5004/api/settings-overdue-implementer-notification-update/${userId}`,
          {
            showOverdueImplementer: !showOverdueImplementer,
          }
        )
      } catch (error) {
        console.error('Ошибка сохранения настроек:', error)
      }
    }
  }

  const toggleEmployeeList = () => {
    setEmployeeListOpen((prev) => !prev)
  }

  const handleEmployeeClick = (id) => {
    if (id) {
      setSelectedEmployeeId(id)
    }
  }

  return (
    <div className={`sidebar modal ${isOpen ? 'open' : ''}`}>
      <button className="sidebar-close" onClick={onClose}>
        ×
      </button>

      <div className="sidebar-content">
        <button className="toggle-button" onClick={toggleEmployeeList}>
          {isEmployeeListOpen ? 'Скрыть сотрудников' : 'Мои сотрудники'}
        </button>
        <div
          className={`employee-list-container ${
            isEmployeeListOpen ? 'open' : ''
          }`}
          style={{ pointerEvents: isContextMenuOpen ? 'none' : 'auto' }}
        >
          <ul
            className={`employee-list ${
              isContextMenuOpen ? 'employee-list-none' : ''
            }`}
          >
            {/*employees*/}
            {employeeList.map((employee) => {
              const employeeReminders = reminders.filter(
                (reminder) => reminder.user_id === employee.user_id
              )

              return (
                <li
                  key={employee.user_id}
                  className={`employee-item ${
                    selectedEmployeeId === employee.user_id
                      ? 'employee-list-selected'
                      : ''
                  }`}
                  onClick={() => handleEmployeeClick(employee.user_id)}
                >
                  <span className="sidebar-employee-text">
                    {`${employee.last_name} ${employee.first_name} ${employee.middle_name}`}
                    <span className="notification-contain-block">
                      {employeeReminders.length ? (
                        <span className="notification-container">
                          {
                            <IoNotificationsOffOutline className="notification-reminder" />
                          }
                          <span className="notification-reminder-count">
                            {employeeReminders.length}
                          </span>
                        </span>
                      ) : (
                        ''
                      )}
                    </span>
                  </span>

                  <div
                    className="sidebar-employee-status"
                    style={{
                      backgroundColor:
                        employee.status === 'not_active'
                          ? 'gray'
                          : employee.status === 'offline'
                          ? 'red'
                          : 'green',
                    }}
                  ></div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="calls-settings">
        <div className="settings-group">
          <h4>Настройки</h4>
          {loading ? ( // Если данные загружаются
            <p>Загрузка...</p>
          ) : (
            <label>
              <input
                type="checkbox"
                checked={showOverdueNotification}
                onChange={handleToggleOverdueNotification}
              />
              <span>Сообщать в чат-бот о просроченных уведомлениях</span>
            </label>
          )}
        </div>
        {roleConfirm && (
          <div className="settings-group">
            {loading ? ( // Если данные загружаются
              <p>Загрузка...</p>
            ) : (
              <label>
                <input
                  type="checkbox"
                  checked={showOverdueImplementer}
                  onChange={handleToggleOverdueImplementer}
                />
                <span>
                  Сообщать в чат-бот о просроченных уведомлениях подчиненных
                  сотрудников отдела
                </span>
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BoardSidebar
