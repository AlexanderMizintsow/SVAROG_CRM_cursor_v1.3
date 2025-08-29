import ConfirmationDialog from '../../../components/confirmationDialog/ConfirmationDialog'
import Toastify from 'toastify-js'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'

const UserDeletion = ({ open, onClose, user, onDeleteComplete }) => {
  const handleDelete = async () => {
    const token = localStorage.getItem('token')
    try {
      await axios.delete(`${API_BASE_URL}5000/api/users/delete/${user.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      Toastify({
        text: `Сотрудник ${user.fullName} удален`,
        close: true,
        style: {
          background: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()
      onDeleteComplete(user.id)
      onClose()
    } catch (error) {
      console.error('Ошибка при удалении сотрудника:', error)
      Toastify({
        text: `Ошибка удаления сотрудника ${user.fullName}: ${error}`,
        close: true,
        style: {
          background: 'linear-gradient(to right, #ff7e79, #ff1e00)',
        },
      }).showToast()
      onClose()
    }
  }

  return (
    <ConfirmationDialog
      open={open}
      onClose={onClose}
      onConfirm={handleDelete}
      title="Подтверждение удаления"
      message={`Вы уверены, что хотите удалить ${user ? user.fullName : ''}?`}
      btn1="Отмена"
      btn2="Удалить"
    />
  )
}

export default UserDeletion
