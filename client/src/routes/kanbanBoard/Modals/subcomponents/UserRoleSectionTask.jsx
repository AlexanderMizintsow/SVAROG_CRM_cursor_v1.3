import { LuDelete } from 'react-icons/lu'
import { IoPersonAddOutline } from 'react-icons/io5'
import styles from '../AddModal.module.scss'

const UserRoleSectionTask = ({
  title,
  roleKey,
  selectedUser,
  setSelectedUser,
  isSelected,
  setIsSelected,
  taskData,
  users,
  remainingUsersForRole,
  handleAddUser,
  handleRemoveUser,
  IconComponent = IoPersonAddOutline,
}) => {
  return (
    <div className={styles.border}>
      <p className={styles.titleInput}>{title}</p>
      <div className={styles.inputSection}>
        <div>
          <select
            value={selectedUser}
            onChange={(e) => {
              setSelectedUser(e.target.value)
              setIsSelected(e.target.value !== '')
            }}
          >
            <option value="">Выберите {title.toLowerCase()}</option>
            {remainingUsersForRole(roleKey).map((user) => (
              <option key={user.id} value={user.id}>
                {`${user.last_name} ${user.first_name} ${
                  user.middle_name || ''
                }`}
              </option>
            ))}
          </select>
          <div className={styles.addPerson}>
            Добавленные {title.toLowerCase()}:
            {taskData[roleKey].map((userId) => {
              const user = users.find((u) => String(u.id) === String(userId))
              return user ? (
                <div
                  style={{ display: 'flex', alignItems: 'center' }}
                  key={userId}
                >
                  {`${user.last_name} ${user.first_name} ${
                    user.middle_name || ''
                  }`}
                  <LuDelete
                    style={{ marginLeft: 'auto' }}
                    title="Удалить"
                    onClick={() => handleRemoveUser(roleKey, userId)}
                    className={styles.removeFile}
                  />
                </div>
              ) : null
            })}
          </div>
        </div>
        <div>
          <IconComponent
            title="Добавить в список"
            className={`${styles.addButton} ${styles['submit-button']} ${
              isSelected ? styles.pulse : ''
            }`}
            onClick={() =>
              handleAddUser(roleKey, selectedUser, setSelectedUser)
            }
          />
        </div>
      </div>
    </div>
  )
}

export default UserRoleSectionTask
