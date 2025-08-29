import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import LoginRegister from '../../components/auth/LoginRegister'
import TopNavBar from '../../components/topnavbar/TopNavBar'
import NavBar from '../../components/navbar/NavBar'
import Footer from '../../components/footer/Footer'
import useUserStore from '../../store/userStore'
import useThemeStore from '../../store/themeStore'
import useMenuOpen from '../../store/menuStore'

import springImage from '/background/springs.jpg'
import summerImage from '/background/summer.jpg'
import autumnImage from '/background/autumn.jpg'
import winterImage from '/background/winter.jpg'

import './layout.scss'

function Layout({ isConnectBD }) {
  const { menu } = useMenuOpen()
  const { theme } = useThemeStore() // Получаем текущую тему
  const { user } = useUserStore() // НЕ УДАЛЯТЬ!
  const token = localStorage.getItem('token')
  const [backgroundImage, setBackgroundImage] = useState('')

  const getSeasonalBackground = () => {
    const currentMonth = new Date().getMonth()

    if (currentMonth >= 2 && currentMonth <= 4) {
      return springImage // Фон для весны springs
    } else if (currentMonth >= 5 && currentMonth <= 7) {
      return summerImage // Фон для лета summer
    } else if (currentMonth >= 8 && currentMonth <= 10) {
      return autumnImage // Фон для осени autumn
    } else {
      return winterImage // для зимы winter
    }
  }
  useEffect(() => {
    setBackgroundImage(getSeasonalBackground())
  }, [])
  //

  //<Outlet />   <AccountActivation /> <Table/>
  return !token ? (
    <LoginRegister isConnectBD={isConnectBD} />
  ) : (
    <div className={`layout ${theme}`}>
      <div className="navbar-top">
        <TopNavBar isConnectBD={isConnectBD} />
      </div>
      <div className="main">
        <div
          className={`navbar ${menu ? 'close' : ''}`}
          style={{
            backgroundImage: `url(${backgroundImage})`, // Стили для смены фона от времени года
            backgroundSize: 'cover', // Настройка размеров фона
            backgroundPosition: 'center', // Центрирование фона
          }}
        >
          <NavBar />
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
      <div className="footer">
        <Footer />
      </div>
    </div>
  )
}

export default Layout
