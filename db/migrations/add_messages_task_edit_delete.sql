-- Мягкое удаление и отметка редактирования сообщений чата задач
ALTER TABLE messages_task
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP NULL;

ALTER TABLE messages_task
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE messages_task
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

COMMENT ON COLUMN messages_task.edited_at IS 'Время последнего редактирования текста сообщения';
COMMENT ON COLUMN messages_task.is_deleted IS 'Мягкое удаление: сообщение скрыто, но запись сохранена';
COMMENT ON COLUMN messages_task.deleted_at IS 'Время мягкого удаления сообщения';
