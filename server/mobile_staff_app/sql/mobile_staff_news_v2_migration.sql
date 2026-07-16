-- V2: ознакомление, PDF, реакции для staff_news

ALTER TABLE staff_news
  ADD COLUMN IF NOT EXISTS requires_ack BOOLEAN NOT NULL DEFAULT FALSE;

-- PDF и картинки в media
DO $$
DECLARE
  check_name TEXT;
BEGIN
  SELECT c.conname
    INTO check_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
   WHERE t.relname = 'staff_news_media'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%media_type%';

  IF check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE staff_news_media DROP CONSTRAINT %I', check_name);
  END IF;
END $$;

ALTER TABLE staff_news_media
  DROP CONSTRAINT IF EXISTS staff_news_media_media_type_check;

ALTER TABLE staff_news_media
  ADD CONSTRAINT staff_news_media_media_type_check
  CHECK (media_type IN ('image', 'pdf'));

ALTER TABLE staff_news_media
  DROP CONSTRAINT IF EXISTS staff_news_media_placement_key_check;

ALTER TABLE staff_news_media
  ADD CONSTRAINT staff_news_media_placement_key_check
  CHECK (placement_key IN ('cover', 'content', 'attachment'));

-- Подтверждение ознакомления
CREATE TABLE IF NOT EXISTS staff_news_acks (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT NOT NULL REFERENCES staff_news(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (news_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_news_acks_news
  ON staff_news_acks(news_id);

CREATE INDEX IF NOT EXISTS idx_staff_news_acks_user
  ON staff_news_acks(user_id);

-- Реакции: like | useful | clarify
CREATE TABLE IF NOT EXISTS staff_news_reactions (
  id BIGSERIAL PRIMARY KEY,
  news_id BIGINT NOT NULL REFERENCES staff_news(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction VARCHAR(24) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (news_id, user_id, reaction),
  CHECK (reaction IN ('like', 'useful', 'clarify'))
);

CREATE INDEX IF NOT EXISTS idx_staff_news_reactions_news
  ON staff_news_reactions(news_id);
