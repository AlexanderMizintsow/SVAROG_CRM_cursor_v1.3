-- Личные шаблоны формы «Создать задачу». У каждого пользователя свои.
CREATE TABLE IF NOT EXISTS user_task_templates (
  id SERIAL PRIMARY KEY,
  owner_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  priority VARCHAR(20) DEFAULT 'низкий',
  tags TEXT DEFAULT '',
  implementer_ids JSONB NOT NULL DEFAULT '[]',
  approver_ids JSONB NOT NULL DEFAULT '[]',
  viewer_ids JSONB NOT NULL DEFAULT '[]',
  deadline_offset_days INT,
  deadline_time VARCHAR(5),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_task_templates_owner
  ON user_task_templates (owner_user_id, updated_at DESC);
