import { useEffect, useState } from 'react'
import useCompanyStore from '../../../../store/useCompanyStore'
import {
  industriesList,
  relatedActivities,
  contractsList,
  socialNetworksOptions,
  notificationMethodsOptions,
} from '../company/dataListsCompany'
import { LuDelete } from 'react-icons/lu'
const EditCompanyDetailsInfo = ({ companyId, companyData, onClose }) => {
  const [formData, setFormData] = useState({
    company_name: '',
    industries: [],
    phoneNumbers: [],
    emails: [],
    relatedActivities: [],
    contracts: [],
    socialNetworks: [],
    deliveryTerms: [],
    notificationMethods: [],
    importantDates: [],
    addresses: [],
  })

  useEffect(() => {
    const parseData = (data, parseFn) => (data ? parseFn(data) : [])

    setFormData({
      company_name: companyData.company_name || '',
      industries: parseData(companyData.industry_name, (str) =>
        str.split(', ').map((item) => item.trim())
      ),
      phoneNumbers: parseData(companyData.phone_number, (str) =>
        str.split(', ').map((item) => item.trim())
      ),
      emails: parseData(companyData.email, (str) =>
        str.split(', ').map((item) => item.trim())
      ),
      relatedActivities: parseData(companyData.activity_name, (str) =>
        str.split(', ').map((item) => item.trim())
      ),
      contracts: parseData(companyData.contract_name, (str) =>
        str.split(', ').map((item) => item.trim())
      ),
      socialNetworks: parseData(companyData.social_networks, (str) =>
        str.split(', ').map((social) => {
          const [network_name, comment] = social.split(': ')
          return {
            network_name: network_name.trim(),
            comment: comment ? comment.trim() : '',
          }
        })
      ),
      deliveryTerms: parseData(companyData.delivery_terms, (str) =>
        str.split(', ').map((term) => {
          const [term_name, term_comment] = term.split(': ')
          return {
            term_name: term_name.trim(),
            term_comment: term_comment ? term_comment.trim() : '',
          }
        })
      ),
      notificationMethods: parseData(companyData.notification_methods, (str) =>
        str.split(', ').map((item) => item.trim())
      ),
      importantDates: parseData(companyData.important_dates, (str) =>
        str.split(', ').map((date) => {
          const [date_name, event_date] = date.split(': ')
          return {
            date_name: date_name.trim(),
            event_date: event_date ? event_date.trim() : '',
          }
        })
      ),
      addresses: companyData.addresses || [],
    })
  }, [companyData])

  const handleInputChange = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const handleAddField = (field) => {
    const newFieldValue = {
      name_companies: companyData.company_name || '',
      industries: '',
      phoneNumbers: '',
      emails: '',
      relatedActivities: '',
      contracts: '',
      socialNetworks: { network_name: '', comment: '' },
      deliveryTerms: { term_name: '', term_comment: '' },
      importantDates: { date_name: '', event_date: '' },
      addresses: {
        region: '',
        city: '',
        street: '',
        building: '',
        is_primary: false,
        comment: '',
      },
    }[field]

    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], newFieldValue],
    }))
  }

  const handleRemoveField = (field, index) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await useCompanyStore.getState().updateCompanyDetails(companyId, formData)
      onClose()
    } catch (error) {
      console.error('Ошибка при обновлении данных компании:', error)
    }
  }

  return (
    <form
      style={{ margin: '17px' }}
      className="container editor-card-element"
      onSubmit={handleSubmit}
    >
      <h3>Отрасли</h3>
      {formData.industries.map((industry, index) => (
        <div key={index}>
          <select
            value={industry}
            onChange={(e) =>
              handleInputChange(
                'industries',
                formData.industries.map((ind, i) =>
                  i === index ? e.target.value : ind
                )
              )
            }
          >
            <option value="" disabled>
              Выбрать отрасль
            </option>
            {industriesList.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {formData.industries.length > 1 && (
            <span
              type="button"
              onClick={() => handleRemoveField('industries', index)}
            >
              <LuDelete
                style={{ color: 'red', marginLeft: '15px' }}
                className="icon-pointer"
              />
            </span>
          )}
        </div>
      ))}
      <button type="button" onClick={() => handleAddField('industries')}>
        Добавить отрасль
      </button>

      <h3>Телефонные номера</h3>
      {formData.phoneNumbers.map((phone, index) => (
        <div key={index}>
          <input
            type="text"
            value={phone}
            onChange={(e) =>
              handleInputChange(
                'phoneNumbers',
                formData.phoneNumbers.map((p, i) =>
                  i === index ? e.target.value : p
                )
              )
            }
          />
          {formData.phoneNumbers.length > 1 && (
            <span
              type="button"
              onClick={() => handleRemoveField('phoneNumbers', index)}
            >
              <LuDelete
                style={{ color: 'red', marginLeft: '15px' }}
                className="icon-pointer"
              />
            </span>
          )}
        </div>
      ))}
      <button type="button" onClick={() => handleAddField('phoneNumbers')}>
        Добавить телефон
      </button>

      <h3>Электронные адреса</h3>
      {formData.emails.map((email, index) => (
        <div key={index}>
          <input
            type="email"
            value={email}
            onChange={(e) =>
              handleInputChange(
                'emails',
                formData.emails.map((e, i) =>
                  i === index ? e.target.value : e
                )
              )
            }
          />
          {formData.emails.length > 1 && (
            <span
              type="button"
              onClick={() => handleRemoveField('emails', index)}
            >
              <LuDelete
                style={{ color: 'red', marginLeft: '15px' }}
                className="icon-pointer"
              />
            </span>
          )}
        </div>
      ))}
      <button type="button" onClick={() => handleAddField('emails')}>
        Добавить email
      </button>

      <h3>Сопутствующие деятельности</h3>
      {formData.relatedActivities.map((activity, index) => (
        <div key={index}>
          <select
            value={activity} // Устанавливаем текущее значение из formData
            onChange={(e) =>
              handleInputChange(
                'relatedActivities',
                formData.relatedActivities.map((act, i) =>
                  i === index ? e.target.value : act
                )
              )
            }
          >
            <option value="" disabled>
              Выберите деятельность
            </option>
            {relatedActivities.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {formData.relatedActivities.length > 1 && (
            <span
              type="button"
              onClick={() => handleRemoveField('relatedActivities', index)}
            >
              <LuDelete
                style={{ color: 'red', marginLeft: '15px' }}
                className="icon-pointer"
              />
            </span>
          )}
        </div>
      ))}
      <button type="button" onClick={() => handleAddField('relatedActivities')}>
        Добавить деятельность
      </button>

      <h3>Договоры</h3>
      {formData.contracts.map((contract, index) => (
        <div key={index}>
          <select
            value={contract} // Устанавливаем текущее значение из formData
            onChange={(e) =>
              handleInputChange(
                'contracts',
                formData.contracts.map((c, i) =>
                  i === index ? e.target.value : c
                )
              )
            }
          >
            <option value="" disabled>
              Выберите договор
            </option>
            {contractsList.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {formData.contracts.length > 1 && (
            <span
              type="button"
              onClick={() => handleRemoveField('contracts', index)}
            >
              <LuDelete
                style={{ color: 'red', marginLeft: '15px' }}
                className="icon-pointer"
              />
            </span>
          )}
        </div>
      ))}
      <button type="button" onClick={() => handleAddField('contracts')}>
        Добавить договор
      </button>

      <h3>Социальные сети</h3>
      {formData.socialNetworks.map((social, index) => (
        <div key={index}>
          <select
            value={social.network_name} // Устанавливаем текущее значение из formData
            onChange={(e) =>
              handleInputChange(
                'socialNetworks',
                formData.socialNetworks.map((s, i) =>
                  i === index ? { ...s, network_name: e.target.value } : s
                )
              )
            }
          >
            <option value="" disabled>
              Выберите социальную сеть
            </option>
            {socialNetworksOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Комментарий"
            value={social.comment}
            onChange={(e) =>
              handleInputChange(
                'socialNetworks',
                formData.socialNetworks.map((s, i) =>
                  i === index ? { ...s, comment: e.target.value } : s
                )
              )
            }
          />
          {formData.socialNetworks.length > 1 && (
            <span
              type="button"
              onClick={() => handleRemoveField('socialNetworks', index)}
            >
              <LuDelete
                style={{ color: 'red', marginLeft: '15px' }}
                className="icon-pointer"
              />
            </span>
          )}
        </div>
      ))}
      <button type="button" onClick={() => handleAddField('socialNetworks')}>
        Добавить соцсеть
      </button>

      <h3>Условия доставки</h3>
      {formData.deliveryTerms.map((term, index) => (
        <div key={index}>
          <input
            type="text"
            placeholder="Условие"
            value={term.term_name}
            onChange={(e) =>
              handleInputChange(
                'deliveryTerms',
                formData.deliveryTerms.map((t, i) =>
                  i === index ? { ...t, term_name: e.target.value } : t
                )
              )
            }
          />

          <input
            type="text"
            placeholder="Комментарий"
            value={term.term_comment}
            onChange={(e) =>
              handleInputChange(
                'deliveryTerms',
                formData.deliveryTerms.map((t, i) =>
                  i === index ? { ...t, term_comment: e.target.value } : t
                )
              )
            }
          />
          {formData.deliveryTerms.length > 1 && (
            <span
              type="button"
              onClick={() => handleRemoveField('deliveryTerms', index)}
            >
              <LuDelete
                style={{ color: 'red', marginLeft: '15px' }}
                className="icon-pointer"
              />
            </span>
          )}
        </div>
      ))}
      <button type="button" onClick={() => handleAddField('deliveryTerms')}>
        Добавить условие доставки
      </button>

      <h3>Способы оповещения</h3>
      {formData.notificationMethods.map((method, index) => (
        <div key={index}>
          <select
            value={method} // Устанавливаем текущее значение из formData
            onChange={(e) =>
              handleInputChange(
                'notificationMethods',
                formData.notificationMethods.map((m, i) =>
                  i === index ? e.target.value : m
                )
              )
            }
          >
            <option value="" disabled>
              Выберите метод оповещения
            </option>
            {notificationMethodsOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {formData.notificationMethods.length > 1 && (
            <span
              type="button"
              onClick={() => handleRemoveField('notificationMethods', index)}
            >
              <LuDelete
                style={{ color: 'red', marginLeft: '15px' }}
                className="icon-pointer"
              />
            </span>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => handleAddField('notificationMethods')}
      >
        Добавить метод оповещения
      </button>

      <h3>Значимые даты</h3>
      {formData.importantDates.map((date, index) => (
        <div key={index}>
          <input
            type="text"
            placeholder="Наименование"
            value={date.date_name}
            onChange={(e) =>
              handleInputChange(
                'importantDates',
                formData.importantDates.map((d, i) =>
                  i === index ? { ...d, date_name: e.target.value } : d
                )
              )
            }
          />
          <input
            type="date"
            value={date.event_date}
            onChange={(e) =>
              handleInputChange(
                'importantDates',
                formData.importantDates.map((d, i) =>
                  i === index ? { ...d, event_date: e.target.value } : d
                )
              )
            }
          />
          {formData.importantDates.length > 1 && (
            <span
              type="button"
              onClick={() => handleRemoveField('importantDates', index)}
            >
              <LuDelete
                style={{ color: 'red', marginLeft: '15px' }}
                className="icon-pointer"
              />
            </span>
          )}
        </div>
      ))}
      <button type="button" onClick={() => handleAddField('importantDates')}>
        Добавить значимую дату
      </button>

      <h3>Адреса</h3>
      {formData.addresses.map((address, index) => (
        <div key={index} className="address-container">
          <input
            type="text"
            placeholder="Регион"
            value={address.region}
            onChange={(e) =>
              handleInputChange(
                'addresses',
                formData.addresses.map((addr, i) =>
                  i === index ? { ...addr, region: e.target.value } : addr
                )
              )
            }
            className="address-input"
          />
          <input
            type="text"
            placeholder="Город"
            value={address.city}
            onChange={(e) =>
              handleInputChange(
                'addresses',
                formData.addresses.map((addr, i) =>
                  i === index ? { ...addr, city: e.target.value } : addr
                )
              )
            }
            className="address-input"
          />
          <input
            type="text"
            placeholder="Улица"
            value={address.street}
            onChange={(e) =>
              handleInputChange(
                'addresses',
                formData.addresses.map((addr, i) =>
                  i === index ? { ...addr, street: e.target.value } : addr
                )
              )
            }
            className="address-input"
          />
          <input
            type="text"
            placeholder="Строение"
            value={address.building}
            onChange={(e) =>
              handleInputChange(
                'addresses',
                formData.addresses.map((addr, i) =>
                  i === index ? { ...addr, building: e.target.value } : addr
                )
              )
            }
            className="address-input"
          />
          <div className="checkbox-container">
            <input
              type="checkbox"
              checked={address.is_primary || false}
              onChange={(e) =>
                handleInputChange(
                  'addresses',
                  formData.addresses.map((addr, i) =>
                    i === index
                      ? { ...addr, is_primary: e.target.checked }
                      : addr
                  )
                )
              }
            />{' '}
            Основной адрес
          </div>
          <input
            type="text"
            placeholder="Комментарий"
            value={address.comment || ''}
            onChange={(e) =>
              handleInputChange(
                'addresses',
                formData.addresses.map((addr, i) =>
                  i === index ? { ...addr, comment: e.target.value } : addr
                )
              )
            }
            className="address-input"
          />
          {formData.addresses.length > 1 && (
            <span
              type="button"
              className="remove-button"
              onClick={() => handleRemoveField('addresses', index)}
            >
              <LuDelete
                style={{ color: 'red', marginLeft: '15px' }}
                className="icon-pointer"
              />
            </span>
          )}
        </div>
      ))}

      <div style={{ marginTop: '15px' }}>
        <div>
          <button
            style={{ marginBottom: '25px' }}
            type="button"
            onClick={() => handleAddField('addresses')}
          >
            Добавить адрес
          </button>
        </div>

        <button type="submit">Сохранить</button>
        <button style={{ marginLeft: '15px' }} type="button" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </form>
  )
}

export default EditCompanyDetailsInfo
