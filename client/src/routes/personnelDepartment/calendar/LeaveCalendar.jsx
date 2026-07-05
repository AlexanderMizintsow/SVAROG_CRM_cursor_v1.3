import { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import useUserStore from '../../../store/userStore'
import {
  fetchActiveAbsences,
  fetchStatusPermissions,
  fetchWorkloadSummary,
  filterManageableUsers,
  formatAbsencePeriod,
  formatUserFullName,
} from '../../../utils/userAbsenceUtils'
import ActiveAbsencesList from './ActiveAbsencesList'
import WorkloadSummaryModal from './WorkloadSummaryModal'
import './UserStatusScheduler.scss'

const TABS = {
  FORM: 'form',
  LIST: 'list',
}

const LeaveCalendar = () => {
  const { user } = useUserStore()
  const actorUserId = user?.id ?? null

  const [activeTab, setActiveTab] = useState(TABS.FORM)
  const [users, setUsers] = useState([])
  const [permissions, setPermissions] = useState(null)
  const [absences, setAbsences] = useState([])
  const [absencesLoading, setAbsencesLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [substituteUser, setSubstituteUser] = useState('')
  const [statusType, setStatusType] = useState('отпуск')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [specificDates, setSpecificDates] = useState([])
  const [currentSpecificDate, setCurrentSpecificDate] = useState('')
  const [isPeriodMode, setIsPeriodMode] = useState(true)
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryData, setSummaryData] = useState(null)
  const [summarySaving, setSummarySaving] = useState(false)
  const [pendingStatusData, setPendingStatusData] = useState(null)

  const loadAbsences = useCallback(async () => {
    setAbsencesLoading(true)
    try {
      const data = await fetchActiveAbsences()
      setAbsences(data)
    } catch {
      toast.error('Не удалось загрузить список отсутствующих')
      setAbsences([])
    } finally {
      setAbsencesLoading(false)
    }
  }, [])

  const loadPermissions = useCallback(async () => {
    if (!actorUserId) {
      setPermissions(null)
      return
    }
    try {
      const data = await fetchStatusPermissions(actorUserId)
      setPermissions(data)
    } catch {
      setPermissions({ canCreate: false, isAdmin: false, isHr: false, headDepartmentIds: [] })
    }
  }, [actorUserId])

  useEffect(() => {
    const fetchUsers = async () => {
      const response = await axios.get(`${API_BASE_URL}5000/api/users`)
      setUsers(response.data)
    }
    fetchUsers()
    loadAbsences()
    loadPermissions()
  }, [loadAbsences, loadPermissions])

  useEffect(() => {
    if (activeTab === TABS.LIST) {
      loadAbsences()
    }
  }, [activeTab, loadAbsences])

  useEffect(() => {
    if (permissions && !permissions.canCreate && activeTab === TABS.FORM) {
      setActiveTab(TABS.LIST)
    }
  }, [permissions, activeTab])

  const manageableUsers = useMemo(
    () => filterManageableUsers(users, permissions),
    [users, permissions]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!actorUserId) {
      toast.error('Не определён текущий пользователь')
      return
    }

    const statusData = {
      user_id: selectedUser,
      status: statusType,
      start_date: isPeriodMode ? startDate : null,
      end_date: isPeriodMode ? endDate : null,
      specific_dates: isPeriodMode ? [] : specificDates,
      substitute_user_id: substituteUser || null,
      actor_user_id: actorUserId,
    }

    setPendingStatusData(statusData)
    setSummaryModalOpen(true)
    setSummaryLoading(true)
    setSummaryData(null)

    try {
      const data = await fetchWorkloadSummary(selectedUser)
      setSummaryData(data)
    } catch {
      toast.error('Не удалось загрузить сводку по задачам и проектам')
      setSummaryData(null)
    } finally {
      setSummaryLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedUser('')
    setSubstituteUser('')
    setStatusType('отпуск')
    setStartDate('')
    setEndDate('')
    setCurrentSpecificDate('')
    setSpecificDates([])
  }

  const closeSummaryModal = () => {
    if (summarySaving) return
    setSummaryModalOpen(false)
    setPendingStatusData(null)
    setSummaryData(null)
  }

  const confirmSaveStatus = async () => {
    if (!pendingStatusData) return

    setSummarySaving(true)
    try {
      await axios.post(`${API_BASE_URL}5000/api/user-statuses`, pendingStatusData)
      toast.success('Статус успешно сохранён!')
      resetForm()
      closeSummaryModal()
      loadAbsences()
    } catch (err) {
      const msg = err.response?.data?.error || 'Ошибка при сохранении статуса. Попробуйте снова.'
      toast.error(msg)
    } finally {
      setSummarySaving(false)
    }
  }

  const selectedEmployee = users.find((u) => String(u.id) === String(selectedUser))
  const selectedEmployeeName = formatUserFullName(selectedEmployee) || 'Сотрудник'
  const pendingPeriodLabel = pendingStatusData
    ? formatAbsencePeriod({
        start_date: pendingStatusData.start_date,
        end_date: pendingStatusData.end_date,
        specific_dates: pendingStatusData.specific_dates,
      })
    : ''

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

  const availableSubstitutes = users.filter(
    (u) => String(u.id) !== String(selectedUser)
  )

  const canCreate = permissions?.canCreate

  return (
    <div className="user-status-scheduler">
      <h2>Планировщик статусов сотрудников</h2>

      <div className="user-status-scheduler__tabs">
        {canCreate && (
          <button
            type="button"
            className={`user-status-scheduler__tab ${
              activeTab === TABS.FORM ? 'user-status-scheduler__tab--active' : ''
            }`}
            onClick={() => setActiveTab(TABS.FORM)}
          >
            Добавить статус
          </button>
        )}
        <button
          type="button"
          className={`user-status-scheduler__tab ${
            activeTab === TABS.LIST ? 'user-status-scheduler__tab--active' : ''
          }`}
          onClick={() => setActiveTab(TABS.LIST)}
        >
          Сейчас отсутствуют
          {absences.length > 0 && (
            <span className="user-status-scheduler__tab-badge">{absences.length}</span>
          )}
        </button>
      </div>

      {activeTab === TABS.FORM && canCreate ? (
        <form onSubmit={handleSubmit} className="user-status-scheduler__form">
          <p className="user-status-scheduler__hint">
            Назначать статус могут: руководитель отдела, сотрудники отдела кадров и администратор.
          </p>

          <label htmlFor="user">Сотрудник</label>
          <select
            id="user"
            value={selectedUser}
            onChange={(e) => {
              setSelectedUser(e.target.value)
              if (String(substituteUser) === String(e.target.value)) {
                setSubstituteUser('')
              }
            }}
            required
          >
            <option value="" disabled>
              Выберите сотрудника
            </option>
            {manageableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {[u.last_name, u.first_name, u.middle_name].filter(Boolean).join(' ')}
              </option>
            ))}
          </select>

          <label htmlFor="substitute">Замещающий сотрудник</label>
          <select
            id="substitute"
            value={substituteUser}
            onChange={(e) => setSubstituteUser(e.target.value)}
          >
            <option value="">Не назначен</option>
            {availableSubstitutes.map((u) => (
              <option key={u.id} value={u.id}>
                {[u.last_name, u.first_name, u.middle_name].filter(Boolean).join(' ')}
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
            <label htmlFor="period">Период</label>

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
              <button type="button" className="user-status-scheduler__btn-secondary" onClick={addSpecificDate}>
                Добавить дату
              </button>

              <ul className="user-status-scheduler__dates-list">
                {specificDates.map((date, index) => (
                  <li key={index}>
                    {date}
                    <button type="button" onClick={() => removeSpecificDate(date)}>
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
      ) : activeTab === TABS.FORM && !canCreate ? (
        <p className="user-status-scheduler__no-access">
          У вас нет прав на добавление статусов. Обратитесь к руководителю отдела, отделу кадров или администратору.
        </p>
      ) : (
        <ActiveAbsencesList
          absences={absences}
          loading={absencesLoading}
          onRefresh={loadAbsences}
          permissions={permissions}
          users={users}
          actorUserId={actorUserId}
        />
      )}

      <ToastContainer />

      <WorkloadSummaryModal
        open={summaryModalOpen}
        employeeName={selectedEmployeeName}
        statusLabel={pendingStatusData?.status}
        periodLabel={pendingPeriodLabel}
        data={summaryData}
        loading={summaryLoading}
        saving={summarySaving}
        onConfirm={confirmSaveStatus}
        onClose={closeSummaryModal}
      />
    </div>
  )
}

export default LeaveCalendar
