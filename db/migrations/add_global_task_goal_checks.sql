-- =============================================================================
-- Проекты: общие отметки целей (визуальный чеклист, без влияния на %)
-- Дата: 07.08.2026
--
-- Применить в PostgreSQL. Безопасно запускать повторно.
-- После применения перезапустить register (порт 5000).
-- =============================================================================

CREATE TABLE IF NOT EXISTS global_task_goal_checks (
  global_task_id INT NOT NULL REFERENCES global_tasks(id) ON DELETE CASCADE,
  goal_index INT NOT NULL CHECK (goal_index >= 0),
  is_checked BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (global_task_id, goal_index)
);

CREATE INDEX IF NOT EXISTS idx_global_task_goal_checks_task
  ON global_task_goal_checks(global_task_id);

COMMENT ON TABLE global_task_goal_checks IS
  'Общие галочки целей проекта (ориентация участников, не входит в процент)';
