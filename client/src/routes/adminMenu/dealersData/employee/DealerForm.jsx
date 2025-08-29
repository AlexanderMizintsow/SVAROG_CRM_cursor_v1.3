import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../../../../../config'
import {
  TextField,
  Button,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Checkbox,
  Paper,
  FormHelperText,
} from '@mui/material'
import { LiaRemoveFormatSolid } from 'react-icons/lia'
import axios from 'axios'
import { ToastContainer, toast } from 'react-toastify'
import { FaDeleteLeft } from 'react-icons/fa6'
import { MdAddCircle } from 'react-icons/md'
import 'react-toastify/dist/ReactToastify.css'

const DealerForm = () => {
  const [formData, setFormData] = useState({
    company_id: '',
    last_name: '',
    first_name: '',
    middle_name: '',
    birth_date: '',
    gender: '',
    hobbies: [''],
    position: '',
    phones: [{ phone_number: '', phone_type: '', is_primary: false }],
    emails: [{ email: '', is_primary: false }],
  })

  const [companies, setCompanies] = useState([])

  useEffect(() => {
    // Загрузить данные из localStorage при монтировании компонента
    const savedData = localStorage.getItem('dealerFormData')
    if (savedData) {
      setFormData(JSON.parse(savedData))
    }

    axios
      .get(`${API_BASE_URL}5003/api/companies/list`)
      .then((response) => setCompanies(response.data))
      .catch((error) =>
        console.error('Ошибка при загрузке списка компаний:', error)
      )
  }, [])

  // Сохранение формы в localStorage при изменении формы
  useEffect(() => {
    localStorage.setItem('dealerFormData', JSON.stringify(formData))
  }, [formData])

  const handleChange = (e) => {
    const { name, value } = e.target

    // Проверяем, если это поле даты
    if (name === 'birth_date') {
      setFormData({
        ...formData,
        [name]: value || '',
      })
    } else {
      setFormData({
        ...formData,
        [name]: value,
      })
    }
  }

  const handleArrayChange = (index, key, value, arrayName) => {
    const updatedArray = formData[arrayName].map((item, i) =>
      i === index ? { ...item, [key]: value } : item
    )
    setFormData({
      ...formData,
      [arrayName]: updatedArray,
    })
  }

  const handleHobbyChange = (index, value) => {
    const updatedHobbies = formData.hobbies.map((hobby, i) =>
      i === index ? value : hobby
    )
    setFormData({
      ...formData,
      hobbies: updatedHobbies,
    })
  }

  const addArrayField = (arrayName) => {
    let newElement
    if (arrayName === 'phones') {
      newElement = { phone_number: '', phone_type: '', is_primary: false }
    } else if (arrayName === 'emails') {
      newElement = { email: '', is_primary: false }
    } else {
      newElement = '' // для hobbies
    }
    setFormData({
      ...formData,
      [arrayName]: [...formData[arrayName], newElement],
    })
  }

  const removeArrayField = (index, arrayName) => {
    const updatedArray = formData[arrayName].filter((_, i) => i !== index)
    setFormData({
      ...formData,
      [arrayName]: updatedArray,
    })
  }

  const resetForm = () => {
    setFormData({
      company_id: '',
      last_name: '',
      first_name: '',
      middle_name: '',
      birth_date: '',
      gender: '',
      hobbies: [''],
      position: '',
      phones: [{ phone_number: '', phone_type: '', is_primary: false }],
      emails: [{ email: '', is_primary: false }],
    })
  }

  const formRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Преобразуем birth_date в нужный формат
    const formattedFormData = {
      ...formData,
      birth_date: formData.birth_date
        ? new Date(formData.birth_date).toISOString().split('T')[0]
        : null,
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}5003/api/dealers`,
        formattedFormData
      )
      toast.success('Новый представитель успешно добавлен')
      // resetForm()
      formRef.current.scrollIntoView({ behavior: 'smooth' })
    } catch (error) {
      console.error('Ошибка при создании дилера:', error)
      toast.error(
        `Ошибка при добавлении нового представителя: ${error.message}`
      )
    }
  }

  const removeDigits = (e) => {
    e.target.value = e.target.value.replace(/[0-9]/g, '')
  }

  const removeLetters = (e) => {
    e.target.value = e.target.value.replace(/[a-zA-Zа-яА-ЯёЁ]/g, '')
  }

  return (
    <Paper
      className="custom-paper container"
      style={{
        marginTop: '10px',
        maxWidth: '100%',
        maxHeight: '90%',
        overflowY: 'auto',
      }}
    >
      <label>
        <span onClick={resetForm} className="remove-form">
          <LiaRemoveFormatSolid /> oчистить поля
        </span>
      </label>

      <ToastContainer />

      <form
        style={{ marginTop: '30px', padding: '10px' }}
        onSubmit={handleSubmit}
      >
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel>ИП, организация (дилер)</InputLabel>
              <Select
                name="company_id"
                value={formData.company_id}
                onChange={handleChange}
                label="ID Компании"
              >
                {companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>
                    {company.name_companies}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              name="last_name"
              label="Фамилия"
              fullWidth
              value={formData.last_name}
              onChange={handleChange}
              onInput={removeDigits}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              name="first_name"
              label="Имя"
              fullWidth
              value={formData.first_name}
              onChange={handleChange}
              onInput={removeDigits}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              name="middle_name"
              label="Отчество"
              fullWidth
              required
              value={formData.middle_name}
              onChange={handleChange}
              onInput={removeDigits}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              name="birth_date"
              label="Дата Рождения"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={formData.birth_date}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Пол</InputLabel>
              <Select
                name="gender"
                required
                value={formData.gender}
                onChange={handleChange}
              >
                <MenuItem value="male">Мужской</MenuItem>
                <MenuItem value="female">Женский</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              name="position"
              label="Должность"
              fullWidth
              value={formData.position}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            {formData.hobbies.map((hobby, index) => (
              <Grid container spacing={2} key={index}>
                <Grid item xs={10}>
                  <TextField
                    label={`Хобби ${index + 1}`}
                    value={hobby}
                    onChange={(e) => handleHobbyChange(index, e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={2}>
                  <Button
                    color="secondary"
                    onClick={() => removeArrayField(index, 'hobbies')}
                    disabled={formData.hobbies.length <= 1}
                  >
                    <FaDeleteLeft />
                  </Button>
                  <Button onClick={() => addArrayField('hobbies')}>
                    <MdAddCircle />
                  </Button>
                </Grid>
              </Grid>
            ))}
          </Grid>
          <Grid item xs={12}>
            {formData.phones.map((phone, index) => {
              const isBothRequired =
                !!(phone.phone_number || phone.phone_type) &&
                !(phone.phone_number && phone.phone_type)

              return (
                <Grid container spacing={2} key={index}>
                  <Grid item xs={4}>
                    <TextField
                      label="Номер Телефона"
                      value={phone.phone_number}
                      onChange={(e) => {
                        let value = e.target.value

                        // Разрешаем только цифры и один знак + в начале
                        if (value.length > 0 && value[0] === '+') {
                          value = '+' + value.slice(1).replace(/[^0-9]/g, '') // Разрешаем только цифры после +
                        } else {
                          value = value.replace(/[^0-9]/g, '') // Разрешаем только цифры
                        }

                        // Проверка на длину и первую цифру
                        if (value.length > 9) {
                          if (value[0] === '8') {
                            handleArrayChange(
                              index,
                              'phone_number',
                              '+7' + value.slice(1),
                              'phones'
                            )
                          } else if (!value.startsWith('+7')) {
                            handleArrayChange(
                              index,
                              'phone_number',
                              '+7' + value,
                              'phones'
                            )
                          } else {
                            handleArrayChange(
                              index,
                              'phone_number',
                              value,
                              'phones'
                            )
                          }
                        } else {
                          handleArrayChange(
                            index,
                            'phone_number',
                            value,
                            'phones'
                          )
                        }
                      }}
                      fullWidth
                      error={isBothRequired}
                      helperText={isBothRequired ? 'Заполните оба поля.' : ''}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <FormControl fullWidth error={isBothRequired}>
                      <InputLabel>Тип Телефона</InputLabel>
                      <Select
                        label="Тип Телефона"
                        value={phone.phone_type}
                        onChange={(e) =>
                          handleArrayChange(
                            index,
                            'phone_type',
                            e.target.value,
                            'phones'
                          )
                        }
                      >
                        <MenuItem value="рабочий">Рабочий</MenuItem>
                        <MenuItem value="домашний">Домашний</MenuItem>
                        <MenuItem value="личный">Личный</MenuItem>
                        <MenuItem value="временный">Временный</MenuItem>
                      </Select>
                      {isBothRequired && !phone.phone_type && (
                        <FormHelperText>Заполните оба поля.</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                  <Grid item xs={2}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={phone.is_primary}
                          onChange={(e) =>
                            handleArrayChange(
                              index,
                              'is_primary',
                              e.target.checked,
                              'phones'
                            )
                          }
                        />
                      }
                      label="Основной"
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <Button
                      color="secondary"
                      onClick={() => removeArrayField(index, 'phones')}
                      disabled={formData.phones.length <= 1}
                    >
                      <FaDeleteLeft />
                    </Button>
                    <Button onClick={() => addArrayField('phones')}>
                      <MdAddCircle />
                    </Button>
                  </Grid>
                </Grid>
              )
            })}
          </Grid>
          <Grid item xs={12}>
            {formData.emails.map((email, index) => (
              <Grid container spacing={2} key={index}>
                <Grid item xs={10}>
                  <TextField
                    label="Email"
                    value={email.email}
                    onChange={(e) =>
                      handleArrayChange(
                        index,
                        'email',
                        e.target.value,
                        'emails'
                      )
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={email.is_primary}
                        onChange={(e) =>
                          handleArrayChange(
                            index,
                            'is_primary',
                            e.target.checked,
                            'emails'
                          )
                        }
                      />
                    }
                    label="Основной"
                  />
                  <Button
                    color="secondary"
                    onClick={() => removeArrayField(index, 'emails')}
                    disabled={formData.emails.length <= 1}
                  >
                    <FaDeleteLeft />
                  </Button>
                  <Button>
                    <MdAddCircle onClick={() => addArrayField('emails')} />
                  </Button>
                </Grid>
              </Grid>
            ))}
          </Grid>
          <Grid item xs={12}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Создать персону дилера
            </Button>
          </Grid>
        </Grid>
      </form>
    </Paper>
  )
}

export default DealerForm
