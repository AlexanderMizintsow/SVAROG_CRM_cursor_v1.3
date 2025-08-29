import { useEffect, useState } from 'react'
import axios from 'axios'
import sberbankIcon from '../../../../src/assets/img/sb_gray.svg'
import './CurrencyRate.scss'
import Spinner from '../../LoadingAnimation/LoadingAnimation'

const CurrencyRate = () => {
  const [currencyRates, setCurrencyRates] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchCurrencyRates = async () => {
    try {
      // Получаем курсы валют с API ЦБ РФ
      const response = await axios.get(
        'https://www.cbr-xml-daily.ru/daily_json.js'
      )
      setCurrencyRates(response.data.Valute)
    } catch (error) {
      console.error('Ошибка при получении курсов валют:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCurrencyRates()
    const interval = setInterval(fetchCurrencyRates, 3600000) // Обновление каждые 60 минут

    return () => clearInterval(interval) // Очистка на размонтировании
  }, [])

  if (loading) {
    return (
      <div className="loading">
        <Spinner />
      </div>
    )
  }

  if (!currencyRates) {
    return <div className="error">Не удалось загрузить курсы валют</div>
  }

  const euroToRUB = currencyRates.EUR.Value // Курс евро
  const dollarToRUB = currencyRates.USD.Value // Курс доллара

  return (
    <div className="currency-card">
      <img
        src={sberbankIcon}
        alt="СБЕРБАНК"
        title="Курс по ЦБ РФ"
        className="sberbank-icon"
      />
      <div className="currency-rate">
        <span>1 $ / {dollarToRUB.toFixed(2)} ₽</span>
      </div>
      <div className="currency-rate">
        <span>1 € / {euroToRUB.toFixed(2)} ₽</span>
      </div>
    </div>
  )
}

export default CurrencyRate
