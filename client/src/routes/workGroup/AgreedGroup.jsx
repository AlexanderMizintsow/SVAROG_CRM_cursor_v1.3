import { useEffect, useState } from 'react'
import axios from 'axios'
import useUserStore from '../../store/userStore'
import { MdContactSupport } from 'react-icons/md'
import HelpModalWorkGroup from './HelpModalWorkGroup'
import ConfirmationDialog from '../../components/confirmationDialog/ConfirmationDialog'
import { API_BASE_URL } from '../../../config'

const AgreedGroup = () => {
  const { user } = useUserStore()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openHelpModal, setOpenHelpModal] = useState(false)
  const [openConfirmationDialog, setOpenConfirmationDialog] = useState(false)
  const [currentGroupId, setCurrentGroupId] = useState(null)
  const [actionType, setActionType] = useState('')

  useEffect(() => {
    const fetchFixedGroups = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/fixed-groups`)
        setGroups(response.data)
      } catch (err) {
        setError('Ошибка при загрузке данных групп.')
      } finally {
        setLoading(false)
      }
    }

    fetchFixedGroups()
  }, [])

  if (loading) {
    return <p>Загрузка...</p>
  }

  if (error) {
    return <p>{error}</p>
  }

  const importanceStyles = {
    low: { color: 'green' },
    medium: { color: 'orange' },
    high: { color: 'red' },
  }

  const calculateRemainingTime = (dateString) => {
    const targetDate = new Date(dateString)
    const now = new Date()
    const timeDifference = targetDate - now

    if (timeDifference < 0) {
      return { time: 'Время истекло', color: 'red', isExpired: true } // Если время истекло, возвращаем 'красный' цвет
    }

    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24))
    const hours = Math.floor(
      (timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    )
    const minutes = Math.floor(
      (timeDifference % (1000 * 60 * 60)) / (1000 * 60)
    )

    let color
    // Условие для выбора цвета в зависимости от оставшихся дней
    if (days > 3) {
      color = '#388E3C' // Более 3 дней
    } else if (days >= 1) {
      color = '#E67E22' // 1-2 дня
    } else {
      color = '#B71C1C' // Менее 1 дня
    }

    return {
      time: `${days} дн. ${hours} ч. ${minutes} мин.`,
      color: color,
      isExpired: false,
    }
  }

  // Функция для получения дня недели
  const getWeekday = (dateString) => {
    const date = new Date(dateString)
    const options = { weekday: 'long' }
    return date.toLocaleDateString('ru-RU', options) // Получаем день недели на русском
  }

  // Функция для форматирования даты
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }

    const formattedDate = date.toLocaleString('ru-RU', options)
    return formattedDate.replace(',', '') // Убираем запятую между датой и временем
  }

  const handleOpenHelpModal = () => {
    setOpenHelpModal(true)
  }

  const handleCancelGroup = (groupId) => {
    setCurrentGroupId(groupId)
    setActionType('cancel') // Устанавливаем действие на отмену
    setOpenConfirmationDialog(true)
  }

  const handleComplectGroup = (groupId) => {
    setCurrentGroupId(groupId)
    setActionType('complect')
    setOpenConfirmationDialog(true)
  }
  const handleConfirmAction = async () => {
    const group = groups.find((g) => g.id === currentGroupId)
    const selectedDateTime = group.selected_date // Сохраняем текущее значение selected_date

    try {
      if (actionType === 'complect') {
        await axios.patch(
          `${API_BASE_URL}5000/api/updateWorkGroup/${currentGroupId}`,
          {
            selected_date: selectedDateTime,
            start_date: null,
            end_date: null,
            create_type: 'complect',
          }
        )
        console.log(`Группа ${currentGroupId} завершена!`)
      } else if (actionType === 'cancel') {
        await axios.patch(
          `${API_BASE_URL}5000/api/updateWorkGroup/${currentGroupId}`,
          {
            selected_date: selectedDateTime,
            start_date: null,
            end_date: null,
            create_type: 'cancel',
          }
        )
        console.log(`Собрание группы ${currentGroupId} отменено!`)
      }

      // Отправка уведомлений участникам
      await axios.post(`${API_BASE_URL}5777/api/create_group_notification`, {
        participants: [...group.participant_ids, user.id], // Включаем создателя группы
        groupData: {
          ...group,
          selected_date: selectedDateTime,
          create_type: actionType, // Устанавливаем create_type
        },
      })

      // Обновляем группы после завершения/отмены
      const updatedResponse = await axios.get(
        `${API_BASE_URL}5000/api/fixed-groups`
      )
      setGroups(updatedResponse.data)
    } catch (error) {
      console.error('Ошибка при изменении группы:', error)
    } finally {
      setOpenConfirmationDialog(false)
    }
  }

  return (
    <div>
      <MdContactSupport
        className="help-icon"
        onClick={handleOpenHelpModal}
        title="Справка"
      />
      <HelpModalWorkGroup
        type={'agreed'}
        open={openHelpModal}
        onClose={() => setOpenHelpModal(false)}
      />
      {groups.length === 0 ? (
        <p>Нет согласованных групп.</p>
      ) : (
        groups
          .filter((group) => {
            const isParticipant = group.participant_ids.includes(user.id)
            const isCreator = user.id === group.created_by
            return isParticipant || isCreator
          })
          .map((group) => {
            const remainingTimeInfo = calculateRemainingTime(
              group.selected_date
            ) // Вычисляем оставшееся время
            return (
              <div className="group-card" key={group.id}>
                {user.id === group.created_by && remainingTimeInfo.isExpired ? (
                  <button
                    onClick={() => handleComplectGroup(group.id)}
                    className="complete-button"
                  >
                    Завершить
                  </button>
                ) : user.id === group.created_by ? (
                  <button
                    onClick={() => handleCancelGroup(group.id)}
                    className="cancel-button"
                  >
                    Отменить собрание рабочей группы
                  </button>
                ) : null}
                <span className="participants-header">
                  Создатель группы:{' '}
                  <span>{`${group.last_name} ${group.first_name} ${group.middle_name}`}</span>
                </span>

                <strong style={importanceStyles[group.importance]}>
                  {group.group_name}
                </strong>
                <p className="date">Дата: {formatDate(group.selected_date)}</p>

                <p
                  className="remaining-time"
                  style={{ color: remainingTimeInfo.color }}
                >
                  Осталось: <strong>{remainingTimeInfo.time}</strong>
                </p>

                <p className="weekday">
                  День недели: {getWeekday(group.selected_date)}
                </p>

                <p className="description">
                  Описание задачи: {group.description}
                </p>

                <h4 className="participants-header">Участники:</h4>
                <ul className="participant-list">
                  {Array.isArray(group.participants) &&
                  group.participants.length > 0 ? (
                    group.participants.map((participant, idx) => (
                      <li key={idx}>{participant}</li>
                    ))
                  ) : (
                    <li>Нет участников.</li>
                  )}
                </ul>
              </div>
            )
          })
      )}
      <ConfirmationDialog
        open={openConfirmationDialog}
        onClose={() => setOpenConfirmationDialog(false)}
        onConfirm={handleConfirmAction}
        title="Подтверждение"
        message="Вы действительно хотите завершить рабочую группу?"
        btn1="Отмена"
        btn2="Да"
      />
    </div>
  )
}

export default AgreedGroup
