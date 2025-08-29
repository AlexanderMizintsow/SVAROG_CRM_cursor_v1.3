import { useState, useEffect } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import { TbUserPlus, TbUserMinus } from 'react-icons/tb'
import { API_BASE_URL } from '../../../../config'
import './accountActivation.scss'

function EmployeeForm({ setRefreshData, refreshData }) {
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    birth_date: '',
    username: '',
    password: '',
    email: '',
    role_id: '',
    supervisor_id: '',
    departments: [
      {
        department_id: '',
        position_id: '',
        start_date: '',
        is_current: false,
      },
    ],
    phone_numbers: [
      {
        phone_number: '',
        phone_type: '', // Например, "мобильный" или "рабочий"
      },
    ],
  })

  const [roles, setRoles] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const rolesResponse = await axios.get(`${API_BASE_URL}5000/api/roles`)
        setRoles(rolesResponse.data)

        const departmentsResponse = await axios.get(
          `${API_BASE_URL}5000/api/departments`
        )
        setDepartments(departmentsResponse.data)

        const positionsResponse = await axios.get(
          `${API_BASE_URL}5000/api/positions`
        )
        setPositions(positionsResponse.data)

        const supervisorsResponse = await axios.get(
          `${API_BASE_URL}5000/api/users?role_id=2`
        )
        setSupervisors(supervisorsResponse.data)
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error)
      }
    }

    fetchData()
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    if (name.startsWith('department_')) {
      const parts = name.split('_')
      const index = parseInt(parts[1], 10)
      const field = parts.slice(2).join('_')
      const updatedDepartments = [...formData.departments]
      updatedDepartments[index][field] = type === 'checkbox' ? checked : value
      setFormData({ ...formData, departments: updatedDepartments })
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value,
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const response = await axios.post(
        `${API_BASE_URL}5000/api/users/new`,
        formData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      Toastify({
        text: 'Новый пользователь был успешно добавлен!',
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()
      setRefreshData(!refreshData)
    } catch (error) {
      console.error('Ошибка при добавлении пользователя:', error)

      Toastify({
        text:
          error.response?.data?.message ||
          'Произошла ошибка при добавлении пользователя',
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        },
      }).showToast()
    }
  }

  const toggleForm = () => {
    setExpanded(!expanded)
  }

  const handlePhoneChange = (index, e) => {
    const { name, value } = e.target
    const updatedPhones = [...formData.phone_numbers]
    updatedPhones[index][name] = value
    setFormData({ ...formData, phone_numbers: updatedPhones })
  }

  const addPhoneField = () => {
    setFormData({
      ...formData,
      phone_numbers: [
        ...formData.phone_numbers,
        { phone_number: '', phone_type: '' },
      ],
    })
  }

  const removePhoneField = (index) => {
    setFormData({
      ...formData,
      phone_numbers: formData.phone_numbers.filter((_, i) => i !== index),
    })
  }

  return (
    <>
      <div className="form-header" onClick={toggleForm}>
        <span style={{ cursor: 'pointer', fontSize: '24px' }}>
          {expanded ? <TbUserMinus /> : <TbUserPlus />}
        </span>
      </div>
      {expanded && (
        <form className="form-user" onSubmit={handleSubmit}>
          <h4>Форма добавления сотрудника</h4>
          <label>
            Имя:
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Отчество:
            <input
              type="text"
              name="middle_name"
              value={formData.middle_name}
              onChange={handleChange}
            />
          </label>
          <label>
            Фамилия:
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Дата рождения:
            <input
              type="date"
              name="birth_date"
              value={formData.birth_date}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Логин:
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Пароль:
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Электронная почта:
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Роль:
            <select
              name="role_id"
              value={formData.role_id}
              onChange={handleChange}
              required
            >
              <option value="">Выберите роль</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Руководитель:
            <select
              name="supervisor_id"
              value={formData.supervisor_id}
              onChange={handleChange}
            >
              <option value="">Выберите руководителя</option>
              {supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.first_name} {supervisor.last_name}
                </option>
              ))}
            </select>
          </label>
          <div className="department-section">
            {formData.departments.map((department, index) => (
              <div key={index}>
                {/*<label>
                  Отдел:
                  <select
                    name={`department_${index}_department_id`}
                    value={department.department_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Выберите отдел</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </label>*/}
                {/* <label>
                  Должность:
                  <select
                    name={`department_${index}_position_id`}
                    value={department.position_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Выберите должность</option>
                    {positions.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.name}
                      </option>
                    ))}
                  </select>
                </label>*/}
                {
                  <label>
                    Дата начала:
                    <input
                      type="date"
                      name={`department_${index}_start_date`}
                      value={department.start_date}
                      onChange={handleChange}
                      required
                    />
                  </label>
                }
                {/*  <label>
                  Текущий:
                  <input
                    type="checkbox"
                    name={`department_${index}_is_current`}
                    checked={department.is_current}
                    onChange={handleChange}
                  />
                </label>*/}
                <div className="phone-section">
                  {formData.phone_numbers.map((phone, index) => (
                    <div key={index}>
                      <label>
                        Номер телефона:
                        <input
                          type="text"
                          name="phone_number"
                          value={phone.phone_number}
                          onChange={(e) => handlePhoneChange(index, e)}
                          required
                        />
                      </label>
                      <label>
                        Тип телефона:
                        <select
                          name="phone_type"
                          value={phone.phone_type}
                          onChange={(e) => handlePhoneChange(index, e)}
                          required
                        >
                          <option value="">Выберите тип</option>
                          <option value="мобильный">Мобильный</option>
                          <option value="рабочий">Рабочий стационарный</option>
                          {/* <option value="стационарный">Стационарный</option>*/}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => removePhoneField(index)}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addPhoneField}>
                    Добавить номер телефона
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="submit">Отправить</button>
        </form>
      )}
    </>
  )
}

export default EmployeeForm
