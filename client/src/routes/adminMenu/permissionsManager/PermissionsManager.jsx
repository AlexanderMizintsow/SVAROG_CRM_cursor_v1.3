import React, { useEffect, useState } from 'react'
import axios from 'axios'
import {
  Container,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import { API_BASE_URL } from '../../../../config'

const PermissionsManager = () => {
  const [roles, setRoles] = useState([])
  const [components, setComponents] = useState([])
  const [permissionsList, setPermissionsList] = useState([])
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedRoleName, setSelectedRoleName] = useState('') // Новое состояние для названия роли
  const [selectedComponent, setSelectedComponent] = useState('')
  const [permissions, setPermissions] = useState({
    can_view: false,
    can_edit: false,
    can_delete: false,
    can_create: false,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const rolesResponse = await axios.get(`${API_BASE_URL}5000/api/roles`)
        const componentsResponse = await axios.get(
          `${API_BASE_URL}5000/api/components`
        )
        setRoles(rolesResponse.data)
        setComponents(componentsResponse.data)
        if (rolesResponse.data.length > 0) {
          const firstRoleId = rolesResponse.data[0]?.id
          setSelectedRole(firstRoleId) // Установить первую роль как выбранную
          setSelectedRoleName(rolesResponse.data[0]?.name) // Установить имя первой роли
          loadPermissions(firstRoleId) // Загрузка прав для первой роли
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error)
      }
    }

    fetchData()
  }, [])

  const loadPermissions = async (roleId) => {
    if (roleId) {
      const response = await axios.get(
        `${API_BASE_URL}5000/api/permissions/${roleId}`
      )
      setPermissionsList(response.data)

      // Устанавливаем состояние чекбоксов в зависимости от загруженных прав
      const existingPermissions = response.data.reduce(
        (acc, perm) => {
          acc.can_view = perm.can_view || acc.can_view
          acc.can_edit = perm.can_edit || acc.can_edit
          acc.can_delete = perm.can_delete || acc.can_delete
          acc.can_create = perm.can_create || acc.can_create
          return acc
        },
        {
          can_view: false,
          can_edit: false,
          can_delete: false,
          can_create: false,
        }
      )

      setPermissions(existingPermissions)
    }
  }

  const handleRoleChange = (event) => {
    const roleId = event.target.value
    setSelectedRole(roleId)
    const selectedRoleObj = roles.find((role) => role.id === roleId)
    setSelectedRoleName(selectedRoleObj ? selectedRoleObj.name : '') // Установка имени роли
    loadPermissions(roleId)
  }

  const handleComponentChange = (event) => {
    const componentId = event.target.value
    setSelectedComponent(componentId)

    // Находим права для выбранного компонента
    const selectedPermission =
      permissionsList.find((perm) => perm.component_id === componentId) || {}

    // Обновляем состояния чекбоксов исходя из выбранного компонента
    setPermissions({
      can_view: selectedPermission.can_view || false,
      can_edit: selectedPermission.can_edit || false,
      can_delete: selectedPermission.can_delete || false,
      can_create: selectedPermission.can_create || false,
    })
  }

  const myFunc = (x) => {
    let num
    if (x <= 10) {
      num = ++x
    }
    if (x > 10) {
      num = --x
    }
    return num
  }
  console.log(myFunc(7))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selectedRole || !selectedComponent) {
      alert('Пожалуйста, выберите роль и компонент.')
      return
    }

    const payload = {
      role_id: selectedRole,
      component_id: selectedComponent,
      ...permissions,
    }

    try {
      await axios.post(`${API_BASE_URL}5000/api/permissions`, payload)
      alert('Права успешно сохранены')
      loadPermissions(selectedRole) // Обновить права для текущей роли
    } catch (error) {
      console.error('Ошибка при сохранении прав:', error)
      alert('Произошла ошибка при сохранении прав')
    }
  }

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <Typography variant="h4" gutterBottom>
        Управление правами доступа (только администратор)
      </Typography>

      <FormControl fullWidth margin="normal">
        <InputLabel className="input-material-label">Роль</InputLabel>
        <Select value={selectedRole} onChange={handleRoleChange}>
          {roles.map((role) => (
            <MenuItem key={role.id} value={role.id}>
              {role.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth margin="normal">
        <InputLabel className="input-material-label">Компонент</InputLabel>
        <Select
          value={selectedComponent}
          onChange={handleComponentChange} // Изменено на handleComponentChange
        >
          {components.map((component) => (
            <MenuItem key={component.id} value={component.id}>
              {component.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormGroup row>
        <FormControlLabel
          control={
            <Checkbox
              checked={permissions.can_view}
              onChange={(e) =>
                setPermissions({ ...permissions, can_view: e.target.checked })
              }
            />
          }
          label="Право на просмотр"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={permissions.can_edit}
              onChange={(e) =>
                setPermissions({ ...permissions, can_edit: e.target.checked })
              }
            />
          }
          label="Право на редактирование"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={permissions.can_delete}
              onChange={(e) =>
                setPermissions({ ...permissions, can_delete: e.target.checked })
              }
            />
          }
          label="Право на удаление"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={permissions.can_create}
              onChange={(e) =>
                setPermissions({ ...permissions, can_create: e.target.checked })
              }
            />
          }
          label="Право на создание"
        />
      </FormGroup>

      <Button
        variant="contained"
        color="primary"
        onClick={handleSubmit}
        style={{ marginTop: '1rem' }}
      >
        Сохранить
      </Button>

      <Typography variant="h5" gutterBottom style={{ marginTop: '2rem' }}>
        Существующие права доступа для роли: {selectedRoleName}
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: 'gray' }}>
              <TableCell>Компонент</TableCell>
              <TableCell align="center">Просмотр</TableCell>
              <TableCell align="center">Редактирование</TableCell>
              <TableCell align="center">Удаление</TableCell>
              <TableCell align="center">Создание</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {components.map((component) => {
              const permission =
                permissionsList.find(
                  (perm) => perm.component_id === component.id
                ) || {}
              return (
                <TableRow key={component.id}>
                  <TableCell>{component.name}</TableCell>
                  <TableCell align="center">
                    {permission.can_view ? '✔️' : '❌'}
                  </TableCell>
                  <TableCell align="center">
                    {permission.can_edit ? '✔️' : '❌'}
                  </TableCell>
                  <TableCell align="center">
                    {permission.can_delete ? '✔️' : '❌'}
                  </TableCell>
                  <TableCell align="center">
                    {permission.can_create ? '✔️' : '❌'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}

export default PermissionsManager
