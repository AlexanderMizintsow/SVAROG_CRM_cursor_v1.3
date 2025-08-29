import { useEffect, useState } from 'react'
import axios from 'axios'
import './WeatherForecast.scss'

const WeatherForecast = () => {
  const [weatherData, setWeatherData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Координаты для Саратова
  const latitude = 51.5335
  const longitude = 46.0343

  const fetchWeatherData = async () => {
    try {
      const response = await axios.get(
        'https://api.open-meteo.com/v1/forecast',
        {
          params: {
            latitude,
            longitude,
            current: 'weathercode,temperature_2m,wind_speed_10m',
            daily:
              'weathercode,temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,relative_humidity_2m_min,wind_speed_10m_max',
            timezone: 'Europe/Moscow',
          },
        }
      )

      setWeatherData(response.data)
    } catch (error) {
      console.error('Ошибка при получении данных о погоде:', error)
      setError('Не удалось загрузить данные о погоде')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeatherData()
  }, [])

  if (loading) {
    return <div className="loading">Загрузка...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  if (!weatherData) {
    return <div className="error">Нет данных о погоде.</div>
  }

  // Определяем символы для погодных условий
  const weatherIcons = {
    0: '☀️', // Ясно
    1: '🌤️', // Малые облака
    2: '🌥️', // Облачно
    3: '🌦️', // Легкий дождь
    4: '🌧️', // Дождь
    5: '❄️', // Снег
    6: '🌩️', // Гроза
  }

  // Компонент для отображения компактной информации
  return (
    <div className="weather-card">
      <div className="current-weather">
        <h4 className="weather-title">Погода в Саратове</h4>
        <h4 className="weather-title">Сейчас</h4>
        <p>
          {weatherIcons[weatherData.current.weathercode]}{' '}
          {weatherData.current.temperature_2m}°C, Ветер:{' '}
          {weatherData.current.wind_speed_10m} м/с
        </p>
      </div>
      <div className="daily-forecast">
        <h4 className="weather-title">Прогноз</h4>
        <div className="forecast-items">
          {weatherData.daily.time.slice(2, 4).map((date, index) => (
            <div key={index} className="daily-item">
              <p>
                {new Date(date).toLocaleDateString()}:{' '}
                {weatherIcons[weatherData.daily.weathercode[index]]}{' '}
                {weatherData.daily.temperature_2m_max[index]}°/
                {weatherData.daily.temperature_2m_min[index]}°
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default WeatherForecast
