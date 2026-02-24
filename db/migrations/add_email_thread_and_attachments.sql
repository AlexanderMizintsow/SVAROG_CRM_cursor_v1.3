-- Переписка в итоговых решениях: одно решение = одна ветка писем (thread)
ALTER TABLE global_task_final_solutions ADD COLUMN IF NOT EXISTS thread_messages JSONB DEFAULT NULL;
-- Связь отправленного письма с конкретным итогом (для добавления ответов в ту же ветку)
ALTER TABLE project_sent_emails ADD COLUMN IF NOT EXISTS final_solution_id INT REFERENCES global_task_final_solutions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_project_sent_emails_final_solution ON project_sent_emails(final_solution_id);

-- Вложения из писем (ответы): храним на диске, ссылка в thread_messages
CREATE TABLE IF NOT EXISTS project_email_attachments (
  id SERIAL PRIMARY KEY,
  final_solution_id INT NOT NULL REFERENCES global_task_final_solutions(id) ON DELETE CASCADE,
  message_index INT NOT NULL,
  filename VARCHAR(500) NOT NULL,
  content_type VARCHAR(255) DEFAULT 'application/octet-stream',
  file_path VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_email_attachments_solution ON project_email_attachments(final_solution_id);
