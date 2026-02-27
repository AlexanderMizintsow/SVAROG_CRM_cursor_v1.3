-- Идеи и предложения пользователей по улучшению приложения
CREATE TABLE IF NOT EXISTS app_ideas (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  file_path VARCHAR(1000) DEFAULT NULL,
  file_name VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_applied BOOLEAN DEFAULT FALSE,
  admin_comment TEXT,
  applied_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_ideas_user_id ON app_ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_app_ideas_created_at ON app_ideas(created_at DESC);
