# Примеры запросов для аналитики (Фаза 1)

После применения миграции `db/migrations/add_analytics_phase1.sql` и доработок кода ниже приведены примеры выборок для будущего компонента отчётов. Связь с отделами и руководителями: `users.department_id`, `users.supervisor_id`, `departments.head_user_id`.

---

## 1. Проекты (global_tasks + global_task_history)

### 1.1 Все события по проекту (дата, время, пользователь, тип)
```sql
SELECT h.id, h.global_task_id, h.event_type, h.description, h.created_at,
       u.first_name, u.last_name, u.department_id,
       d.name AS department_name
FROM global_task_history h
LEFT JOIN users u ON h.created_by = u.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE h.global_task_id = $1
ORDER BY h.created_at DESC;
```

### 1.2 События по отделам за период
```sql
SELECT d.name AS department_name,
       h.event_type,
       COUNT(*) AS cnt
FROM global_task_history h
JOIN users u ON h.created_by = u.id
JOIN departments d ON u.department_id = d.id
WHERE h.created_at BETWEEN $1 AND $2
GROUP BY d.id, d.name, h.event_type
ORDER BY d.name, h.event_type;
```

### 1.3 Кто и когда удалял/ставил на паузу/завершал проекты
```sql
SELECT h.event_type, h.description, h.created_at,
       u.first_name, u.last_name, d.name AS department_name
FROM global_task_history h
LEFT JOIN users u ON h.created_by = u.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE h.event_type IN ('удаление', 'Пауза', 'Завершено', 'Провал', 'Продолжить')
  AND h.created_at BETWEEN $1 AND $2
ORDER BY h.created_at DESC;
```

### 1.4 Добавление документов по проектам (кто, когда, имя файла)
```sql
SELECT h.global_task_id, h.description, h.created_at, h.data,
       u.first_name, u.last_name
FROM global_task_history h
LEFT JOIN users u ON h.created_by = u.id
WHERE h.event_type = 'документ'
  AND h.created_at BETWEEN $1 AND $2;
```

---

## 2. Задачи (tasks + task_history + task_approvals)

### 2.1 Время выполнения задачи (создание → завершение исполнителем)
```sql
SELECT t.id, t.title, t.created_at, t.completed_at,
       EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 3600 AS hours_to_complete,
       t.created_by, t.global_task_id
FROM tasks t
WHERE t.completed_at IS NOT NULL
  AND t.created_at BETWEEN $1 AND $2;
```

### 2.2 Время от «выполнено исполнителем» до «одобрено автором»
```sql
SELECT t.id, t.title, t.completed_at AS marked_done_at,
       tap.responded_at AS approved_at,
       EXTRACT(EPOCH FROM (tap.responded_at - t.completed_at)) / 3600 AS hours_to_approve,
       tap.approver_id, tap.is_approved
FROM tasks t
JOIN task_approvals tap ON t.id = tap.task_id
WHERE t.completed_at IS NOT NULL AND tap.responded_at IS NOT NULL
  AND tap.is_approved = true
  AND t.completed_at BETWEEN $1 AND $2;
```

### 2.3 История по одной задаче (создание, выполнение, одобрение/доработка, просрочка)
```sql
SELECT th.id, th.change_description, th.change_timestamp,
       u.first_name, u.last_name, u.department_id,
       d.name AS department_name
FROM task_history th
LEFT JOIN users u ON th.changed_by = u.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE th.task_id = $1
ORDER BY th.change_timestamp DESC;
```

### 2.4 Просроченные задачи (факт фиксации в истории)
```sql
SELECT t.id, t.title, t.deadline, th.change_timestamp AS overdue_detected_at,
       t.created_by, t.global_task_id
FROM task_history th
JOIN tasks t ON t.id = th.task_id
WHERE th.change_description = 'Дедлайн истёк'
  AND th.change_timestamp BETWEEN $1 AND $2
ORDER BY th.change_timestamp DESC;
```

