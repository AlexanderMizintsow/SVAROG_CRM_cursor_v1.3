-- Фаза 1 аналитики: поля и индексы для истории и аналитики по проектам, задачам, отделам и сотрудникам

-- 1. Задачи: дата фактического завершения (когда исполнитель отметил выполненной)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;
COMMENT ON COLUMN tasks.completed_at IS 'Дата и время отметки задачи как выполненной исполнителем (для аналитики и отчётов)';

-- 2. Согласование подзадачи: дата ответа автора (одобрение/отклонение)
ALTER TABLE task_approvals ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP NULL;
COMMENT ON COLUMN task_approvals.responded_at IS 'Дата и время ответа согласующего (одобрение или отправка на доработку)';

-- 3. Индексы для гибкой выборки истории проектов (по дате, пользователю, типу события)
CREATE INDEX IF NOT EXISTS idx_global_task_history_created_at ON global_task_history(created_at);
CREATE INDEX IF NOT EXISTS idx_global_task_history_created_by ON global_task_history(created_by);
CREATE INDEX IF NOT EXISTS idx_global_task_history_event_type ON global_task_history(event_type);

-- 4. Индексы для гибкой выборки истории задач (по дате, пользователю)
CREATE INDEX IF NOT EXISTS idx_task_history_change_timestamp ON task_history(change_timestamp);
CREATE INDEX IF NOT EXISTS idx_task_history_changed_by ON task_history(changed_by);

-- 5. Индекс для выборки задач по дате завершения (аналитика «время выполнения»)
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL;

-- 6. Индекс для выборки по дате ответа согласующего
CREATE INDEX IF NOT EXISTS idx_task_approvals_responded_at ON task_approvals(responded_at) WHERE responded_at IS NOT NULL;
