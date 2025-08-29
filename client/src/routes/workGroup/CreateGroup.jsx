import { useEffect, useState } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import ConfirmationDialog from '../../components/confirmationDialog/ConfirmationDialog'
import useUserStore from '../../store/userStore'
import { FaDeleteLeft } from 'react-icons/fa6'
import { MdContactSupport } from 'react-icons/md' // Импортируем иконку справки
import HelpModalWorkGroup from './HelpModalWorkGroup'
import { API_BASE_URL } from '../../../config'

const CreateGroup = () => {
  const { user } = useUserStore()
  const [groupName, setGroupName] = useState('')
  const [participants, setParticipants] = useState([])
  const [description, setDescription] = useState('')
  const [importance, setImportance] = useState('low')
  const [createType, setCreateType] = useState('range')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [userList, setUserList] = useState([])
  const [newParticipant, setNewParticipant] = useState('')
  const [time, setTime] = useState('')
  const [openDialog, setOpenDialog] = useState(false)
  const [openHelpModal, setOpenHelpModal] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/users`)

        setUserList(response.data)
      } catch (error) {
        Toastify({
          text: 'Ошибка при получении пользователей.',
          close: true,
          style: {
            backgroundColor: 'linear-gradient(to right, #ff0000, #ffcccc)',
          },
        }).showToast()
      }
    }
    fetchUsers()
  }, [])

  const handleAddParticipant = () => {
    const selectedUser = userList.find(
      (user) => user.id === Number(newParticipant)
    )
    if (
      newParticipant &&
      selectedUser &&
      !participants.includes(selectedUser.id)
    ) {
      setParticipants([...participants, selectedUser.id])
      setNewParticipant('')
    } else {
      Toastify({
        text: 'Участник уже добавлен или выбор недействителен.',
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #ff0000, #ffcccc)',
        },
      }).showToast()
    }
  }

  // Функция для удаления участника из списка
  const handleRemoveParticipant = (participantId) => {
    setParticipants(participants.filter((id) => id !== participantId))
  }

  const handleCreateGroup = async () => {
    const errors = []

    if (!groupName) errors.push('Название группы')
    if (participants.length === 0) errors.push('Участники')
    if (!description) errors.push('Описание задачи')
    if (!time) errors.push('Время')
    if (createType === 'fixed') {
      if (!selectedDate) errors.push('Дата')
    }
    if (createType === 'range' && (!startDate || !endDate)) {
      if (!startDate) errors.push('Дата начала')
      if (!endDate) errors.push('Дата окончания')
    }

    if (errors.length > 0) {
      Toastify({
        text: `Пожалуйста, заполните следующие обязательные поля: ${errors.join(
          ', '
        )}`,
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #ff0000, #ffcccc)',
        },
      }).showToast()
      return
    }

    let startDateTime, endDateTime

    if (createType === 'range') {
      startDateTime = new Date(startDate)
      endDateTime = new Date(endDate)

      const timeParts = time.split(':')
      startDateTime.setUTCHours(
        parseInt(timeParts[0], 10),
        parseInt(timeParts[1], 10),
        0
      )
      endDateTime.setUTCHours(
        parseInt(timeParts[0], 10),
        parseInt(timeParts[1], 10),
        0
      )
    } else {
      startDateTime = new Date(selectedDate)
      endDateTime = new Date(selectedDate)

      const timeParts = time.split(':')
      startDateTime.setUTCHours(
        parseInt(timeParts[0], 10),
        parseInt(timeParts[1], 10),
        0
      )
      endDateTime.setUTCHours(
        parseInt(timeParts[0], 10),
        parseInt(timeParts[1], 10),
        0
      )
    }

    const groupData = {
      group_name: groupName,
      description,
      importance,
      create_type: createType,
      start_date: createType === 'range' ? startDateTime.toISOString() : null,
      end_date: createType === 'range' ? endDateTime.toISOString() : null,
      selected_date:
        createType === 'fixed' ? startDateTime.toISOString() : null,
      created_by: user ? user.id : null,
      time,
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}5000/api/work_groups`,
        groupData
      )
      const workGroupId = response.data.id

      await Promise.all(
        participants.map(async (participantId) => {
          const payload = {
            work_groups_id: workGroupId,
            user_id: participantId,
          }

          try {
            await axios.post(
              `${API_BASE_URL}5000/api/group_participants`,
              payload
            )
          } catch (error) {
            console.error('Ошибка при добавлении участника:', error)
          }
        })
      )

      // Теперь вызываем новый API для отправки уведомлений
      await axios.post(`${API_BASE_URL}5777/api/create_group_notification`, {
        participants: [...participants, user.id], // Включаем создателя группы
        groupData,
      })

      setGroupName('')
      setParticipants([])
      setDescription('')
      setImportance('low')
      setCreateType('range')
      setStartDate('')
      setEndDate('')
      setSelectedDate('')
      setTime('')
      setNewParticipant('')

      Toastify({
        text: 'Группа успешно создана!',
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #007BFF, #0056b3)',
        },
      }).showToast()
    } catch (error) {
      console.error('Ошибка при создании группы:', error)
    }
  }

  const handleOpenDialog = () => {
    setOpenDialog(true)
  }

  const handleConfirmCreateGroup = async () => {
    await handleCreateGroup()
    setOpenDialog(false)
  }

  // Функция для открытия модального окна справки
  const handleOpenHelpModal = () => {
    setOpenHelpModal(true)
  }

  // Генерация часов с 7:00 до 20:00 (каждые 30 минут)
  const generateTimeOptions = () => {
    const times = []
    for (let hour = 8; hour <= 18; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${min
          .toString()
          .padStart(2, '0')}`
        times.push(timeString)
      }
    }
    return times
  }

  return (
    <div className="create-group">
      <MdContactSupport
        className="help-icon"
        onClick={handleOpenHelpModal}
        title="Справка"
      />
      <HelpModalWorkGroup
        type={'create'}
        open={openHelpModal}
        onClose={() => setOpenHelpModal(false)}
      />
      <input
        type="text"
        className="input-field"
        placeholder="Название группы"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
      />
      <textarea
        className="input-field"
        placeholder="Описание задачи"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div>
        <div className="select-container">
          <select
            id="participant-select"
            value={newParticipant}
            onChange={(e) => setNewParticipant(e.target.value)}
          >
            <option value="">Выберите участника</option>
            {userList.map((user) => (
              <option key={user.id} value={user.id}>
                {`${user.first_name} ${user.last_name}`}
              </option>
            ))}
          </select>
        </div>
        <button className="button" onClick={handleAddParticipant}>
          Добавить участника
        </button>
      </div>
      <ul className="participant-list">
        {participants.map((participantId, index) => {
          const participant = userList.find((user) => user.id === participantId)
          return participant ? (
            <li key={index}>
              {`${participant.first_name} ${participant.last_name}`}

              <FaDeleteLeft
                className="remove-button-user"
                title="Удалить"
                onClick={() => handleRemoveParticipant(participant.id)}
              />
            </li>
          ) : null
        })}
      </ul>
      <div>
        <div className="centered-radio">
          <label className="radio">
            <input
              type="radio"
              value="fixed"
              checked={createType === 'fixed'}
              onChange={() => setCreateType('fixed')}
            />
            <span> Указать точную дату</span>
          </label>
          <label className="radio">
            <input
              type="radio"
              value="range"
              checked={createType === 'range'}
              onChange={() => setCreateType('range')}
            />
            <span> Указать диапазон дат</span>
          </label>
        </div>

        {createType === 'fixed' ? (
          <>
            <label>Дата:</label>
            <input
              type="date"
              className="input-field input-date"
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <label>Время:</label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input-field input-date"
            >
              <option value="">Выберите время</option>
              {generateTimeOptions().map((timeOption) => (
                <option key={timeOption} value={timeOption}>
                  {timeOption}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label>Дата начала:</label>
            <input
              type="date"
              className="input-field input-date"
              onChange={(e) => setStartDate(e.target.value)}
            />
            <label>Дата окончания:</label>
            <input
              type="date"
              className="input-field input-date"
              onChange={(e) => setEndDate(e.target.value)}
            />
            <label>Время:</label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input-field input-date"
            >
              <option value="">Выберите время</option>
              {generateTimeOptions().map((timeOption) => (
                <option key={timeOption} value={timeOption}>
                  {timeOption}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <div>
        <label>Важность:</label>
        <select
          value={importance}
          onChange={(e) => setImportance(e.target.value)}
          className="input-field importance"
        >
          <option value="">Выберите важность</option>
          <option value="low">Низкая</option>
          <option value="medium">Средняя</option>
          <option value="high">Высокая</option>
        </select>
      </div>
      <button className="button" onClick={handleOpenDialog}>
        Создать рабочую группу
      </button>

      <ConfirmationDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onConfirm={handleConfirmCreateGroup}
        title="Создать рабочую группу?"
        message="Вы уверены, что хотите создать рабочую группу с указанными данными?"
        btn1="Отмена"
        btn2="Создать"
      />
    </div>
  )
}

export default CreateGroup
