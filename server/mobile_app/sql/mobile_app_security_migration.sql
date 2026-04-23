-- Миграция для существующей БД: mobile безопасность

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS mobile_password VARCHAR(255) NOT NULL DEFAULT 'NOTACCES';

CREATE UNIQUE INDEX IF NOT EXISTS unique_mobile_password
ON companies(mobile_password)
WHERE mobile_password <> 'NOTACCES';

CREATE TABLE IF NOT EXISTS mobile_refresh_sessions (
  id SERIAL PRIMARY KEY,
  refresh_token_id UUID NOT NULL UNIQUE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITHOUT TIME ZONE,
  revoke_reason VARCHAR(120)
);

CREATE INDEX IF NOT EXISTS idx_mobile_refresh_sessions_company_id
ON mobile_refresh_sessions(company_id);

CREATE INDEX IF NOT EXISTS idx_mobile_refresh_sessions_expires_at
ON mobile_refresh_sessions(expires_at);

CREATE TABLE IF NOT EXISTS mobile_auth_audit_logs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  company_name VARCHAR(255),
  event_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL,
  message VARCHAR(500),
  ip_address VARCHAR(120),
  user_agent VARCHAR(500),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_auth_audit_logs_company_id
ON mobile_auth_audit_logs(company_id);

CREATE INDEX IF NOT EXISTS idx_mobile_auth_audit_logs_created_at
ON mobile_auth_audit_logs(created_at DESC);
