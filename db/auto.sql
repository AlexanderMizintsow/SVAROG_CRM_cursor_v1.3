-- ===================================================================
-- АВТОМАТИЗАЦИЯ МАРКЕТИНГА - Структура базы данных
-- ===================================================================
-- Файл содержит все таблицы, индексы и триггеры для компонента
-- "Автоматизация маркетинга"
-- ===================================================================

-- ===================================================================
-- 1. КАТЕГОРИИ ИНФОРМАЦИИ
-- ===================================================================

-- Категории информации (Акции, Техническая информация и т.д.)
CREATE TABLE marketing_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50), -- эмодзи для бота
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Комментарии к таблице
COMMENT ON TABLE marketing_categories IS 'Категории маркетинговой информации (Акции, Техническая информация и т.д.)';
COMMENT ON COLUMN marketing_categories.icon IS 'Эмодзи для отображения в Telegram-боте';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_marketing_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_categories_updated_at_trigger
BEFORE UPDATE ON marketing_categories
FOR EACH ROW EXECUTE FUNCTION update_marketing_categories_updated_at();

-- Индексы
CREATE INDEX idx_marketing_categories_display_order ON marketing_categories(display_order);

-- ===================================================================
-- 2. СПРАВОЧНИКИ
-- ===================================================================

-- Справочник локаций (городов)
CREATE TABLE marketing_locations (
    id SERIAL PRIMARY KEY,
    city VARCHAR(255) NOT NULL UNIQUE,
    region VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_locations IS 'Справочник локаций (городов) для фильтрации дилеров';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_marketing_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_locations_updated_at_trigger
BEFORE UPDATE ON marketing_locations
FOR EACH ROW EXECUTE FUNCTION update_marketing_locations_updated_at();

-- Индексы
CREATE INDEX idx_marketing_locations_city ON marketing_locations(city);
CREATE INDEX idx_marketing_locations_region ON marketing_locations(region);

-- Справочник тегов
CREATE TABLE marketing_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    color VARCHAR(7), -- hex цвет для отображения
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_tags IS 'Справочник тегов для маркетинговых кампаний';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_marketing_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_tags_updated_at_trigger
BEFORE UPDATE ON marketing_tags
FOR EACH ROW EXECUTE FUNCTION update_marketing_tags_updated_at();

-- Индексы
CREATE INDEX idx_marketing_tags_name ON marketing_tags(name);

-- ===================================================================
-- 3. МАРКЕТИНГОВЫЕ КАМПАНИИ (ИНФОРМАЦИЯ)
-- ===================================================================

-- Маркетинговые кампании (акции, сообщения)
CREATE TABLE marketing_campaigns (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES marketing_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- HTML/Markdown
    status VARCHAR(20) CHECK (status IN ('draft', 'active', 'inactive')) DEFAULT 'draft',
    period_type VARCHAR(20) CHECK (period_type IN ('unlimited', 'date', 'period')) DEFAULT 'unlimited',
    send_date DATE, -- если period_type = 'date'
    period_start TIMESTAMP WITHOUT TIME ZONE, -- если period_type = 'period'
    period_end TIMESTAMP WITHOUT TIME ZONE, -- если period_type = 'period'
    auto_send BOOLEAN DEFAULT FALSE,
    send_time TIME DEFAULT '08:00:00', -- время автоматической отправки (нельзя менять пользователю)
    blocking_period_days INTEGER DEFAULT 30, -- период блокировки дублирования (можно менять)
    contact_person_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    show_contact_person BOOLEAN DEFAULT FALSE,
    notes TEXT, -- служебные заметки
    delivery_channels JSONB DEFAULT '["telegram"]'::jsonb, -- массив каналов
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_campaigns IS 'Маркетинговые кампании (акции, сообщения для дилеров)';
COMMENT ON COLUMN marketing_campaigns.send_time IS 'Время автоматической отправки (фиксированное: 08:00)';
COMMENT ON COLUMN marketing_campaigns.blocking_period_days IS 'Период блокировки дублирования отправок (дни)';
COMMENT ON COLUMN marketing_campaigns.delivery_channels IS 'Массив каналов доставки: ["telegram", "email", "sms"]';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_marketing_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_campaigns_updated_at_trigger
BEFORE UPDATE ON marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION update_marketing_campaigns_updated_at();

-- Индексы
CREATE INDEX idx_marketing_campaigns_category_id ON marketing_campaigns(category_id);
CREATE INDEX idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX idx_marketing_campaigns_period_type ON marketing_campaigns(period_type);
CREATE INDEX idx_marketing_campaigns_send_date ON marketing_campaigns(send_date);
CREATE INDEX idx_marketing_campaigns_period_start ON marketing_campaigns(period_start);
CREATE INDEX idx_marketing_campaigns_period_end ON marketing_campaigns(period_end);
CREATE INDEX idx_marketing_campaigns_auto_send ON marketing_campaigns(auto_send);
CREATE INDEX idx_marketing_campaigns_created_by ON marketing_campaigns(created_by);
CREATE INDEX idx_marketing_campaigns_created_at ON marketing_campaigns(created_at);

-- Составной индекс для поиска активных кампаний на сегодня
CREATE INDEX idx_marketing_campaigns_active_today ON marketing_campaigns(status, auto_send, send_date, period_start, period_end)
WHERE status = 'active' AND auto_send = TRUE;

-- ===================================================================
-- 4. ИЗОБРАЖЕНИЯ И ВЛОЖЕНИЯ КАМПАНИЙ
-- ===================================================================

-- Изображения кампаний
CREATE TABLE marketing_campaign_images (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_campaign_images IS 'Изображения для маркетинговых кампаний';

-- Индексы
CREATE INDEX idx_marketing_campaign_images_campaign_id ON marketing_campaign_images(campaign_id);
CREATE INDEX idx_marketing_campaign_images_display_order ON marketing_campaign_images(display_order);

-- Вложения (документы) кампаний
CREATE TABLE marketing_campaign_attachments (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(255), -- Увеличено с 50 до 255 для длинных MIME-типов
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_campaign_attachments IS 'Вложения (документы) для маркетинговых кампаний';

-- Индексы
CREATE INDEX idx_marketing_campaign_attachments_campaign_id ON marketing_campaign_attachments(campaign_id);
CREATE INDEX idx_marketing_campaign_attachments_display_order ON marketing_campaign_attachments(display_order);

-- ===================================================================
-- 5. СВЯЗИ КАМПАНИЙ С ДИЛЕРАМИ, ЛОКАЦИЯМИ И ТЭГАМИ
-- ===================================================================

-- Связь кампаний с компаниями (дилерскими компаниями)
CREATE TABLE marketing_campaign_companies (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, company_id)
);

COMMENT ON TABLE marketing_campaign_companies IS 'Связь маркетинговых кампаний с дилерскими компаниями (если выбраны конкретные компании)';

-- Индексы
CREATE INDEX idx_marketing_campaign_companies_campaign_id ON marketing_campaign_companies(campaign_id);
CREATE INDEX idx_marketing_campaign_companies_company_id ON marketing_campaign_companies(company_id);

-- Связь кампаний с локациями
CREATE TABLE marketing_campaign_locations (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES marketing_locations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, location_id)
);

COMMENT ON TABLE marketing_campaign_locations IS 'Связь маркетинговых кампаний с локациями (городами)';

-- Индексы
CREATE INDEX idx_marketing_campaign_locations_campaign_id ON marketing_campaign_locations(campaign_id);
CREATE INDEX idx_marketing_campaign_locations_location_id ON marketing_campaign_locations(location_id);

-- Связь кампаний с тегами
CREATE TABLE marketing_campaign_tags (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES marketing_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, tag_id)
);

COMMENT ON TABLE marketing_campaign_tags IS 'Связь маркетинговых кампаний с тегами';

-- Индексы
CREATE INDEX idx_marketing_campaign_tags_campaign_id ON marketing_campaign_tags(campaign_id);
CREATE INDEX idx_marketing_campaign_tags_tag_id ON marketing_campaign_tags(tag_id);

-- ===================================================================
-- 6. ЖУРНАЛ ОТПРАВОК
-- ===================================================================

-- Журнал отправок маркетинговых кампаний
CREATE TABLE marketing_send_log (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    sent_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) CHECK (status IN ('sent', 'error', 'no_telegram')) DEFAULT 'sent',
    send_type VARCHAR(20) CHECK (send_type IN ('auto', 'manual')) DEFAULT 'manual',
    error_message TEXT,
    delivery_channel VARCHAR(20) DEFAULT 'telegram',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE marketing_send_log IS 'Журнал отправок маркетинговых кампаний дилерам';
COMMENT ON COLUMN marketing_send_log.status IS 'Статус отправки: sent - отправлено, error - ошибка, no_telegram - нет регистрации в ТГ';
COMMENT ON COLUMN marketing_send_log.send_type IS 'Тип отправки: auto - автоматическая, manual - ручная';

-- Индексы для быстрого поиска
CREATE INDEX idx_marketing_send_log_campaign_id ON marketing_send_log(campaign_id);
CREATE INDEX idx_marketing_send_log_company_id ON marketing_send_log(company_id);
CREATE INDEX idx_marketing_send_log_sent_at ON marketing_send_log(sent_at);
CREATE INDEX idx_marketing_send_log_status ON marketing_send_log(status);
CREATE INDEX idx_marketing_send_log_send_type ON marketing_send_log(send_type);

-- Составной индекс для проверки дублирования
CREATE INDEX idx_marketing_send_log_duplicate_check ON marketing_send_log(campaign_id, company_id, sent_at);

-- ===================================================================
-- 7. ПРАВА ДОСТУПА К КОМПОНЕНТУ
-- ===================================================================

-- Права доступа к компоненту "Автоматизация маркетинга"
-- Аналогично handle_editor_permissions
CREATE TABLE marketing_editor_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_edit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id)
);

