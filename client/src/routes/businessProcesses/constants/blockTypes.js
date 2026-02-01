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

/** Исход завершения процесса (блок Конец) — для аналитики */
export const END_OUTCOMES = [
  { value: 'SUCCESS', label: 'УСПЕХ' },
  { value: 'FAILURE', label: 'НЕУДАЧА' },
]

/** Статусы задач в приложении (для развилки) */
export const TASK_STATUSES = [
  { value: 'backlog', label: 'В очереди' },
  { value: 'wait', label: 'В ожидании (pending)' },
  { value: 'doing', label: 'В процессе (in_progress)' },
  { value: 'todo', label: 'К выполнению / на доработку' },
  { value: 'done', label: 'Выполнено (completed)' },
  { value: 'pause', label: 'Приостановлена (on_hold)' },
  { value: 'cancelled', label: 'Отменена (cancelled)' },
]

/**
 * Условия развилки: статус задачи, дедлайн, приоритет, одобрение.
 * Сервер сопоставляет по value (см. gateway.js matchCondition).
 */
export const GATEWAY_CONDITIONS = [
  { value: 'else', label: '— Иначе (ветка по умолчанию)' },
  // Инициатор процесса (если развилка после Старт или выбран режим "Инициатор")
  { value: 'initiator_is_user', label: 'Инициатор: конкретный пользователь' },
  { value: 'initiator_has_role', label: 'Инициатор: роль' },
  { value: 'initiator_in_department', label: 'Инициатор: отдел' },
  // Статус задачи
  { value: 'status_backlog', label: 'Статус: В очереди' },
  { value: 'status_wait', label: 'Статус: В ожидании (wait / pending)' },
  { value: 'status_doing', label: 'Статус: В процессе (doing / in_progress)' },
  { value: 'status_todo', label: 'Статус: К выполнению / на доработке (todo)' },
  { value: 'status_done', label: 'Статус: Выполнено (done / completed)' },
  { value: 'status_pause', label: 'Статус: Приостановлена (pause / on_hold)' },
  { value: 'status_cancelled', label: 'Статус: Отменена (cancelled)' },
  { value: 'task_completed', label: 'Задача выполнена (одобрена)' },
  { value: 'task_not_completed', label: 'Задача не выполнена' },
  { value: 'returned_for_rework', label: 'Возвращена на доработку' },
  { value: 'rejected_by_customer', label: 'Отклонена заказчиком' },
  { value: 'approval_pending', label: 'Ожидание одобрения заказчиком' },
  // Исполнители (задача)
  { value: 'assignee_contains_user', label: 'Исполнители: содержит пользователя' },
  // Дедлайн
  { value: 'task_overdue', label: 'Просрочена (дедлайн истёк)' },
  { value: 'task_in_time', label: 'В срок (дедлайн не истёк)' },
  { value: 'task_no_deadline', label: 'Без дедлайна' },
  { value: 'deadline_today', label: 'Дедлайн сегодня' },
  { value: 'deadline_tomorrow', label: 'Дедлайн завтра' },
  // Приоритет
  { value: 'priority_high', label: 'Приоритет: высокий' },
  { value: 'priority_medium', label: 'Приоритет: средний' },
  { value: 'priority_low', label: 'Приоритет: низкий' },
  // Комбинации (удобные пресеты)
  { value: 'done_and_approved', label: 'Выполнено и одобрено' },
  { value: 'done_not_approved', label: 'Выполнено, ожидает одобрения' },
  { value: 'overdue_and_doing', label: 'Просрочена и в работе' },
  { value: 'overdue_not_done', label: 'Просрочена и не выполнена' },
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

/** Режим создания задачи в блоке «Создать задачу» */
export const CREATE_TASK_MODES = [
  { value: 'prepared', label: 'Создать задачу сразу по шаблону (все поля подставляются при запуске процесса)' },
  { value: 'modal_at_runtime', label: 'При запуске открыть окно создания задачи (как в Менеджере задач) с подстановкой шаблона' },
]
