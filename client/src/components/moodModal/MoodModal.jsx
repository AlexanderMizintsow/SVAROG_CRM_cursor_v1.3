import { useState, useEffect } from 'react'
import './moodModal.scss' // Импорт стилей
import { Modal, Button, TextField } from '@mui/material'
import axios from 'axios'

const MoodModal = ({ show, handleClose, userId }) => {
  const [mood, setMood] = useState('')
  const [comment, setComment] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const now = new Date()
    const day = now.getDay()
    const hours = now.getHours()

    // Проверьте, что это рабочий день и рабочие часы
    const isWeekend = day === 0 || day === 6 // Воскресенье и суббота

    setIsOpen(true)
  }, [])

  const handleMoodChange = (selectedMood) => {
    setMood(selectedMood)
  }

  const handleCommentChange = (e) => {
    setComment(e.target.value)
  }

  // Обработчик отправки данных
  const handleSubmit = async (e) => {
    e.preventDefault()
    const data = { user_id: userId, mood_selection: mood, comment }

    try {
      // Отправка данных на сервер
      await axios.post('https://your-api-endpoint.com/api/mood', data)
      // Сброс состояния
      setMood('')
      setComment('')
      handleClose()
    } catch (error) {
      console.error('Ошибка при отправке данных: ', error)
    }
  }

  return (
    <Modal open={isOpen && show} onClose={handleClose} className="mood-modal">
      <div className="modal-content">
        <h2>Как твое настроение сегодня?</h2>
        <div className="mood-buttons">
          {['Супер', 'Хорошо', 'Нормально', 'Плохо'].map((m) => (
            <Button
              key={m}
              variant={mood === m ? 'contained' : 'outlined'}
              onClick={() => handleMoodChange(m)}
            >
              {m}
            </Button>
          ))}
        </div>
        <TextField
          label="Чего бы ты хотел сегодня?"
          multiline
          rows={3}
          variant="outlined"
          value={comment}
          onChange={handleCommentChange}
          fullWidth
        />
        <div className="modal-actions">
          <Button variant="contained" onClick={handleSubmit} disabled={!mood}>
            Отправить
          </Button>
          <Button variant="outlined" onClick={handleClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default MoodModal
