-- =============================================================================
-- POZ-Staff / режим директора — все новые таблицы (одним файлом)
-- Дата: 27.07.2026
--
-- Применить в PostgreSQL (одна БД CRM / register).
-- Безопасно запускать повторно: CREATE IF NOT EXISTS.
--
-- После применения перезапустить:
--   - register (порт 5000)
--   - mobile_staff_app (порт 5011)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) Обращения к непосредственному руководителю
--    Mobile: /api/mobile/employee/manager-requests/*
--    Web:    /api/manager-requests/*
--    Типы:   question | proposal | escalation
--    Статусы: open | answered | closed | converted_to_task
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_manager_requests (
  id SERIAL PRIMARY KEY,
  from_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL CHECK (type IN ('question', 'proposal', 'escalation')),
  title VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'answered', 'closed', 'converted_to_task')),
  answer_text TEXT,
  answered_at TIMESTAMP,
  answered_by INT REFERENCES users(id) ON DELETE SET NULL,
  related_task_id INT REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_smr_from_user ON staff_manager_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_smr_to_user ON staff_manager_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_smr_to_status ON staff_manager_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_smr_created ON staff_manager_requests(created_at DESC);


-- -----------------------------------------------------------------------------
-- 2) Настройки утреннего push-дайджеста директора
--    Mobile: /api/mobile/employee/director/digest
--    Scheduler: mobile_staff_app (час по умолчанию 8, env DIRECTOR_DIGEST_HOUR)
--    enabled по умолчанию TRUE (вкл для директора / руководителей с подчинёнными)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_director_digest_prefs (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_on DATE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- Конец файла
-- =============================================================================
