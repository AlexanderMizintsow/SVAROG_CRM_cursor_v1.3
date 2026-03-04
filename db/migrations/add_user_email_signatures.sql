-- Подпись к письму для каждого пользователя (проекты)
CREATE TABLE IF NOT EXISTS user_email_signatures (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  signature_text TEXT DEFAULT '',
  signature_image TEXT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_email_signatures_user_id ON user_email_signatures(user_id);
