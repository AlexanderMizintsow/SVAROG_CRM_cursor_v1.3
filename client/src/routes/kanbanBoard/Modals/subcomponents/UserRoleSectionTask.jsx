import { LuDelete } from 'react-icons/lu'
import styles from '../AddModal.module.scss'
import { useMemo, useState } from 'react'
import { getAbsenceLabel } from '../../../../utils/userAbsenceUtils'

const UserRoleSectionTask = ({
  title,
  roleKey,
  selectedUser,
  setSelectedUser,
  taskData,
  users,
  remainingUsersForRole,
  handleAddUser,
  handleRemoveUser,
  absencesMap = {},
  absenceMeta = [],
}) => {
  const [searchValue, setSearchValue] = useState('')

  const getUserFullName = (user) =>
    `${user.last_name || ''} ${user.first_name || ''} ${user.middle_name || ''}`
      .replace(/\s+/g, ' ')
      .trim()

  const getDepartmentLabel = (user) =>
    user?.department?.name || user?.department_name || user?.department || ''

  const getPositionLabel = (user) =>
    user?.position?.name || user?.position_name || user?.position || ''

  const notesByEffectiveId = useMemo(() => {
    const map = {}
    ;(absenceMeta || [])
      .filter((entry) => entry.roleKey === roleKey)
      .forEach((entry) => {
        map[String(entry.effectiveId)] = entry.note || null
      })
    return map
  }, [absenceMeta, roleKey])

  const filteredUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    const availableUsers = remainingUsersForRole(roleKey)
    if (!query) return availableUsers

    return availableUsers.filter((user) => {
      const haystack = [
        getUserFullName(user),
        getDepartmentLabel(user),
        getPositionLabel(user),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [searchValue, remainingUsersForRole, roleKey])

  return (
    <div className={styles.border}>
      <p className={styles.titleInput}>{title}</p>
      <div className={styles.inputSection}>
        <div>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Поиск: фамилия, должность, отдел"
            className={styles.userSearchInput}
          />
          <select
            value={selectedUser}
            onChange={(e) => {
              const value = e.target.value
              setSelectedUser(value)
              if (value) {
                handleAddUser(roleKey, value, setSelectedUser)
              }
            }}
            className={styles.userSelectCompact}
          >
            <option value="">Выберите {title.toLowerCase()}</option>
            {filteredUsers.map((user) => {
              const absence = absencesMap[Number(user.id)]
              const absenceLabel = getAbsenceLabel(absence)
              return (
                <option key={user.id} value={user.id}>
                  {getUserFullName(user)}
                  {absenceLabel ? ` — ${absenceLabel}` : ''}
                </option>
              )
            })}
          </select>
          <div className={styles.addPerson}>
            Добавленные {title.toLowerCase()}:
            {taskData[roleKey].map((userId) => {
              const user = users.find((u) => String(u.id) === String(userId))
              const note = notesByEffectiveId[String(userId)]
              return user ? (
                <div
                  style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap' }}
                  key={userId}
                >
                  <span>{getUserFullName(user)}</span>
                  <LuDelete
                    style={{ marginLeft: 'auto' }}
                    title="Удалить"
                    onClick={() => handleRemoveUser(roleKey, userId)}
                    className={styles.removeFile}
                  />
                  {note ? <span className={styles.absenceNote}>{note}</span> : null}
                </div>
              ) : null
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserRoleSectionTask
