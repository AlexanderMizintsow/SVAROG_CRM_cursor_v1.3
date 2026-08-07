-- =============================================================================
-- База знаний: отметки «обнаружена ошибка» на документах/файлах
-- Дата: 07.08.2026
--
-- Применить в PostgreSQL. Безопасно запускать повторно.
-- После применения перезапустить register (порт 5000).
-- =============================================================================

CREATE TABLE IF NOT EXISTS knowledge_document_error_marks (
  id SERIAL PRIMARY KEY,
  document_id INT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  -- NULL = отметка на документе целиком (одиночный файл);
  -- иначе — файл внутри папки
  file_id INT NULL REFERENCES knowledge_document_files(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT knowledge_document_error_marks_comment_nonempty
    CHECK (length(trim(comment)) > 0)
);

-- Один пользователь — одна отметка на цель (документ или файл в папке)
CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_error_marks_unique_user_target
  ON knowledge_document_error_marks (document_id, COALESCE(file_id, 0), created_by);

CREATE INDEX IF NOT EXISTS idx_kb_error_marks_document
  ON knowledge_document_error_marks(document_id);

CREATE INDEX IF NOT EXISTS idx_kb_error_marks_file
  ON knowledge_document_error_marks(file_id)
  WHERE file_id IS NOT NULL;

COMMENT ON TABLE knowledge_document_error_marks IS
  'Отметки «обнаружена ошибка» в документах базы знаний (веб)';
