import { useState } from 'react'
import { documentTransferOptions } from '../company/dataListsCompany'
import { companyStatusOptions } from '../company/dataListsCompany'
import useCompanyStore from '../../../../store/useCompanyStore'
const EditCompanyGeneralInfo = ({ companyId, companyData, onClose }) => {
  const [formData, setFormData] = useState({
    name_companies: companyData.company_name,
    status_companies: companyData.company_status,
    seller_code: companyData.seller_code,
    inn: companyData.inn,
    trade_brand: companyData.trade_brand,
    document_transfer_department: companyData.document_transfer_department,
    is_self_service: companyData.is_self_service || false,
    has_availability: companyData.has_availability || false,
    has_warehouse: companyData.has_warehouse || false,
    floorRising: {
      is_paid:
        companyData.floor_rising_status &&
        companyData.floor_rising_status.includes('Платно'),
      comment: '', // Или добавить логику для комментария, если нужно
    },
  })

  const updateCompany = useCompanyStore((state) => state.updateCompany)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleFloorRisingChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prevData) => ({
      ...prevData,
      floorRising: {
        ...prevData.floorRising,
        [name]: type === 'checkbox' ? checked : value,
      },
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      // Используем updateCompany из Zustand
      await updateCompany(companyId, {
        name_companies: formData.name_companies,
        status_companies: formData.status_companies,
        seller_code: formData.seller_code,
        inn: formData.inn,
        trade_brand: formData.trade_brand,
        document_transfer_department: formData.document_transfer_department,
        is_self_service: formData.is_self_service,
        has_availability: formData.has_availability,
        has_warehouse: formData.has_warehouse,
        floor_rising: {
          is_paid: formData.floorRising.is_paid,
          comment: formData.floorRising.comment || '',
        },
      })
      console.log('Данные компании успешно обновлены')
      onClose() // Закрываем модальное окно или компонент
    } catch (error) {
      console.error('Ошибка при обновлении данных компании:', error)
    }
  }

  console.log(companyData)
  return (
    <form
      style={{ margin: '17px' }}
      className="container editor-card-element"
      onSubmit={handleSubmit}
    >
      <div>
        <label>
          Название компании:{' '}
          <input
            type="text"
            name="name_companies"
            value={formData.name_companies}
            onChange={handleChange}
            required
          />
        </label>
      </div>
      <div>
        <label>
          Статус компании:{' '}
          <select
            name="status_companies"
            value={formData.status_companies}
            onChange={handleChange}
          >
            {companyStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <label>
          Код продавца:{' '}
          <input
            type="text"
            name="seller_code"
            value={formData.seller_code}
            onChange={handleChange}
          />
        </label>
      </div>
      <div>
        <label>
          ИНН:{' '}
          <input
            type="text"
            name="inn"
            value={formData.inn}
            onChange={handleChange}
          />
        </label>
      </div>
      <div>
        <label>
          Торговый бренд:{' '}
          <input
            type="text"
            name="trade_brand"
            value={formData.trade_brand}
            onChange={handleChange}
          />
        </label>
      </div>
      <div>
        <label>
          Отдел передачи документов:{' '}
          <select
            name="document_transfer_department"
            value={formData.document_transfer_department}
            onChange={handleChange}
          >
            {documentTransferOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <label>
          Самостоятельный клиент:{' '}
          <input
            type="checkbox"
            name="is_self_service"
            checked={formData.is_self_service}
            onChange={handleChange}
          />
        </label>
      </div>
      <div>
        <label>
          Наличие АВ:{' '}
          <input
            type="checkbox"
            name="has_availability"
            checked={formData.has_availability}
            onChange={handleChange}
          />
        </label>
      </div>
      <div>
        <label>
          Наличие склада:{' '}
          <input
            type="checkbox"
            name="has_warehouse"
            checked={formData.has_warehouse}
            onChange={handleChange}
          />
        </label>
      </div>
      <div>
        <label>
          Подъем на этаж платно:{' '}
          <input
            type="checkbox"
            name="is_paid"
            checked={formData.floorRising.is_paid}
            onChange={handleFloorRisingChange}
          />
          <input
            type="text"
            name="comment"
            placeholder="Комментарий"
            value={formData.floorRising.comment}
            onChange={handleFloorRisingChange}
          />
        </label>
      </div>
      <button type="submit">Сохранить</button>
      <button type="button" onClick={onClose}>
        Закрыть
      </button>
    </form>
  )
}

export default EditCompanyGeneralInfo
