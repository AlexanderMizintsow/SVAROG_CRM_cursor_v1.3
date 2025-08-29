import logo_windows from '../../src/assets/img/logo_windows.png'
import Toastify from 'toastify-js'

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

// Функция для отправки уведомления в браузере
export const sendBrowserNotification = (newReminder) => {
  if (Notification.permission === 'granted') {
    new Notification('Новое напоминание!', {
      body: `Необходимо выполнить: ${newReminder.comment || 'Нет комментария'}`,
      icon: logo_windows,
    })
  } else {
    console.log(
      'Разрешение на уведомления не предоставлено:',
      Notification.permission
    )
  }
}

// Новая функция для отправки произвольного текста уведомления
export const sendCustomNotification = (text) => {
  if (Notification.permission === 'granted') {
    new Notification('Уведомление', {
      body: text,
      icon: logo_windows,
    })
  } else {
    console.log(
      'Разрешение на уведомления не предоставлено:',
      Notification.permission
    )
  }
}
