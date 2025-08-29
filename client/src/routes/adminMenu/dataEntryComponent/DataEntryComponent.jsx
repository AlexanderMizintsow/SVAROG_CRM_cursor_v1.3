import { useState, useEffect } from 'react'
import { FcDeleteDatabase } from 'react-icons/fc'
import axios from 'axios'
import { ToastContainer, toast } from 'react-toastify'
import { TiUserDelete } from 'react-icons/ti'
import {
  Container,
  TextField,
  Button,
  MenuItem,
  Typography,
  Paper,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import { API_BASE_URL } from '../../../../config'
import 'react-toastify/dist/ReactToastify.css'
import './dataEntryComponent.scss'

const DataEntryComponent = () => {
  const [roles, setRoles] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [currentDelete, setCurrentDelete] = useState({ type: '', id: null })

  const [newRole, setNewRole] = useState({ name: '' })
  const [newDepartment, setNewDepartment] = useState({
    name: '',
    head_user_id: '',
  })
  const [newPosition, setNewPosition] = useState({ name: '' })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const rolesResponse = await axios.get(`${API_BASE_URL}5000/api/roles`)

        const departmentsResponse = await axios.get(
          `${API_BASE_URL}5000/api/departments`
        )
        const positionsResponse = await axios.get(
          `${API_BASE_URL}5000/api/positions`
        )
        const usersResponse = await axios.get(`${API_BASE_URL}5000/api/users`)

        setRoles(rolesResponse.data)
        setDepartments(departmentsResponse.data)
        setPositions(positionsResponse.data)
        setUsers(usersResponse.data)
        setLoading(false)
      } catch (error) {
        console.error('Ошибка при получении данных:', error)
        setError('Ошибка при получении данных')
        setOpen(true)
      }
    }

    fetchData()
  }, [newPosition, newRole, newDepartment])

  const isDuplicate = (name, list) => {
    return list.some((item) => item.name.toLowerCase() === name.toLowerCase())
  }

  const handleSubmitRole = async (e) => {
    e.preventDefault()
    if (isDuplicate(newRole.name, roles)) {
      toast.error('Такая роль уже существует')
      return
    }
    try {
      const response = await axios.post(
        `${API_BASE_URL}5000/api/roles/new`,
        newRole
      )
      setRoles([...roles, response.data])
      toast.success('Новая роль успешно добавлена')
      setNewRole({ name: '' })
    } catch (error) {
      console.error('Ошибка при добавлении новой роли:', error)
      setError(`Ошибка при добавлении новой роли: ${error.message}`)
      setOpen(true)
    }
  }

  const handleSubmitDepartment = async (e) => {
    e.preventDefault()
    if (!newDepartment.name || !newDepartment.head_user_id) {
      toast.error(
        'Название отдела и руководитель отдела обязательны для заполнения'
      )
      return
    }
    if (isDuplicate(newDepartment.name, departments)) {
      toast.error('Такой отдел уже существует')
      return
    }
    try {
      const response = await axios.post(
        `${API_BASE_URL}5000/api/departments/new`,
        newDepartment
      )
      setDepartments([...departments, response.data])
      toast.success('Новый отдел успешно добавлен')
      setNewDepartment({ name: '', head_user_id: '' })
    } catch (error) {
      console.error('Ошибка при добавлении нового отдела:', error)
      setError(`Ошибка при добавлении нового отдела: ${error.message}`)
      setOpen(true)
    }
  }

  const handleSubmitPosition = async (e) => {
    e.preventDefault()
    if (isDuplicate(newPosition.name, positions)) {
      toast.error('Такая должность уже существует')
      return
    }
    try {
      const response = await axios.post(
        `${API_BASE_URL}5000/api/positions/new`,
        newPosition
      )
      setPositions([...positions, response.data])
      toast.success('Новая должность успешно добавлена')
      setNewPosition({ name: '' })
    } catch (error) {
      console.error('Ошибка при добавлении новой должности:', error)
      setError(`Ошибка при добавлении новой должности: ${error.message}`)
      setOpen(true)
    }
  }

  const handleDelete = async () => {
    const { type, id } = currentDelete
    try {
      if (type === 'роль') {
        await axios.delete(`${API_BASE_URL}5000/api/roles/${id}`)
        setRoles(roles.filter((role) => role.id !== id))
      } else if (type === 'отдел') {
        await axios.delete(`${API_BASE_URL}5000/api/departments/${id}`)
        setDepartments(departments.filter((department) => department.id !== id))
      } else if (type === 'должность') {
        await axios.delete(`${API_BASE_URL}5000/api/positions/${id}`)
        setPositions(positions.filter((position) => position.id !== id))
      }
      toast.success('Элемент успешно удален')
    } catch (error) {
      console.error('Ошибка при удалении элемента:', error)
      setError(`Ошибка при удалении элемента: ${error.message}`)
      setOpen(true)
    }
    setDialogOpen(false)
  }

  const handleDialogOpen = (type, id, name) => {
    setCurrentDelete({ type, id, name })
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
  }

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return
    }
    setOpen(false)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <CircularProgress />
      </div>
    )
  }

  const handleAssignHead = async (departmentId, headUserId) => {
    try {
      await axios.post(
        `${API_BASE_URL}5000/api/departments/${departmentId}/assign-head`,
        { head_user_id: headUserId }
      )
      setDepartments(
        departments.map((department) =>
          department.id === departmentId
            ? { ...department, head_user_id: headUserId }
            : department
        )
      )
      toast.success('Руководитель успешно назначен')
    } catch (error) {
      console.error('Ошибка при назначении руководителя:', error)
      setError(`Ошибка при назначении руководителя: ${error.message}`)
      setOpen(true)
    }
  }

  const handleRemoveHeadClick = async (departmentId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}5000/api/departments/${departmentId}/remove-head`
      )
      if (response.status === 200) {
        setDepartments(
          departments.map((department) =>
            department.id === departmentId
              ? { ...department, head_user_id: null }
              : department
          )
        )
        toast.success('Руководитель отдела успешно удален')
      }
    } catch (error) {
      console.error('Ошибка при удалении руководителя:', error)
      toast.error('Ошибка при удалении руководителя')
    }
  }

  return (
    <Container
      className="container"
      style={{ maxWidth: '100%', maxHeight: '100%', overflowY: 'auto' }}
    >
      <Paper
        className="paper"
        elevation={3}
        style={{
          padding: '1em',
          marginTop: '1em',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1em',
          border: '2px solid #1976d2',
          borderRadius: '8px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div>
          <Typography variant="h5" gutterBottom>
            Существующие роли
          </Typography>
          {roles.map((role) => (
            <Typography key={role.id}>
              {role.name}{' '}
              <FcDeleteDatabase
                style={{ cursor: 'pointer' }}
                onClick={() => handleDialogOpen('роль', role.id, role.name)}
              />
            </Typography>
          ))}

          <form
            onSubmit={handleSubmitRole}
            style={{
              marginTop: '1em',
              border: '1px solid #1976d2',
              padding: '1em',
              borderRadius: '8px',
            }}
          >
            <Typography variant="h5" gutterBottom>
              Добавить новую роль
            </Typography>
            <TextField
              className="custom-text-field"
              fullWidth
              name="name"
              label="Название роли"
              variant="outlined"
              onChange={(e) => setNewRole({ name: e.target.value })}
              value={newRole.name}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              style={{ marginTop: '1em' }}
            >
              Добавить
            </Button>
          </form>
        </div>
        <div>
          <Typography variant="h5" gutterBottom>
            Существующие отделы
          </Typography>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {departments.map((department) => (
              <div
                key={department.id}
                style={{
                  marginBottom: '1em',
                  padding: '1em',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                }}
              >
                <Typography
                  style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                  }}
                >
                  {department.name}
                  <FcDeleteDatabase
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      handleDialogOpen('отдел', department.id, department.name)
                    }
                  />
                </Typography>
                <TextField
                  select
                  className="custom-text-field"
                  label="Руководитель отдела"
                  variant="outlined"
                  fullWidth
                  value={department.head_user_id || ''}
                  onChange={(e) =>
                    handleAssignHead(department.id, e.target.value)
                  }
                  style={{ marginTop: '1em' }}
                >
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </MenuItem>
                  ))}
                </TextField>
                {department.head_user_id && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => handleRemoveHeadClick(department.id)}
                    style={{ marginTop: '0.1em' }}
                    startIcon={<TiUserDelete />}
                  >
                    Удалить руководителя отдела
                  </Button>
                )}
              </div>
            ))}
          </div>
          <form
            onSubmit={handleSubmitDepartment}
            style={{
              marginTop: '1em',
              border: '1px solid #1976d2',
              padding: '1em',
              borderRadius: '8px',
            }}
          >
            <Typography variant="h5" gutterBottom>
              Добавить новый отдел
            </Typography>
            <TextField
              className="custom-text-field"
              fullWidth
              name="name"
              label="Название отдела"
              variant="outlined"
              onChange={(e) =>
                setNewDepartment({
                  ...newDepartment,
                  name: e.target.value,
                })
              }
              value={newDepartment.name}
            />
            <TextField
              select
              className="custom-text-field"
              fullWidth
              name="head_user_id"
              label="Руководитель отдела"
              variant="outlined"
              onChange={(e) =>
                setNewDepartment({
                  ...newDepartment,
                  head_user_id: e.target.value,
                })
              }
              value={newDepartment.head_user_id || ''}
              style={{ marginTop: '1em' }}
            >
              {users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                </MenuItem>
              ))}
            </TextField>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              style={{ marginTop: '1em' }}
            >
              Добавить
            </Button>
          </form>
        </div>
        <div>
          <Typography variant="h5" gutterBottom>
            Существующие должности
          </Typography>
          {positions.map((position) => (
            <Typography key={position.id}>
              {position.name}{' '}
              <FcDeleteDatabase
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  handleDialogOpen('должность', position.id, position.name)
                }
              />
            </Typography>
          ))}

          <form
            onSubmit={handleSubmitPosition}
            style={{
              marginTop: '1em',
              border: '1px solid #1976d2',
              padding: '1em',
              borderRadius: '8px',
            }}
          >
            <Typography variant="h5" gutterBottom>
              Добавить новую должность
            </Typography>
            <TextField
              className="custom-text-field"
              fullWidth
              name="name"
              label="Название должности"
              variant="outlined"
              onChange={(e) => setNewPosition({ name: e.target.value })}
              value={newPosition.name}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              style={{ marginTop: '1em' }}
            >
              Добавить
            </Button>
          </form>
        </div>
      </Paper>
      <ToastContainer />

      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Подтвердите удаление</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Вы действительно хотите удалить {currentDelete.type}{' '}
            {currentDelete.name}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary">
            Отмена
          </Button>
          <Button onClick={handleDelete} color="secondary" autoFocus>
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={open} autoHideDuration={6000} onClose={handleClose}>
        <Alert onClose={handleClose} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Container>
  )
}

export default DataEntryComponent
