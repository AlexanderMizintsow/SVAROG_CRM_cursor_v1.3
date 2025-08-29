import { useEffect, useState } from 'react'
import axios from 'axios'
import useUserStore from '../../store/userStore'
import Toastify from 'toastify-js'
import ConfirmationDialog from '../../components/confirmationDialog/ConfirmationDialog'

import io from 'socket.io-client'
import { MdContactSupport } from 'react-icons/md'
import HelpModalWorkGroup from './HelpModalWorkGroup'
import { API_BASE_URL } from '../../../config'

const Planning = () => {
  const { user } = useUserStore()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDates, setSelectedDates] = useState({})
  const [currentVoting, setCurrentVoting] = useState(null) // Состояние для текущего голосования
  const [dateConfirmed, setDateConfirmed] = useState(false)
  const [openDialog, setOpenDialog] = useState(false) // Состояние для диалогового окна
  const [groupToDelete, setGroupToDelete] = useState(null) // ID группы для удаления
  const [participantToRemove, setParticipantToRemove] = useState(null)
  const [openHelpModal, setOpenHelpModal] = useState(false)

  useEffect(() => {
    if (currentVoting) {
      const { group, participantId } = currentVoting
      handleConfirmDates(group, participantId)
      setCurrentVoting(null) // Сбрасываем текущее голосование
    }
  }, [currentVoting, selectedDates])

  useEffect(() => {
    const socket = io(`${API_BASE_URL}5000`)

    // Обработка события обновлений голосов
    socket.on(
      'participantVotesUpdated',
      ({ group_id, participant, selected_dates }) => {
        console.log('Голоса обновлены:', group_id, participant, selected_dates)
        // Здесь обновите состояние компонента
        setSelectedDates((prev) => ({
          ...prev,
          [group_id]: {
            ...prev[group_id],
            [participant]: selected_dates,
          },
        }))
        // Дополнительно можно вызвать fetchParticipantVotes(), если нужно обновление
      }
    )

    return () => {
      socket.disconnect() // Очистка сокета при размонтировании компонента
    }
  }, [])

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/range-groups`)
        setGroups(response.data)
      } catch (err) {
        setError('Ошибка при загрузке данных групп.')
      } finally {
        setLoading(false)
      }
    }

    /* const storedSelectedDates =
        JSON.parse(localStorage.getItem('selectedDates')) || {}
      setSelectedDates(storedSelectedDates)*/

    const fetchParticipantVotes = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}5000/api/participant_votes`
        )

        const storedSelectedDates = response.data

        setSelectedDates(storedSelectedDates)
      } catch (error) {
        console.error('Ошибка при получении голосов участников:', error)
      }
    }
    fetchGroups()
    fetchParticipantVotes()
  }, [dateConfirmed])

  const getAvailableDatesInRange = (start, end) => {
    const availableDates = []
    let startDate = new Date(start)
    const endDate = new Date(end)

    while (startDate <= endDate) {
      availableDates.push(startDate.toISOString().split('T')[0])
      startDate.setDate(startDate.getDate() + 1)
    }

    return availableDates
  }

  const handleCheckboxChange = (groupId, participantId, date) => {
    setSelectedDates((prev) => {
      const participantDates = prev[groupId]
        ? prev[groupId][participantId] || []
        : []
      const isSelected = participantDates.includes(date)
      const updatedDates = isSelected
        ? participantDates.filter((d) => d !== date)
        : [...participantDates, date]

      const newSelectedDates = {
        ...prev,
        [groupId]: {
          ...prev[groupId],
          [participantId]: updatedDates,
        },
      }

      localStorage.setItem('selectedDates', JSON.stringify(newSelectedDates))

      // Устанавливаем текущее голосование
      setCurrentVoting({
        group: groups.find((group) => group.id === groupId),
        participantId,
      })

      return newSelectedDates
    })
  }

  const handleConfirmDates = async (group, participantId) => {
    const votes = selectedDates[group.id] || {}
    const selectedDatesForParticipant = votes[participantId] || []

    if (selectedDatesForParticipant.length > 0) {
      await axios.post(`${API_BASE_URL}5000/api/participant_votes`, {
        group_id: group.id,
        participant: participantId,
        selected_dates: selectedDatesForParticipant,
      })

      // Проверка, проголосовали ли все участники
      if (Object.keys(votes).length === group.participants.length) {
        const commonDate = findCommonDate(votes)
        if (commonDate) {
          const timeFromStartDate = getTimeFromStartDate(group.start_date)
          const selectedDateTime = `${commonDate} ${timeFromStartDate}`

          await axios.patch(
            `${API_BASE_URL}5000/api/updateWorkGroup/${group.id}`,
            {
              selected_date: selectedDateTime,
              start_date: null,
              end_date: null,
              create_type: 'fixed',
            }
          )

          // вызываем API для отправки уведомлений
          await axios.post(
            `${API_BASE_URL}5777/api/create_group_notification`,
            {
              participants: [
                ...group.participants.map((participant) => participant.id),
                user.id,
              ],
              groupData: {
                ...group,
                selected_date: selectedDateTime,
                create_type: 'fixed',
              },
            }
          )

          Toastify({
            text: 'Общая дата успешно зафиксирована: ' + selectedDateTime,
            close: true,
            style: {
              backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
            },
          }).showToast()

          localStorage.removeItem('selectedDates')

          setDateConfirmed((prev) => !prev)
        } else {
          Toastify({
            text: 'Не удалось определить общую дату для участников.',
            close: true,
            style: {
              backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
            },
          }).showToast()
        }
      } else {
        Toastify({
          text: 'Вы успешно подтвердили выбор дат. Ожидаем, когда проголосуют все участники.',
          close: true,
          style: {
            backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
          },
        }).showToast()
      }
    } else {
      Toastify({
        text: 'Пожалуйста, выберите хотя бы одну дату.',
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #87CEFA, #1E90FF)',
        },
      }).showToast()
    }
  }

  const handleRemoveParticipant = async () => {
    if (participantToRemove) {
      const { groupId, participantId } = participantToRemove
      console.log(
        `Удаление участника: Группа - ${groupId}, Участник - ${participantId}`
      )

      try {
        // Удаление участника на сервере
        await axios.delete(
          `${API_BASE_URL}5000/api/group_participants/${groupId}/${participantId}`
        )

        // Обновляем состояние групп
        setGroups((prevGroups) =>
          prevGroups.map((group) => {
            if (group.id === groupId) {
              return {
                ...group,
                participants: group.participants.filter(
                  (participant) => participant.id !== participantId
                ),
              }
            }
            return group
          })
        )

        // Удаляем выбранные даты для участника
        setSelectedDates((prev) => {
          const newSelectedDates = { ...prev }
          if (newSelectedDates[groupId]) {
            delete newSelectedDates[groupId][participantId] // Удаляем даты участника
            // Удаляем группу, если у неё больше нет участников
            if (Object.keys(newSelectedDates[groupId]).length === 0) {
              delete newSelectedDates[groupId]
            }
          }
          localStorage.setItem(
            'selectedDates',
            JSON.stringify(newSelectedDates)
          ) // Сохраняем изменения в локальном хранилище
          return newSelectedDates // Возвращаем обновлённые выбранные даты
        })

        Toastify({
          text: 'Участник успешно удален.',
          close: true,
          style: {
            backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
          },
        }).showToast()

        // Получение актуального состояния голосов
        const updatedSelectedDates =
          JSON.parse(localStorage.getItem('selectedDates')) || {}
        const votes = updatedSelectedDates[groupId] || {} // Получаем текущие голоса

        // Вместо запроса из групповых данных получаем из группы, которая обновилась только что
        const remainingParticipants =
          groups.find((group) => group.id === groupId)?.participants.length - 1

        console.log('Текущие голоса:', votes) // Отладка: текущие голоса после удаления
        console.log(
          'Общее количество оставшихся участников:',
          remainingParticipants
        )

        // Проверка на совпадение количества голосов с актуальным числом оставшихся участников
        if (Object.keys(votes).length === remainingParticipants) {
          const commonDate = findCommonDate(votes) // Определение общей даты

          if (commonDate) {
            const timeFromStartDate = getTimeFromStartDate(
              groups.find((group) => group.id === groupId).start_date
            )
            const selectedDateTime = `${commonDate} ${timeFromStartDate}`

            // Обновление группы с общей датой на сервере
            await axios.patch(
              `${API_BASE_URL}5000/api/updateWorkGroup/${groupId}`,
              {
                selected_date: selectedDateTime,
                start_date: null,
                end_date: null,
                create_type: 'fixed',
              }
            )

            Toastify({
              text: 'Общая дата успешно зафиксирована: ' + selectedDateTime,
              close: true,
              style: {
                backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
              },
            }).showToast()
            localStorage.removeItem('selectedDates')
          } else {
            Toastify({
              text: 'Не удалось определить общую дату для участников.',
              close: true,
              style: {
                backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
              },
            }).showToast()
          }
        } else {
          Toastify({
            text: 'Ожидаем голосования от всех участников.',
            close: true,
            style: {
              backgroundColor: 'linear-gradient(to right, #87CEFA, #1E90FF)',
            },
          }).showToast()
        }
      } catch (error) {
        console.error('Ошибка при удалении участника:', error)
        Toastify({
          text: 'Ошибка при удалении участника.',
          close: true,
          style: {
            backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
          },
        }).showToast()
      } finally {
        setParticipantToRemove(null)
        setOpenDialog(false)
      }
    }
  }

  const handleOpenRemoveParticipantDialog = (groupId, participantId) => {
    setParticipantToRemove({ groupId, participantId })
    setOpenDialog(true)
  }

  const getTimeFromStartDate = (startDate) => {
    const date = new Date(startDate)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const findCommonDate = (votes) => {
    const dateCounts = {}

    Object.values(votes).forEach((participantVotes) => {
      participantVotes.forEach((date) => {
        dateCounts[date] = (dateCounts[date] || 0) + 1
      })
    })

    const totalParticipants = Object.keys(votes).length
    for (const [date, count] of Object.entries(dateCounts)) {
      if (count === totalParticipants) {
        return date
      }
    }
    return null
  }

  const handleDeleteGroup = async () => {
    if (groupToDelete) {
      // if (window.confirm('Вы уверены, что хотите удалить эту группу?')) {
      try {
        await axios.delete(
          `${API_BASE_URL}5000/api/work_groups/${groupToDelete}`
        )
        setGroups((prevGroups) =>
          prevGroups.filter((group) => group.id !== groupToDelete)
        )
        Toastify({
          text: 'Группа успешно удалена.',
          close: true,
          style: {
            backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
          },
        }).showToast()
      } catch (error) {
        console.error('Ошибка при удалении группы:', error)
        Toastify({
          text: 'Ошибка при удалении группы.',
          close: true,
          style: {
            backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
          },
        }).showToast()
      } finally {
        setGroupToDelete(null) // Сбросить ID группы после выполнения
        setOpenDialog(false) // Закрыть диалог
      }
    }
  }

  const handleOpenDialog = (groupId) => {
    setGroupToDelete(groupId)
    setOpenDialog(true)
  }

  const getWeekday = (dateString) => {
    const dateParts = dateString.split('-')
    const date = new Date(
      Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])
    )
    const options = { weekday: 'long', timeZone: 'UTC', locale: 'ru-RU' } // Указываем временную зону
    return date.toLocaleDateString('ru-RU', options) // Получаем день недели на русском
  }

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-')
    return `${day}.${month}.${year}`
  }
  const handleOpenHelpModal = () => {
    setOpenHelpModal(true)
  }
  if (loading) return <p>Загрузка...</p>
  if (error) return <p>{error}</p>

  return (
    <div className="planning-container">
      <MdContactSupport
        className="help-icon"
        onClick={handleOpenHelpModal}
        title="Справка"
      />
      <HelpModalWorkGroup
        type={'plan'}
        open={openHelpModal}
        onClose={() => setOpenHelpModal(false)}
      />
      <h3>Планирование</h3>
      {groups.length === 0 ? (
        <p>Нет групп для планирования.</p>
      ) : (
        groups
          .filter((group) => {
            // Участник группы или создатель группы
            const isParticipant = group.participants.some(
              (participant) => participant.id === user.id
            )
            const isCreator = user && user.id === group.created_by_id

            return isParticipant || isCreator
          })
          .map((group) => (
            <div key={group.id} className="group-card">
              <div className="group-header">
                {user && user.id === group.created_by_id && (
                  <button
                    className="delete-group"
                    onClick={() => handleOpenDialog(group.id)}
                  >
                    Удалить группу
                  </button>
                )}
                <span className="participants-header">
                  Создатель группы:{' '}
                  <span>{`${group.last_name} ${group.first_name} ${group.middle_name}`}</span>
                </span>
              </div>
              <strong className="group-name">{group.group_name}</strong>
              <p className="description">
                Описание задачи: {group.description}
              </p>
              <p className="time">
                Время сбора: {getTimeFromStartDate(group.start_date)} ч.
              </p>
              <h4>Участники:</h4>

              {group.participants.map((participant) => (
                <div key={participant.id} className="participant">
                  <div className="participants" aria-hidden="false">
                    <span className="participant-name">
                      {participant.full_name}
                    </span>

                    {/* Проверяем, является ли текущий пользователь создателем группы или совпадает ли его ID с ID участника */}
                    {user && user.id === group.created_by_id && (
                      <button
                        className="remove-participant"
                        onClick={() =>
                          handleOpenRemoveParticipantDialog(
                            group.id,
                            participant.id
                          )
                        }
                      >
                        Удалить участника
                      </button>
                    )}

                    {user && user.id === participant.id ? (
                      <div className="date-selection">
                        {/* Только текущий пользователь может взаимодействовать с чекбоксами */}
                        {getAvailableDatesInRange(
                          group.start_date,
                          group.end_date
                        ).map((date) => (
                          <label key={date} className="date-label">
                            <input
                              type="checkbox"
                              checked={
                                selectedDates[group.id]?.[
                                  participant.id
                                ]?.includes(date) || false
                              }
                              onChange={() =>
                                handleCheckboxChange(
                                  group.id,
                                  participant.id,
                                  date
                                )
                              }
                              style={{ display: 'none' }}
                            />
                            <span
                              className={`date-button ${
                                selectedDates[group.id]?.[
                                  participant.id
                                ]?.includes(date)
                                  ? 'selected'
                                  : ''
                              }`}
                              title={getWeekday(date)}
                            >
                              {formatDate(date)}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="date-selection">
                        {/* Оставим только отображение дат без возможности выбора для других пользователей */}
                        {getAvailableDatesInRange(
                          group.start_date,
                          group.end_date
                        ).map((date) => (
                          <span
                            key={date}
                            className={`date-button read-only ${
                              selectedDates[group.id]?.[
                                participant.id
                              ]?.includes(date)
                                ? 'selected'
                                : ''
                            }`}
                          >
                            {formatDate(date)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
      )}
      <ConfirmationDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onConfirm={
          participantToRemove ? handleRemoveParticipant : handleDeleteGroup
        }
        title={
          participantToRemove
            ? 'Подтверждение удаления участника'
            : 'Подтверждение удаления группы'
        }
        message={
          participantToRemove
            ? 'Вы уверены, что хотите удалить этого участника?'
            : 'Вы уверены, что хотите удалить эту группу?'
        }
        btn1="Отмена"
        btn2="Да"
      />
    </div>
  )
}

export default Planning
//1
