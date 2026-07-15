-- Push-устройства сотрудников (POZ-Staff, package com.poz.staff)
-- Firebase project: poz-mobile-push — нужна ОТДЕЛЬНАЯ Android-app с package com.poz.staff
-- (дилерское com.poz.mobile не менять)

CREATE TABLE IF NOT EXISTS mobile_staff_push_devices (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token VARCHAR(255) NOT NULL,
  platform VARCHAR(32) NOT NULL DEFAULT 'android',
  app_version VARCHAR(32) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_mobile_staff_push_user_token
  ON mobile_staff_push_devices(user_id, expo_push_token);

CREATE INDEX IF NOT EXISTS idx_mobile_staff_push_devices_active
  ON mobile_staff_push_devices(user_id, is_active, updated_at DESC);
