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

const CompanyPassword = () => {
  const { user } = useUserStore()
  const [companies, setCompanies] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)
  const [selectedCompanyName, setSelectedCompanyName] = useState('') // Добавляем состояние для имени компании
  const [searchTerm, setSearchTerm] = useState('')
  const [openHelpModal, setOpenHelpModal] = useState(false)
  const [passwordMode, setPasswordMode] = useState('telegram')
  const [issuedPasswordModal, setIssuedPasswordModal] = useState({
    open: false,
    companyName: '',
    password: '',
  })

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5003/api/companies/list`)
      setCompanies(response.data)
    } catch (error) {
      console.error('Ошибка при получении компаний:', error)
      toast.error('Ошибка при получении компаний')
    }
  }

  const handlePasswordChange = async (companyId, newPassword) => {
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

  const handlePasswordDelete = (companyId, companyName) => {
    setSelectedCompanyId(companyId)
    setSelectedCompanyName(companyName)
    setDialogOpen(true)
  }

  const confirmDelete = async () => {
    const isUpdated = await handlePasswordChange(selectedCompanyId, 'NOTACCES')
    if (isUpdated) {
      await fetchCompanies()
    }
    setDialogOpen(false)
    setSelectedCompanyName('')
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

  const handleGeneratePassword = async (company) => {
    const newPassword = generateRandomPassword()
    if (!newPassword) {
      return
    }

    const isUpdated = await handlePasswordChange(company.id, newPassword)
    if (!isUpdated) {
      return
    }

    if (passwordMode === 'mobile') {
      setIssuedPasswordModal({
        open: true,
        companyName: company.name_companies,
        password: newPassword,
      })
    }

    await fetchCompanies()
  }

  const renderTableCellActions = (company) => (
    <TableCell>
      <Button
        variant="contained"
        onClick={() => handleGeneratePassword(company)}
      >
        Установить пароль
      </Button>
      {getPasswordByMode(company) !== 'NOTACCES' && (
        <Button
          variant="contained"
          color="secondary"
          onClick={() =>
            handlePasswordDelete(company.id, company.name_companies)
          }
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

  // Функция для открытия модального окна справки
  const handleOpenHelpModal = () => {
    setOpenHelpModal(true)
  }

  return (
    <div className="container">
      <MdContactSupport
        className="help-icon"
        onClick={handleOpenHelpModal}
        title="Справка"
      />
      <HelpModalCompanyPassword
        type={'create'}
        open={openHelpModal}
        onClose={() => setOpenHelpModal(false)}
      />
      <SearchBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        placeholder="Поиск..."
      />
      <Typography variant="h4" gutterBottom>
        Управление паролями доступа дилеров
      </Typography>
      <Tabs
        value={passwordMode}
        onChange={(_, value) => setPasswordMode(value)}
        sx={{ marginBottom: 2 }}
      >
        <Tab
          value="telegram"
          label="Пароли для Telegram-бота"
        />
        <Tab
          value="mobile"
          label="Пароли для мобильного приложения"
        />
      </Tabs>
      <Typography variant="body2" sx={{ marginBottom: 2 }}>
        {passwordMode === 'telegram'
          ? 'Вкладка для выдачи пароля доступа в Telegram-бот.'
          : 'Вкладка для выдачи пароля доступа в мобильное приложение ПОЗ.'}
      </Typography>

      <TableContainer>
        <Table>
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
                    <Typography variant="body1">
                      {getPasswordByMode(company)}
                    </Typography>
                  )}
                </TableCell>
                {renderTableCellActions(company)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <ToastContainer />
      <Dialog
        open={issuedPasswordModal.open}
        onClose={() =>
          setIssuedPasswordModal({
            open: false,
            companyName: '',
            password: '',
          })
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Новый пароль для мобильного приложения</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Компания: {issuedPasswordModal.companyName}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Сохраните и передайте пароль дилеру. После закрытия окна он больше не
            будет отображаться в CRM.
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
                companyName: '',
                password: '',
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
        message={`Вы уверены, что хотите удалить пароль для компании "${selectedCompanyName}"?`} // Используем имя компании
        btn1="Отмена"
        btn2="Удалить"
      />
    </div>
  )
}

export default CompanyPassword
