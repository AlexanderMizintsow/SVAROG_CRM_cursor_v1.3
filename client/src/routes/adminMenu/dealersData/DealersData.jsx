import { useState } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import { MdAddBusiness, MdContactSupport } from 'react-icons/md'
import { LiaUsersCogSolid } from 'react-icons/lia'
import { FaRegAddressCard } from 'react-icons/fa'
import CompanyForm from './company/CompanyForm'
import DealerForm from './employee/DealerForm'
import CompanyList from './dealersCard/CompanyList'
import HelpModalDealersData from './HelpModalDealersData'
import SearchBar from '../../../components/searchBar/SearchBar'
import { API_BASE_URL } from '../../../../config'
import './dealerData.scss'

const DealersData = () => {
  const [isFormVisibleCompany, setIsFormVisibleCompany] = useState(false)
  const [isFormVisibleDealer, setIsFormVisibleDealer] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [openHelpModal, setOpenHelpModal] = useState(false)

  const handleCompanySubmit = async (company) => {
    try {
      const response = await axios.post(`${API_BASE_URL}5003/api/companies`, company)
      Toastify({
        text: `Компания создана: ${response.data.name}`,
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()

      setIsFormVisibleCompany(false)
    } catch (error) {
      let errorMessage = 'Ошибка при создании компании'
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error
      }
      Toastify({
        text: errorMessage,
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
      console.error('Ошибка при создании компании:', error)
    }
  }

  const toggleFormVisibilityCompany = () => {
    setIsFormVisibleCompany(true)
    setIsFormVisibleDealer(false)
  }

  const toggleFormVisibilityDealer = () => {
    setIsFormVisibleDealer(true)
    setIsFormVisibleCompany(false)
  }

  const toggleFormVisibilityCard = () => {
    setIsFormVisibleDealer(false)
    setIsFormVisibleCompany(false)
  }

  const handleOpenHelpModal = () => {
    setOpenHelpModal(true) // Открываем модальное окно
  }

  return (
    <span style={{ position: 'relative' }}>
      {/* Модальное окно справки */}
      <HelpModalDealersData isOpen={openHelpModal} onClose={() => setOpenHelpModal(false)} />
      <MdAddBusiness
        className="icon-pointer"
        title="Создать карточку Дилера"
        style={{ marginRight: '15px', marginBottom: '5px' }}
        size={24}
        onClick={toggleFormVisibilityCompany}
      />
      <LiaUsersCogSolid
        className="icon-pointer"
        title="Создать персону"
        style={{ marginRight: '15px', marginBottom: '5px' }}
        size={24}
        onClick={toggleFormVisibilityDealer}
      />
      <FaRegAddressCard
        className="icon-pointer"
        title="Карточка Дилера"
        style={{ marginRight: '15px', marginBottom: '5px' }}
        size={24}
        onClick={toggleFormVisibilityCard}
      />

      <MdContactSupport
        className="help-icon"
        onClick={handleOpenHelpModal}
        title="Справка по управлению дилерами"
        style={{
          fontSize: '24px',
          marginLeft: '15px',
          color: '#0b63c5',
          cursor: 'pointer',
          padding: '5px',
          borderRadius: '50%',
          backgroundColor: '#eef6ff',
          border: '2px solid #0b63c5',
        }}
      />

      {/* Поиск */}
      <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      {!isFormVisibleCompany && !isFormVisibleDealer && <CompanyList searchTerm={searchTerm} />}

      {isFormVisibleCompany && <CompanyForm onSubmit={handleCompanySubmit} />}
      {isFormVisibleDealer && <DealerForm />}
    </span>
  )
}

export default DealersData
