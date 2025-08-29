// GlobalTaskCard.jsx ***************************************************************************
export const getPriorityClass = (p) => {
  switch (p) {
    case 'high':
      return 'global-task-card--priority-high'
    case 'medium':
      return 'global-task-card--priority-medium'
    case 'low':
      return 'global-task-card--priority-low'
    default:
      return ''
  }
}

export const getPriorityLabel = (p) => {
  switch (p) {
    case 'high':
      return 'Высокий приоритет'
    case 'medium':
      return 'Средний приоритет'
    case 'low':
      return 'Низкий приоритет'
    default:
      return ''
  }
}

export const getPriorityColorClass = (p) => {
  switch (p) {
    case 'high':
      return 'global-task-card__priority-label--high'
    case 'medium':
      return 'global-task-card__priority-label--medium'
    case 'low':
      return 'global-task-card__priority-label--low'
    default:
      return 'global-task-card__priority-label--default'
  }
}

export const getResponsibleColorClass = (color) => {
  switch (color) {
    case 'blue':
      return 'global-task-card__responsible-avatar--blue'
    case 'purple':
      return 'global-task-card__responsible-avatar--purple'
    case 'green':
      return 'global-task-card__responsible-avatar--green'
    default:
      return 'global-task-card__responsible-avatar--default'
  }
}

export const getResponsibleTextColorClass = (color) => {
  switch (color) {
    case 'blue':
      return 'global-task-card__responsible-role--blue'
    case 'purple':
      return 'global-task-card__responsible-role--purple'
    case 'green':
      return 'global-task-card__responsible-role--green'
    default:
      return 'global-task-card__responsible-role--default'
  }
}

export const getRemainingDays = (deadline) => {
  if (!deadline) return 'Дата не указана'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
    const dateParts = deadline.split('T')
    const datePart = dateParts[0]

    const dateComponents = datePart.split('-')
    const [year, month, day] = dateComponents

    if (!day || !month || !year) {
      console.error('Некорректный формат даты:', deadline)
      return 'Некорректный формат даты'
    }

    const isoDateString = `${year}-${month}-${day}`
    const dueDate = new Date(isoDateString)

    if (isNaN(dueDate.getTime())) {
      return 'Некорректная дата (объект Date)'
    }

    dueDate.setHours(0, 0, 0, 0)
    const diffTime = dueDate - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > 0) {
      return `${diffDays} дней`
    } else if (diffDays === 0) {
      return 'Сегодня'
    } else {
      return 'Просрочено'
    }
  } catch (error) {
    console.error('Ошибка при парсинге даты:', error)
    return 'Ошибка парсинга даты'
  }
}

//  ResponsibleSelector.jsx ***************************************************************************
export const generateRandomAvatarColorClass = () => {
  const colorClasses = [
    'create-global-task-form__responsible-avatar--blue',
    'create-global-task-form__responsible-avatar--purple',
    'create-global-task-form__responsible-avatar--green',
    'create-global-task-form__responsible-avatar--orange',
    'create-global-task-form__responsible-avatar--default',
  ]
  const randomIndex = Math.floor(Math.random() * colorClasses.length)
  return colorClasses[randomIndex]
}

export const generateRandomBackgroundColorClass = () => {
  const colorClasses = [
    'create-global-task-form__responsible-item--bg-blue',
    'create-global-task-form__responsible-item--bg-purple',
    'create-global-task-form__responsible-item--bg-green',
    'create-global-task-form__responsible-item--bg-orange',
    'create-global-task-form__responsible-item--bg-gray',
  ]
  const randomIndex = Math.floor(Math.random() * colorClasses.length)
  return colorClasses[randomIndex]
}

export const generateInitials = (firstName, lastName) => {
  if (!lastName && !firstName) return ''
  if (!lastName) return firstName[0]?.toUpperCase() || ''
  if (!firstName) return lastName[0]?.toUpperCase() || ''
  return `${lastName[0].toUpperCase()}${firstName[0].toUpperCase()}`
}

// CreateGlobalTaskForm.jsx ***************************************************************************
export const responsibleRolesList = [
  'Лидер проекта',
  'Руководитель отдела',
  'IT поддержка',
  'Участник',
]
