import { useState, useEffect } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import useUserStore from '../../../../../store/userStore'
import { API_BASE_URL } from '../../../../../../config'
import ConfirmationDialog from '../../../../../components/confirmationDialog/ConfirmationDialog'
import './PermissionsManager.scss'

const PermissionsManager = ({ refreshKey }) => {
  const { user } = useUserStore()
  const userId = user?.id

  const [users, setUsers] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState('')
  const [deletePermissionId, setDeletePermissionId] = useState(null)

  useEffect(() => {
    loadUsers()
    loadPermissions()
  }, [refreshKey])

  const loadUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/users`)
      setUsers(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке пользователей:', error)
    }
  }

  const loadPermissions = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/permissions/all`)
      setPermissions(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке прав доступа:', error)
      Toastify({
        text: 'Ошибка при загрузке прав доступа',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    } finally {
      setLoading(false)
    }
  }

  const handleGrantPermission = async () => {
    if (!selectedUser) {
      Toastify({
        text: 'Выберите пользователя',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
      return
    }

    try {
      await axios.post(`${API_BASE_URL}5778/api/marketing/permissions`, {
        user_id: parseInt(selectedUser),
        can_edit: true,
        created_by: userId,
      })
      Toastify({
        text: 'Права доступа успешно выданы',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      setSelectedUser('')
      loadPermissions()
    } catch (error) {
      console.error('Ошибка при выдаче прав доступа:', error)
      Toastify({
        text: error.response?.data?.error || 'Ошибка при выдаче прав доступа',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  const handleDeletePermission = (id) => {
    setDeletePermissionId(id)
  }

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}5778/api/marketing/permissions/${deletePermissionId}`)
      Toastify({
        text: 'Права доступа удалены',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
      setDeletePermissionId(null)
      loadPermissions()
    } catch (error) {
      console.error('Ошибка при удалении прав доступа:', error)
      Toastify({
        text: error.response?.data?.error || 'Ошибка при удалении прав доступа',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  if (loading) {
    return <div className="permissions-manager__loading">Загрузка...</div>
  }

  return (
    <div className="permissions-manager">
      <div className="permissions-manager__header">
        <h2>Управление правами доступа</h2>
      </div>

      <div className="permissions-manager__grant-section">
        <h3>Выдать права доступа</h3>
        <div className="permissions-manager__grant-form">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="permissions-manager__select"
          >
            <option value="">Выберите пользователя</option>
            {users
              .filter((u) => !permissions.some((p) => p.user_id === u.id))
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.last_name} {user.first_name} {user.middle_name} ({user.email})
                </option>
              ))}
          </select>
          <button className="permissions-manager__btn" onClick={handleGrantPermission}>
            Выдать права
          </button>
        </div>
      </div>

      <div className="permissions-manager__list-section">
        <h3>Пользователи с правами доступа</h3>
        {permissions.length === 0 ? (
          <div className="permissions-manager__empty">Нет пользователей с правами доступа</div>
        ) : (
          <div className="permissions-manager__list">
            {permissions.map((permission) => {
              const user = users.find((u) => u.id === permission.user_id)
              return (
                <div key={permission.id} className="permissions-manager__item">
                  <div className="permissions-manager__item-info">
                    <div className="permissions-manager__item-name">
                      {user
                        ? `${user.last_name} ${user.first_name} ${user.middle_name}`
                        : 'Пользователь не найден'}
                    </div>
                    <div className="permissions-manager__item-email">{user?.email || '-'}</div>
                    <div className="permissions-manager__item-date">
                      Выдано: {new Date(permission.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <button
                    className="permissions-manager__btn-delete"
                    onClick={() => handleDeletePermission(permission.id)}
                  >
                    Удалить права
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {deletePermissionId && (
        <ConfirmationDialog
          open={!!deletePermissionId}
          onClose={() => setDeletePermissionId(null)}
          onConfirm={confirmDelete}
          title="Удаление прав доступа"
          message="Вы уверены, что хотите удалить права доступа для этого пользователя?"
          btn1="Отмена"
          btn2="Удалить"
        />
      )}
    </div>
  )
}

export default PermissionsManager

