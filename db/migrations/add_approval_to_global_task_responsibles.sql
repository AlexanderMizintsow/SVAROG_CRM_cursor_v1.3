-- Согласование участников проекта: колонки в global_task_responsibles
-- Выполнить один раз для существующей БД (если таблица создана без этих полей).

ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;
ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS approval_comment TEXT;
ALTER TABLE global_task_responsibles ADD COLUMN IF NOT EXISTS approval_at TIMESTAMP;
