-- =============================================================================
-- База знаний: справочники категорий и тегов (управляет администратор)
-- Дата: 29.07.2026
--
-- Применить в PostgreSQL. Безопасно запускать повторно.
-- После применения перезапустить register (порт 5000).
-- =============================================================================

-- Снять жёсткий CHECK, чтобы можно было добавлять категории
ALTER TABLE knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_category_check;

CREATE TABLE IF NOT EXISTS knowledge_categories (
  id VARCHAR(64) PRIMARY KEY,
  label VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_tags_name_lower
  ON knowledge_tags (lower(trim(name)));

INSERT INTO knowledge_categories (id, label, sort_order) VALUES
  ('regulations', 'Регламенты', 10),
  ('commerce', 'Коммерция', 20),
  ('technical', 'Техника', 30),
  ('templates', 'Шаблоны', 40),
  ('other', 'Прочее', 100)
ON CONFLICT (id) DO NOTHING;

-- Подтянуть уже использованные теги в справочник
INSERT INTO knowledge_tags (name)
SELECT DISTINCT trim(t)
FROM knowledge_documents, unnest(tags) AS t
WHERE length(trim(t)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM knowledge_tags kt
    WHERE lower(trim(kt.name)) = lower(trim(t::text))
  );

COMMENT ON TABLE knowledge_categories IS 'Категории базы знаний (CRUD только администратор)';
COMMENT ON TABLE knowledge_tags IS 'Справочник тегов базы знаний (CRUD только администратор)';
