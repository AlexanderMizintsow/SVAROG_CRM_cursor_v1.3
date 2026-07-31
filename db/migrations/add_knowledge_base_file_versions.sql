-- =============================================================================
-- База знаний: версии отдельных файлов внутри папки
-- Дата: 31.07.2026
-- Безопасно запускать повторно.
-- После применения перезапустить register (порт 5000).
-- =============================================================================

CREATE TABLE IF NOT EXISTS knowledge_document_file_versions (
  id SERIAL PRIMARY KEY,
  file_id INT NOT NULL REFERENCES knowledge_document_files(id) ON DELETE CASCADE,
  document_id INT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(500),
  file_type VARCHAR(200),
  file_size BIGINT,
  file_hash VARCHAR(64),
  search_text TEXT,
  uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (file_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_kb_file_versions_file
  ON knowledge_document_file_versions(file_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_kb_file_versions_doc
  ON knowledge_document_file_versions(document_id, created_at DESC);

COMMENT ON TABLE knowledge_document_file_versions IS
  'История версий файла внутри папки/документа БЗ; актуальный файл — в knowledge_document_files';
