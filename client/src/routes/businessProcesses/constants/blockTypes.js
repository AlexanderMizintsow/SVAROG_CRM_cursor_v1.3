/**
 * Типы блоков (узлов) бизнес-процесса для палитры и схемы.
 */
export const BLOCK_TYPES = {
  START: 'start',
  END: 'end',
  // Визуальная группировка / «дорожка» (не участвует в логике процесса)
  LANE: 'lane',
  // Заглушка/контейнер доп. данных (ключ:значение), может останавливать процесс до заполнения
  ADDITIONAL_INFO: 'additional_info',
  // Проекты (global tasks) и управление ими из БП
  CREATE_PROJECT: 'create_project',
  PROJECT_UPDATE_STATUS: 'project_update_status',
  PROJECT_ADD_COMMENT: 'project_add_comment',
  PROJECT_POST_CHAT: 'project_post_chat',
  PROJECT_ADD_RESPONSIBLES: 'project_add_responsibles',
  PROJECT_UPDATE_GOALS: 'project_update_goals',
  PROJECT_UPDATE_ADDITIONAL_INFO: 'project_update_additional_info',
  PROJECT_ADD_ATTACHMENT: 'project_add_attachment',
  PROJECT_UPDATE_TASK_STATUS: 'project_update_task_status',
  CREATE_TASK: 'create_task',
  ASSIGN_TASK: 'assign_task',
  TASK_UPDATE_STATUS: 'task_update_status',
  TASK_ADD_COMMENT: 'task_add_comment',
  TASK_ADD_ATTACHMENT: 'task_add_attachment',
  NOTIFICATION: 'notification',
  GATEWAY: 'gateway',
  GATEWAY_JOIN: 'gateway_join',
  SPLITTER: 'splitter',
  TIMER: 'timer',
  DECISION: 'decision',
}

/** Значение «Неважно» для блока Развилка-Слияние */
export const JOIN_CONDITION_ANY = 'any'

