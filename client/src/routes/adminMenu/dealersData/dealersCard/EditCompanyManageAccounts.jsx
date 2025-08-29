import { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import Toastify from 'toastify-js'
import './EditCompanyForm.scss'
import ConfirmationDialog from '../../../../components/confirmationDialog/ConfirmationDialog'
import UserStore from '../../../../store/userStore'

const EditCompanyManageAccounts = ({ company, onClose, setIsDelete }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { user } = UserStore()

  const handleDeleteDealerCard = async (company) => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}5003/api/company/delete/${company.company_id}/${company.company_name}/${user.id}`
      )
      Toastify({
        text: response.data,
        close: true,
        style: {
          background: 'linear-gradient(to right, #007BFF, #0056b3)',
        },
      }).showToast()
      setIsDelete(company.company_id)
      setIsDialogOpen(false)
    } catch (error) {
      Toastify({
        text: `Ошибка при удалении компании: ${
          error.response ? error.response.data : error.message
        }`,
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #ff0000, #ffcccc)',
        },
      }).showToast()
      console.error('Ошибка при загрузке конкурентов:', error)
      setIsDialogOpen(false)
    }
  }

  const handleDeleteClick = () => {
    setIsDialogOpen(true) // Открываем диалог подтверждения
  }

  return (
    <div style={{ margin: '17px' }} className="container editor-card-element">
      <h4>Управление карточкой:</h4>

      <button style={{ marginLeft: '15px' }} onClick={onClose}>
        Закрыть
      </button>

      <button
        style={{ position: 'absolute', right: '10px', background: 'red' }}
        onClick={handleDeleteClick}
      >
        Удалить карточку дилера
      </button>

      <ConfirmationDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)} // Закрываем диалог
        onConfirm={() => handleDeleteDealerCard(company)} // Подтверждение удаления
        title="Подтверждение удаления"
        message={`Вы уверены, что хотите удалить компанию ${company.company_name}?`}
        btn1="Отмена"
        btn2="Удалить"
      />
    </div>
  )
}

export default EditCompanyManageAccounts
//1
