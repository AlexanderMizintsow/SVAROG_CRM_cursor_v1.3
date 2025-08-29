import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
} from '@mui/material'
import { API_BASE_URL } from '../../../../config'
import axios from 'axios'

const PhoneNumbersDialog = ({ open, onClose, userId }) => {
  const [phones, setPhones] = useState([])
  const [newPhone, setNewPhone] = useState('')
  const [editPhone, setEditPhone] = useState(null)
  const [phoneType, setPhoneType] = useState('')
  const [editPhoneType, setEditPhoneType] = useState('')

  const phoneTypes = ['Рабочий стационарный', 'Мобильный', 'Дополнительный']

  useEffect(() => {
    if (userId) {
      const fetchPhones = async () => {
        try {
          const response = await axios.get(
            `${API_BASE_URL}5000/api/users/${userId}/phones`
          )
          setPhones(response.data)
        } catch (error) {
          console.error('Ошибка при получении номеров телефонов:', error)
        }
      }

      fetchPhones()
    }
  }, [userId, open])

  const handleAddPhone = async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}5000/api/users/${userId}/phones`,

        { phone_number: newPhone, phone_type: phoneType }
      )
      setPhones([...phones, response.data])
      setNewPhone('')
      setPhoneType('')
    } catch (error) {
      console.error('Ошибка при добавлении номера телефона:', error)
    }
  }

  const handleEditButtonClick = (phone) => {
    setEditPhone(phone)
    setEditPhoneType(phone.phone_type)
  }

  const handleEditPhone = async () => {
    try {
      if (!editPhone || !editPhone.id) {
        console.error('editPhone или editPhone.id отсутствует', editPhone)
        throw new Error('ID телефона не указан')
      }

      const response = await axios.put(
        `${API_BASE_URL}5000/api/users/phones/update/${editPhone.id}`,

        {
          phone_number: editPhone.phone_number,
          phone_type: editPhoneType,
        }
      )

      setPhones(
        phones.map((phone) =>
          phone.id === editPhone.id ? response.data : phone
        )
      )
      setEditPhone(null)
    } catch (error) {
      console.error('Ошибка при обновлении номера телефона:', error)
    }
  }

  const handleDeletePhone = async (phoneId) => {
    if (!phoneId) {
      console.error('ID телефона отсутствует или неопределен')
      return
    }

    try {
      await axios.delete(`${API_BASE_URL}5000/api/phones/delete/${phoneId}`)

      setPhones(phones.filter((phone) => phone.id !== phoneId))
    } catch (error) {
      console.error('Ошибка при удалении номера телефона:', error)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Номера телефонов</DialogTitle>
      <DialogContent>
        <List>
          {phones.length > 0 ? (
            phones.map((phone) => (
              <ListItem key={phone.id}>
                <ListItemText
                  primary={phone.phone_number}
                  secondary={phone.phone_type}
                />
                <Button onClick={() => handleEditButtonClick(phone)}>
                  Изменить
                </Button>
                <Button
                  onClick={() => handleDeletePhone(phone.id)}
                  color="error"
                >
                  Удалить
                </Button>
              </ListItem>
            ))
          ) : (
            <ListItem>
              <ListItemText primary="Нет номеров телефонов" />
            </ListItem>
          )}
        </List>
        <TextField
          label="Новый номер"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          fullWidth
          margin="normal"
        />
        <FormControl fullWidth margin="normal">
          <InputLabel>Тип номера</InputLabel>
          <Select
            value={phoneType}
            onChange={(e) => setPhoneType(e.target.value)}
            label="Тип номера"
          >
            {phoneTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button onClick={handleAddPhone} color="primary">
          Добавить
        </Button>

        {editPhone && (
          <div>
            <TextField
              label="Изменить номер"
              value={editPhone.phone_number || ''}
              onChange={(e) =>
                setEditPhone({ ...editPhone, phone_number: e.target.value })
              }
              fullWidth
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Тип номера</InputLabel>
              <Select
                value={editPhoneType}
                onChange={(e) => setEditPhoneType(e.target.value)}
                label="Тип номера"
              >
                {phoneTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button onClick={handleEditPhone} color="primary">
              Сохранить изменения
            </Button>
            <Button onClick={() => setEditPhone(null)} color="secondary">
              Отменить
            </Button>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PhoneNumbersDialog
