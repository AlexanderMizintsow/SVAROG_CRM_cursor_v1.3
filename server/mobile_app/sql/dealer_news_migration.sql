-- Новости дилеров для мобильного приложения POZ

CREATE TABLE IF NOT EXISTS dealer_news_permissions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  can_edit BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dealer_news (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  content_html TEXT NOT NULL,
  cover_image_url TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  publish_at TIMESTAMPTZ NULL,
  unpublish_at TIMESTAMPTZ NULL,
  created_by INTEGER NULL,
  updated_by INTEGER NULL,
  CHECK (status IN ('draft', 'scheduled', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_dealer_news_status ON dealer_news(status);
CREATE INDEX IF NOT EXISTS idx_dealer_news_publish_at ON dealer_news(publish_at);
CREATE INDEX IF NOT EXISTS idx_dealer_news_updated_at ON dealer_news(updated_at DESC);

CREATE TABLE IF NOT EXISTS dealer_news_media (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT NOT NULL REFERENCES dealer_news(id) ON DELETE CASCADE,
  media_type VARCHAR(24) NOT NULL DEFAULT 'image',
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type VARCHAR(128) NOT NULL,
  width_px INTEGER NULL,
  height_px INTEGER NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  placement_key VARCHAR(64) NOT NULL DEFAULT 'content',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (media_type IN ('image')),
  CHECK (placement_key IN ('cover', 'content'))
);

CREATE INDEX IF NOT EXISTS idx_dealer_news_media_news_id
  ON dealer_news_media(news_id, display_order);

CREATE TABLE IF NOT EXISTS dealer_news_segments (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT NOT NULL REFERENCES dealer_news(id) ON DELETE CASCADE,
  segment_type VARCHAR(32) NOT NULL,
  segment_value VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (segment_type IN ('region', 'city', 'company'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_dealer_news_segment
  ON dealer_news_segments(news_id, segment_type, segment_value);

CREATE INDEX IF NOT EXISTS idx_dealer_news_segments_type_value
  ON dealer_news_segments(segment_type, segment_value);

DO $$
DECLARE
  check_name TEXT;
BEGIN
  SELECT c.conname
    INTO check_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
   WHERE t.relname = 'dealer_news_segments'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%segment_type%';

  IF check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE dealer_news_segments DROP CONSTRAINT %I', check_name);
  END IF;

  ALTER TABLE dealer_news_segments
    ADD CONSTRAINT dealer_news_segments_segment_type_check
    CHECK (segment_type IN ('region', 'city', 'company'));
END $$;

CREATE TABLE IF NOT EXISTS dealer_news_change_log (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT NULL REFERENCES dealer_news(id) ON DELETE SET NULL,
  user_id INTEGER NULL,
  action_type VARCHAR(64) NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dealer_news_change_log_news_id
  ON dealer_news_change_log(news_id, created_at DESC);
