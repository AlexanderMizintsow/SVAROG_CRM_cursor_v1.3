-- Добавление цели "Без цели" для звонков без выбранной цели
INSERT INTO call_purposes (name, description) VALUES
    ('Без цели', 'Звонок без указанной цели') 
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_calls_purpose_id ON calls(purpose_id);















 