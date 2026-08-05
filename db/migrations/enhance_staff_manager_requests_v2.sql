-- Обращения к Директору: непрочитанное + чат уточнений
-- Выполнить вручную на БД CRM при деплое.

ALTER TABLE staff_manager_requests
  ADD COLUMN IF NOT EXISTS author_has_unread BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE staff_manager_requests
  ADD COLUMN IF NOT EXISTS recipient_has_unread BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS staff_manager_request_messages (
  id SERIAL PRIMARY KEY,
  request_id INT NOT NULL REFERENCES staff_manager_requests(id) ON DELETE CASCADE,
  author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_smr_messages_request
  ON staff_manager_request_messages(request_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_smr_author_unread
  ON staff_manager_requests(from_user_id, author_has_unread)
  WHERE author_has_unread = TRUE;

CREATE INDEX IF NOT EXISTS idx_smr_recipient_unread
  ON staff_manager_requests(to_user_id, recipient_has_unread)
  WHERE recipient_has_unread = TRUE;
