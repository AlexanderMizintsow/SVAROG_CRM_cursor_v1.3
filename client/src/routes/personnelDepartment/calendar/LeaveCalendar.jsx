import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './UserStatusScheduler.scss'

const LeaveCalendar = () => {
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [statusType, setStatusType] = useState('отпуск')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [specificDates, setSpecificDates] = useState([])
  const [currentSpecificDate, setCurrentSpecificDate] = useState('')
  const [isPeriodMode, setIsPeriodMode] = useState(true)

  useEffect(() => {
    const fetchUsers = async () => {
      const response = await axios.get(`${API_BASE_URL}5000/api/users`)
      setUsers(response.data)
    }
    fetchUsers()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    const statusData = {
      user_id: selectedUser,
      status: statusType,
      start_date: isPeriodMode ? startDate : null,
      end_date: isPeriodMode ? endDate : null,
      specific_dates: isPeriodMode ? [] : specificDates,
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}5000/api/user-statuses`,
        statusData
      )

      const userStatusId = response.data.id
      const successfulSave = isPeriodMode || specificDates.length > 0

      // Уведомление о сохранении статуса
      if (successfulSave) {
        toast.success('Статус успешно сохранён!')
      }

      if (!isPeriodMode && specificDates.length > 0) {
        for (const date of specificDates) {
          try {
            await axios.post(`${API_BASE_URL}5000/api/user-status-dates`, {
              user_status_id: userStatusId,
              specific_date: date,
            })
            // Уведомление о конкретной дате
            toast.success(`Дата ${date} успешно сохранена!`)
          } catch (error) {
            // Обработка ошибки сохранения конкретной даты
            //   toast.error('Ошибка при сохранении конкретной даты: ' + date)
          }
        }
      }

      // Очистка состояния после отправки
      setSelectedUser('')
      setStatusType('отпуск')
      setStartDate('')
      setEndDate('')
      setCurrentSpecificDate('')
      setSpecificDates([])
    } catch (error) {
      toast.error('Ошибка при сохранении статуса. Попробуйте снова.') // Сообщение об ошибке
    }
  }

  const addSpecificDate = () => {
    if (currentSpecificDate) {
      setSpecificDates([...specificDates, currentSpecificDate])
      setCurrentSpecificDate('')
    }
  }

  const removeSpecificDate = (date) => {
    setSpecificDates(specificDates.filter((d) => d !== date))
  }

  const handleModeChange = (mode) => {
    setIsPeriodMode(mode)
    if (mode) {
      setStartDate('')
      setEndDate('')
      setSpecificDates([])
    } else {
      setCurrentSpecificDate('')
    }
  }

  const isSubmitDisabled = () => {
    return (
      !selectedUser ||
      (isPeriodMode && (!startDate || !endDate)) ||
      (!isPeriodMode && specificDates.length === 0)
    )
  }

  return (
    <div className="user-status-scheduler">
      <h2>Планировщик статусов сотрудников</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="user">Сотрудник</label>
        <select
          id="user"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          required
        >
          <option value="" disabled>
            Выберите сотрудника
          </option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {`${user.first_name} ${user.last_name}`}
            </option>
          ))}
        </select>

        <label htmlFor="status">Тип статуса</label>
        <select
          id="status"
          value={statusType}
          onChange={(e) => setStatusType(e.target.value)}
        >
          <option value="отпуск">Отпуск</option>
          <option value="командировка">Командировка</option>
          <option value="болезнь">Болезнь</option>
          <option value="на обучении">На обучении</option>
        </select>

        <div className="mode-selection">
          <input
            type="radio"
            id="period"
            name="statusType"
            checked={isPeriodMode}
            onChange={() => handleModeChange(true)}
          />
          <label style={{ marginRight: '35px' }} htmlFor="period">
            Период
          </label>

          <input
            type="radio"
            id="specificDates"
            name="statusType"
            checked={!isPeriodMode}
            onChange={() => handleModeChange(false)}
          />
          <label htmlFor="specificDates">Конкретные даты</label>
        </div>

        {isPeriodMode ? (
          <>
            <label htmlFor="startdate">Дата начала</label>
            <input
              className="user-status-scheduler-input-date"
              type="date"
              id="startdate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />

            <label htmlFor="enddate">Дата окончания</label>
            <input
              className="user-status-scheduler-input-date"
              type="date"
              id="enddate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </>
        ) : (
          <>
            <label htmlFor="specificDate">Добавить конкретную дату</label>
            <input
              type="date"
              id="specificDate"
              value={currentSpecificDate}
              onChange={(e) => setCurrentSpecificDate(e.target.value)}
            />
            <button
              style={{ marginBottom: '20px' }}
              type="button"
              onClick={addSpecificDate}
            >
              Добавить дату
            </button>

            <ul>
              {specificDates.map((date, index) => (
                <li key={index}>
                  {date}{' '}
                  <button
                    type="button"
                    onClick={() => removeSpecificDate(date)}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <button type="submit" disabled={isSubmitDisabled()}>
          Сохранить статус
        </button>
      </form>
      <ToastContainer />
    </div>
  )
}

export default LeaveCalendar
