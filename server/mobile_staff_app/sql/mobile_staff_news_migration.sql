-- Новости для мобильного приложения ПОЗ-сотрудники (отдельно от dealer_news)

CREATE TABLE IF NOT EXISTS staff_news_permissions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  can_edit BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_news (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  summary TEXT NOT NULL DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  importance VARCHAR(16) NOT NULL DEFAULT 'normal',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  publish_at TIMESTAMPTZ NULL,
  unpublish_at TIMESTAMPTZ NULL,
  created_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  CHECK (importance IN ('normal', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_staff_news_status ON staff_news(status);
CREATE INDEX IF NOT EXISTS idx_staff_news_publish_at ON staff_news(publish_at);
CREATE INDEX IF NOT EXISTS idx_staff_news_pinned ON staff_news(is_pinned) WHERE is_pinned = TRUE;

CREATE TABLE IF NOT EXISTS staff_news_media (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT NOT NULL REFERENCES staff_news(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_staff_news_media_news_id
  ON staff_news_media(news_id, display_order);

-- Сегменты: department | role | user
-- Пустой набор = всем.
-- Аудитория аддитивная: отделы ∪ роли ∪ сотрудники (OR между типами).
CREATE TABLE IF NOT EXISTS staff_news_segments (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT NOT NULL REFERENCES staff_news(id) ON DELETE CASCADE,
  segment_type VARCHAR(32) NOT NULL,
  segment_value VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (segment_type IN ('department', 'role', 'user'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_staff_news_segment
  ON staff_news_segments(news_id, segment_type, segment_value);

CREATE INDEX IF NOT EXISTS idx_staff_news_segments_type_value
  ON staff_news_segments(segment_type, segment_value);

CREATE TABLE IF NOT EXISTS staff_news_change_log (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT NULL REFERENCES staff_news(id) ON DELETE SET NULL,
  user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(64) NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_news_change_log_news
  ON staff_news_change_log(news_id, created_at DESC);

CREATE TABLE IF NOT EXISTS staff_news_reads (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT NOT NULL REFERENCES staff_news(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (news_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_news_reads_user
  ON staff_news_reads(user_id, read_at DESC);
