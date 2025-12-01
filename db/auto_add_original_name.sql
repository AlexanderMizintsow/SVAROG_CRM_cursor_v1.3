-- Миграция: добавление поля original_name для хранения оригинального имени файла
-- Выполнить эту миграцию для поддержки оригинальных имен файлов

-- Добавляем поле original_name в таблицу marketing_campaign_images
ALTER TABLE marketing_campaign_images 
ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);

-- Добавляем поле original_name в таблицу marketing_campaign_attachments
ALTER TABLE marketing_campaign_attachments 
ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);

-- Обновляем комментарии
COMMENT ON COLUMN marketing_campaign_images.original_name IS 'Оригинальное имя файла (без префикса timestamp)';
COMMENT ON COLUMN marketing_campaign_attachments.original_name IS 'Оригинальное имя файла (без префикса timestamp)';

