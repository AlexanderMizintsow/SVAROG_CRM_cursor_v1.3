import { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import {
  industriesList,
  contractsList,
  relatedActivities,
  documentTransferOptions,
  notificationMethodsOptions,
  socialNetworksOptions,
} from './dataListsCompany'
import {
  TextField,
  Button,
  Container,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
} from '@mui/material'
import UserStore from '../../../../store/userStore'
import { FaDeleteLeft } from 'react-icons/fa6'
import { MdAddCircle } from 'react-icons/md'
import { LiaRemoveFormatSolid } from 'react-icons/lia'
import Toastify from 'toastify-js'
import './companyForm.scss'

const CompanyForm = ({ onSubmit }) => {
  const { user } = UserStore()
  console.log(user.id)
  const [employees, setEmployees] = useState([])
  const [competitorsList, setCompetitorsList] = useState([])
  const [company, setCompany] = useState({
    name_companies: '',
    status_companies: '',
    seller_code: '',
    inn: '',
    trade_brand: '',
    regional_manager_id: '',
    mpp_id: '',
    mpr_id: '',
    has_availability: false,
    has_warehouse: false,
    document_transfer_department: '',
    is_self_service: false,
    industries: [''],
    phoneNumbers: [''],
    emails: [''],
    relatedActivities: [''],
    contracts: [''],
    socialNetworks: [{ network_name: '', comment: '' }],
    deliveryTerms: [{ term_name: '', term_comment: '' }],
    notificationMethods: [''],
    importantDates: [{ date_name: '', event_date: '' }],
    floorRising: { is_paid: false, comment: '' },
    addresses: [
      {
        region: '',
        city: '',
        street: '',
        building: '',
        is_primary: false,
        comment: '',
      },
    ],
    competitors: [{ competitor_id: '', has_representation: false }],
    replacing_mpr: [{ user_id: '' }],
    replacing_mpp: [{ user_id: '', priority_level: 1 }],
    userId: user.id,
  })

  // Загрузка данных из localStorage
  useEffect(() => {
    const parsedData = localStorage.getItem('companyFormData')
    if (parsedData) {
      //  setCompany(JSON.parse(savedData))
      const savedData = JSON.parse(parsedData)
      setCompany({
        ...savedData,
        userId: user.id, // Убедитесь, что userId актуален
      })
    }
  }, [user.id])

  // Сохранение данных в localStorage
  useEffect(() => {
    localStorage.setItem('companyFormData', JSON.stringify(company))
  }, [company])

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/users`)
        setEmployees(response.data)
      } catch (error) {
        console.error('Ошибка при получении сотрудников:', error)
      }
    }

    const fetchCompetitors = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5003/api/competitors`)
        setCompetitorsList(response.data)
      } catch (error) {
        console.error('Ошибка при получении конкурентов:', error)
      }
    }

    fetchCompetitors()
    fetchEmployees()
  }, [])

  const handleChange = (e) => {
    setCompany({ ...company, [e.target.name]: e.target.value })
  }

  const handleArrayChange = (field, index, value) => {
    const updatedArray = [...company[field]]
    updatedArray[index] = value
    setCompany({ ...company, [field]: updatedArray })
  }

  const handleNestedArrayChange = (field, index, key, value) => {
    const updatedArray = [...company[field]]
    updatedArray[index][key] = value
    setCompany({ ...company, [field]: updatedArray })
  }

  const handleAddField = (field) => {
    setCompany({ ...company, [field]: [...company[field], ''] })
  }

  const handleRemoveField = (field, index) => {
    setCompany({
      ...company,
      [field]: company[field].filter((_, i) => i !== index),
    })
  }

  const handleAddNestedField = (field, initialElement) => {
    setCompany({ ...company, [field]: [...company[field], initialElement] })
  }

  const removeText = () => {
    setCompany({
      name_companies: '',
      status_companies: '',
      seller_code: '',
      inn: '',
      trade_brand: '',
      regional_manager_id: '',
      mpp_id: '',
      mpr_id: '',
      has_availability: false,
      has_warehouse: false,
      document_transfer_department: '',
      is_self_service: false,
      industries: [''],
      phoneNumbers: [''],
      emails: [''],
      relatedActivities: [''],
      contracts: [''],
      socialNetworks: [{ network_name: '', comment: '' }],
      deliveryTerms: [{ term_name: '', term_comment: '' }],
      notificationMethods: [''],
      importantDates: [{ date_name: '', event_date: '' }],
      floorRising: { is_paid: false, comment: '' },
      addresses: [
        {
          region: '',
          city: '',
          street: '',
          building: '',
          is_primary: false,
          comment: '',
        },
      ],
      competitors: [{ competitor_id: '', has_representation: false }],
      replacing_mpr: [{ user_id: '' }],
      replacing_mpp: [{ user_id: '' }],
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (let email of company.emails) {
      if (!emailRegex.test(email)) {
        alert('Пожалуйста, введите корректный email.')
        return
      }
    }
    console.log('Данные для отправки:', company)

    try {
      const response = await axios.post(`${API_BASE_URL}5003/api/companies`, company)
      Toastify({
        text: `Компания "${company.name_companies}" успешно создана.`,
        close: true,
        style: {
          background: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()
    } catch (error) {
      let errorMessage = 'Ошибка при создании компании, проверьте заполнение полей.'
      if (error.response) {
        if (error.response.data && error.response.data.error) {
          errorMessage = `${error.response.data.error}: ${error.response.data.details}`
        }
      }
      Toastify({
        text: errorMessage,
        close: true,
        style: {
          background: 'linear-gradient(to right, #ff7e79, #ff1e00)',
        },
      }).showToast()
    }
  }

  return (
    <Container
      className="container"
      style={{ maxWidth: '100%', maxHeight: '90%', overflowY: 'auto' }}
    >
      <label>
        <span onClick={removeText} className="remove-form">
          <LiaRemoveFormatSolid /> oчистить поля
        </span>
      </label>

      <Typography variant="h4" gutterBottom></Typography>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Название компании"
          name="name_companies"
          value={company.name_companies}
          onChange={handleChange}
          fullWidth
          margin="normal"
          required
        />

        <TextField
          label="Код продавца"
          name="seller_code"
          value={company.seller_code}
          onChange={handleChange}
          fullWidth
          margin="normal"
        />
        <TextField
          label="ИНН"
          name="inn"
          value={company.inn}
          onChange={handleChange}
          fullWidth
          margin="normal"
        />

        <TextField
          className="text-field"
          label="Торговый бренд"
          name="trade_brand"
          value={company.trade_brand}
          onChange={handleChange}
          fullWidth
          margin="normal"
        />

        <FormControl fullWidth margin="normal" required>
          <InputLabel id="regional-manager-select-label">Региональный менеджер</InputLabel>
          <Select
            labelId="regional-manager-select-label"
            name="regional_manager_id"
            value={company.regional_manager_id}
            onChange={handleChange}
          >
            <MenuItem value="">
              <em>Выберите регионального менеджера</em>
            </MenuItem>
            {employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {`${employee.last_name} ${employee.first_name} ${employee.middle_name}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Выбор МПП */}
        <FormControl fullWidth margin="normal" required>
          <InputLabel id="mpp-select-label">МПП</InputLabel>
          <Select
            labelId="mpp-select-label"
            name="mpp_id"
            value={company.mpp_id}
            onChange={handleChange}
          >
            <MenuItem value="">
              <em>Выберите МПП</em>
            </MenuItem>
            {employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {`${employee.last_name} ${employee.first_name} ${employee.middle_name}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Выбор МПР */}
        <FormControl fullWidth margin="normal" required>
          <InputLabel id="mpr-select-label">МПР</InputLabel>
          <Select
            labelId="mpr-select-label"
            name="mpr_id"
            value={company.mpr_id}
            onChange={handleChange}
          >
            <MenuItem value="">
              <em>Выберите МПР</em>
            </MenuItem>
            {employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {`${employee.last_name} ${employee.first_name} ${employee.middle_name}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Замещающие МПР */}
        {company.replacing_mpr.map((mpr, index) => (
          <div key={index} className="company-form-input-field">
            <FormControl fullWidth margin="normal" required>
              <InputLabel id={`replacing-mpr-select-label-${index}`}>
                Замещающий МПР №{index + 1}
              </InputLabel>
              <Select
                labelId={`replacing-mpr-select-label-${index}`}
                value={mpr.user_id}
                onChange={(e) =>
                  handleNestedArrayChange('replacing_mpr', index, 'user_id', e.target.value)
                }
              >
                <MenuItem value="">
                  <em>Выберите замещающего МПР</em>
                </MenuItem>
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {`${employee.last_name} ${employee.first_name} ${employee.middle_name}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              disabled={company.replacing_mpr.length <= 1}
              onClick={() => handleRemoveField('replacing_mpr', index)}
              color="secondary"
            >
              <FaDeleteLeft />
            </Button>
            <Button
              onClick={() => handleAddNestedField('replacing_mpr', { user_id: '' })}
              color="primary"
            >
              <MdAddCircle />
            </Button>
          </div>
        ))}

        {/* Замещающие МПП */}
        {company.replacing_mpp.map((mpp, index) => (
          <div key={index} className="company-form-input-field">
            <FormControl fullWidth margin="normal" required>
              <InputLabel id={`replacing-mpp-select-label-${index}`}>
                Замещающий МПП №{index + 1}
              </InputLabel>
              <Select
                labelId={`replacing-mpp-select-label-${index}`}
                value={mpp.user_id}
                onChange={(e) =>
                  handleNestedArrayChange('replacing_mpp', index, 'user_id', e.target.value)
                }
              >
                <MenuItem value="">
                  <em>Выберите замещающего МПП</em>
                </MenuItem>
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {`${employee.last_name} ${employee.first_name} ${employee.middle_name}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {/* Поле для выбора уровня приоритета */}
            <FormControl fullWidth margin="normal" required>
              <InputLabel id={`priority-select-label-${index}`}>Приоритет №{index + 1}</InputLabel>
              <Select
                labelId={`priority-select-label-${index}`}
                value={mpp.priority_level}
                onChange={(e) =>
                  handleNestedArrayChange('replacing_mpp', index, 'priority_level', e.target.value)
                }
              >
                <MenuItem value={1}>Высокий</MenuItem>
                <MenuItem value={2}>Средний</MenuItem>
                <MenuItem value={3}>Низкий</MenuItem>
              </Select>
            </FormControl>

            <Button
              disabled={company.replacing_mpp.length <= 1}
              onClick={() => handleRemoveField('replacing_mpp', index)}
              color="secondary"
            >
              <FaDeleteLeft />
            </Button>
            <Button
              onClick={() =>
                handleAddNestedField('replacing_mpp', {
                  user_id: '',
                  priority_level: 1,
                })
              }
              color="primary"
            >
              <MdAddCircle />
            </Button>
          </div>
        ))}

        <FormControlLabel
          control={
            <Checkbox
              checked={company.has_availability}
              onChange={(e) => setCompany({ ...company, has_availability: e.target.checked })}
              name="has_availability"
              color="primary"
            />
          }
          label="Наличие АВ"
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={company.has_warehouse}
              onChange={(e) => setCompany({ ...company, has_warehouse: e.target.checked })}
              name="has_warehouse"
              color="primary"
            />
          }
          label="Наличие склада"
        />

        <FormControl fullWidth margin="normal" required>
          <InputLabel id="document-transfer-label">Отдел передачи документов</InputLabel>
          <Select
            labelId="document-transfer-label"
            name="document_transfer_department"
            value={company.document_transfer_department || ''} // Убедитесь, что значение по умолчанию - пустая строка
            onChange={handleChange}
            displayEmpty
          >
            {documentTransferOptions.map((option, index) => (
              <MenuItem key={index} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Checkbox
              checked={company.is_self_service}
              onChange={(e) => setCompany({ ...company, is_self_service: e.target.checked })}
              name="is_self_service"
              color="primary"
            />
          }
          label="Самостоятельный клиент"
        />

        {company.industries.map((industry, index) => (
          <div key={index} className="company-form-input-field">
            <FormControl fullWidth margin="normal" required>
              <InputLabel id={`industry-select-label-${index}`}>Отрасль №{index + 1}</InputLabel>
              <Select
                labelId={`industry-select-label-${index}`}
                value={industry}
                onChange={(e) => handleArrayChange('industries', index, e.target.value)}
                label={`Отрасль №${index + 1}`}
              >
                {industriesList.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              disabled={company.industries.length <= 1}
              onClick={() => handleRemoveField('industries', index)}
              color="secondary"
            >
              <FaDeleteLeft />
            </Button>
            <Button onClick={() => handleAddNestedField('industries', '')} color="primary">
              <MdAddCircle />
            </Button>
          </div>
        ))}

        {company.phoneNumbers.map((phoneNumber, index) => (
          <div key={index} className="company-form-input-field">
            <TextField
              label={`Телефон №${index + 1}`}
              value={phoneNumber}
              onChange={(e) => {
                let value = e.target.value

                // Разрешаем только цифры и один знак + в начале
                if (value.length > 0 && value[0] === '+') {
                  value = '+' + value.slice(1).replace(/[^0-9]/g, '') // Разрешаем только цифры после +
                } else {
                  value = value.replace(/[^0-9]/g, '') // Разрешаем только цифры
                }

                if (value.length > 9) {
                  if (value[0] === '8') {
                    handleArrayChange('phoneNumbers', index, '+7' + value.slice(1))
                  } else if (!value.startsWith('+7')) {
                    handleArrayChange('phoneNumbers', index, '+7' + value)
                  } else {
                    handleArrayChange('phoneNumbers', index, value)
                  }
                } else {
                  handleArrayChange('phoneNumbers', index, value)
                }
              }}
              fullWidth
              margin="normal"
              inputProps={{ maxLength: 20 }}
              required
            />
            <Button
              disabled={company.phoneNumbers.length <= 1}
              onClick={() => handleRemoveField('phoneNumbers', index)}
              color="secondary"
            >
              <FaDeleteLeft />
            </Button>{' '}
            <Button onClick={() => handleAddField('phoneNumbers')} color="primary">
              <MdAddCircle />
            </Button>
          </div>
        ))}

        {company.emails.map((email, index) => (
          <div key={index} className="company-form-input-field">
            <TextField
              label={`Email №${index + 1}`}
              value={email}
              onChange={(e) => handleArrayChange('emails', index, e.target.value)}
              fullWidth
              margin="normal"
              required
            />
            <Button
              disabled={company.emails.length <= 1}
              onClick={() => handleRemoveField('emails', index)}
              color="secondary"
            >
              <FaDeleteLeft />
            </Button>{' '}
            <Button onClick={() => handleAddField('emails')} color="primary">
              <MdAddCircle />
            </Button>
          </div>
        ))}

        <FormControl fullWidth margin="normal" required>
          <InputLabel id="status-label">Статус</InputLabel>
          <Select
            labelId="status-label"
            name="status_companies"
            value={company.status_companies}
            onChange={handleChange}
          >
            <MenuItem value="Покупатели в работе">Покупатели в работе</MenuItem>
            <MenuItem value="Уснувшие">Уснувшие</MenuItem>
            <MenuItem value="Отвал">Отвал</MenuItem>
            <MenuItem value="Холдинг">Холдинг</MenuItem>
            <MenuItem value="Потенциальные">Потенциальные</MenuItem>
          </Select>
        </FormControl>

        {company.relatedActivities.map((activity, index) => (
          <div key={index} className="company-form-input-field">
            <FormControl fullWidth margin="normal">
              <InputLabel id={`related-activity-select-label-${index}`}>
                Сопутствующая деятельность №{index + 1}
              </InputLabel>
              <Select
                labelId={`related-activity-select-label-${index}`}
                value={activity}
                onChange={(e) => handleArrayChange('relatedActivities', index, e.target.value)}
                displayEmpty
              >
                {relatedActivities.map((relatedActivity, idx) => (
                  <MenuItem key={idx} value={relatedActivity}>
                    {relatedActivity}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              disabled={company.relatedActivities.length <= 1}
              onClick={() => handleRemoveField('relatedActivities', index)}
              color="secondary"
            >
              <FaDeleteLeft />
            </Button>
            <Button onClick={() => handleAddField('relatedActivities')} color="primary">
              <MdAddCircle />
            </Button>
          </div>
        ))}

        {company.contracts.map((contract, index) => (
          <div key={index} className="company-form-input-field">
            <FormControl fullWidth margin="normal" required>
              <InputLabel id={`contract-select-label-${index}`}>Договор №{index + 1}</InputLabel>
              <Select
                labelId={`contract-select-label-${index}`}
                value={contract}
                onChange={(e) => handleArrayChange('contracts', index, e.target.value)}
              >
                <MenuItem value="">
                  <em>Выберите договор</em>
                </MenuItem>
                {contractsList.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              disabled={company.contracts.length <= 1}
              onClick={() => handleRemoveField('contracts', index)}
              color="secondary"
            >
              <FaDeleteLeft />
            </Button>
            <Button onClick={() => handleAddField('contracts')} color="primary">
              <MdAddCircle />
            </Button>
          </div>
        ))}

        {company.socialNetworks.map((network, index) => (
          <div key={index} className="company-form-input-field">
            <FormControl fullWidth margin="normal" style={{ marginRight: '15px' }} required>
              <InputLabel id={`social-network-select-label-${index}`}>
                Соц. сеть №{index + 1}
              </InputLabel>
              <Select
                labelId={`social-network-select-label-${index}`}
                value={network.network_name || ''} // Убедитесь, что значение по умолчанию - пустая строка
                onChange={(e) =>
                  handleNestedArrayChange('socialNetworks', index, 'network_name', e.target.value)
                }
                displayEmpty
              >
                {socialNetworksOptions.map((option, idx) => (
                  <MenuItem key={idx} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Комментарий к соц. сети"
              value={network.comment}
              onChange={(e) =>
                handleNestedArrayChange('socialNetworks', index, 'comment', e.target.value)
              }
              fullWidth
              margin="normal"
            />
            <Button
              disabled={company.socialNetworks.length <= 1}
              onClick={() => handleRemoveField('socialNetworks', index)}
              color="secondary"
            >
              <FaDeleteLeft />
            </Button>{' '}
            <Button
              onClick={() =>
                handleAddNestedField('socialNetworks', {
                  network_name: '',
                  comment: '',
                })
              }
              color="primary"
            >
              <MdAddCircle />
            </Button>
          </div>
        ))}

        {company.deliveryTerms.map((term, index) => (
          <div key={index} className="company-form-input-field">
            <TextField
              style={{ marginRight: '15PX' }}
              label="Условия доставки"
              value={term.term_name}
              onChange={(e) =>
                handleNestedArrayChange('deliveryTerms', index, 'term_name', e.target.value)
              }
              fullWidth
              margin="normal"
              required
            />
            <TextField
              label="Комментарий к условию доставки"
              value={term.term_comment}
              onChange={(e) =>
                handleNestedArrayChange('deliveryTerms', index, 'term_comment', e.target.value)
              }
              fullWidth
              margin="normal"
            />
            <Button
              disabled={company.deliveryTerms.length <= 1}
              onClick={() => handleRemoveField('deliveryTerms', index)}
              color="secondary"
            >
              <FaDeleteLeft />
            </Button>{' '}
            <Button
              onClick={() =>
                handleAddNestedField('deliveryTerms', {
                  term_name: '',
                  term_comment: '',
                })
              }
              color="primary"
            >
              <MdAddCircle />
            </Button>
          </div>
        ))}

        {company.notificationMethods.map((method, index) => (
          <div key={index} className="company-form-input-field">
            <FormControl fullWidth margin="normal" required>
              <InputLabel id={`notification-method-select-label-${index}`}>
                Способ оповещения №{index + 1}
              </InputLabel>
              <Select
                labelId={`notification-method-select-label-${index}`}
                value={method || ''}
                onChange={(e) => handleArrayChange('notificationMethods', index, e.target.value)}
                displayEmpty
              >
                {notificationMethodsOptions.map((option, idx) => (
                  <MenuItem key={idx} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              disabled={company.notificationMethods.length <= 1}
              onClick={() => handleRemoveField('notificationMethods', index)}
              color="secondary"
            >
              <FaDeleteLeft />
            </Button>
            <Button onClick={() => handleAddField('notificationMethods')} color="primary">
              <MdAddCircle />
            </Button>
          </div>
        ))}

        {company.importantDates.map((date, index) => {
          const isBothRequired =
            !!(date.date_name || date.event_date) && !(date.date_name && date.event_date)
          return (
            <div key={index} className="company-form-input-field">
              <TextField
                style={{ marginRight: '15px' }}
                label="Наименование значимой даты"
                value={date.date_name}
                onChange={(e) =>
                  handleNestedArrayChange('importantDates', index, 'date_name', e.target.value)
                }
                fullWidth
                margin="normal"
                error={isBothRequired} // Показываем ошибку, если одно из полей заполнено
                helperText={isBothRequired ? 'Заполните оба поля.' : ''} // Сообщение об ошибке
              />
              <TextField
                label="Дата"
                type="date"
                value={date.event_date}
                onChange={(e) =>
                  handleNestedArrayChange('importantDates', index, 'event_date', e.target.value)
                }
                fullWidth
                margin="normal"
                InputLabelProps={{ shrink: true }}
                error={isBothRequired}
                helperText={isBothRequired ? 'Заполните оба поля.' : ''}
              />
              <Button
                disabled={company.importantDates.length <= 1}
                onClick={() => handleRemoveField('importantDates', index)}
                color="secondary"
              >
                <FaDeleteLeft />
              </Button>{' '}
              <Button
                onClick={() =>
                  handleAddNestedField('importantDates', {
                    date_name: '',
                    event_date: '',
                  })
                }
                color="primary"
              >
                <MdAddCircle />
              </Button>
            </div>
          )
        })}

        <div className="company-form-input-field">
          <FormControlLabel
            control={
              <Checkbox
                checked={company.floorRising.is_paid}
                onChange={(e) =>
                  setCompany({
                    ...company,
                    floorRising: {
                      ...company.floorRising,
                      is_paid: e.target.checked,
                    },
                  })
                }
                name="is_paid"
                color="primary"
              />
            }
            label={`Подъем на этаж (${company.floorRising.is_paid ? 'Да' : 'Нет'})`}
          />
          <TextField
            label="Комментарий по подъему на этаж"
            value={company.floorRising.comment}
            onChange={(e) =>
              setCompany({
                ...company,
                floorRising: {
                  ...company.floorRising,
                  comment: e.target.value,
                },
              })
            }
            fullWidth
            margin="normal"
          />
        </div>

        {company.addresses.map((address, index) => {
          const isAnyFilled = !!(
            address.region ||
            address.city ||
            address.street ||
            address.building
          )
          const isAllRequired =
            isAnyFilled && !(address.region && address.city && address.street && address.building)

          return (
            <div key={index} className="company-form-input-field">
              <TextField
                style={{ marginRight: '15px' }}
                label={`Регион ${index + 1}`}
                value={address.region}
                onChange={(e) =>
                  handleNestedArrayChange('addresses', index, 'region', e.target.value)
                }
                fullWidth
                margin="normal"
                error={isAllRequired} // Показываем ошибку, если одно из полей заполнено
                helperText={isAllRequired ? 'Заполните все поля.' : ''} // Сообщение об ошибке
              />
              <TextField
                style={{ marginRight: '15px' }}
                label="Город"
                value={address.city}
                onChange={(e) =>
                  handleNestedArrayChange('addresses', index, 'city', e.target.value)
                }
                fullWidth
                margin="normal"
                error={isAllRequired} // Показываем ошибку, если одно из полей заполнено
                helperText={isAllRequired ? 'Заполните все поля.' : ''} // Сообщение об ошибке
              />
              <TextField
                style={{ marginRight: '15px' }}
                label="Улица"
                value={address.street}
                onChange={(e) =>
                  handleNestedArrayChange('addresses', index, 'street', e.target.value)
                }
                fullWidth
                margin="normal"
                error={isAllRequired} // Показываем ошибку, если одно из полей заполнено
                helperText={isAllRequired ? 'Заполните все поля.' : ''} // Сообщение об ошибке
              />
              <TextField
                style={{ marginRight: '15px' }}
                label="Строение"
                value={address.building}
                onChange={(e) =>
                  handleNestedArrayChange('addresses', index, 'building', e.target.value)
                }
                fullWidth
                margin="normal"
                error={isAllRequired} // Показываем ошибку, если одно из полей заполнено
                helperText={isAllRequired ? 'Заполните все поля.' : ''} // Сообщение об ошибке
              />
              <TextField
                style={{ marginRight: '15px' }}
                label="Комментарий к адресу"
                value={address.comment}
                onChange={(e) =>
                  handleNestedArrayChange('addresses', index, 'comment', e.target.value)
                }
                fullWidth
                margin="normal"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={address.is_primary}
                    onChange={(e) =>
                      handleNestedArrayChange('addresses', index, 'is_primary', e.target.checked)
                    }
                    name="is_primary"
                    color="primary"
                  />
                }
                label="Основной"
              />
              <Button
                disabled={company.addresses.length <= 1}
                onClick={() => handleRemoveField('addresses', index)}
                color="secondary"
              >
                <FaDeleteLeft />
              </Button>{' '}
              <Button
                onClick={() =>
                  handleAddNestedField('addresses', {
                    region: '',
                    city: '',
                    street: '',
                    building: '',
                    is_primary: false,
                    comment: '',
                  })
                }
                color="primary"
              >
                <MdAddCircle />
              </Button>
            </div>
          )
        })}

        {company.competitors.map((competitor, index) => (
          <div key={index} className="company-form-input-field">
            <FormControl style={{ marginRight: '15PX' }} fullWidth margin="normal">
              <InputLabel id={`competitor-select-label-${index}`}>
                Конкурент №{index + 1}
              </InputLabel>
              <Select
                labelId={`competitor-select-label-${index}`}
                value={competitor.competitor_id || ''}
                onChange={(e) =>
                  handleNestedArrayChange('competitors', index, 'competitor_id', e.target.value)
                }
                label={`Конкурент №${index + 1}`}
              >
                {competitorsList.map((comp) => (
                  <MenuItem key={comp.id} value={comp.id}>
                    {comp.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  checked={competitor.has_representation}
                  onChange={(e) =>
                    handleNestedArrayChange(
                      'competitors',
                      index,
                      'has_representation',
                      e.target.checked
                    )
                  }
                  name="has_representation"
                  color="primary"
                />
              }
              label="Наличие представительства"
            />
            <Button
              disabled={company.competitors.length <= 1}
              onClick={() => handleRemoveField('competitors', index)}
              color="secondary"
            >
              <FaDeleteLeft />
            </Button>{' '}
            <Button
              onClick={() =>
                handleAddNestedField('competitors', {
                  competitor_id: '',
                  has_representation: false,
                })
              }
              color="primary"
            >
              <MdAddCircle />
            </Button>
          </div>
        ))}

        <Button variant="contained" color="primary" type="submit" fullWidth>
          Создать компанию
        </Button>
      </form>
    </Container>
  )
}

export default CompanyForm
