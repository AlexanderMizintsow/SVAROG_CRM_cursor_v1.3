-- Миграция: добавление статуса 'skipped' в таблицу marketing_send_log
-- Выполнить эту миграцию для поддержки статуса "Пропущено"

-- Удаляем старый CHECK constraint
ALTER TABLE marketing_send_log DROP CONSTRAINT IF EXISTS marketing_send_log_status_check;

-- Добавляем новый CHECK constraint с поддержкой статуса 'skipped'
ALTER TABLE marketing_send_log 
ADD CONSTRAINT marketing_send_log_status_check 
CHECK (status IN ('sent', 'error', 'skipped', 'no_telegram'));

-- Обновляем комментарий
COMMENT ON COLUMN marketing_send_log.status IS 'Статус отправки: sent - отправлено, error - ошибка, skipped - пропущено (блокировка повторной отправки), no_telegram - нет регистрации в ТГ';

