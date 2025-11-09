-- Миграция: Добавление системы категорий для значений параметров
-- Выполнить на существующей БД для добавления новых таблиц и полей

-- 1. Создание таблицы категорий
CREATE TABLE IF NOT EXISTS parameter_value_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 2. Добавление поля use_categories в таблицу parameters
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'parameters' AND column_name = 'use_categories'
    ) THEN
        ALTER TABLE parameters ADD COLUMN use_categories BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Добавление поля category_id в таблицу parameter_values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'parameter_values' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE parameter_values ADD COLUMN category_id INTEGER;
        ALTER TABLE parameter_values 
            ADD CONSTRAINT fk_parameter_values_category 
            FOREIGN KEY (category_id) 
            REFERENCES parameter_value_categories(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Создание индексов
CREATE INDEX IF NOT EXISTS idx_parameter_values_category_id ON parameter_values(category_id);
CREATE INDEX IF NOT EXISTS idx_parameter_value_categories_name ON parameter_value_categories(name);

-- Комментарии для документации
COMMENT ON TABLE parameter_value_categories IS 'Категории для группировки значений параметров (например, категории цветов)';
COMMENT ON COLUMN parameters.use_categories IS 'Использовать категории для группировки значений параметра (например, для цветов)';
COMMENT ON COLUMN parameter_values.category_id IS 'Ссылка на категорию значения параметра';

