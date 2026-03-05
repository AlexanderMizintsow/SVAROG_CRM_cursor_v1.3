-- Добавить source и source_task_id в task_attachments_global_tasks
ALTER TABLE task_attachments_global_tasks
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'project' CHECK (source IN ('project', 'task')),
  ADD COLUMN IF NOT EXISTS source_task_id INT REFERENCES tasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN task_attachments_global_tasks.source IS 'Откуда добавлен: project — из карточки проекта, task — из карточки задачи';
COMMENT ON COLUMN task_attachments_global_tasks.source_task_id IS 'ID задачи, если source = task';
