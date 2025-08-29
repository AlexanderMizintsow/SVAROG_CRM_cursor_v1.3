import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { TbMessageUp } from 'react-icons/tb'
import { TfiWrite } from 'react-icons/tfi'
import { RiMailSettingsLine } from 'react-icons/ri'
import ModalEmailToken from '../../components/modalEmailToken/ModalEmailToken'
import { API_BASE_URL } from '../../../config'
import './mail.scss'

const Mail = () => {
  const [close, setClose] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false) // Состояние для модального окна настроек
  const [conditionMet, setConditionMet] = useState(false)

  useEffect(() => {
    const userDataString = localStorage.getItem('userData')
    const userData = userDataString ? JSON.parse(userDataString) : null
    const userId = userData ? userData.id : null

    const checkEmailToken = async () => {
      if (!userId) {
        console.error('User ID not found in localStorage')
        setConditionMet(false)
        return
      }

      try {
        const response = await fetch(`${API_BASE_URL}5001/get-email-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        })

        const data = await response.json()
        setConditionMet(data.exists)
      } catch (error) {
        console.error('Error checking email token:', error)
        setConditionMet(false)
      }
    }

    checkEmailToken()
  }, [])

  const handleClose = () => setClose((prev) => !prev)
  const handleOpenSettingsModal = () => setIsSettingsModalOpen(true) // Открытие модального окна
  const handleCloseSettingsModal = () => setIsSettingsModalOpen(false) // Закрытие модального окна

  return (
    <div className="mail">
      <div className="header-mail">
        <div className="left">
          <Link target="_blank" to="https://e.mail.ru/inbox/" className="logo">
            <img src="/mail_ru.png" alt="" className="topnavlogo" />
            <span>Mail.ru</span>
          </Link>
        </div>
      </div>
      <div className="main-mail">
        {!close && (
          <div className={`navbar-mail`}>
            <div className="navbar-mail-top">
              <RiMailSettingsLine
                className="icon-pointer"
                onClick={handleOpenSettingsModal}
              />
              {/* Добавляем обработчик клика */}
              <p>
                <b>Почта</b>
              </p>
              <p className="buttonClose" onClick={handleClose}>
                X
              </p>
            </div>
            <div className="navbar-menu">
              <Link
                to="inbox"
                className={`navbar-link ${!conditionMet ? 'disabled' : ''}`}
              >
                Входящие <TbMessageUp />
              </Link>
              <Link></Link>
              <Link
                to="send"
                className={`navbar-link ${!conditionMet ? 'disabled' : ''}`}
              >
                Написать письмо <TfiWrite />
              </Link>
            </div>
          </div>
        )}
        {close && (
          <div className="buttonOpen" onClick={handleClose}>
            <p> Открыть панель</p>
          </div>
        )}
        <div className="content-mail">
          <Outlet />
        </div>
        {/* Отображение модального окна настроек */}
        <ModalEmailToken
          isOpen={isSettingsModalOpen}
          inputVisible={true}
          onClose={handleCloseSettingsModal}
        />
      </div>
    </div>
  )
}

export default Mail
