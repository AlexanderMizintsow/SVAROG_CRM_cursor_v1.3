-- =============================================================================
-- База знаний: папки (комплекты) с несколькими файлами
-- Дата: 31.07.2026
-- Безопасно запускать повторно.
-- После применения перезапустить register (порт 5000) и mobile_staff_app.
-- =============================================================================

-- Папка = документ с is_folder=true и несколькими записями в knowledge_document_files
ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS is_folder BOOLEAN NOT NULL DEFAULT FALSE;

-- У папки без файлов / после удаления всех file_url может быть пустым
ALTER TABLE knowledge_documents
  ALTER COLUMN file_url DROP NOT NULL;

CREATE TABLE IF NOT EXISTS knowledge_document_files (
  id SERIAL PRIMARY KEY,
  document_id INT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(500),
  file_type VARCHAR(200),
  file_size BIGINT,
  file_hash VARCHAR(64),
  search_text TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  version_number INT NOT NULL DEFAULT 1,
  uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_doc_files_document
  ON knowledge_document_files(document_id, sort_order ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_kb_doc_files_hash
  ON knowledge_document_files(file_hash)
  WHERE file_hash IS NOT NULL;

-- Перенос уже загруженных одиночных документов в таблицу файлов
INSERT INTO knowledge_document_files (
  document_id, file_url, file_name, file_type, file_size, file_hash,
  search_text, sort_order, version_number, uploaded_by, created_at, updated_at
)
SELECT
  d.id,
  d.file_url,
  d.file_name,
  d.file_type,
  d.file_size,
  d.file_hash,
  d.search_text,
  0,
  COALESCE(d.version_number, 1),
  COALESCE(d.updated_by, d.uploaded_by),
  COALESCE(d.created_at, CURRENT_TIMESTAMP),
  COALESCE(d.updated_at, CURRENT_TIMESTAMP)
FROM knowledge_documents d
WHERE d.file_url IS NOT NULL
  AND d.is_archived = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM knowledge_document_files f WHERE f.document_id = d.id
  );

COMMENT ON COLUMN knowledge_documents.is_folder IS
  'true = папка/комплект с несколькими файлами; false = одиночный документ';
COMMENT ON TABLE knowledge_document_files IS
  'Файлы внутри документа или папки базы знаний';
