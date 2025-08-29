import React from 'react'
import PropTypes from 'prop-types'
import { TiDeleteOutline } from 'react-icons/ti'
import './EditDealerCard.scss'

const EditDealerCard = ({
  editingDealer,
  handleChange,
  handleArrayChange,
  handlePhoneChange,
  handleEmailChange,
  addNewPhone,
  addNewEmail,
  handleSave,
  handleCancel,
  handleDeletePhone,
  handleDeleteEmail,
}) => {
  const validatePhones = () => {
    for (const phone of editingDealer.phones) {
      if (
        phone.phone_type === 'мобильный' &&
        phone.phone_number &&
        !phone.phone_number.startsWith('+7')
      ) {
        alert(
          'Номер мобильного телефона должен начинаться с +7: ' +
            phone.phone_number
        )
        return false
      }
    }
    return true
  }

  const validateEmails = () => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const email of editingDealer.emails) {
      if (email.email && !emailPattern.test(email.email)) {
        alert('Некорректный адрес электронной почты: ' + email.email)
        return false
      }
    }
    return true
  }

  const handleSaveClick = () => {
    if (validatePhones() && validateEmails()) {
      handleSave()
    }
  }

  return (
    <div className="edit-form">
      <input
        name="first_name"
        value={editingDealer.first_name}
        onChange={handleChange}
        placeholder="Имя"
      />
      <input
        name="last_name"
        value={editingDealer.last_name}
        onChange={handleChange}
        placeholder="Фамилия"
      />
      <input
        name="middle_name"
        value={editingDealer.middle_name || ''}
        onChange={handleChange}
        placeholder="Отчество"
      />
      <input
        type="date"
        name="birth_date"
        value={
          editingDealer.birth_date ? editingDealer.birth_date.slice(0, 10) : ''
        }
        onChange={handleChange}
      />
      <span style={{ marginTop: '10px' }}>
        Разделяйте запятой для введения списка значений хобби и должность
      </span>
      <textarea
        name="hobbies"
        value={editingDealer.hobbies.join(', ') || ''}
        onChange={(e) => handleArrayChange('hobbies', e.target.value)}
        placeholder="Хобби (разделяйте запятой)"
      />
      <textarea
        name="positions"
        value={editingDealer.positions.join(', ') || ''}
        onChange={(e) => handleArrayChange('positions', e.target.value)}
        placeholder="Должности (разделяйте запятой)"
      />
      {editingDealer.phones.map((phone, index) => (
        <div key={index} className="phone-entry">
          <input
            value={phone.phone_number || ''}
            onChange={(e) =>
              handlePhoneChange(index, 'phone_number', e.target.value)
            }
            placeholder="Телефон"
          />
          <select
            value={phone.phone_type}
            onChange={(e) =>
              handlePhoneChange(index, 'phone_type', e.target.value)
            }
          >
            <option value="рабочий">Рабочий</option>
            <option value="мобильный">Мобильный</option>
            <option value="домашний">Домашний</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={phone.is_primary}
              onChange={() =>
                handlePhoneChange(index, 'is_primary', !phone.is_primary)
              }
            />
            Осн.
          </label>
          <span>
            <TiDeleteOutline
              className="edit-icon-delete"
              onClick={() => handleDeletePhone(phone)}
            />
          </span>

          {/* Кнопка удаления телефона */}
        </div>
      ))}
      <button onClick={addNewPhone}>Добавить телефон</button>

      {editingDealer.emails.map((email, index) => (
        <div key={index} className="email-entry">
          <input
            value={email.email || ''}
            onChange={(e) => handleEmailChange(index, 'email', e.target.value)}
            placeholder="Эл. почта"
          />
          <label>
            <input
              type="checkbox"
              checked={email.is_primary}
              onChange={() =>
                handleEmailChange(index, 'is_primary', !email.is_primary)
              }
            />
            Осн.
          </label>

          <span>
            <TiDeleteOutline
              className="edit-icon-delete"
              onClick={() => handleDeleteEmail(email)}
            />
          </span>
          {/* Кнопка удаления email */}
        </div>
      ))}
      <button onClick={addNewEmail}>Добавить электронную почту</button>
      <button onClick={handleSaveClick}>Сохранить</button>
      <button onClick={handleCancel}>Отменить</button>
    </div>
  )
}

EditDealerCard.propTypes = {
  editingDealer: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  handleArrayChange: PropTypes.func.isRequired,
  handlePhoneChange: PropTypes.func.isRequired,
  handleEmailChange: PropTypes.func.isRequired,
  addNewPhone: PropTypes.func.isRequired,
  addNewEmail: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
  handleCancel: PropTypes.func.isRequired,
  handleDeletePhone: PropTypes.func.isRequired,
  handleDeleteEmail: PropTypes.func.isRequired,
}

export default EditDealerCard
