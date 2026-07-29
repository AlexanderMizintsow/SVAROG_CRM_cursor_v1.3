-- =============================================================================
-- База знаний: версии файлов, хеш-дубли, аудит просмотров/скачиваний
-- Дата: 29.07.2026
-- Безопасно запускать повторно.
-- =============================================================================

ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);

ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS version_number INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_kb_docs_file_hash
  ON knowledge_documents(file_hash)
  WHERE file_hash IS NOT NULL AND is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_kb_docs_title_dept
  ON knowledge_documents(owner_department_id, lower(title))
  WHERE is_archived = FALSE;

-- История предыдущих файлов (актуальный файл всегда в knowledge_documents)
CREATE TABLE IF NOT EXISTS knowledge_document_versions (
  id SERIAL PRIMARY KEY,
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
  UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_kb_versions_doc
  ON knowledge_document_versions(document_id, version_number DESC);

-- Аудит: просмотр / скачивание
CREATE TABLE IF NOT EXISTS knowledge_document_events (
  id SERIAL PRIMARY KEY,
  document_id INT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('view', 'download')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_events_doc
  ON knowledge_document_events(document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_events_user
  ON knowledge_document_events(user_id, created_at DESC);

COMMENT ON COLUMN knowledge_documents.file_hash IS 'SHA-256 содержимого файла для контроля дублей';
COMMENT ON COLUMN knowledge_documents.version_number IS 'Номер текущей версии файла';
COMMENT ON TABLE knowledge_document_versions IS 'Предыдущие версии файла; в списке и поиске — только актуальная';
COMMENT ON TABLE knowledge_document_events IS 'Кто открыл/скачал документ';
