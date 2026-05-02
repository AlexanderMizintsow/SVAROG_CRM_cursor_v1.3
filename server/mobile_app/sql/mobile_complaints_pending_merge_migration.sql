-- Связь отправленного мастера рекламации с номером заявки из учётной системы (после регистрации менеджером).
-- Безопасно для повторного запуска.

DO $$
BEGIN
  ALTER TABLE mobile_complaint_drafts ADD COLUMN onec_request_number VARCHAR(120) NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_mobile_complaint_drafts_company_onec
  ON mobile_complaint_drafts (company_id, onec_request_number)
  WHERE onec_request_number IS NOT NULL;
