import { useState, useEffect } from 'react'
import { BiMailSend } from 'react-icons/bi'
import { Box, Container, TextField } from '@mui/material'
import { TiDeleteOutline } from 'react-icons/ti'
import Toastify from 'toastify-js'
import useMailStore from '../../store/mailStore'
import axios from 'axios'
import { API_BASE_URL } from '../../../config'
import 'toastify-js/src/toastify.css'
import './composeMail.scss'

export default function ComposeMail() {
  const { mail: initialMail, resetMail } = useMailStore() // Получаем данные из store
  const [files, setFiles] = useState([])
  const [preview, setPreview] = useState(null)
  const [mail, setMail] = useState(initialMail) // Инициализация с данными из store
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setMail(initialMail) // Устанавливаем состояние при монтировании
  }, [initialMail])

  const userDataString = localStorage.getItem('userData')
  const userData = JSON.parse(userDataString)

  const handleAttachment = (event) => {
    const newFiles = Array.from(event.target.files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setFiles((prevFiles) => [...prevFiles, ...newFiles])
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const newFiles = Array.from(event.dataTransfer.files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setFiles((prevFiles) => [...prevFiles, ...newFiles])
  }

  const handleDragOver = (event) => {
    event.preventDefault()
  }

  const handleChange = (prop) => (event) => {
    setMail({ ...mail, [prop]: event.target.value })
  }

  const handleRemoveFile = (index) => {
    setFiles((prevFiles) => {
      const updatedFiles = prevFiles.filter((_, i) => i !== index)
      URL.revokeObjectURL(prevFiles[index].preview) // Освобождаем память
      return updatedFiles
    })
  }

  const handleMouseEnter = (preview) => {
    setPreview(preview)
  }

  const handleMouseLeave = () => {
    setPreview(null)
  }

  const resetForm = () => {
    resetMail() // Сбросить состояние в глобальном store
    setFiles([])
    setPreview(null)
    setIsSubmitting(false)
  }

  const handleSubmit = async () => {
    if (!mail.to || !mail.subject || !mail.body) {
      Toastify({
        text: 'Необходимо указать все поля!',
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        },
      }).showToast()

      return
    }

    setIsSubmitting(true)

    Toastify({
      text: 'Отправка сообщения!',
      close: true,
      style: {
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      },
    }).showToast()

    const formData = new FormData()
    formData.append('userId', userData.id) // Добавляем userId
    formData.append('to', mail.to)
    formData.append('subject', mail.subject)
    formData.append('body', mail.body)
    files.forEach((fileObj) => {
      formData.append('attachments', fileObj.file)
    })

    try {
      console.log('Отправка данных:', formData)
      const response = await axios.post(
        `${API_BASE_URL}5001/send-email`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      console.log('Email sent:', response.data)

      Toastify({
        text: `Письмо для ${mail.to} успешно доставлено!`,
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()

      resetForm()
    } catch (error) {
      console.error('Error sending email:', error)

      Toastify({
        text: error.response?.data || 'Ошибка отправки письма',
        close: true,
        style: {
          backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
        },
      }).showToast()

      setIsSubmitting(false)
    }
  }

  return (
    <Container maxWidth="lg">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        className="textFieldContainer"
      >
        <TextField
          label="Кому"
          value={mail.to}
          onChange={handleChange('to')}
          margin="normal"
          required={true}
          fullWidth
          disabled={isSubmitting}
        />
        <TextField
          label="Тема"
          value={mail.subject}
          onChange={handleChange('subject')}
          margin="normal"
          required={true}
          fullWidth
          disabled={isSubmitting}
        />
        <TextField
          label="Сообщение"
          value={mail.body}
          onChange={handleChange('body')}
          margin="normal"
          fullWidth
          multiline
          required={true}
          rows={12}
          disabled={isSubmitting}
        />
        <div
          className="file-input-container"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            className="file-input"
            type="file"
            multiple
            onChange={handleAttachment}
            disabled={isSubmitting}
          />
          <label className="file-input-label">
            Выберите файл или перетащите его сюда
          </label>
        </div>
        <div className="file-list">
          {files.map((fileObj, index) => (
            <div
              key={index}
              className="file-item"
              onMouseEnter={() => handleMouseEnter(fileObj.preview)}
              onMouseLeave={handleMouseLeave}
            >
              {fileObj.file.name}
              <TiDeleteOutline
                className="remove-file"
                onClick={() => handleRemoveFile(index)}
              />
            </div>
          ))}
          {preview && (
            <div className="preview-container">
              <img src={preview} alt="Preview" className="preview-image" />
            </div>
          )}
        </div>

        <button
          className="send-button"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          Отправить &nbsp; <BiMailSend />
        </button>
      </Box>
    </Container>
  )
}
