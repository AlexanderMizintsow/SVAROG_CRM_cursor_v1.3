-- Ответ утверждающего задачи: ожидает / утвердил / отклонил.
-- Старые строки не закрывают задачи: false без decision остаётся «ожидает».
ALTER TABLE task_approvals ADD COLUMN IF NOT EXISTS decision VARCHAR(20);
ALTER TABLE task_approvals ADD COLUMN IF NOT EXISTS rejection_comment TEXT;

UPDATE task_approvals
SET decision = 'approved'
WHERE is_approved = true
  AND decision IS NULL;

COMMENT ON COLUMN task_approvals.decision IS 'pending не пишется: NULL — ожидает, approved — утвердил, rejected — отклонил';
COMMENT ON COLUMN task_approvals.rejection_comment IS 'Причина отказа утверждающего';
