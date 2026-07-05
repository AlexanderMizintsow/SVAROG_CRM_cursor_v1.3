-- Замещающий сотрудник для периода отсутствия
ALTER TABLE user_statuses
  ADD COLUMN IF NOT EXISTS substitute_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
