-- =============================================================================
-- База знаний: избранные документы пользователя
-- Дата: 29.07.2026
--
-- Применить в PostgreSQL. Безопасно запускать повторно.
-- После применения перезапустить register (порт 5000).
-- =============================================================================

CREATE TABLE IF NOT EXISTS knowledge_document_favorites (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id INT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_favorites_document
  ON knowledge_document_favorites(document_id);

COMMENT ON TABLE knowledge_document_favorites IS 'Личные избранные документы пользователей в базе знаний';
