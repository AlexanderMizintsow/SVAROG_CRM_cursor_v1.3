-- Чат по рекламации (mobile): тред на черновик, сообщения, только изображения во вложениях.

CREATE TABLE IF NOT EXISTS mobile_complaint_chat_threads (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  draft_id BIGINT NOT NULL REFERENCES mobile_complaint_drafts(id) ON DELETE CASCADE,
  reminder_id INTEGER REFERENCES reminders(id) ON DELETE SET NULL,
  manager_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  rejected_by_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_complaint_chat_threads_company
  ON mobile_complaint_chat_threads (company_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mobile_complaint_chat_threads_reminder
  ON mobile_complaint_chat_threads (reminder_id);

CREATE TABLE IF NOT EXISTS mobile_complaint_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES mobile_complaint_chat_threads(id) ON DELETE CASCADE,
  author_role VARCHAR(16) NOT NULL CHECK (author_role IN ('manager', 'dealer')),
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_complaint_chat_messages_thread
  ON mobile_complaint_chat_messages (thread_id, id ASC);

CREATE TABLE IF NOT EXISTS mobile_complaint_chat_message_images (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES mobile_complaint_chat_messages(id) ON DELETE CASCADE,
  stored_rel_path VARCHAR(600) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_complaint_chat_msg_images_message
  ON mobile_complaint_chat_message_images (message_id, sort_order);