COMMENT ON TABLE marketing_editor_permissions IS 'Права доступа к компоненту "Автоматизация маркетинга" для конкретных пользователей';
COMMENT ON COLUMN marketing_editor_permissions.can_edit IS 'Если true, пользователь имеет все права редактирования (кроме управления пользователями)';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_marketing_editor_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_editor_permissions_updated_at_trigger
BEFORE UPDATE ON marketing_editor_permissions
FOR EACH ROW EXECUTE FUNCTION update_marketing_editor_permissions_updated_at();

-- Индексы
CREATE INDEX idx_marketing_editor_permissions_user_id ON marketing_editor_permissions(user_id);

-- ===================================================================
-- 8. ВСТАВКА НАЧАЛЬНЫХ ДАННЫХ
-- ===================================================================

-- Вставка базовых категорий
INSERT INTO marketing_categories (name, description, icon, display_order) VALUES
    ('Акции', 'Специальные предложения и акции для дилеров', '🎯', 1),
    ('Техническая информация', 'Технические характеристики, инструкции, документация', '📋', 2),
    ('Новости', 'Новости компании и отрасли', '📰', 3),
    ('Обучение', 'Материалы для обучения и повышения квалификации', '📚', 4)
ON CONFLICT (name) DO NOTHING;



-- Удаляем старый CHECK constraint
ALTER TABLE marketing_send_log DROP CONSTRAINT IF EXISTS marketing_send_log_status_check;

-- Добавляем новый CHECK constraint с поддержкой статуса 'skipped'
ALTER TABLE marketing_send_log 
ADD CONSTRAINT marketing_send_log_status_check 
CHECK (status IN ('sent', 'error', 'skipped', 'no_telegram'));

-- Обновляем комментарий
COMMENT ON COLUMN marketing_send_log.status IS 'Статус отправки: sent - отправлено, error - ошибка, skipped - пропущено (блокировка повторной отправки), no_telegram - нет регистрации в ТГ';



-- ===================================================================
-- КОНЕЦ ФАЙЛА
-- ===================================================================

