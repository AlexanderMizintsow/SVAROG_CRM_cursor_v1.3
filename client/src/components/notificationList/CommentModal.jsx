import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material'

const CommentModal = ({
  isOpen,
  onClose,
  onSubmit,
  dealerId,
  currentComment,
  onCommentChange,
}) => {
  const inputBackgroundColor = '#f0f0f0' // Светлый фон для текста
  const inputTextColor = '#333333' // Темный текст для читаемости
  const labelColor = 'blue' // Цвет метки (светлый серо-голубой)
  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Комментарий</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Ваш комментарий"
          type="text"
          fullWidth
          multiline
          rows={5}
          value={currentComment}
          onChange={(e) => onCommentChange(dealerId, e.target.value)}
          variant="outlined"
          InputLabelProps={{
            style: { color: labelColor }, // Цвет метки
          }}
          InputProps={{
            style: {
              color: inputTextColor, // Цвет текста
              backgroundColor: inputBackgroundColor, // Цвет фона инпута
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Отмена
        </Button>
        <Button
          onClick={() => onSubmit(dealerId)}
          color="primary"
          variant="contained"
        >
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CommentModal