export const BLOCK_LABELS = {
  [BLOCK_TYPES.START]: 'Старт',
  [BLOCK_TYPES.END]: 'Конец',
  [BLOCK_TYPES.LANE]: 'Дорожка',
  [BLOCK_TYPES.ADDITIONAL_INFO]: 'Доп. информация',
  [BLOCK_TYPES.CREATE_PROJECT]: 'Создать проект',
  [BLOCK_TYPES.PROJECT_UPDATE_STATUS]: 'Проект: статус',
  [BLOCK_TYPES.PROJECT_ADD_COMMENT]: 'Проект: комментарий',
  [BLOCK_TYPES.PROJECT_POST_CHAT]: 'Проект: чат',
  [BLOCK_TYPES.PROJECT_ADD_RESPONSIBLES]: 'Проект: ответственные',
  [BLOCK_TYPES.PROJECT_UPDATE_GOALS]: 'Проект: цели',
  [BLOCK_TYPES.PROJECT_UPDATE_ADDITIONAL_INFO]: 'Проект: доп. инфо',
  [BLOCK_TYPES.PROJECT_ADD_ATTACHMENT]: 'Проект: вложение',
  [BLOCK_TYPES.PROJECT_UPDATE_TASK_STATUS]: 'Подзадача: статус',
  [BLOCK_TYPES.CREATE_TASK]: 'Создать задачу',
  [BLOCK_TYPES.ASSIGN_TASK]: 'Назначить задачу',
  [BLOCK_TYPES.TASK_UPDATE_STATUS]: 'Задача: статус',
  [BLOCK_TYPES.TASK_ADD_COMMENT]: 'Задача: комментарий',
  [BLOCK_TYPES.TASK_ADD_ATTACHMENT]: 'Задача: вложение',
  [BLOCK_TYPES.NOTIFICATION]: 'Уведомление',
  [BLOCK_TYPES.GATEWAY]: 'Развилка',
  [BLOCK_TYPES.GATEWAY_JOIN]: 'Развилка-Слияние',
  [BLOCK_TYPES.SPLITTER]: 'Разделитель',
  [BLOCK_TYPES.TIMER]: 'Таймер',
  [BLOCK_TYPES.DECISION]: 'Принятие решения',
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

/** Условия по задаче для блока «Развилка-Слияние» (аналог GATEWAY_CONDITIONS для задач) */
export const GATEWAY_JOIN_TASK_CONDITIONS = [
  { value: JOIN_CONDITION_ANY, label: 'Неважно' },
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
  { value: 'done_and_approved', label: 'Выполнено и одобрено' },
  { value: 'done_not_approved', label: 'Выполнено, ожидает одобрения' },
  { value: 'overdue_and_doing', label: 'Просрочена и в работе' },
  { value: 'overdue_not_done', label: 'Просрочена и не выполнена' },
  { value: 'task_overdue', label: 'Просрочена (дедлайн истёк)' },
  { value: 'task_in_time', label: 'В срок (дедлайн не истёк)' },
  { value: 'task_no_deadline', label: 'Без дедлайна' },
  { value: 'deadline_today', label: 'Дедлайн сегодня' },
  { value: 'deadline_tomorrow', label: 'Дедлайн завтра' },
  { value: 'priority_high', label: 'Приоритет: высокий' },
  { value: 'priority_medium', label: 'Приоритет: средний' },
  { value: 'priority_low', label: 'Приоритет: низкий' },
  { value: 'assignee_contains_user', label: 'Исполнители: содержит пользователя' },
]

/** Условия по проекту для блока «Развилка-Слияние» (входящий источник — Создать проект / подблоки проекта) */
export const GATEWAY_JOIN_PROJECT_CONDITIONS = [
  { value: JOIN_CONDITION_ANY, label: 'Неважно' },
  { value: 'project_status_new', label: 'Проект: статус «Новая»' },
  { value: 'project_status_in_progress', label: 'Проект: статус «В работе»' },
  { value: 'project_status_pause', label: 'Проект: статус «Пауза»' },
  { value: 'project_status_completed', label: 'Проект: статус «Завершено»' },
  { value: 'project_status_failed', label: 'Проект: статус «Провал»' },
  { value: 'project_overdue', label: 'Проект: просрочен' },
  { value: 'project_in_time', label: 'Проект: в срок' },
  { value: 'project_no_deadline', label: 'Проект: без дедлайна' },
  { value: 'project_deadline_today', label: 'Проект: дедлайн сегодня' },
  { value: 'project_deadline_tomorrow', label: 'Проект: дедлайн завтра' },
  { value: 'project_priority_high', label: 'Проект: приоритет высокий' },
  { value: 'project_priority_medium', label: 'Проект: приоритет средний' },
  { value: 'project_priority_low', label: 'Проект: приоритет низкий' },
  { value: 'project_completion_100', label: 'Проект: прогресс 100%' },
  { value: 'project_completion_not_100', label: 'Проект: прогресс не 100%' },
  { value: 'project_completion_above_50', label: 'Проект: прогресс > 50%' },
  { value: 'project_completion_above_75', label: 'Проект: прогресс > 75%' },
  { value: 'project_completion_above_90', label: 'Проект: прогресс > 90%' },
]

/** Режим создания проекта (аналог CREATE_TASK_MODES) */
export const CREATE_PROJECT_MODES = [
  { value: 'prepared', label: 'Создать проект сразу по шаблону (все поля подставляются при запуске процесса)' },
  { value: 'modal_at_runtime', label: 'При запуске открыть окно создания проекта с подстановкой шаблона' },
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
  { value: 'initiator_has_position', label: 'Инициатор: должность' },
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
  // После блока «Принятие решения»
  { value: 'decision_button_clicked', label: 'Нажата кнопка ответа' },
  // Доп. информация (ключи из блоков «Доп. информация»)
  { value: 'ai_var_true', label: 'Доп.инфо: ключ заполнен (true)' },
  { value: 'ai_var_false', label: 'Доп.инфо: ключ пустой/не задан (false)' },
  { value: 'ai_var_equals', label: 'Доп.инфо: ключ равен значению' },
  // Проект (блок «Создать проект» и подблоки)
  { value: 'project_status_new', label: 'Проект: статус «Новая»' },
  { value: 'project_status_in_progress', label: 'Проект: статус «В работе»' },
  { value: 'project_status_pause', label: 'Проект: статус «Пауза»' },
  { value: 'project_status_completed', label: 'Проект: статус «Завершено»' },
  { value: 'project_status_failed', label: 'Проект: статус «Провал»' },
  { value: 'project_overdue', label: 'Проект: просрочен (дедлайн истёк)' },
  { value: 'project_in_time', label: 'Проект: в срок (дедлайн не истёк)' },
  { value: 'project_no_deadline', label: 'Проект: без дедлайна' },
  { value: 'project_deadline_today', label: 'Проект: дедлайн сегодня' },
  { value: 'project_deadline_tomorrow', label: 'Проект: дедлайн завтра' },
  { value: 'project_priority_high', label: 'Проект: приоритет высокий' },
  { value: 'project_priority_medium', label: 'Проект: приоритет средний' },
  { value: 'project_priority_low', label: 'Проект: приоритет низкий' },
  { value: 'project_completion_100', label: 'Проект: прогресс 100% (выполнен)' },
  { value: 'project_completion_not_100', label: 'Проект: прогресс не 100%' },
  { value: 'project_completion_above', label: 'Проект: процент выполнения больше (%)' },
]

/** Группы условий развилки по источнику данных (для отображения: какой источник к какому блоку относится) */
export const GATEWAY_CONDITIONS_GROUPED = [
  { groupKey: 'initiator', groupLabel: 'Инициатор процесса', conditions: ['initiator_is_user', 'initiator_has_role', 'initiator_in_department', 'initiator_has_position'] },
  {
    groupKey: 'task',
    groupLabel: 'Задача (блоки «Создать задачу», «Назначить задачу»)',
    conditions: [
      'status_backlog', 'status_wait', 'status_doing', 'status_todo', 'status_done', 'status_pause', 'status_cancelled',
      'task_completed', 'task_not_completed', 'returned_for_rework', 'rejected_by_customer', 'approval_pending',
      'assignee_contains_user', 'task_overdue', 'task_in_time', 'task_no_deadline', 'deadline_today', 'deadline_tomorrow',
      'priority_high', 'priority_medium', 'priority_low',
      'done_and_approved', 'done_not_approved', 'overdue_and_doing', 'overdue_not_done',
    ],
  },
  {
    groupKey: 'project',
    groupLabel: 'Проект (блок «Создать проект» и подблоки)',
    conditions: [
      'project_status_new', 'project_status_in_progress', 'project_status_pause', 'project_status_completed', 'project_status_failed',
      'project_overdue', 'project_in_time', 'project_no_deadline', 'project_deadline_today', 'project_deadline_tomorrow',
      'project_priority_high', 'project_priority_medium', 'project_priority_low',
      'project_completion_100', 'project_completion_not_100', 'project_completion_above',
    ],
  },
  { groupKey: 'decision', groupLabel: 'Принятие решения', conditions: ['decision_button_clicked'] },
  { groupKey: 'ai', groupLabel: 'Доп. информация', conditions: ['ai_var_true', 'ai_var_false', 'ai_var_equals'] },
]

/** Какие группы условий показывать при выбранном источнике данных */
export const GATEWAY_CONDITION_GROUPS_BY_SOURCE = {
  initiator: ['initiator'],
  task: ['initiator', 'task', 'ai'],
  project: ['initiator', 'project', 'ai'],
  decision: ['initiator', 'decision'],
}

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

/** Режим условия в стрелке развилки: одно или несколько (И/ИЛИ) */
export const CONDITION_MODE = [
  { value: 'single', label: 'Одно условие' },
  { value: 'multiple', label: 'Несколько условий (И/ИЛИ)' },
]

/** Оператор для составных условий */
export const CONDITION_OPERATOR = [
  { value: 'and', label: 'И (все условия)' },
  { value: 'or', label: 'ИЛИ (хотя бы одно)' },
]

/** Ограничение по времени/дате для условия стрелки */
export const TIME_CONSTRAINT_TYPES = [
  { value: '', label: '— Без ограничения —' },
  { value: 'time_before', label: 'Время до (например, до 18:00)' },
  { value: 'time_after', label: 'Время после (например, после 09:00)' },
  { value: 'date_before', label: 'Дата до (например, до 2025-02-15)' },
  { value: 'date_after', label: 'Дата после' },
]

/** Режим создания задачи в блоке «Создать задачу» */
export const CREATE_TASK_MODES = [
  { value: 'prepared', label: 'Создать задачу сразу по шаблону (все поля подставляются при запуске процесса)' },
  { value: 'modal_at_runtime', label: 'При запуске открыть окно создания задачи (как в Менеджере задач) с подстановкой шаблона' },
]
