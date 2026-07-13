-- Миграция для мобильного приложения сотрудников (отдельный сервер mobile_staff_app)

ALTER TABLE users
ADD COLUMN IF NOT EXISTS mobile_staff_password VARCHAR(255) NOT NULL DEFAULT 'NOTACCES';

CREATE TABLE IF NOT EXISTS mobile_employee_refresh_sessions (
  id SERIAL PRIMARY KEY,
  refresh_token_id UUID NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITHOUT TIME ZONE,
  revoke_reason VARCHAR(120)
);

CREATE INDEX IF NOT EXISTS idx_mobile_employee_refresh_sessions_user_id
ON mobile_employee_refresh_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_mobile_employee_refresh_sessions_expires_at
ON mobile_employee_refresh_sessions(expires_at);

CREATE TABLE IF NOT EXISTS mobile_staff_auth_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(100),
  event_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL,
  message VARCHAR(500),
  ip_address VARCHAR(120),
  user_agent VARCHAR(500),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_staff_auth_audit_logs_user_id
ON mobile_staff_auth_audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_mobile_staff_auth_audit_logs_created_at
ON mobile_staff_auth_audit_logs(created_at DESC);
