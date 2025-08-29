import { useEffect, useRef } from 'react'
import { API_BASE_URL } from '../../config'
import axios from 'axios'
import useUserStore from '../store/userStore'
import throttle from 'lodash/throttle'

const ActivityTracker = () => {
  const userId = useUserStore((state) => state.user?.id)
  const inactivityTime = useRef(0)
  let previousStatus = 'not_active'

  // Функция для сброса счетчика
  const resetTimer = () => {
    inactivityTime.current = 0

    //console.log(userId)
    if (previousStatus === 'not_active' && userId) {
      axios
        .post(`${API_BASE_URL}5000/update-status`, {
          userId,
          status: 'online',
        })
        .then(() => {
          previousStatus = 'online'
        })
        .catch((error) => console.error('Ошибка обновления статуса:', error))
    }
  }

  // Функция для обновления статуса
  const updateStatus = () => {
    if (inactivityTime.current >= 60 && previousStatus === 'online') {
      console.log('Timer updateStatus')
      axios
        .post(`${API_BASE_URL}5000/update-status`, {
          userId,
          status: 'not_active',
        })
        .then((response) => (previousStatus = 'not_active'))
        .catch((error) => console.error('Ошибка обновления статуса:', error))
    }
  }

  const setOfflineStatus = async () => {
    if (previousStatus !== 'offline') {
      try {
        await axios.post(`${API_BASE_URL}5000/update-status`, {
          userId,
          status: 'offline',
        })
        previousStatus = 'offline'
      } catch (error) {
        console.error('Ошибка обновления статуса:', error)
      }
    }
  }

  // Устанавливаем таймер для отслеживания бездействия
  useEffect(() => {
    const interval = setInterval(() => {
      inactivityTime.current += 10
      updateStatus()
    }, 600000) // 10 мин

    // Добавляем троттлированные слушатели для сброса таймера
    const throttledResetTimer = throttle(resetTimer, 3000) // Троттлируем вызовы resetTimer до 200мс 3 секунды
    document.addEventListener('mousemove', throttledResetTimer)
    document.addEventListener('keypress', throttledResetTimer)
    document.addEventListener('scroll', throttledResetTimer)

    const handleBeforeUnload = () => {
      setOfflineStatus()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(interval)
      document.removeEventListener('mousemove', throttledResetTimer)
      document.removeEventListener('keypress', throttledResetTimer)
      document.removeEventListener('scroll', throttledResetTimer)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [userId])

  return null // Можно вернуть null, так как этот компонент не рендерит ничего на экране
}

export default ActivityTracker
