import { useState, useRef, useEffect } from 'react'
import { AiOutlineBarcode } from 'react-icons/ai'
import { FaTelegramPlane } from 'react-icons/fa'
import { ImExit } from 'react-icons/im'
import axios from 'axios'
import bwipjs from 'bwip-js'
import useUserStore from '../../store/userStore'
import ConfirmationDialog from '../confirmationDialog/ConfirmationDialog'
import { API_BASE_URL } from '../../../config'
import MyBtn from '../btn/Btn'
import { CiCalculator2 } from 'react-icons/ci'
import './usermodal.scss'
import CurrencyRate from '../widgets/currencyRate/CurrencyRate'
import WeatherForecast from '../widgets/weatherForecast/WeatherForecast'
import Calculator from '../widgets/calculator/Calculator'

const UserModal = ({ user, closeModal, exit }) => {
  const filePicker = useRef(null)
  const { avatar, setAvatar } = useUserStore()
  const [barcodeValue, setBarcodeValue] = useState('')
  const [isBarcodeFormVisible, setIsBarcodeFormVisible] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isModalOpenCalc, setIsModalOpenCalc] = useState(false)

  useEffect(() => {
    if (user) {
      setIsVisible(true)
    }
    return () => {
      setIsVisible(false)
    }
  }, [user])

  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/users/${user.id}/avatar`)
        setAvatar(response.data.image)
      } catch (error) {
        console.error('Ошибка при получении аватара:', error)
      }
    }

    fetchAvatar()
  }, [user.id, setAvatar])

  const handleFileSelectAndUpload = async (event) => {
    const file = event.target.files[0]

    if (!file) {
      console.error('Файл не выбран')
      return
    }

    const formData = new FormData()
    formData.append('avatar', file)

    try {
      const response = await axios.post(
        `${API_BASE_URL}5000/api/users/${user.id}/avatar`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      if (response.status === 200) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setAvatar(reader.result)
        }
        reader.readAsDataURL(file)
      }
    } catch (error) {
      console.error('Ошибка при загрузке аватара:', error)
    }
  }

  const handleGenerateAndDownloadBarcode = () => {
    const canvas = document.createElement('canvas')

    bwipjs.toCanvas(canvas, {
      bcid: 'code128',
      text: barcodeValue,
      scale: 7,
      height: 10,
      includetext: true,
      textxalign: 'center',
      backgroundcolor: '#ffffff',
      color: '#000000',
      padding: 10,
    })

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'barcode.png'
      link.click()
      URL.revokeObjectURL(url)
    })
  }

  const toggleBarcodeForm = () => {
    setIsBarcodeFormVisible(!isBarcodeFormVisible)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
  }

  const handleExitClick = () => {
    setDialogOpen(true)
  }

  const confirmExit = () => {
    setDialogOpen(false)
    exit()
  }

  const handleOpenModal = () => {
    setIsModalOpenCalc(true)
  }

  const handleCloseModal = () => {
    setIsModalOpenCalc(false)
  }

  return (
    <div className={`modal-backdrop ${isVisible ? 'visible' : ''}`} onClick={closeModal}>
      <div
        className={`modal ${isVisible ? 'is-visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={closeModal}>
          ×
        </button>
        <div className="content">
          <div className="top">
            <div className="info">
              <img src={avatar} alt="Аватар" onClick={() => filePicker.current.click()} />
              <input
                type="file"
                ref={filePicker}
                onChange={handleFileSelectAndUpload}
                style={{ display: 'none' }}
                accept="image/*"
              />
              <div className="info-text">
                <p>
                  {user?.first_name || 'нет_имени'} {user?.last_name || 'нет_фамилии'}
                </p>
                <p>{user?.role_name || 'нет_роли'}</p>
              </div>
              <div className="exit">
                {/* <ImExit onClick={handleExitClick} title="Выход из приложения" />*/}
              </div>
            </div>
          </div>
          <CurrencyRate />
          <WeatherForecast />

          <div className="center">
            <div>
              <CiCalculator2
                className="barcode center-icon"
                onClick={handleOpenModal}
                title="Калькулятор скидок и конверсий веса"
              />
              <Calculator isOpen={isModalOpenCalc} onClose={handleCloseModal} />
            </div>
            <div>
              <AiOutlineBarcode
                className="barcode center-icon"
                onClick={toggleBarcodeForm}
                title="Штрихкод"
              />
              {isBarcodeFormVisible && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <input
                    type="text"
                    value={barcodeValue}
                    onChange={(e) => setBarcodeValue(e.target.value)}
                    placeholder="Введите значение"
                    style={{
                      marginBottom: '10px',
                      padding: '7px',
                      fontSize: '16px',
                    }}
                  />
                  <MyBtn
                    text={'Сгенерировать и скачать штрихкод'}
                    onClick={handleGenerateAndDownloadBarcode}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onConfirm={confirmExit}
        title="Выход из приложения"
        message={`Вы уверены, что хотите выйти, ${user?.first_name}?`}
        btn1="Отмена"
        btn2="Выйти"
      />
    </div>
  )
}

export default UserModal
