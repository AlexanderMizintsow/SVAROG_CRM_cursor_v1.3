import io from 'socket.io-client'
import Toastify from 'toastify-js'
import { API_BASE_URL } from '../config'
import 'toastify-js/src/toastify.css'

export const setupNotifications = () => {
  const notifiedEmails =
    JSON.parse(localStorage.getItem('notifiedEmails')) || []
  const userDataString = localStorage.getItem('userData')
  const userData = JSON.parse(userDataString)

  const socket = io(`${API_BASE_URL}5001`, {
    query: { userId: userData.id },
    // Почта/уведомления на :5001 — если сервис не запущен, не долбить консоль
    reconnectionAttempts: 3,
    reconnectionDelay: 8000,
    timeout: 5000,
    autoConnect: true,
  })
  socket.on('connect_error', () => {
    // Сервис почты (5001) недоступен — это не ошибка базы знаний
  })
  socket.on('new-emails', (newEmails) => {
    newEmails.forEach((mail) => {
      if (!notifiedEmails.includes(mail.uid)) {
        // Функция для копирования текста в буфер обмена
        const handleCopy = (text) => {
          navigator.clipboard
            .writeText(text)
            .then(() => {
              Toastify({
                text: 'Текст скопирован в буфер обмена',
                duration: 2000, // Показать уведомление на 2 секунды
                close: true,
                style: {
                  background: 'linear-gradient(to right, #00b09b, #96c93d)',
                },
              }).showToast()
            })
            .catch((err) => {
              console.error('Ошибка при копировании текста: ', err)
              Toastify({
                text: 'Ошибка при копировании текста',
                duration: 2000,
                close: true,
                style: {
                  background: 'linear-gradient(to right, #e53935, #b71c1c)',
                },
              }).showToast()
            })
        }

        Toastify({
          text: `Письмо от ${mail.from}`,
          close: true,
          style: {
            background: 'linear-gradient(to right, #00b09b, #96c93d)',
          },
          onClick: () => handleCopy(mail.from), // Добавляем обработчик клика для копирования отправителя
        }).showToast()

        notifiedEmails.push(mail.uid)
        localStorage.setItem('notifiedEmails', JSON.stringify(notifiedEmails))

        // Воспроизведение звука уведомления
        const audio = new Audio('/sound/notificationEmail.mp3')
        audio.play()
      }
    })
  })

  return () => {
    socket.disconnect()
  }
}
