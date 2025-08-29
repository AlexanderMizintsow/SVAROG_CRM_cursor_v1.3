// Шапка
import { useState } from 'react'
import { FaRegComments, FaUserEdit } from 'react-icons/fa'
import { MdCalendarMonth } from 'react-icons/md'
import GlobalTaskChat from './subcomponents/globalChat/GlobalTaskChat'
import './styles/GlobalTaskHeader.scss'

const GlobalTaskHeader = ({ taskId, status, title, createdAt, author }) => {
  const [isChatOpen, setIsChatOpen] = useState(false)

  const toggleChat = () => {
    setIsChatOpen((prev) => !prev)
  }

  return (
    <div className="global-task-header">
      <div>
        <span className="global-task-header-id">id: {taskId}</span>
        <h2 style={{ color: 'orange', marginLeft: '23px' }}>
          {status === 'Пауза' ? 'ПРОЕКТ ПРИОСТАНОВЛЕН' : null}
        </h2>
        <h1 className="global-task-header__title">Проект: {title} </h1>
        <div className="global-task-header__meta">
          <span>
            <MdCalendarMonth className="global-task-header__icon" /> Создана:{' '}
            {createdAt ? new Date(createdAt).toLocaleString() : 'N/A'}
          </span>
          <span>
            <FaUserEdit className="global-task-header__icon" /> Автор:{' '}
            {author.name}
          </span>
        </div>
      </div>
      <div className="global-task-header__actions">
        {/* Кнопка для открытия чата */}
        <div className="avatar-box bg-indigo-500 global-task__chat">
          <FaRegComments
            style={{ fontSize: '24px', cursor: 'pointer' }}
            onClick={toggleChat}
          />
        </div>
        {/*<button className="global-task-header__button global-task-header__button--edit">
          <FaEdit className="global-task-header__button-icon" />
          Редактировать
        </button>
        <button className="global-task-header__button global-task-header__button--history">
          <FaHistory className="global-task-header__button-icon" />
          История
        </button>*/}
      </div>
      {isChatOpen && (
        <GlobalTaskChat
          onClick={toggleChat}
          globalTaskId={taskId}
          title={title}
        />
      )}
    </div>
  )
}

export default GlobalTaskHeader
//1
