import { useEffect, useState } from 'react'
import axios from 'axios'
import { CiLight } from 'react-icons/ci'
import { GiNightSky } from 'react-icons/gi'
import useThemeStore from '../../store/themeStore'
import useMenuOpen from '../../store/menuStore'
import useUserStore from '../../store/userStore'
import { ImExit } from 'react-icons/im'
import UserModal from '../Modal/UserModal'
import { API_BASE_URL } from '../../../config'
import { IoHomeOutline } from 'react-icons/io5'
import { TbSocial } from 'react-icons/tb'
import { IoNotificationsOutline } from 'react-icons/io5'
import '../../assets/fonts/lobsterRegular.scss'
import './topnavbar.scss'
import { List } from '@mui/material'
import ConfirmationDialog from '../confirmationDialog/ConfirmationDialog'

function TopNavBar({ isConnectBD }) {
  const { toggleTheme, theme } = useThemeStore()
  const { toggleMenu, menu } = useMenuOpen()
  const { clearUser, avatar, setAvatar, user } = useUserStore((state) => state)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false) // Состояние для диалога
  const roleAdministrator = user?.role_name === 'Администратор' ? true : false

  useEffect(() => {
    const fetchAvatar = async () => {
      // Проверка, что user существует и имеет id
      if (user && user?.id) {
        try {
          const response = await axios.get(
            `${API_BASE_URL}5000/api/users/${user.id}/avatar`
          )
          setAvatar(response.data.image)
        } catch (error) {
          console.error('Ошибка при получении аватара:', error)
        }
      }
    }

    fetchAvatar()
  }, [user])

  const toggleModal = () => {
    setIsModalOpen((prev) => !prev)
  }

  const handleDialogOpen = () => {
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
  }

  const handleLogout = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}5000/update-status`, {
        userId: user.id,
        status: 'offline',
      })

      // Проверяем, успешен ли ответ от сервера
      if (response.status === 200) {
        console.log('Статус пользователя обновлен на offline')
      } else {
        console.warn('Не удалось обновить статус пользователя')
      }
    } catch (error) {
      console.error('Ошибка при обновлении статуса:', error.message)
      // Здесь также можно добавить уведомление для пользователя
    } finally {
      // Очищаем локальное хранилище и выполняем другие действия
      clearUser()
      localStorage.removeItem('token')
      localStorage.removeItem('userData')
      handleDialogClose()
    }
  }

  return (
    <nav className="topnav">
      <div className="left">
        {!menu && (
          <List to="/" className="logo">
            <img src="/logo.png" alt="" className="topnavlogo" />
            <span style={{ fontFamily: 'Lobster' }}>SVAROG</span>
          </List>
        )}
        <div
          className={`menu-icon ${menu ? 'close' : ''}`}
          onClick={() => toggleMenu()}
        >
          <div className="bar1"></div>
          <div className="bar2"></div>
          <div className="bar3"></div>
        </div>

        {/*Соц-портал*/}
        {roleAdministrator && (
          <div className="topnav-social-portal icon">
            <IoHomeOutline className="topnav-social-portal-item" />
            <IoNotificationsOutline className="topnav-social-portal-item" />
            <TbSocial className="topnav-social-portal-item" />
          </div>
        )}
      </div>

      <div className="right">
        <div className="block icon">
          {isConnectBD !== 'Connected' ? (
            <p style={{ color: 'red', fontSize: '21px' }}>
              База данных не подключена
            </p>
          ) : null}
          <input
            type="checkbox"
            className="checkbox"
            checked={theme === 'dark'}
            onChange={toggleTheme}
          />
          {theme === 'light' ? (
            <CiLight className="sun" />
          ) : (
            <GiNightSky className="moon" />
          )}
        </div>
        <div className="block user">
          <img src={avatar} alt="" onClick={() => toggleModal()} />

          <div className="info">
            <p>
              {user?.first_name ? user?.first_name : 'нет_имени '}
              &nbsp;
              {user?.last_name ? user?.last_name : 'нет_фамилии'}
            </p>
            <p>{user?.role_name ? user?.role_name : 'нет_роли'}</p>
          </div>
        </div>
        <div className="block exit">
          <ImExit
            style={{ width: '40px', height: '40px' }}
            onClick={handleDialogOpen}
            title="Выход из приложения"
          />
        </div>
      </div>
      {isModalOpen && (
        <UserModal user={user} closeModal={toggleModal} exit={handleLogout} />
      )}

      {/* Использование компонента ConfirmationDialog */}
      <ConfirmationDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onConfirm={handleLogout}
        title="Выход из приложения"
        message={`Вы уверены, что хотите выйти, ${user?.first_name}?`}
        btn1="Отмена"
        btn2="Выйти"
      />
    </nav>
  )
}

export default TopNavBar
