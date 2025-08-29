import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../../../../config'
import {
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Typography,
} from '@mui/material'
import { ToastContainer, toast } from 'react-toastify'
import { MdContactSupport } from 'react-icons/md'
import axios from 'axios'
import ConfirmationDialog from '../../../components/confirmationDialog/ConfirmationDialog'
import SearchBar from '../../../components/searchBar/SearchBar'
import 'react-toastify/dist/ReactToastify.css'
import HelpModalCompanyPassword from './HelpModalCompanyPassword'

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
  const [companies, setCompanies] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)
  const [selectedCompanyName, setSelectedCompanyName] = useState('') // Добавляем состояние для имени компании
  const [searchTerm, setSearchTerm] = useState('')
  const [openHelpModal, setOpenHelpModal] = useState(false)

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
    try {
      await axios.put(
        `${API_BASE_URL}5003/api/companies/password/${companyId}`,
        {
          telegram_password: newPassword,
        }
      )
      toast.success('Пароль успешно обновлён')
      await fetchCompanies()
    } catch (error) {
      console.error('Ошибка при обновлении пароля:', error)
      toast.error('Ошибка при обновлении пароля')
    }
  }

  const handlePasswordDelete = (companyId, companyName) => {
    setSelectedCompanyId(companyId)
    setSelectedCompanyName(companyName)
    setDialogOpen(true)
  }

  const confirmDelete = async () => {
    await handlePasswordChange(selectedCompanyId, 'NOTACCES')
    setDialogOpen(false)
    setSelectedCompanyName('')
  }

  const renderTableCellActions = (company) => (
    <TableCell>
      <Button
        variant="contained"
        onClick={() => {
          const newPassword = generateRandomPassword()
          if (newPassword) {
            handlePasswordChange(company.id, newPassword)
          }
        }}
      >
        Установить пароль
      </Button>
      {company.telegram_password !== 'NOTACCES' && (
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

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Название компании</TableCell>
              <TableCell>Пароль Telegram</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCompanies.map((company) => (
              <TableRow key={company.id}>
                <TableCell>{company.name_companies}</TableCell>
                <TableCell>
                  {company.telegram_password === 'NOTACCES' ? (
                    'NOTACCES'
                  ) : (
                    <Typography variant="body1">
                      {company.telegram_password}
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
