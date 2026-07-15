-- Миграция: уведомления рабочих групп для POZ-Staff (без Telegram).
-- Выполнить один раз на БД CRM.

-- Привязка in-app уведомления к рабочей группе
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS work_group_id INT REFERENCES work_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_work_group_id
  ON notifications(work_group_id);

-- Напоминание за ~3 часа через mobile_staff_app (независимо от TG notification_sent)
ALTER TABLE work_groups
  ADD COLUMN IF NOT EXISTS staff_notification_sent BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_work_groups_staff_notification_sent
  ON work_groups(staff_notification_sent)
  WHERE staff_notification_sent = FALSE;
