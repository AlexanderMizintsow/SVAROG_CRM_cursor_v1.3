-- Универсальная система push-уведомлений для mobile_app

CREATE TABLE IF NOT EXISTS mobile_push_devices (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  expo_push_token VARCHAR(255) NOT NULL,
  platform VARCHAR(32) NOT NULL DEFAULT 'android',
  app_version VARCHAR(32) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_mobile_push_device_company_token
  ON mobile_push_devices(company_id, expo_push_token);

CREATE INDEX IF NOT EXISTS idx_mobile_push_devices_active
  ON mobile_push_devices(company_id, is_active, updated_at DESC);

CREATE TABLE IF NOT EXISTS mobile_push_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NULL,
  entity_id BIGINT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  created_by INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL,
  CHECK (status IN ('queued', 'processing', 'done', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_mobile_push_events_created_at
  ON mobile_push_events(created_at DESC);

CREATE TABLE IF NOT EXISTS mobile_push_delivery_logs (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES mobile_push_events(id) ON DELETE CASCADE,
  company_id INTEGER NULL,
  company_name VARCHAR(255) NULL,
  expo_push_token VARCHAR(255) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'sent',
  error_message TEXT NULL,
  response_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('sent', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_mobile_push_delivery_logs_event
  ON mobile_push_delivery_logs(event_id, created_at DESC);
