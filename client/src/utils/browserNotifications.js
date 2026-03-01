import logo_windows from '../../src/assets/img/logo_windows.png'
import Toastify from 'toastify-js'

// Получаем Electron API если доступен
const getElectronAPI = () => {
  return typeof window !== 'undefined' ? window.electronAPI : null
}

// Универсальная функция отправки уведомления через Electron
// Electron сам проверяет активность окна и показывает уведомление только если окно не активно
export const sendDesktopNotification = (title, body) => {
  const electronAPI = getElectronAPI()
  if (electronAPI && typeof electronAPI.sendNotification === 'function') {
    electronAPI.sendNotification(title, body)
  }
}

// Функция для запроса разрешения на уведомления в браузере
export const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          console.log('Разрешение на уведомления предоставлено.')
        } else if (permission === 'denied') {
          console.log('Разрешение на уведомления отклонено.')
        } else {
          console.log('Разрешение на уведомления не выбрано.')
        }
      } catch (error) {
        console.error('Ошибка при запросе разрешения на уведомления:', error)
      }
    } else if (Notification.permission === 'granted') {
      //   console.log('Разрешение на уведомления уже предоставлено.')
    } else {
      console.log('Разрешение на уведомления уже отклонено.')
    }
  } else {
    console.warn('Браузер не поддерживает уведомления.')
  }
}

// Функция для отправки уведомления о напоминании
export const sendBrowserNotification = (newReminder) => {
  const title = 'Новое напоминание!'
  const body = `Необходимо выполнить: ${newReminder.comment || 'Нет комментария'}`
  
  // Отправляем через Electron (проверка активности окна на стороне Electron)
  sendDesktopNotification(title, body)
}

// Функция для отправки произвольного текста уведомления
export const sendCustomNotification = (text) => {
  // Отправляем через Electron (проверка активности окна на стороне Electron)
  sendDesktopNotification('Уведомление', text)
}
