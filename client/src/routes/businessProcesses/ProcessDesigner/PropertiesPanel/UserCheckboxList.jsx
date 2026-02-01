import './UserCheckboxList.scss'

/**
 * Список пользователей с чекбоксами для выбора.
 * Клик по строке переключает выбор.
 * Используется в блоках: Старт, Создать задачу, Уведомление, Назначить задачу.
 */
const formatUserName = (u) => {
  const parts = [u.last_name, u.first_name, u.middle_name].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : u.username || `ID ${u.id}`
}

const UserCheckboxList = ({ users = [], selectedIds = [], onChange, maxHeight = 180 }) => {
  const selectedSet = new Set(Array.isArray(selectedIds) ? selectedIds.map(Number) : [])

  const handleToggle = (e, userId) => {
    e.preventDefault()
    e.stopPropagation()
    const id = Number(userId)
    const next = selectedSet.has(id)
      ? selectedIds.filter((x) => Number(x) !== id)
      : [...selectedIds, id]
    onChange(next)
  }

  if (!Array.isArray(users) || users.length === 0) {
    return <p className="properties-panel__hint">Нет доступных пользователей</p>
  }

  return (
    <div
      className="user-checkbox-list"
      role="listbox"
      aria-multiselectable="true"
      style={{
        maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
        minHeight: '80px',
      }}
    >
      {users.map((u) => {
        const id = Number(u.id)
        const checked = selectedSet.has(id)
        return (
          <div
            key={u.id}
            role="option"
            aria-selected={checked}
            className={`user-checkbox-list__row ${checked ? 'user-checkbox-list__row--checked' : ''}`}
            onClick={(e) => handleToggle(e, id)}
          >
            <span className="user-checkbox-list__check">{checked ? '✓' : ''}</span>
            <span className="user-checkbox-list__name">{formatUserName(u)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default UserCheckboxList
