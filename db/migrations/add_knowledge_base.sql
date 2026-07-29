-- =============================================================================
-- База знаний отделов (knowledge base)
-- Дата: 29.07.2026
--
-- Применить в PostgreSQL. Безопасно запускать повторно.
-- После применения перезапустить register (порт 5000).
--
-- FUTURE: поиск технической информации в описаниях задач (отдельная фича).
-- =============================================================================

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL DEFAULT 'other'
    CHECK (category IN ('regulations', 'commerce', 'technical', 'templates', 'other')),
  owner_department_id INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  visibility_mode VARCHAR(32) NOT NULL DEFAULT 'all'
    CHECK (visibility_mode IN ('all', 'owner_department', 'segments')),
  file_url TEXT NOT NULL,
  file_name VARCHAR(500),
  file_type VARCHAR(200),
  file_size BIGINT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  search_text TEXT,
  uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_document_segments (
  id SERIAL PRIMARY KEY,
  document_id INT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  segment_type VARCHAR(32) NOT NULL CHECK (segment_type IN ('department', 'user')),
  segment_value VARCHAR(64) NOT NULL,
  UNIQUE (document_id, segment_type, segment_value)
);

CREATE INDEX IF NOT EXISTS idx_kb_docs_owner_dept
  ON knowledge_documents(owner_department_id);

CREATE INDEX IF NOT EXISTS idx_kb_docs_category
  ON knowledge_documents(category);

CREATE INDEX IF NOT EXISTS idx_kb_docs_created
  ON knowledge_documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_docs_archived
  ON knowledge_documents(is_archived);

CREATE INDEX IF NOT EXISTS idx_kb_segments_doc
  ON knowledge_document_segments(document_id);

CREATE INDEX IF NOT EXISTS idx_kb_segments_type_value
  ON knowledge_document_segments(segment_type, segment_value);

COMMENT ON TABLE knowledge_documents IS 'Документы базы знаний по отделам';
COMMENT ON COLUMN knowledge_documents.visibility_mode IS 'all | owner_department | segments';
COMMENT ON COLUMN knowledge_documents.search_text IS 'Текст для поиска (извлечение из файлов — этап 2, без OCR)';
