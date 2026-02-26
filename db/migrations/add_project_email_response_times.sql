-- Время ответа на письмо по проекту: для аналитики «Почта» (кто сколько ждал ответа, по автору письма и отделу)
-- Один ответ на одно отправленное письмо = одна запись (sent_message_id = project_sent_emails.message_id)
CREATE TABLE IF NOT EXISTS project_email_response_times (
  sent_message_id VARCHAR(512) PRIMARY KEY,
  reply_received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_email_response_times_reply_at ON project_email_response_times(reply_received_at);
COMMENT ON TABLE project_email_response_times IS 'Момент получения ответа на отправленное из проекта письмо (для аналитики времени ожидания по почте)';
