import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material'
import Btn from '@mui/material/Button' // Кнопка для действий в диалоге
import { useEffect, useState } from 'react'
const ConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  btn1,
  btn2,
  comment,
  dateInput,
  actionType, // необязательный
  initialDate = '',
}) => {
  const [commentValue, setCommentValue] = useState('')
  const [dateValue, setDateValue] = useState(initialDate || '')

  const handleConfirm = () => {
    if (comment && dateInput) {
      onConfirm(commentValue, dateValue, actionType)
    } else if (comment) {
      onConfirm(commentValue, actionType)
    } else if (dateInput) {
      onConfirm(dateValue, actionType)
    } else {
      onConfirm()
    }
    // Сбрасываем значения после подтверждения
    setCommentValue('')
    setDateValue('')
  }

  const handleFocus = (e) => {
    // Проверяем, если поле уже заполнено
    if (!dateValue && !initialDate) {
      const now = new Date()
      now.setMinutes(0) // Устанавливаем минуты на 0
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(
        2,
        '0'
      )}:${String(now.getMinutes()).padStart(2, '0')}` // Форматируем дату в локальном времени
      setDateValue(formattedDate) // Устанавливаем значение в состояние
    }
  }

  useEffect(() => {
    if (open && initialDate) {
      setDateValue(initialDate)
    }
  }, [open, initialDate])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      className="customDialog"
    >
      <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description" className="dialogDescription">
          {message}
        </DialogContentText>
        {comment && (
          <TextField
            autoFocus
            margin="dense"
            id="comment"
            label="Комментарий"
            type="text"
            fullWidth
            variant="outlined"
            value={commentValue}
            onChange={(e) => setCommentValue(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-input': {
                color: '#fff',
              },
              '& .MuiInputLabel-root': {
                color: '#fff',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#fff',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#fff',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#fff',
              },
            }}
          />
        )}
        {dateInput && (
          <TextField
            margin="dense"
            id="new-deadline"
            label="Новый срок выполнения"
            type="datetime-local"
            fullWidth
            variant="outlined"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            onFocus={handleFocus}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{
              '& .MuiOutlinedInput-input': { color: '#fff' },
              '& .MuiInputLabel-root': { color: '#fff' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#fff',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#fff',
              },
            }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Btn onClick={onClose} color="primary">
          {btn1}
        </Btn>
        <Btn onClick={handleConfirm} color="secondary">
          {btn2}
        </Btn>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmationDialog
