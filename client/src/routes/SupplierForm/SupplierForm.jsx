import { API_BASE_URL } from '../../../config'
import axios from 'axios'
import { useState, useEffect } from 'react'
import './supplierForm.scss'

const SupplierForm = () => {
  const [supplier, setSupplier] = useState({
    name: '',
    contact_fio: '',
    phones: [''],
    emails: [''],
  })
  const [suppliersList, setSuppliersList] = useState([])
  const [editingId, setEditingId] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setSupplier((prev) => ({ ...prev, [name]: value }))
  }

  const handleArrayChange = (field, index, value) => {
    setSupplier((prev) => {
      const arr = [...(prev[field] || [])]
      arr[index] = value
      return { ...prev, [field]: arr }
    })
  }

  const addArrayItem = (field) => {
    setSupplier((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), ''],
    }))
  }

  const removeArrayItem = (field, index) => {
    setSupplier((prev) => {
      const arr = (prev[field] || []).filter((_, i) => i !== index)
      return { ...prev, [field]: arr.length ? arr : [''] }
    })
  }

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5003/api/suppliers`)
      setSuppliersList(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Ошибка при получении поставщиков:', error)
      setSuppliersList([])
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const resetForm = () => {
    setSupplier({
      name: '',
      contact_fio: '',
      phones: [''],
      emails: [''],
    })
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const phonesFiltered = (supplier.phones || []).filter((p) => String(p).trim() !== '')
    const emailsFiltered = (supplier.emails || []).filter((e) => String(e).trim() !== '')
    const payload = {
      name: supplier.name?.trim() || '',
      contact_fio: supplier.contact_fio?.trim() || '',
      phones: phonesFiltered.length ? phonesFiltered : [],
      emails: emailsFiltered.length ? emailsFiltered : [],
    }
    if (!payload.name) {
      alert('Укажите наименование поставщика.')
      return
    }
    try {
      if (editingId) {
        await axios.put(`${API_BASE_URL}5003/api/suppliers/${editingId}`, payload)
        resetForm()
      } else {
        await axios.post(`${API_BASE_URL}5003/api/suppliers`, payload)
        resetForm()
      }
      fetchSuppliers()
    } catch (error) {
      console.error('Ошибка при сохранении поставщика:', error)
      alert(error.response?.data?.error || 'Не удалось сохранить')
    }
  }

  const handleEdit = (item) => {
    setSupplier({
      name: item.name || '',
      contact_fio: item.contact_fio || '',
      phones: Array.isArray(item.phones) && item.phones.length ? item.phones : [''],
      emails: Array.isArray(item.emails) && item.emails.length ? item.emails : [''],
    })
    setEditingId(item.id)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этого поставщика?')) return
    try {
      await axios.delete(`${API_BASE_URL}5003/api/suppliers/${id}`)
      fetchSuppliers()
      if (editingId === id) resetForm()
    } catch (error) {
      console.error('Ошибка при удалении:', error)
      alert(error.response?.data?.error || 'Не удалось удалить')
    }
  }

  return (
    <div className="supplier-form-container">
      <div className="form-section">
        <h1>{editingId ? 'Редактировать поставщика' : 'Добавить поставщика'}</h1>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="name">Наименование поставщика *</label>
            <input
              type="text"
              name="name"
              id="name"
              value={supplier.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="contact_fio">ФИО контакта</label>
            <input
              type="text"
              name="contact_fio"
              id="contact_fio"
              value={supplier.contact_fio}
              onChange={handleChange}
            />
          </div>
          <div className="input-group">
            <label>Телефоны</label>
            {(supplier.phones || ['']).map((phone, index) => (
              <div key={`phone-${index}`} className="input-row">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => handleArrayChange('phones', index, e.target.value)}
                  placeholder="+7 ..."
                />
                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => removeArrayItem('phones', index)}
                  disabled={(supplier.phones || []).length <= 1}
                >
                  −
                </button>
              </div>
            ))}
            <button type="button" className="btn-add" onClick={() => addArrayItem('phones')}>
              + Добавить телефон
            </button>
          </div>
          <div className="input-group">
            <label>Адреса эл. почты</label>
            {(supplier.emails || ['']).map((email, index) => (
              <div key={`email-${index}`} className="input-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => handleArrayChange('emails', index, e.target.value)}
                  placeholder="email@example.com"
                />
                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => removeArrayItem('emails', index)}
                  disabled={(supplier.emails || []).length <= 1}
                >
                  −
                </button>
              </div>
            ))}
            <button type="button" className="btn-add" onClick={() => addArrayItem('emails')}>
              + Добавить email
            </button>
          </div>
          <div className="form-actions">
            <button type="submit" className="submit-button">
              {editingId ? 'Сохранить' : 'Добавить'}
            </button>
            {editingId && (
              <button type="button" className="cancel-button" onClick={resetForm}>
                Отмена
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="list-section">
        <h2>Список поставщиков</h2>
        <ul>
          {suppliersList.map((item) => (
            <li key={item.id} className="supplier-item">
              <div className="supplier-item__header">
                <h3>{item.name}</h3>
                <div className="supplier-item__actions">
                  <button type="button" className="btn-edit" onClick={() => handleEdit(item)}>
                    Изменить
                  </button>
                  <button type="button" className="btn-delete" onClick={() => handleDelete(item.id)}>
                    Удалить
                  </button>
                </div>
              </div>
              {item.contact_fio && <p className="supplier-item__fio">ФИО: {item.contact_fio}</p>}
              {Array.isArray(item.phones) && item.phones.length > 0 && (
                <p className="supplier-item__phones">Тел.: {item.phones.join(', ')}</p>
              )}
              {Array.isArray(item.emails) && item.emails.length > 0 && (
                <p className="supplier-item__emails">Email: {item.emails.join(', ')}</p>
              )}
            </li>
          ))}
        </ul>
        {suppliersList.length === 0 && <p className="list-empty">Нет сохранённых поставщиков.</p>}
      </div>
    </div>
  )
}

export default SupplierForm
