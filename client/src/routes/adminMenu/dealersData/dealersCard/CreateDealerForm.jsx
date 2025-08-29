import { useState } from 'react'
import axios from 'axios'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL

const CreateDealerForm = ({ companyId, onCancel, onSuccess }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    birth_date: '',
    company_id: companyId,
    positions: [],
    phones: [{ phone_number: '', phone_type: 'рабочий', is_primary: false }],
    emails: [{ email: '', is_primary: false }],
    hobbies: [],
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePhoneChange = (index, field, value) => {
    const updatedPhones = [...formData.phones]
    updatedPhones[index][field] = value
    setFormData((prev) => ({ ...prev, phones: updatedPhones }))
  }

  const handleEmailChange = (index, field, value) => {
    const updatedEmails = [...formData.emails]
    updatedEmails[index][field] = value
    setFormData((prev) => ({ ...prev, emails: updatedEmails }))
  }

  const addPhone = () => {
    setFormData((prev) => ({
      ...prev,
      phones: [...prev.phones, { phone_number: '', phone_type: 'рабочий', is_primary: false }],
    }))
  }

  const addEmail = () => {
    setFormData((prev) => ({
      ...prev,
      emails: [...prev.emails, { email: '', is_primary: false }],
    }))
  }

  const removePhone = (index) => {
    const updatedPhones = formData.phones.filter((_, i) => i !== index)
    setFormData((prev) => ({ ...prev, phones: updatedPhones }))
  }

  const removeEmail = (index) => {
    const updatedEmails = formData.emails.filter((_, i) => i !== index)
    setFormData((prev) => ({ ...prev, emails: updatedEmails }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await axios.post(`${API_BASE_URL}5003/api/dealers`, formData)
      onSuccess(response.data)
    } catch (error) {
      console.error('Creation error:', error)
    }
  }

  return (
    <div className="create-form">
      <h3>Новый представитель</h3>
      <form onSubmit={handleSubmit}>
        {/* Основные поля */}
        <div className="form-group">
          <label>Фамилия*</label>
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Имя*</label>
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
          />
        </div>

        {/* Телефоны */}
        <div className="phones-section">
          <h4>Телефоны</h4>
          {formData.phones.map((phone, index) => (
            <div key={index} className="phone-row">
              <input
                type="text"
                value={phone.phone_number}
                onChange={(e) => handlePhoneChange(index, 'phone_number', e.target.value)}
                placeholder="Номер телефона"
                required
              />
              {/* Остальные поля телефона */}
              <button type="button" onClick={() => removePhone(index)}>
                Удалить
              </button>
            </div>
          ))}
          <button type="button" onClick={addPhone}>
            Добавить телефон
          </button>
        </div>

        {/* Кнопки */}
        <div className="form-actions">
          <button type="submit">Создать</button>
          <button type="button" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateDealerForm
