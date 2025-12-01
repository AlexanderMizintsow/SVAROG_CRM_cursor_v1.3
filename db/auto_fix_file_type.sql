-- Исправление размера поля file_type в таблице marketing_campaign_attachments
-- Выполните этот скрипт, если таблица уже создана

ALTER TABLE marketing_campaign_attachments 
ALTER COLUMN file_type TYPE VARCHAR(255);

COMMENT ON COLUMN marketing_campaign_attachments.file_type IS 'MIME-тип файла (увеличено до 255 для длинных типов)';

