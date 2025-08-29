-- Таблица целей звонков
CREATE TABLE call_purposes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Вставка базовых целей звонков
INSERT INTO call_purposes (name, description) VALUES
    ('Расчет', 'Вопросы по расчетам и ценообразованию'),
    ('Консультация', 'Общие консультации по продуктам и услугам'),
    ('Рекламация', 'Жалобы и претензии'),
    ('Бухгалтерия', 'Вопросы по бухгалтерским документам'),
    ('Логистика', 'Вопросы по доставке и логистике');

-- Добавление полей в таблицу calls для цели звонка и описания
ALTER TABLE calls 
ADD COLUMN purpose_id INTEGER REFERENCES call_purposes(id),
ADD COLUMN description TEXT,
ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

-- Создание индекса для быстрого поиска по цели звонка
CREATE INDEX idx_calls_purpose_id ON calls(purpose_id);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calls_updated_at_trigger
BEFORE UPDATE ON calls
FOR EACH ROW EXECUTE FUNCTION update_calls_updated_at();
