import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'

export const initialColumns = {
  notifications: {
    id: 'notifications',
    name: 'Уведомления',
    items: [],
  },
  backlog: {
    id: 'backlog',
    name: 'Список задач',
    items: [],
  },
  todo: {
    id: 'todo',
    name: 'К выполнению',
    items: [],
  },
  wait: {
    id: 'wait',
    name: 'В ожидании',
    items: [],
  },
  doing: {
    id: 'doing',
    name: 'В процессе',
    items: [],
  },
  done: {
    id: 'done',
    name: 'Выполнено',
    items: [],
  },
  pause: {
    id: 'pause',
    name: 'Приостановлено',
    items: [],
  },
}

// Сортировка задач по дате создания (от новых к старым)
export const sortTasks = (tasks) => {
  return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

// Фильтрация задач по поисковому запросу
export const filterTasks = (task, term) => {
  if (!task.title && !task.description && !task.priority && !task.tags) {
    return false // Пропустить задачи без обязательных полей
  }

  const lowerTerm = term.toLowerCase()

  // Проверка, что task.tags является массивом
  const tagsMatch =
    Array.isArray(task.tags) &&
    task.tags.some((tag) => tag.title && tag.title.toLowerCase().includes(lowerTerm))

  return (
    task.title.toLowerCase().includes(lowerTerm) ||
    task.description.toLowerCase().includes(lowerTerm) ||
    task.priority.toLowerCase().includes(lowerTerm) ||
    tagsMatch
  )
}

//**************************
export const handleDragEnd = async (
  result,
  columns,
  setColumns,
  setIsDialogOpen,
  setTaskToMove
) => {
  const { destination, source } = result

  // Если карточка не перемещена или перемещена в ту же колонку, ничего не делаем
  if (!destination || destination.droppableId === source.droppableId) {
    return
  }

  if (destination.droppableId === 'pause') return
  if (source.droppableId === 'pause') {
    return
  }

  // Если карточка перемещена в колонку "Уведомления", ничего не делаем
  if (destination.droppableId === 'notifications') {
    return
  }

  // Если карточка перемещена в колонку "Выполнено"
  if (destination.droppableId === 'done') {
    const task = columns[source.droppableId].items[source.index]

    try {
      // Проверяем наличие незавершенных подзадач
      const response = await axios.get(`${API_BASE_URL}5000/api/tasks/${task.id}/has-subtasks`)

      if (response.data.has_subtasks && !response.data.all_completed) {
        // Если есть незавершенные подзадачи, показываем уведомление и отменяем перемещение
        alert('Нельзя завершить задачу, пока не завершены все подзадачи!')
        return
      }

      // Если подзадач нет или все завершены, показываем диалог подтверждения
      setTaskToMove({ task, source, destination })
      setIsDialogOpen(true)
    } catch (error) {
      console.error('Ошибка при проверке подзадач:', error)
      alert('Произошла ошибка при проверке подзадач')
    }
    return
  }

  // Если карточка перемещена в другую колонку, выполняем стандартное перемещение
  const sourceColumn = columns[source.droppableId]
  const destColumn = columns[destination.droppableId]
  const task = sourceColumn.items[source.index]

  const newSourceItems = [...sourceColumn.items]
  newSourceItems.splice(source.index, 1)

  const newDestItems = [...destColumn.items]
  newDestItems.splice(destination.index, 0, task)

  // Обновляем состояние колонок
  const newColumns = {
    ...columns,
    [source.droppableId]: {
      ...sourceColumn,
      items: newSourceItems,
    },
    [destination.droppableId]: {
      ...destColumn,
      items: newDestItems,
    },
  }
  setColumns(newColumns)

  // Обновляем статус задачи на сервере
  try {
    const response = await axios.put(`${API_BASE_URL}5000/api/tasks/${task.id}/status`, {
      status: destination.droppableId,
    })
  } catch (error) {
    console.error('Ошибка при обновлении статуса задачи:', error)
  }
}

// Обработчик подтверждения в диалоге
export const handleConfirm = async (
  taskToMove,
  columns,
  setColumns,
  setIsDialogOpen,
  setTaskToMove
) => {
  if (taskToMove) {
    const { task, source, destination } = taskToMove
    const newColumns = { ...columns }
    const destColumn = newColumns[destination.droppableId]

    // Удаляем задачу из исходной колонки
    const sourceColumn = newColumns[source.droppableId]
    sourceColumn.items.splice(source.index, 1)

    // Добавляем задачу в колонку "Выполнено"
    destColumn.items.splice(destination.index, 0, task)
    setColumns(newColumns)

    // Обновляем статус задачи на сервере
    try {
      const response = await axios.put(`${API_BASE_URL}5000/api/tasks/${task.id}/status`, {
        status: destination.droppableId,
      })
    } catch (error) {
      console.error('Ошибка при обновлении статуса задачи:', error)
    }
  }

  // Закрываем модальное окно
  setIsDialogOpen(false)
  setTaskToMove(null)
}

// Обработчик отмены в диалоге
export const handleCancel = (taskToMove, columns, setIsDialogOpen, setTaskToMove) => {
  if (taskToMove) {
    const { task, source } = taskToMove
    const newColumns = { ...columns }
    const sourceColumn = newColumns[source.droppableId]

    // Проверяем, есть ли задача уже в исходной колонке
    const taskExists = sourceColumn.items.some((existingTask) => existingTask.id === task.id)

    // Если задачи нет в исходной колонке, добавляем её
    if (!taskExists) {
      sourceColumn.items.splice(source.index, 0, task)
    }
  }

  setIsDialogOpen(false)
  setTaskToMove(null)
}

// убирает html тэги
export const stripHtmlTags = (html) => {
  return html.replace(/<[^>]+>/g, '')
}

export const getStatusLabel = (statusId) => {
  switch (statusId) {
    case 'notifications':
      return 'Уведомления'
    case 'backlog':
      return 'Задача в ожидании на исполнение'
    case 'todo':
      return 'Задача принята на исполнение'
    case 'wait':
      return 'В ожидании'
    case 'doing':
      return 'В процессе'
    case 'done':
      return 'Выполнено, ожидается подтверждение от автора задачи'
    default:
      return 'Неизвестный статус'
  }
}

export const templateOptions = [
  {
    title: 'Шаблон 1',
    description: 'Описание задачи по умолчанию для шаблона 1',
    priority: 'средний',
    tags: ['Производство'],
  },
]

// Проверяем, остались ли файлы с опасными форматами
export const dangerousFormats = [
  'application/x-msdownload', // .exe
  'application/x-sh', // .sh
  'application/x-bat', // .bat
  'application/x-csh', // .csh
  'application/x-java-archive', // .jar
  'application/x-msdos-program', // .com
  'application/x-php', // .php
  'application/x-python-code', // .py
  'application/x-shellscript', // .sh
  'application/x-perl', // .pl
  'application/x-ruby', // .rb
  'application/x-javascript', // .js
  'application/x-httpd-php', // .php
  'application/x-httpd-php-source', // .php
]

export const tagOptions = [
  'Производство',
  'CRM',
  'WEB приложение',
  'Ошибка',
  'Новый продукт',
  'Изменения',
  'Цены',
]

const chipStyles = {
  высокий: { backgroundColor: '#f8d7da', color: '#721c24' },
  средний: { backgroundColor: '#fff3cd', color: '#856404' },
  низкий: { backgroundColor: '#d4edda', color: '#155724' },
  default: { backgroundColor: '#f8f9fa', color: '#6c757d' },
}
export const getChipStyles = (priority) => chipStyles[priority] || chipStyles.default

// GlobalTaskSubtasks ********************************************************************
export const getStatusClass = (status) => {
  switch (status) {
    case 'backlog':
      return 'global-task-subtasks__status--new'
    case 'todo':
      return 'global-task-subtasks__status--in-progress'
    case 'done':
      return 'global-task-subtasks__status--completed'
    case 'doing':
      return 'global-task-subtasks__status--on-hold'
    case 'wait':
      return 'global-task-subtasks__status--cancelled'
    case 'pause':
      return 'global-task-subtasks__status--cancelled'
    default:
      return ''
  }
}

// Функция для получения класса цвета аватарки
export const getResponsibleAvatarColorClass = (color) => {
  switch (color) {
    case 'purple':
      return 'global-task-subtasks__responsible-avatar--blue'
    case 'blue':
      return 'global-task-subtasks__responsible-avatar--purple'
    case 'green':
      return 'global-task-subtasks__responsible-avatar--orange'
    default:
      return 'global-task-subtasks__responsible-avatar--default'
  }
}

export const getResponsibleColorClass = (color) => {
  switch (color) {
    case 'blue':
      return 'global-task-subtasks__responsible-avatar--blue'
    case 'purple':
      return 'global-task-subtasks__responsible-avatar--purple'
    case 'green':
      return 'global-task-subtasks__responsible-avatar--green'
    default:
      return 'global-task-subtasks__responsible-avatar--default'
  }
}

export const getStatusLabelTask = (status) => {
  switch (status) {
    case 'backlog':
      return 'Новая'
    case 'todo':
      return 'В работе'
    case 'doing':
      return 'В процессе'
    case 'wait':
      return 'В ожидании'
    case 'pause':
      return 'На паузе'
    case 'done':
      return 'Ожидает подтверждение автора'
    case 'final':
      return 'Завершено'
    default:
      return 'Неизвестно'
  }
}

export function formatDate(isoString) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}
