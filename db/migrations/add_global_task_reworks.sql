-- =============================================================================
-- Проекты: доработки при 100% (участвуют в расчёте процента)
-- Дата: 07.08.2026
--
-- Применить в PostgreSQL. Безопасно запускать повторно.
-- После применения перезапустить register (порт 5000).
-- =============================================================================

CREATE TABLE IF NOT EXISTS global_task_reworks (
  id SERIAL PRIMARY KEY,
  global_task_id INT NOT NULL REFERENCES global_tasks(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  assignee_user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  completed_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT global_task_reworks_comment_nonempty CHECK (length(trim(comment)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_global_task_reworks_task
  ON global_task_reworks(global_task_id);

CREATE INDEX IF NOT EXISTS idx_global_task_reworks_assignee
  ON global_task_reworks(assignee_user_id);

COMMENT ON TABLE global_task_reworks IS
  'Доработки проекта: обязательный комментарий + исполнитель; учитываются в % выполнения';
