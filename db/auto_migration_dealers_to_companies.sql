-- Миграция: замена dealer_id на company_id в таблицах маркетинга
-- Выполните этот скрипт, если таблицы уже созданы

-- Проверяем, существует ли старая таблица marketing_campaign_dealers
DO $$
BEGIN
    -- 1. Переименование таблицы marketing_campaign_dealers в marketing_campaign_companies (если существует)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marketing_campaign_dealers') THEN
        ALTER TABLE marketing_campaign_dealers RENAME TO marketing_campaign_companies;
        
        -- 2. Удаление старого индекса
        DROP INDEX IF EXISTS idx_marketing_campaign_dealers_campaign_id;
        DROP INDEX IF EXISTS idx_marketing_campaign_dealers_dealer_id;
        
        -- 3. Удаление старого внешнего ключа
        ALTER TABLE marketing_campaign_companies DROP CONSTRAINT IF EXISTS marketing_campaign_dealers_dealer_id_fkey;
        
        -- 4. Переименование колонки dealer_id в company_id
        ALTER TABLE marketing_campaign_companies RENAME COLUMN dealer_id TO company_id;
        
        -- 5. Добавление нового внешнего ключа на companies
        ALTER TABLE marketing_campaign_companies 
        ADD CONSTRAINT marketing_campaign_companies_company_id_fkey 
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. Создание новых индексов (если их еще нет)
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_companies_campaign_id ON marketing_campaign_companies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_companies_company_id ON marketing_campaign_companies(company_id);

-- 7. Обновление таблицы marketing_send_log
DO $$
BEGIN
    -- Проверяем, существует ли колонка dealer_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketing_send_log' AND column_name = 'dealer_id'
    ) THEN
        -- Удаление старого индекса
        DROP INDEX IF EXISTS idx_marketing_send_log_dealer_id;
        DROP INDEX IF EXISTS idx_marketing_send_log_duplicate_check;
        
        -- Удаление старого внешнего ключа
        ALTER TABLE marketing_send_log DROP CONSTRAINT IF EXISTS marketing_send_log_dealer_id_fkey;
        
        -- Переименование колонки dealer_id в company_id
        ALTER TABLE marketing_send_log RENAME COLUMN dealer_id TO company_id;
        
        -- Добавление нового внешнего ключа на companies
        ALTER TABLE marketing_send_log 
        ADD CONSTRAINT marketing_send_log_company_id_fkey 
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 11. Создание новых индексов (если их еще нет)
CREATE INDEX IF NOT EXISTS idx_marketing_send_log_company_id ON marketing_send_log(company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_send_log_duplicate_check ON marketing_send_log(campaign_id, company_id, sent_at);

-- 12. Обновление комментариев
COMMENT ON TABLE marketing_campaign_companies IS 'Связь маркетинговых кампаний с дилерскими компаниями (если выбраны конкретные компании)';
COMMENT ON COLUMN marketing_send_log.company_id IS 'ID дилерской компании (ссылка на companies.id)';

