-- Скрипт для обновления поля ИНН в существующей базе данных
-- Удаляет ограничение длины и расширяет до VARCHAR(255)

-- Обновление таблицы companies
ALTER TABLE companies ALTER COLUMN inn TYPE VARCHAR(255);

-- Обновление таблицы orders_1c
ALTER TABLE orders_1c ALTER COLUMN inn TYPE VARCHAR(255);

-- Обновление таблицы reclamation_records (если существует)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reclamation_records') THEN
        ALTER TABLE reclamation_records ALTER COLUMN inn TYPE VARCHAR(255);
    END IF;
END $$;

-- Проверка изменений
SELECT 
    table_name, 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns 
WHERE column_name = 'inn' 
    AND table_name IN ('companies', 'orders_1c', 'reclamation_records');
