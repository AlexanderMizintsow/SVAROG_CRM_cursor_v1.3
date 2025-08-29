import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material'
import io from 'socket.io-client'
import Table from '../../components/table/Table'
import axios from 'axios'
import useMailStore from '../../store/mailStore'
import { API_BASE_URL } from '../../../config'
import 'react-resizable/css/styles.css'

const InboxMail = () => {
  const { setMail } = useMailStore()
  const [loading, setLoading] = useState(false)
  const [emails, setEmails] = useState([])
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    const userDataString = localStorage.getItem('userData')
    const userData = JSON.parse(userDataString)
    console.log(userData.id)
    if (!userData.id) {
      console.error('Ошибка: userId не указан.')
      return
    }

    setLoading(true)

    const fetchEmails = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5001/get-emails`, {
          params: { userId: userData.id },
        })
        console.log('Полученные письма:', response.data)
        setEmails(response.data)
      } catch (error) {
        console.error('Ошибка при получении писем:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEmails()

    const socket = io(`${API_BASE_URL}5001`, {
      query: { userId: userData.id },
    })

    socket.on('connect_error', (error) => {
      //  console.error('Ошибка подключения:', error.message)
    })
    socket.on('new-emails', (newEmails) => {
      console.log('Получены новые письма через сокет:', newEmails)
      setEmails((prevEmails) => {
        const uniqueEmails = newEmails.filter(
          (newEmail) => !prevEmails.some((email) => email.uid === newEmail.uid)
        )
        return [...uniqueEmails, ...prevEmails]
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const formatDate = (dateString) => {
    const options = {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    }
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', options).replace(',', ' в')
  }

  const formatEmailBody = (body) => {
    return body
      .replace(
        /(\n|^)(От:|Дата:|Содержание:|Кому:|Тема:|С уважением,)/g,
        '\n\n$2'
      )
      .replace(/(?:\r\n|\r|\n){2,}/g, '\n\n')
      .replace(/(?:\r\n|\r|\n)/g, '<br />')
  }

  const columns = [
    { field: 'date', headerName: 'Дата', width: 150, flex: 1 },
    { field: 'from', headerName: 'Отправитель', width: 250, flex: 2 },
    { field: 'subject', headerName: 'Тема', width: 250, flex: 2 },
    { field: 'body', headerName: 'Содержание', width: 300, flex: 3 },
  ]

  const emailRows = emails.map((email, index) => ({
    id: index,
    date: formatDate(email.date),
    from: email.from,
    subject: email.subject,
    body: email.body,
  }))

  const handleRowClick = (params) => {
    const email = emails[params.id]
    setSelectedEmail({
      ...email,
      body: formatEmailBody(email.body),
    })
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setSelectedEmail(null)
  }

  const handleAnswer = () => {
    setMail({
      to: selectedEmail.from,
      subject: `Re: ${selectedEmail.subject}`,
      body: `\n\n----------------------\n${selectedEmail.body}`,
    })
    setIsDialogOpen(false)
  }

  return (
    <>
      {loading ? (
        <div className="progress-container">
          <CircularProgress size={50} />
        </div>
      ) : (
        <Table
          exports={true}
          columns={columns}
          rows={emailRows}
          checkboxSelection
          disableSelectionOnClick={true}
          disableRowSelectionOnClick
          headerColor="#abcdef"
          textColor="#123456"
          onRowClick={handleRowClick}
          cursor={true}
        />
      )}

      <Dialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{selectedEmail?.subject}</DialogTitle>
        <DialogContent dividers>
          <p>
            <strong>От:</strong> {selectedEmail?.from}
          </p>
          <p>
            <strong>Дата:</strong> {formatDate(selectedEmail?.date)}
          </p>
          <p>
            <strong>Содержание:</strong>
          </p>
          <div dangerouslySetInnerHTML={{ __html: selectedEmail?.body }} />
        </DialogContent>
        <DialogActions>
          <Button
            component={Link}
            to="/application-mail/send"
            onClick={handleAnswer}
            color="primary"
          >
            Ответить
          </Button>
          <Button onClick={handleCloseDialog} color="primary">
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default InboxMail
