import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../../../../config'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Tab,
  Tabs,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import { ToastContainer, toast } from 'react-toastify'
import { MdContactSupport } from 'react-icons/md'
import axios from 'axios'
import ConfirmationDialog from '../../../components/confirmationDialog/ConfirmationDialog'
import SearchBar from '../../../components/searchBar/SearchBar'
import 'react-toastify/dist/ReactToastify.css'
import HelpModalCompanyPassword from './HelpModalCompanyPassword'
import useUserStore from '../../../store/userStore'

const generateRandomPassword = (length = 12) => {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#'
  let password = ''
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length)
    password += charset[randomIndex]
  }
  return password
}

const buildEmployeeName = (employee) => {
  const parts = [employee.last_name, employee.first_name, employee.middle_name].filter(Boolean)
  return parts.length ? parts.join(' ') : employee.username
}

const CompanyPassword = () => {
  const { user } = useUserStore()
  const [companies, setCompanies] = useState([])
  const [employees, setEmployees] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEntityId, setSelectedEntityId] = useState(null)
  const [selectedEntityName, setSelectedEntityName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [openHelpModal, setOpenHelpModal] = useState(false)
  const [passwordMode, setPasswordMode] = useState('staff')
  const [issuedPasswordModal, setIssuedPasswordModal] = useState({
    open: false,
    entityLabel: '',
    password: '',
    isStaff: false,
  })

  useEffect(() => {
    if (passwordMode === 'staff') {
      fetchEmployees()
      return
    }
    fetchCompanies()
  }, [passwordMode])

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5003/api/companies/list`)
      setCompanies(response.data)
    } catch (error) {
      console.error('Ошибка при получении компаний:', error)
      toast.error('Ошибка при получении компаний')
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/users/mobile-staff-access`)
      setEmployees(response.data)
    } catch (error) {
      console.error('Ошибка при получении сотрудников:', error)
      toast.error('Ошибка при получении сотрудников')
    }
  }

  const handleCompanyPasswordChange = async (companyId, newPassword) => {
    const isTelegramMode = passwordMode === 'telegram'
    const endpoint = isTelegramMode
      ? `${API_BASE_URL}5003/api/companies/password/${companyId}`
      : `${API_BASE_URL}5003/api/companies/mobile-password/${companyId}`
    const payload = isTelegramMode
      ? { telegram_password: newPassword }
      : { mobile_password: newPassword, userId: user?.id || null }

    try {
      await axios.put(endpoint, payload)
      toast.success('Пароль успешно обновлён')
      return true
    } catch (error) {
      console.error('Ошибка при обновлении пароля:', error)
      toast.error('Ошибка при обновлении пароля')
      return false
    }
  }

  const handleStaffPasswordChange = async (employeeId, newPassword) => {
    try {
      await axios.put(`${API_BASE_URL}5000/api/users/mobile-staff-password/${employeeId}`, {
        mobile_staff_password: newPassword,
        userId: user?.id || null,
      })
      toast.success('Пароль успешно обновлён')
      return true
    } catch (error) {
      console.error('Ошибка при обновлении пароля сотрудника:', error)
      toast.error('Ошибка при обновлении пароля')
      return false
    }
  }

  const handlePasswordDelete = (entityId, entityName) => {
    setSelectedEntityId(entityId)
    setSelectedEntityName(entityName)
    setDialogOpen(true)
  }

  const confirmDelete = async () => {
    const isUpdated =
      passwordMode === 'staff'
        ? await handleStaffPasswordChange(selectedEntityId, 'NOTACCES')
        : await handleCompanyPasswordChange(selectedEntityId, 'NOTACCES')

    if (isUpdated) {
      if (passwordMode === 'staff') {
        await fetchEmployees()
      } else {
        await fetchCompanies()
      }
    }
    setDialogOpen(false)
    setSelectedEntityName('')
  }

  const getPasswordByMode = (company) =>
    passwordMode === 'telegram' ? company.telegram_password : company.mobile_password

  const handleCopyPassword = async (password) => {
    try {
      await navigator.clipboard.writeText(password)
      toast.success('Пароль скопирован')
    } catch (error) {
      console.error('Ошибка при копировании пароля:', error)
      toast.error('Не удалось скопировать пароль')
    }
  }

  const handleGenerateCompanyPassword = async (company) => {
    const newPassword = generateRandomPassword()
    if (!newPassword) {
      return
    }

    const isUpdated = await handleCompanyPasswordChange(company.id, newPassword)
    if (!isUpdated) {
      return
    }

    if (passwordMode === 'mobile') {
      setIssuedPasswordModal({
        open: true,
        entityLabel: company.name_companies,
        password: newPassword,
        isStaff: false,
      })
    }

    await fetchCompanies()
  }

  const handleGenerateStaffPassword = async (employee) => {
    const newPassword = generateRandomPassword()
    if (!newPassword) {
      return
    }

    const isUpdated = await handleStaffPasswordChange(employee.id, newPassword)
    if (!isUpdated) {
      return
    }

    setIssuedPasswordModal({
      open: true,
      entityLabel: buildEmployeeName(employee),
      password: newPassword,
      isStaff: true,
    })

    await fetchEmployees()
  }

  const renderCompanyActions = (company) => (
    <TableCell>
      <Button variant="contained" onClick={() => handleGenerateCompanyPassword(company)}>
        Установить пароль
      </Button>
      {getPasswordByMode(company) !== 'NOTACCES' && (
        <Button
          variant="contained"
          color="secondary"
          onClick={() => handlePasswordDelete(company.id, company.name_companies)}
          style={{ marginLeft: '10px' }}
        >
          Удалить пароль
        </Button>
      )}
    </TableCell>
  )

  const renderStaffActions = (employee) => (
    <TableCell>
      <Button variant="contained" onClick={() => handleGenerateStaffPassword(employee)}>
        Установить пароль
      </Button>
      {employee.mobile_staff_access !== 'NOTACCES' && (
        <Button
          variant="contained"
          color="secondary"
          onClick={() => handlePasswordDelete(employee.id, buildEmployeeName(employee))}
          style={{ marginLeft: '10px' }}
        >
          Удалить пароль
        </Button>
      )}
    </TableCell>
  )

  const filteredCompanies = companies.filter((company) =>
    company.name_companies.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredEmployees = employees.filter((employee) => {
    const haystack = [
      employee.username,
      employee.first_name,
      employee.last_name,
      employee.middle_name,
      employee.role_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(searchTerm.toLowerCase())
  })

  const modeDescription =
    passwordMode === 'telegram'
      ? 'Вкладка для выдачи пароля доступа в Telegram-бот.'
      : passwordMode === 'mobile'
        ? 'Вкладка для выдачи пароля доступа в мобильное приложение ПОЗ (дилеры).'
        : 'Вкладка для выдачи пароля доступа в мобильное приложение ПОЗ-сотрудники.'

  return (
    <div className="container">
      <MdContactSupport
        className="help-icon"
        onClick={() => setOpenHelpModal(true)}
        title="Справка"
      />
      <HelpModalCompanyPassword
        type={'create'}
        open={openHelpModal}
        onClose={() => setOpenHelpModal(false)}
      />
      <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Поиск..." />
      <Typography variant="h4" gutterBottom>
        Управление паролями доступа
      </Typography>
      <Tabs
        value={passwordMode}
        onChange={(_, value) => setPasswordMode(value)}
        sx={{ marginBottom: 2 }}
      >
        <Tab value="staff" label="Пароли для ПОЗ-сотрудники" />
        <Tab value="telegram" label="Пароли для Telegram-бота" />
        <Tab value="mobile" label="Пароли для ПОЗ (дилеры)" />
      </Tabs>
      <Typography variant="body2" sx={{ marginBottom: 2 }}>
        {modeDescription}
      </Typography>

      <TableContainer>
        <Table>
          {passwordMode === 'staff' ? (
            <>
              <TableHead>
                <TableRow>
                  <TableCell>Сотрудник</TableCell>
                  <TableCell>Логин</TableCell>
                  <TableCell>Роль</TableCell>
                  <TableCell>Доступ в приложение</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>{buildEmployeeName(employee)}</TableCell>
                    <TableCell>{employee.username}</TableCell>
                    <TableCell>{employee.role_name || '—'}</TableCell>
                    <TableCell>
                      {employee.mobile_staff_access === 'NOTACCES' ? (
                        'NOTACCES'
                      ) : (
                        <Typography variant="body2">
                          Установлен. Для передачи сотруднику перевыпустите пароль.
                        </Typography>
                      )}
                    </TableCell>
                    {renderStaffActions(employee)}
                  </TableRow>
                ))}
              </TableBody>
            </>
          ) : (
            <>
              <TableHead>
                <TableRow>
                  <TableCell>Название компании</TableCell>
                  <TableCell>
                    {passwordMode === 'telegram'
                      ? 'Пароль Telegram'
                      : 'Пароль мобильного приложения'}
                  </TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>{company.name_companies}</TableCell>
                    <TableCell>
                      {getPasswordByMode(company) === 'NOTACCES' ? (
                        'NOTACCES'
                      ) : passwordMode === 'mobile' ? (
                        <Typography variant="body2">
                          Установлен. Для передачи дилеру перевыпустите пароль.
                        </Typography>
                      ) : (
                        <Typography variant="body1">{getPasswordByMode(company)}</Typography>
                      )}
                    </TableCell>
                    {renderCompanyActions(company)}
                  </TableRow>
                ))}
              </TableBody>
            </>
          )}
        </Table>
      </TableContainer>
      <ToastContainer />
      <Dialog
        open={issuedPasswordModal.open}
        onClose={() =>
          setIssuedPasswordModal({
            open: false,
            entityLabel: '',
            password: '',
            isStaff: false,
          })
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {issuedPasswordModal.isStaff
            ? 'Новый пароль для ПОЗ-сотрудники'
            : 'Новый пароль для мобильного приложения'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {issuedPasswordModal.isStaff ? 'Сотрудник' : 'Компания'}:{' '}
            {issuedPasswordModal.entityLabel}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Сохраните и передайте пароль. После закрытия окна он больше не будет отображаться в
            CRM.
          </Typography>
          <Typography variant="h6">{issuedPasswordModal.password}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleCopyPassword(issuedPasswordModal.password)}>
            Копировать
          </Button>
          <Button
            onClick={() =>
              setIssuedPasswordModal({
                open: false,
                entityLabel: '',
                password: '',
                isStaff: false,
              })
            }
          >
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Подтверждение удаления пароля"
        message={`Вы уверены, что хотите удалить пароль для "${selectedEntityName}"?`}
        btn1="Отмена"
        btn2="Удалить"
      />
    </div>
  )
}

export default CompanyPassword
