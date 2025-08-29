// useElapsedTime.js Вычисляет прошедшее с момента создания время для уведомлений и карточек задач
// createdAt от данного момента считает сколько прошло времени
import { useState, useEffect } from 'react'

const useElapsedTime = (createdAt) => {
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0 })

  useEffect(() => {
    const calculateElapsedTime = () => {
      const now = new Date()
      const diff = now - new Date(createdAt) // вычисляем разницу в мс
      const elapsedMinutes = Math.floor(diff / (1000 * 60)) // переводим в минуты
      const hours = Math.floor(elapsedMinutes / 60)
      const minutes = elapsedMinutes % 60
      setElapsedTime({ hours, minutes })
    }

    calculateElapsedTime()
    const interval = setInterval(calculateElapsedTime, 60000) // обновление каждые 60 сек.

    return () => clearInterval(interval) // очистка интервала при анмаунте компонента
  }, [createdAt])

  return elapsedTime
}

export const formatDate = (dateString) => {
  if (!dateString) return false
  const date = new Date(dateString)
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }

  const formattedDate = date.toLocaleString('ru-RU', options)
  return formattedDate.replace(',', '') // Убираем запятую между датой и временем
}

export default useElapsedTime
