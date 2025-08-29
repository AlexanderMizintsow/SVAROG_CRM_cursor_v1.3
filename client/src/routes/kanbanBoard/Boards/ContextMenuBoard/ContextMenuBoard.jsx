import { useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import useKanbanStore from '../../../../store/useKanbanStore'
import useUserStore from '../../../../store/userStore'
import Toastify from 'toastify-js'
import SearchBar from '../../../../components/searchBar/SearchBar'
import './contextMenuBoard.scss'

const ContextMenuBoard = ({ isOpen, onClose, taskId }) => {
  const { user } = useUserStore()
  const { employeeList } = useKanbanStore((state) => state)
  const [selectedEmployeeIdMenu, setSelectedEmployeeIdMenu] = useState(null)
  const [selectedEmployeeLastName, setselectedEmployeeLastName] = useState(null) // тот кому выбрано передать уведомление
  const selectedEmployeeLastNameBoard = useKanbanStore(
    (state) => state.getSelectedEmployeeLastName()(state) // Тот у кого забрали уведомление
  )
  const [searchTerm, setSearchTerm] = useState('')

  if (!isOpen) return null
  console.log({ selectedEmployeeLastName })
  const handleSelectAndClose = (employeeId, lastName) => {
    setSelectedEmployeeIdMenu(employeeId)
    setselectedEmployeeLastName(lastName)
  }

  const handleSubmit = async () => {
    if (selectedEmployeeIdMenu) {
      const newTag = {
        bg: '#A3D3E2',
        text: '#1F3A63',
        title: `💬 Передал: ${user.last_name}.  
       Предыдущий ${
         selectedEmployeeLastNameBoard
           ? selectedEmployeeLastNameBoard
           : user.last_name
       }. 
       Передано для ${
         selectedEmployeeLastName ? selectedEmployeeLastName : user.last_name
       }`,
      }
      try {
        await axios.post(
          `${API_BASE_URL}5000/api/update/reminder/notification`,
          {
            selectedEmployeeId: selectedEmployeeIdMenu,
            taskId,
            newTag,
          }
        )
        Toastify({
          text: `Уведомление назначено: ${
            selectedEmployeeLastName === ''
              ? ''
              : `сотрудник  ${selectedEmployeeLastName},`
          } задача ID ${taskId}`,
          duration: 5000,
          close: true,
          backgroundColor:
            'linear-gradient(to right,rgb(26, 155, 80),rgba(13, 170, 8, 0.86))',
        }).showToast()
      } catch (error) {
        Toastify({
          text: `Ошибка при обновлении напоминания: ${error}`,
          duration: 5000,
          close: true,
          backgroundColor:
            'linear-gradient(to right,rgba(241, 53, 68, 0.85),rgba(170, 8, 16, 0.86))',
        }).showToast()
      }
    }
    onClose()
    setSelectedEmployeeIdMenu(null)
  }

  // Фильтрация сотрудников по фамилии, имени и отчеству
  const filteredEmployees = employeeList.filter((employee) => {
    const fullName =
      `${employee.last_name} ${employee.first_name} ${employee.middle_name}`.toLowerCase()
    return fullName.includes(searchTerm.toLowerCase())
  })

  return (
    <div className="context-menu-board">
      <div className="context-menu-board-header">
        <p>Выберите сотрудника для назначения</p>
      </div>
      <button
        className="sidebar-close"
        onClick={() => {
          onClose()
          setSelectedEmployeeIdMenu(null)
        }}
      >
        ×
      </button>
      <ul className="context-menu-board-list">
        {filteredEmployees.map((employee) => (
          <li
            key={employee.user_id}
            className={`employee-item ${
              selectedEmployeeIdMenu === employee.user_id
                ? 'employee-list-selected'
                : ''
            }`}
            onClick={() =>
              handleSelectAndClose(employee.user_id, employee.last_name)
            }
          >
            <span className="sidebar-employee-text">{`${employee.last_name} ${employee.first_name} ${employee.middle_name}`}</span>
            <div
              className="context-menu-status"
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
        ))}
      </ul>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          marginTop: '15px',
        }}
      >
        <button
          onClick={handleSubmit}
          className="context-menu-board-button"
          disabled={!selectedEmployeeIdMenu}
        >
          Отправить
        </button>

        <SearchBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          placeholder="Поиск ..."
          transform={0}
        />
      </div>
      {selectedEmployeeIdMenu && (
        <div className="selected-employee-info">
          {selectedEmployeeLastName === '' ? (
            <p></p>
          ) : (
            <p>Выбранный сотрудник: {selectedEmployeeLastName}</p>
          )}
          <p>Выбранное уведомление ID: {taskId}</p>
        </div>
      )}
    </div>
  )
}

export default ContextMenuBoard
