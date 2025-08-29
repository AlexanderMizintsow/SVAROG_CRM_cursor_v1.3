// Определяет оставшееся время и цвет приоритета ********************************************************************
export const getTimeAndPriority = (deadline) => {
  const now = new Date()
  const deadlineDate = new Date(deadline)

  if (deadlineDate < now) {
    return {
      remainingTime: 'Срок истек',
      priorityClass: 'high-priority',
    }
  }

  const diff = deadlineDate - now
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  const timeParts = []
  if (days > 0) timeParts.push(`${days} дн`)
  if (hours > 0) timeParts.push(`${hours} ч`)
  if (minutes > 0) timeParts.push(`${minutes} м`)

  const remainingTime = timeParts.join(', ') || 'Менее секунды'
  const totalMinutes = days * 24 * 60 + hours * 60 + minutes

  let priorityClass = ''
  if (totalMinutes <= 20) {
    priorityClass = 'high-priority'
  } else if (days >= 3) {
    priorityClass = 'low-priority'
  } else {
    priorityClass = 'medium-priority'
  }

  return { remainingTime, priorityClass }
}

// Сравнивает полученный id (ids) и participants - ФИО+id с БД существующих пользователей и отдает ФИО *******************************************
export const getUserNames = (ids, participants) => {
  if (!ids || !participants.length) return ''

  let idArray
  if (Array.isArray(ids)) {
    idArray = ids // Если ids уже массив, используем его
  } else if (typeof ids === 'number') {
    idArray = [ids] // Если число, создаем массив с одним элементом
  }

  const users = participants.filter((user) => idArray.includes(user.id))
  return users
    .map((user) => {
      const lastName = user.last_name
      const firstNameInitial = user.first_name ? user.first_name[0] + '.' : ''
      const middleNameInitial = user.middle_name
        ? user.middle_name[0] + '.'
        : ''
      return `${lastName} ${firstNameInitial}${middleNameInitial}`
    })
    .join(', ')
}
