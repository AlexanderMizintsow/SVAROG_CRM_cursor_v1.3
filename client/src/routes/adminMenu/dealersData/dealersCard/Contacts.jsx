import { useEffect, useState } from 'react'
import axios from 'axios'
import { FiMail } from 'react-icons/fi'
import { API_BASE_URL } from '../../../../../config'
import './contacts.scss'
const Contacts = ({ companyId }) => {
  const [dealers, setDealers] = useState([])

  useEffect(() => {
    const fetchDealersAndUsers = async () => {
      {
        /*try {
        const response = await axios.get(
          `${API_BASE_URL}5003/api/companies/${companyId}/dealers-users` 
        )
        setDealers(response.data)
      } catch (error) {
        console.error(
          'Ошибка при загрузке данных дилеров и пользователей:',
          error
        )
      }*/
      }
    }

    fetchDealersAndUsers()
  }, [companyId])

  return (
    <div className="card-section is-active" id="contact">
      <div className="card-content">
        <div className="card-subtitle">Общая информация</div>
        <div className="card-contact-wrapper">
          {dealers.length ? (
            dealers.map((dealer) => (
              <div key={dealer.dealer_id} className="card-dealer">
                <h3>
                  {dealer.dealer_last_name} {dealer.dealer_first_name}{' '}
                  {dealer.dealer_middle_name}
                </h3>
                {dealer.users.length ? (
                  dealer.users.map((user) => (
                    <div key={user.user_id} className="card-user">
                      <p>
                        <strong>
                          {user.first_name} {user.middle_name} {user.last_name}
                        </strong>
                        <br />
                        <FiMail /> {user.email}
                        <br />
                        Должность: {user.position_name}
                        <br />
                        Отдел: {user.department_name}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>Пользователи не найдены для этого дилера.</p>
                )}
              </div>
            ))
          ) : (
            <p>Информация о дилерах отсутствует.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Contacts
