import { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'
import { CircularProgress, Pagination } from '@mui/material'
import NotificationList from '../../../components/notificationList/NotificationList'
import { Modal, Box, TextField, Button, Select, MenuItem } from '@mui/material'
import { API_BASE_URL } from '../../../../config'
import useUserStore from '../../../store/userStore'

const ProcessedCalls = () => {
  const { user } = useUserStore()
  const [isLoading, setLoading] = useState(true)
  const [processedCalls, setProcessedCalls] = useState([])
  const [dealers, setDealers] = useState([])
  const [companies, setCompanies] = useState([])
  const [open, setOpen] = useState(false)
  const [selectedDealer, setSelectedDealer] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phoneType, setPhoneType] = useState('мобильный')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 7,
    total: 0,
  })

  // Новые состояния для информации о пользователе
  const [userInfo, setUserInfo] = useState(null)
  const [departmentEmployees, setDepartmentEmployees] = useState([])
  const [allCallEmployees, setAllCallEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [selectedUnassignedEmployee, setSelectedUnassignedEmployee] = useState(false)

  const userId = user?.id

  // Мемоизируем API URL для предотвращения ререндеров
  const apiBaseUrl = useMemo(() => API_BASE_URL, [])

  // Функция загрузки информации о пользователе
  const fetchUserInfo = useCallback(async () => {
    if (!userId) return

    try {
      const response = await axios.get(`${apiBaseUrl}5004/api/user-info/${userId}`)
      setUserInfo(response.data)

      // Если пользователь руководитель отдела или НОК, загружаем сотрудников отдела
      if ((response.data.isDepartmentHead || response.data.isNOK) && response.data.department_id) {
        const employeesResponse = await axios.get(
          `${apiBaseUrl}5004/api/department-employees/${response.data.department_id}`
        )
        setDepartmentEmployees(employeesResponse.data)
        // Для НОК и руководителей отдела используем только сотрудников отдела
        setAllCallEmployees(employeesResponse.data)
      } else if (response.data.isAdmin) {
        // Администратор видит всех сотрудников из звонков
        const allEmployeesResponse = await axios.get(`${apiBaseUrl}5004/api/calls-employees`)
        setAllCallEmployees(allEmployeesResponse.data)
        setDepartmentEmployees([])
      } else {
        // Обычные пользователи не загружают списки сотрудников
        setDepartmentEmployees([])
        setAllCallEmployees([])
      }
    } catch (error) {
      console.error('Ошибка при получении информации о пользователе:', error)
    }
  }, [userId, apiBaseUrl])

  const fetchProcessedCalls = useCallback(
    async (page = 1) => {
      if (!userInfo) return // Не загружаем звонки пока нет информации о пользователе

      try {
        setLoading(true)

        const params = {
          status: 'processed',
          page,
          limit: pagination.limit,
        }

        // Если пользователь может видеть все звонки (НОК, администратор, руководитель отдела)
        if (userInfo.canViewAllCalls) {
          params.canViewAllCalls = true

          // Если это руководитель отдела, добавляем фильтр по отделу
          if (userInfo.isDepartmentHead && userInfo.department_id) {
            params.departmentId = userInfo.department_id
          }

          // Если выбран конкретный сотрудник
          if (selectedEmployee && selectedEmployee !== 'undefined') {
            params.employeeId = selectedEmployee
          }

          // Фильтр по неопределенным сотрудникам
          if (selectedUnassignedEmployee) {
            // Неопределенные по сотруднику (где сотрудник не определен)
            params.unassigned = true
          }
        } else {
          // Обычный пользователь - видит только свои звонки
          params.userId = userId
        }

        const response = await axios.get(`${apiBaseUrl}5004/api/calls`, { params })

        const { data, total } = response.data

        const formattedData = data.map((call) => ({
          id: call.call_id,
          text: `Обработанный звонок от: ${call.caller_number}`,
          time: new Date(call.accepted_at).toLocaleString('ru-RU', {
            dateStyle: 'short',
            timeStyle: 'short',
          }),
          callerName: call.caller_name,
          receiverName: call.receiver_name,
          callerNumber: call.caller_number,
          receiverNumber: call.receiver_number,
          dealerId: call.dealer_id,
          dateTime: new Date(call.accepted_at),
          status: call.status,
        }))

        const sortedData = formattedData.sort((a, b) => b.dateTime - a.dateTime)

        setProcessedCalls(sortedData)
        setPagination((prev) => ({
          ...prev,
          page,
          total,
        }))
      } catch (error) {
        console.error('Ошибка при получении данных о звонках:', error)
      } finally {
        setLoading(false)
      }
    },
    [userInfo, selectedEmployee, pagination.limit, userId, apiBaseUrl, selectedUnassignedEmployee]
  )

  const fetchDealers = useCallback(async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}5003/api/dealers/all`)
      setDealers(response.data)
    } catch (error) {
      console.error('Ошибка при получении данных о дилерах:', error)
    }
  }, [apiBaseUrl])

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}5003/api/companies`)
      setCompanies(response.data)
    } catch (error) {
      console.error('Ошибка при получении данных о компаниях:', error)
    }
  }, [apiBaseUrl])

  // Инициализация данных только один раз при монтировании
  useEffect(() => {
    const initData = async () => {
      try {
        await Promise.all([fetchUserInfo(), fetchDealers(), fetchCompanies()])
      } catch (error) {
        console.error('Ошибка инициализации данных:', error)
      }
    }

    initData()
  }, []) // Пустой массив зависимостей - выполняется только один раз

  // Загружаем звонки когда получена информация о пользователе
  useEffect(() => {
    if (userInfo) {
      fetchProcessedCalls(1)
    }
  }, [userInfo, fetchProcessedCalls])

  // Загружаем звонки при изменении фильтров
  useEffect(() => {
    if (userInfo) {
      fetchProcessedCalls(pagination.page)
    }
  }, [selectedEmployee, fetchProcessedCalls, pagination.page, selectedUnassignedEmployee])

  // Обработчик изменения страницы
  const handlePageChange = useCallback((event, newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }))
  }, [])

  const handleOpen = (notification) => {
    setPhoneNumber(notification.callerNumber)
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setSelectedDealer('')
    setPhoneNumber('')
    setCompanyName('')
    setPhoneType('мобильный')
  }

  const handleDealerChange = (dealerId) => {
    setSelectedDealer(dealerId)
    const dealer = dealers.find((d) => d.id === dealerId)
    if (dealer) {
      const company = companies.find((c) => c.id === dealer.company_id)
      setCompanyName(company ? company.name : '')
    }
  }

  const handleAddPhoneNumber = async () => {
    if (!selectedDealer) return alert('Выберите дилера')

    try {
      const response = await axios.post(`${apiBaseUrl}5004/api/add-phone`, {
        dealerId: selectedDealer,
        phoneNumber,
        phoneType,
        isPrimary: true,
      })

      if (response.status === 201) {
        alert('Номер телефона добавлен')
        handleClose()
      } else {
        alert('Ошибка при добавлении номера')
      }
    } catch (error) {
      console.error('Ошибка:', error)
      alert('Ошибка при добавлении номера')
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
        <CircularProgress className="progress" color="primary" size={50} variant="indeterminate" />
      </div>
    )
  }

  return (
    <div className="container">
      {/* Блок с кнопками фильтрации по сотрудникам (только для пользователей с правами на просмотр всех звонков) */}
      {userInfo?.canViewAllCalls && (
        <div
          className="filter-buttons"
          style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}
        >
          <h4>Фильтр по сотруднику:</h4>
          <button
            onClick={() => {
              setSelectedEmployee(null)
              setSelectedUnassignedEmployee(false)
            }}
            style={{
              padding: '8px 16px',
              backgroundColor:
                selectedEmployee === null && !selectedUnassignedEmployee ? '#1976d2' : '#f0f0f0',
              color: selectedEmployee === null && !selectedUnassignedEmployee ? 'white' : 'black',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {userInfo.isAdmin ? 'Все сотрудники' : 'Сотрудники отдела'}
          </button>

          <button
            onClick={() => {
              setSelectedUnassignedEmployee(!selectedUnassignedEmployee)
              setSelectedEmployee(null)
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedUnassignedEmployee ? '#1976d2' : '#f0f0f0',
              color: selectedUnassignedEmployee ? 'white' : 'black',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Неопределенный сотрудник
          </button>

          {/* Кнопки для конкретных сотрудников отдела (для НОК и руководителей) */}
          {(userInfo.isDepartmentHead || userInfo.isNOK) &&
            departmentEmployees.map((employee) => (
              <button
                key={employee.id}
                onClick={() => {
                  setSelectedEmployee(employee.id)
                  setSelectedUnassignedEmployee(false)
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: selectedEmployee === employee.id ? '#1976d2' : '#f0f0f0',
                  color: selectedEmployee === employee.id ? 'white' : 'black',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {`${employee.last_name} ${employee.first_name}`}
              </button>
            ))}

          {/* Кнопки для всех сотрудников (только для администраторов) */}
          {userInfo.isAdmin &&
            allCallEmployees.map((employee) => (
              <button
                key={employee.id}
                onClick={() => {
                  setSelectedEmployee(employee.id)
                  setSelectedUnassignedEmployee(false)
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: selectedEmployee === employee.id ? '#1976d2' : '#f0f0f0',
                  color: selectedEmployee === employee.id ? 'white' : 'black',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
                title={`${employee.position_name || 'Должность не указана'} - ${
                  employee.department_name || 'Отдел не указан'
                }`}
              >
                {`${employee.last_name} ${employee.first_name}`}
              </button>
            ))}
        </div>
      )}

      {/* Информация о текущих правах пользователя */}
      {userInfo && (
        <div
          style={{
            marginBottom: '20px',
            padding: '10px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          <strong>Текущие права:</strong>
          {userInfo.isNOK && ' НОК (видит все звонки)'}
          {userInfo.isAdmin && ' Администратор (видит все звонки)'}
          {userInfo.isDepartmentHead &&
            ` Руководитель отдела "${userInfo.department_name}" (видит звонки отдела)`}
          {!userInfo.canViewAllCalls && ' Обычный пользователь (видит только свои звонки)'}
        </div>
      )}

      <NotificationList
        title="Обработанные звонки"
        notifications={processedCalls}
        statusTitle="Обработанный"
        onAddPhoneClick={handleOpen}
        userInfo={userInfo}
      />

      <Pagination
        count={Math.ceil(pagination.total / pagination.limit)}
        page={pagination.page}
        onChange={handlePageChange}
        color="primary"
        style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}
      />

      <Modal open={open} onClose={handleClose}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 1,
          }}
        >
          <h2>Добавить номер телефона</h2>
          <TextField
            label="Номер телефона"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            fullWidth
            margin="normal"
          />
          <Select
            value={selectedDealer}
            onChange={(e) => handleDealerChange(e.target.value)}
            fullWidth
            displayEmpty
            margin="normal"
          >
            <MenuItem value="" disabled>
              Выберите дилера
            </MenuItem>
            {dealers.map((dealer) => (
              <MenuItem key={dealer.id} value={dealer.id}>
                {dealer.first_name} {dealer.last_name}
              </MenuItem>
            ))}
          </Select>
          <Select
            value={phoneType}
            onChange={(e) => setPhoneType(e.target.value)}
            fullWidth
            displayEmpty
            margin="normal"
          >
            <MenuItem value="мобильный">Мобильный</MenuItem>
            <MenuItem value="домашний">Домашний</MenuItem>
            <MenuItem value="рабочий">Рабочий</MenuItem>
          </Select>
          {companyName && <p>Компания: {companyName}</p>}
          <Button variant="contained" color="primary" onClick={handleAddPhoneNumber}>
            Добавить
          </Button>
        </Box>
      </Modal>
    </div>
  )
}

export default ProcessedCalls
