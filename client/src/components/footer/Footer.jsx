import { API_BASE_URL } from '../../../config'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'
import useUserStore from '../../store/userStore'
import useVersionInfo from '../../store/useVersionInfo'
import RatingModal from './ratingModal/RatingModal'
import { FaStar } from 'react-icons/fa'
import { BsJournalCode } from 'react-icons/bs'
import dextopSvarog from '../../assets/img/dextop.ico'
import './footer.scss'
import ConfirmationDialog from '../confirmationDialog/ConfirmationDialog'

const Footer = () => {
  const { user } = useUserStore()
  const [isModalOpen, setModalOpen] = useState(false)
  const [versionShow, setversionShow] = useState(false)
  const { versions } = useVersionInfo()
  const currentYear = new Date().getFullYear() // Получаем текущий год
  const [isDialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (user) {
      axios
        .get(`${API_BASE_URL}5000/api/introduction/version/${user.id}`)
        .then((response) => {
          const data = response.data
          if (data) {
            setversionShow(data.is_approved)
          }
        })
        .catch((error) => {
          console.error(
            'Ошибка при получении отзыва:',
            error.response ? error.response.data : error.message
          )
        })
    }
  }, [user, versions])

  const handleApprovedVersion = async (id) => {
    try {
      await axios.post(`${API_BASE_URL}5000/api/introduction/version`, {
        user_id: id,
      })
      setversionShow(true)
    } catch (error) {
      console.error('Ошибка при добавлении или обновлении записи:', error)
    }
  }

  const handleDownload = () => {
    // Здесь вы можете указать путь к вашему файлу
    const link = document.createElement('a')
    link.href = '/download/Dextop SVAROG Setup 1.0.0.exe'
    link.download = 'Dextop SVAROG Setup 1.0.0.exe'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setDialogOpen(false) // Закрываем диалог после загрузки
  }

  return (
    <footer className="footermenu">
      <div className="feedback">
        {/*<span title="Сообщить об ошибке">  
          <FaBug />
        </span>*/}

        <img
          src={dextopSvarog}
          onClick={() => setDialogOpen(true)}
          alt="dextopSvarog"
          title="Скачать декстопное приложение"
          style={{ width: '40px', height: '40px', cursor: 'pointer' }}
        />

        <span title="Поставить оценку" onClick={() => setModalOpen(true)}>
          <FaStar />
        </span>
        <span className="pulsing-container">
          <Link
            to="/changelog"
            title="Журнал изменений"
            className="icon-link"
            onClick={() => handleApprovedVersion(user.id)}
          >
            <BsJournalCode />
          </Link>
          {!versionShow && <p className="pulsing-text">Новая версия!</p>}
        </span>
      </div>
      <div className="owner-info">
        {/* © {currentYear}.{' '}
        Приложение находится на стадии активной разработки и
        может содержать ошибки, которые будут исправлены в будущих обновлениях.
        Разработчик: Александр Мизинцов*/}
      </div>
      {isModalOpen && <RatingModal onClose={() => setModalOpen(false)} />}
      {isModalOpen && <RatingModal onClose={() => setModalOpen(false)} />}
      <ConfirmationDialog
        open={isDialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleDownload}
        title="Подтверждение установки"
        message="Хотите скачать декстопную версию приложения?"
        btn1="Нет"
        btn2="Да"
      />
    </footer>
  )
}

export default Footer
