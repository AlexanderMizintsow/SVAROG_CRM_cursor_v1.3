/**
 * Типы блоков (узлов) бизнес-процесса для палитры и схемы.
 */
export const BLOCK_TYPES = {
  START: 'start',
  END: 'end',
  CREATE_TASK: 'create_task',
  ASSIGN_TASK: 'assign_task',
  NOTIFICATION: 'notification',
  GATEWAY: 'gateway',
  TIMER: 'timer',
}

export const BLOCK_LABELS = {
  [BLOCK_TYPES.START]: 'Старт',
  [BLOCK_TYPES.END]: 'Конец',
  [BLOCK_TYPES.CREATE_TASK]: 'Создать задачу',
  [BLOCK_TYPES.ASSIGN_TASK]: 'Назначить задачу',
  [BLOCK_TYPES.NOTIFICATION]: 'Уведомление',
  [BLOCK_TYPES.GATEWAY]: 'Развилка',
  [BLOCK_TYPES.TIMER]: 'Таймер',
}

export const GATEWAY_CONDITIONS = [
  { value: 'task_completed', label: 'Задача выполнена' },
  { value: 'task_not_completed', label: 'Задача не выполнена' },
  { value: 'task_overdue', label: 'Просрочена' },
  { value: 'task_in_time', label: 'В срок' },
  { value: 'approval_pending', label: 'Ожидание одобрения' },
  { value: 'else', label: 'Иначе' },
]

export const INITIATOR_TYPES = [
  { value: 'current_user', label: 'Текущий пользователь' },
  { value: 'fixed_user', label: 'Конкретный пользователь' },
  { value: 'by_role', label: 'По роли' },
]

export const RECIPIENT_SOURCES = [
  { value: 'users', label: 'Конкретные пользователи' },
  { value: 'department', label: 'Отдел' },
  { value: 'role', label: 'Роль' },
  { value: 'initiator', label: 'Инициатор процесса' },
  { value: 'task_assignee', label: 'Исполнитель задачи из блока' },
]

export const ASSIGNEE_SOURCES = [
  { value: 'users', label: 'Пользователи' },
  { value: 'department', label: 'Отдел' },
  { value: 'role', label: 'Роль' },
]

export const TIMER_TYPES = [
  { value: 'interval', label: 'Интервал (минуты/часы/дни)' },
  { value: 'until_date', label: 'До даты/времени' },
]

export const TIMER_UNITS = [
  { value: 'minutes', label: 'Минуты' },
  { value: 'hours', label: 'Часы' },
  { value: 'days', label: 'Дни' },
]

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Низкий' },
  { value: 'normal', label: 'Обычный' },
  { value: 'high', label: 'Высокий' },
]
