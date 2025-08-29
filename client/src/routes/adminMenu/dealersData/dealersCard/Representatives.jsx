import { useEffect, useState } from 'react'
import axios from 'axios'
import './representatives.scss'
import { API_BASE_URL } from '../../../../../config'
import { CiEdit } from 'react-icons/ci'
import { FcDeleteColumn } from 'react-icons/fc'
import EditDealerCard from './EditDealerCard'
import ConfirmationDialog from '../../../../components/confirmationDialog/ConfirmationDialog' // Импортируйте ваш диалог
import { FaBirthdayCake, FaEnvelope, FaPhone, FaStar, FaUser } from 'react-icons/fa'

const Representatives = ({ companyId }) => {
  const [dealers, setDealers] = useState([])
  const [editingDealer, setEditingDealer] = useState({
    positions: [],
    phones: [],
    emails: [],
    hobbies: [],
    birth_date: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    dealer_id: null,
  })

  const [dialogOpen, setDialogOpen] = useState(false) // Состояние для диалога
  const [deleteItem, setDeleteItem] = useState(null) // Храним информацию об удаляемом элементе

  useEffect(() => {
    const fetchDealers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5003/api/dealers`, {
          params: { company_id: companyId },
        })
        setDealers(response.data)
      } catch (error) {
        console.error('Ошибка при загрузке данных дилеров:', error)
      }
    }

    fetchDealers()
  }, [companyId])

  const removeDuplicates = (array, key) => {
    return array.filter(
      (item, index, self) => index === self.findIndex((t) => t[key] === item[key])
    )
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Нет данных'
    const options = { year: 'numeric', month: 'long', day: 'numeric' }
    return new Date(dateString).toLocaleDateString('ru-RU', options)
  }

  const handleEditClick = (dealer) => {
    setEditingDealer({
      ...dealer,
      positions: dealer.positions || [],
      phones: dealer.phones || [],
      emails: dealer.emails || [],
      hobbies: dealer.hobbies || [],
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setEditingDealer((prev) => ({ ...prev, [name]: value }))
  }

  const handleArrayChange = (name, value) => {
    setEditingDealer((prev) => ({
      ...prev,
      [name]: value.split(',').map((item) => item.trim()),
    }))
  }

  const handlePhoneChange = (index, field, value) => {
    const updatedPhones = editingDealer.phones.map((phone, i) => {
      if (i === index) {
        return { ...phone, [field]: value }
      }
      return phone
    })
    setEditingDealer((prev) => ({ ...prev, phones: updatedPhones }))
  }

  const addNewPhone = () => {
    setEditingDealer((prev) => ({
      ...prev,
      phones: [...prev.phones, { phone_number: '', phone_type: 'рабочий', is_primary: false }],
    }))
  }

  const handleEmailChange = (index, field, value) => {
    const updatedEmails = editingDealer.emails.map((email, i) => {
      if (i === index) {
        return { ...email, [field]: value }
      }
      return email
    })
    setEditingDealer((prev) => ({ ...prev, emails: updatedEmails }))
  }

  const addNewEmail = () => {
    setEditingDealer((prev) => ({
      ...prev,
      emails: [...prev.emails, { email: '', is_primary: false }],
    }))
  }

  const handleSave = async () => {
    if (editingDealer.dealer_id) {
      try {
        await axios.put(`${API_BASE_URL}5003/api/dealers/${editingDealer.dealer_id}`, editingDealer)
        setDealers((prev) =>
          prev.map((dealer) =>
            dealer.dealer_id === editingDealer.dealer_id ? editingDealer : dealer
          )
        )
        setEditingDealer({
          positions: [],
          phones: [],
          emails: [],
          hobbies: [],
          birth_date: '',
          first_name: '',
          last_name: '',
          middle_name: '',
          dealer_id: null,
        })
      } catch (error) {
        console.error('Ошибка при обновлении данных дилера:', error)
      }
    }
  }

  const handleDeleteDealer = (dealerId) => {
    setDeleteItem({ type: 'dealer', id: dealerId })
    setDialogOpen(true)
  }

  const handleDeletePhone = (phone) => {
    setDeleteItem({ type: 'phone', phone })
    setDialogOpen(true)
  }

  const handleDeleteEmail = (email) => {
    setDeleteItem({ type: 'email', email })
    setDialogOpen(true)
  }

  const confirmDeletion = async () => {
    if (!deleteItem) return

    try {
      if (deleteItem.type === 'dealer') {
        await axios.delete(`${API_BASE_URL}5003/api/dealers/${deleteItem.id}`)
        setDealers((prev) => prev.filter((dealer) => dealer.dealer_id !== deleteItem.id))
      } else if (deleteItem.type === 'phone') {
        await axios.delete(`${API_BASE_URL}5003/api/dealers/${editingDealer.dealer_id}/phones`, {
          data: { phone_number: deleteItem.phone.phone_number },
        })
        setEditingDealer((prev) => ({
          ...prev,
          phones: prev.phones.filter((p) => p.phone_number !== deleteItem.phone.phone_number),
        }))
      } else if (deleteItem.type === 'email') {
        await axios.delete(`${API_BASE_URL}5003/api/dealers/${editingDealer.dealer_id}/emails`, {
          data: { email: deleteItem.email.email },
        })
        setEditingDealer((prev) => ({
          ...prev,
          emails: prev.emails.filter((e) => e.email !== deleteItem.email.email),
        }))
      }
    } catch (error) {
      console.error('Ошибка при удалении:', error)
    } finally {
      setDeleteItem(null)
      setDialogOpen(false)
    }
  }

  return (
    <div className="card-section is-active" id="dealers">
      <div className="card-content">
        <div className="card-subtitle">Представители:</div>
        <div className="dealers-grid">
          {dealers.length ? (
            dealers.map((dealer) => (
              <div key={dealer.dealer_id} className="dealer-card">
                <div className="dealer-header">
                  <CiEdit
                    title="Редактировать"
                    className="edit-dealer-btn"
                    onClick={() => handleEditClick(dealer)}
                  />

                  <FcDeleteColumn
                    title="Удалить персону"
                    className="edit-dealer-btn"
                    onClick={() => handleDeleteDealer(dealer.dealer_id)}
                  />
                  <h3>{`${dealer.first_name || ''} ${dealer.middle_name || ''} ${
                    dealer.last_name || ''
                  }`}</h3>
                </div>

                {editingDealer.dealer_id === dealer.dealer_id ? (
                  <EditDealerCard
                    editingDealer={editingDealer}
                    handleChange={handleChange}
                    handleArrayChange={handleArrayChange}
                    handlePhoneChange={handlePhoneChange}
                    handleEmailChange={handleEmailChange}
                    addNewPhone={addNewPhone}
                    addNewEmail={addNewEmail}
                    handleSave={handleSave}
                    handleCancel={() =>
                      setEditingDealer({
                        positions: [],
                        phones: [],
                        emails: [],
                        hobbies: [],
                        birth_date: '',
                        first_name: '',
                        last_name: '',
                        middle_name: '',
                        dealer_id: null,
                      })
                    }
                    handleDeletePhone={handleDeletePhone}
                    handleDeleteEmail={handleDeleteEmail}
                    formatDate={formatDate}
                    removeDuplicates={removeDuplicates}
                  />
                ) : (
                  <div className="dealer-body">
                    <p className="contactInfo">
                      <FaBirthdayCake className="contactInfo-icon" />
                      <strong>Дата рождения:</strong> {formatDate(dealer.birth_date)}
                    </p>
                    <p className="contactInfo">
                      <FaEnvelope className="contactInfo-icon" />
                      <strong>Эл. почта:</strong>
                      {dealer.emails && dealer.emails.length > 0
                        ? removeDuplicates(dealer.emails, 'email').map((email) => (
                            <span key={email.id}>
                              <a href={`mailto:${email.email}`}>{email.email}</a>

                              <br />
                            </span>
                          ))
                        : 'Нет данных'}
                    </p>
                    <p className="contactInfo">
                      <FaPhone className="contactInfo-icon" />
                      <strong>Телефон:</strong>
                      {dealer.phones && dealer.phones.length > 0
                        ? removeDuplicates(dealer.phones, 'phone_number').map((phone) => (
                            <span key={phone.id}>
                              {phone.phone_number}

                              <br />
                            </span>
                          ))
                        : 'Нет данных'}
                    </p>
                    <p className="contactInfo">
                      <FaStar className="contactInfo-icon" />
                      <strong>Хобби:</strong>
                      {dealer.hobbies && dealer.hobbies.length > 0
                        ? dealer.hobbies.join(', ')
                        : 'Нет данных'}
                    </p>
                    <p className="contactInfo">
                      <FaUser className="contactInfo-icon" />
                      <strong>Должности:</strong>
                      {dealer.positions && dealer.positions.length > 0
                        ? dealer.positions.join(', ')
                        : 'Нет данных'}
                    </p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p>Информация о дилерах отсутствует.</p>
          )}
        </div>
      </div>
      {/* Рендерим диалог для подтверждения */}
      <ConfirmationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={confirmDeletion}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить этот элемент?"
        btn1="Отменить"
        btn2="Удалить"
      />
    </div>
  )
}

export default Representatives
