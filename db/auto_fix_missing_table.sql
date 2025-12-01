-- Исправление: создание таблицы marketing_campaign_companies, если её нет
-- Выполните этот скрипт, если получаете ошибку "отношение marketing_campaign_dealers не существует"

-- Создаем таблицу, если её еще нет
CREATE TABLE IF NOT EXISTS marketing_campaign_companies (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, company_id)
);

-- Комментарии
COMMENT ON TABLE marketing_campaign_companies IS 'Связь маркетинговых кампаний с дилерскими компаниями (если выбраны конкретные компании)';

-- Индексы (если их еще нет)
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_companies_campaign_id ON marketing_campaign_companies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_companies_company_id ON marketing_campaign_companies(company_id);

-- Проверяем и обновляем marketing_send_log, если нужно
DO $$
BEGIN
    -- Если колонка dealer_id существует, переименовываем её
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketing_send_log' AND column_name = 'dealer_id'
    ) THEN
        DROP INDEX IF EXISTS idx_marketing_send_log_dealer_id;
        DROP INDEX IF EXISTS idx_marketing_send_log_duplicate_check;
        ALTER TABLE marketing_send_log DROP CONSTRAINT IF EXISTS marketing_send_log_dealer_id_fkey;
        ALTER TABLE marketing_send_log RENAME COLUMN dealer_id TO company_id;
        ALTER TABLE marketing_send_log 
        ADD CONSTRAINT marketing_send_log_company_id_fkey 
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    END IF;
    
    -- Создаем индексы, если их нет
    CREATE INDEX IF NOT EXISTS idx_marketing_send_log_company_id ON marketing_send_log(company_id);
    CREATE INDEX IF NOT EXISTS idx_marketing_send_log_duplicate_check ON marketing_send_log(campaign_id, company_id, sent_at);
END $$;

