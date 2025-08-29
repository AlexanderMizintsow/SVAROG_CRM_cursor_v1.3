import { useState } from 'react'
import CreateGroup from './CreateGroup' // Импорт вашего компонента создания группы
import Planning from './Planning' // Импорт вашего компонента планирования
import AgreedGroup from './AgreedGroup' // Импорт вашего компонента для согласованной группы
import './workGroup.scss'
import useRemindersStore from '../../store/useRemindersStore'

const WorkGroup = () => {
  const [groupName, setGroupName] = useState('')
  const [participants, setParticipants] = useState([])
  const [newParticipant, setNewParticipant] = useState('')
  const [groups, setGroups] = useState([])
  const [createType, setCreateType] = useState('range')
  const [date, setDate] = useState({ start: '', end: '' })
  const [description, setDescription] = useState('')
  const [importance, setImportance] = useState('low')
  const [activeTab, setActiveTab] = useState('create')
  const [time, setTime] = useState('09:00')
  const { groupCounts } = useRemindersStore()

  const handleCreateGroup = () => {
    if (!groupName || participants.length === 0 || !description) {
      alert('Пожалуйста, заполните все поля.')
      return
    }

    const newGroup = {
      name: groupName,
      participants,
      date: '',
      description,
      importance,
      voting: createType === 'range',
    }

    if (createType === 'fixed') {
      const fixedDate = date.start // фиксированная дата
      newGroup.date = fixedDate // установим дату вместо пустого значения
      newGroup.voting = false // группа не должна быть голосующей
    }

    setGroups((prevGroups) => [...prevGroups, newGroup])

    // Сброс полей
    setGroupName('')
    setParticipants([])
    setDescription('')
    setImportance('low')
    setNewParticipant('')
  }

  const handleVote = (group, selectedDates) => {
    const dateCounts = {}

    selectedDates.forEach((date) => {
      dateCounts[date] = (dateCounts[date] || 0) + 1
    })

    // Проверяем, есть ли общая дата для всех участников
    const agreedDate = Object.entries(dateCounts).find(
      ([, count]) => count === group.participants.length
    )

    if (agreedDate) {
      setGroups((prevGroups) =>
        prevGroups.map((g) =>
          g.name === group.name
            ? { ...g, date: agreedDate[0], voting: false }
            : g
        )
      )
    }
  }

  return (
    <div className="container">
      <div>
        <button
          className={`button ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Создать группу
        </button>

        <button
          className={`button ${activeTab === 'planning' ? 'active' : ''}`}
          onClick={() => setActiveTab('planning')}
        >
          Планирование
          {groupCounts.rangeCount > 0 && (
            <>
              <span className="notification-circle-work-group range-count">
                {groupCounts.rangeCount}
              </span>
            </>
          )}
        </button>

        <button
          className={`button ${activeTab === 'agreed' ? 'active' : ''}`}
          onClick={() => setActiveTab('agreed')}
        >
          Согласованная группа
          {groupCounts.fixedCount > 0 && (
            <>
              <span className="notification-circle-work-group fixed-count">
                {groupCounts.fixedCount}
              </span>
            </>
          )}
        </button>
      </div>

      {activeTab === 'create' && (
        <CreateGroup
          groupName={groupName}
          setGroupName={setGroupName}
          participants={participants}
          setParticipants={setParticipants}
          description={description}
          setDescription={setDescription}
          importance={importance}
          setImportance={setImportance}
          createType={createType}
          setCreateType={setCreateType}
          handleCreateGroup={handleCreateGroup}
          newParticipant={newParticipant}
          setNewParticipant={setNewParticipant}
          setDate={setDate}
          setTime={setTime}
          time={time}
        />
      )}

      {activeTab === 'planning' && (
        <Planning
          groups={groups.filter((g) => g.voting)} // Фильтрация только голосующих групп
          handleVote={handleVote}
          participantDates={date}
        />
      )}

      {activeTab === 'agreed' && (
        <AgreedGroup
          groups={groups.filter((g) => !g.voting && g.date)} // Фильтрация согласованных групп
          importanceStyles={{
            low: { color: 'green' },
            medium: { color: 'orange' },
            high: { color: 'red' },
          }}
        />
      )}
    </div>
  )
}

export default WorkGroup
