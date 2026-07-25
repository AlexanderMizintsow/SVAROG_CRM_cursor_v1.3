-- Мягкое удаление и отметка редактирования сообщений чата проектов
ALTER TABLE global_task_chat_messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP NULL;

ALTER TABLE global_task_chat_messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE global_task_chat_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

COMMENT ON COLUMN global_task_chat_messages.edited_at IS 'Время последнего редактирования текста сообщения';
COMMENT ON COLUMN global_task_chat_messages.is_deleted IS 'Мягкое удаление: сообщение скрыто, но запись сохранена';
COMMENT ON COLUMN global_task_chat_messages.deleted_at IS 'Время мягкого удаления сообщения';
