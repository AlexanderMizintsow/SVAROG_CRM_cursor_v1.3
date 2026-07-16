-- V3: комментарии, опросы, флаги вовлечённости для staff_news

ALTER TABLE staff_news
  ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS staff_news_comments (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT NOT NULL REFERENCES staff_news(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_news_comments_news
  ON staff_news_comments(news_id, created_at DESC)
  WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS staff_news_polls (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT NOT NULL UNIQUE REFERENCES staff_news(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  is_multiple BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_news_poll_options (
  id BIGSERIAL PRIMARY KEY,
  poll_id BIGINT NOT NULL REFERENCES staff_news_polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_staff_news_poll_options_poll
  ON staff_news_poll_options(poll_id, display_order);

CREATE TABLE IF NOT EXISTS staff_news_poll_votes (
  id BIGSERIAL PRIMARY KEY,
  poll_id BIGINT NOT NULL REFERENCES staff_news_polls(id) ON DELETE CASCADE,
  option_id BIGINT NOT NULL REFERENCES staff_news_poll_options(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, user_id, option_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_news_poll_votes_poll
  ON staff_news_poll_votes(poll_id);

CREATE INDEX IF NOT EXISTS idx_staff_news_reactions_user
  ON staff_news_reactions(news_id, user_id);