### 2.5 Статистика по сотрудникам: сколько задач завершено, среднее время
```sql
SELECT u.id, u.first_name, u.last_name, d.name AS department_name,
       COUNT(t.id) AS tasks_completed,
       AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 3600) AS avg_hours_to_complete
FROM tasks t
JOIN task_assignments ta ON t.id = ta.task_id AND ta.user_id = t.created_by
JOIN users u ON u.id = ta.user_id
LEFT JOIN departments d ON u.department_id = d.id
WHERE t.completed_at IS NOT NULL
  AND t.completed_at BETWEEN $1 AND $2
GROUP BY u.id, u.first_name, u.last_name, d.name;
```

### 2.6 По отделам: количество задач, выполненных и с просрочкой
```sql
SELECT d.id, d.name AS department_name,
       COUNT(DISTINCT t.id) FILTER (WHERE t.completed_at IS NOT NULL) AS completed_count,
       COUNT(DISTINCT th.task_id) FILTER (WHERE th.change_description = 'Дедлайн истёк') AS overdue_count
FROM tasks t
JOIN task_assignments ta ON t.id = ta.task_id
JOIN users u ON u.id = ta.user_id
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN task_history th ON th.task_id = t.id AND th.change_description = 'Дедлайн истёк'
WHERE t.created_at BETWEEN $1 AND $2
GROUP BY d.id, d.name;
```

### 2.7 Руководители отделов и активность подчинённых (через supervisor_id)
```sql
SELECT sup.id AS supervisor_id, sup.first_name AS sup_first_name, sup.last_name AS sup_last_name,
       d.name AS department_name,
       u.id AS user_id, u.first_name, u.last_name,
       COUNT(t.id) FILTER (WHERE t.completed_at IS NOT NULL) AS completed_tasks
FROM users u
JOIN users sup ON u.supervisor_id = sup.id
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN task_assignments ta ON ta.user_id = u.id
LEFT JOIN tasks t ON t.id = ta.task_id AND t.completed_at BETWEEN $1 AND $2
WHERE u.supervisor_id IS NOT NULL
GROUP BY sup.id, sup.first_name, sup.last_name, d.name, u.id, u.first_name, u.last_name;
```

---

## 3. Сводки для дашборда

### 3.1 Завершённые и незавершённые задачи на момент отчёта
```sql
SELECT
  COUNT(*) FILTER (WHERE t.completed_at IS NOT NULL) AS completed,
  COUNT(*) FILTER (WHERE t.completed_at IS NULL AND (t.deadline IS NULL OR t.deadline >= CURRENT_TIMESTAMP)) AS in_progress,
  COUNT(*) FILTER (WHERE t.completed_at IS NULL AND t.deadline < CURRENT_TIMESTAMP) AS overdue
FROM tasks t
WHERE t.global_task_id IS NOT NULL;  -- при необходимости сузить по проектам
```

### 3.2 Соответствие срокам (задачи с дедлайном: уложились или просрочили)
```sql
SELECT
  COUNT(*) FILTER (WHERE t.completed_at IS NOT NULL AND t.completed_at <= t.deadline) AS on_time,
  COUNT(*) FILTER (WHERE t.completed_at IS NOT NULL AND t.completed_at > t.deadline) AS late
FROM tasks t
WHERE t.deadline IS NOT NULL AND t.completed_at IS NOT NULL;
```

---

## 4. Бизнес-процессы (уже есть в БД)

- **Время старта/окончания:** `bp_process_instances.started_at`, `finished_at`.
- **Время по блокам:** `bp_node_execution_log.entered_at`, `exited_at`; длительность = `exited_at - entered_at`.
- Агрегации по `instance_id`, `node_id`, периоду — без доработок БД.

---

Все выборки можно фильтровать по периоду (`created_at`, `change_timestamp`, `completed_at`, `responded_at`), по `department_id`, по `user_id` / `created_by` / `changed_by` и комбинировать для переключения аналитики в UI.
