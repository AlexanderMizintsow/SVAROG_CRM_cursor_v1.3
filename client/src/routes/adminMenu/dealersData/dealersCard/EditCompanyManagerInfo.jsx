import { useEffect, useState } from 'react'
import useCompanyStore from '../../../../store/useCompanyStore'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import { LuDelete } from 'react-icons/lu'

const EditCompanyManagerInfo = ({ companyId, companyData, onClose }) => {
  const [formData, setFormData] = useState({
    regional_manager_id: companyData.regional_manager_id || '',
    mpp_id: companyData.mpp_id || '',
    mpr_id: companyData.mpr_id || '',
    replacing_mpr: companyData.replacing_mpr_ids || [],
    replacing_mpp: companyData.replacing_mpp_ids || [],
    mpp_priorities:
      companyData.mpp_priorities.map((item) => item.priority_level) || [],
  })

  const [users, setUsers] = useState([])
  const updateManager = useCompanyStore((state) => state.updateManager)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/users`)
        setUsers(response.data)
      } catch (error) {
        console.error('Ошибка при загрузке пользователей:', error)
      }
    }
    fetchUsers()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }))
  }

  const handleAddMPR = () => {
    setFormData((prevData) => ({
      ...prevData,
      replacing_mpr: [...prevData.replacing_mpr, ''],
    }))
  }

  const handleReplaceMPRChange = (index, value) => {
    const newMPRs = [...formData.replacing_mpr]
    newMPRs[index] = value
    setFormData((prevData) => ({
      ...prevData,
      replacing_mpr: newMPRs,
    }))
  }

  const handleRemoveMPR = (index) => {
    if (formData.replacing_mpr.length > 1) {
      const newMPRs = formData.replacing_mpr.filter((_, i) => i !== index)
      setFormData((prevData) => ({
        ...prevData,
        replacing_mpr: newMPRs,
      }))
    }
  }

  const handleAddMPP = () => {
    setFormData((prevData) => ({
      ...prevData,
      replacing_mpp: [...prevData.replacing_mpp, ''],
      mpp_priorities: [...prevData.mpp_priorities, ''],
    }))
  }

  const handleReplaceMPPChange = (index, value) => {
    const newMPPs = [...formData.replacing_mpp]
    newMPPs[index] = value
    setFormData((prevData) => ({
      ...prevData,
      replacing_mpp: newMPPs,
    }))
  }

  const handleReplaceMPPPriorityChange = (index, value) => {
    const newPriorities = [...formData.mpp_priorities]
    newPriorities[index] = value
    setFormData((prevData) => ({
      ...prevData,
      mpp_priorities: newPriorities,
    }))
    console.log('Изменен приоритет на:', value)
  }

  const handleRemoveMPP = (index) => {
    if (formData.replacing_mpp.length > 1) {
      const newMPPs = formData.replacing_mpp.filter((_, i) => i !== index)
      const newPriorities = formData.mpp_priorities.filter(
        (_, i) => i !== index
      ) // Удаление соответствующего приоритета
      setFormData((prevData) => ({
        ...prevData,
        replacing_mpp: newMPPs,
        mpp_priorities: newPriorities,
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await updateManager(companyId, {
        regional_manager_id: formData.regional_manager_id,
        mpp_id: formData.mpp_id,
        mpr_id: formData.mpr_id,
        replacing_mpr: formData.replacing_mpr,
        replacing_mpp: formData.replacing_mpp,
        mpp_priorities: formData.mpp_priorities
          .map(Number)
          .filter((priority) => !isNaN(priority)),
      })
      console.log('Данные менеджера успешно обновлены')
      onClose()
    } catch (error) {
      console.error('Ошибка при обновлении данных менеджера:', error)
    }
  }

  return (
    <form
      style={{ margin: '17px' }}
      className="container editor-card-element"
      onSubmit={handleSubmit}
    >
      <div>
        <label>
          Региональный менеджер:{' '}
          <select
            name="regional_manager_id"
            value={formData.regional_manager_id}
            onChange={handleChange}
            required
          >
            <option value="">Выберите менеджера</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <label>
          МПП:{' '}
          <select
            name="mpp_id"
            value={formData.mpp_id}
            onChange={handleChange}
            required
          >
            <option value="">Выберите МПП</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <label>
          МПР:{' '}
          <select
            name="mpr_id"
            value={formData.mpr_id}
            onChange={handleChange}
            required
          >
            <option value="">Выберите МПР</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <h3>Замещающие МПР: </h3>
        {formData.replacing_mpr.map((mpr, index) => (
          <div key={index}>
            <select
              value={mpr}
              onChange={(e) => handleReplaceMPRChange(index, e.target.value)}
            >
              <option value="">Выберите МПР</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                </option>
              ))}
            </select>
            {formData.replacing_mpr.length > 1 && (
              <span onClick={() => handleRemoveMPR(index)}>
                <LuDelete
                  style={{ color: 'red', marginLeft: '15px' }}
                  className="icon-pointer"
                />
              </span>
            )}
          </div>
        ))}
        <button type="button" onClick={handleAddMPR}>
          Добавить МПР
        </button>
      </div>
      <div>
        <h3>Замещающие МПП:</h3>
        {formData.replacing_mpp.map((mpp, index) => {
          const priority = formData.mpp_priorities[index] || ''

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <select
                value={mpp}
                onChange={(e) => handleReplaceMPPChange(index, e.target.value)}
                style={{ width: '200px', marginRight: '10px' }} // Ширина селекта
              >
                <option value="">Выберите МПП</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>

              <select
                value={priority}
                onChange={(e) =>
                  handleReplaceMPPPriorityChange(index, e.target.value)
                }
                style={{ width: '80px', fontSize: '12px' }}
              >
                <option value="" disabled>
                  Приоритет не установлен
                </option>
                <option value="1">Высокий</option>
                <option value="2">Средний</option>
                <option value="3">Низкий</option>
              </select>
              {formData.replacing_mpp.length > 1 && (
                <span onClick={() => handleRemoveMPP(index)}>
                  <LuDelete
                    style={{
                      color: 'red',
                      marginLeft: '15px',
                      cursor: 'pointer',
                    }}
                    className="icon-pointer"
                  />
                </span>
              )}
            </div>
          )
        })}

        <button
          style={{ marginBottom: '25px', padding: '5px 15px' }}
          type="button"
          onClick={handleAddMPP}
        >
          Добавить МПП
        </button>
      </div>

      <button type="submit">Сохранить</button>
      <button style={{ marginLeft: '15px' }} type="button" onClick={onClose}>
        Закрыть
      </button>
    </form>
  )
}

export default EditCompanyManagerInfo
