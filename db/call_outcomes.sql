-- Добавление поля итога звонка в таблицу calls
ALTER TABLE calls 
ADD COLUMN outcome VARCHAR(50) CHECK (outcome IN ('success', 'failed', 'postponed', 'callback', 'send_info'));

-- Добавление поля для связи с напоминанием
ALTER TABLE calls 
ADD COLUMN reminder_id INTEGER REFERENCES reminders(id);
-- Добавление поля для связи с задачей
ALTER TABLE calls 
ADD COLUMN task_id INTEGER REFERENCES tasks(id);

-- Создание индекса для быстрого поиска по итогу звонка
CREATE INDEX idx_calls_outcome ON calls(outcome);

-- Создание индекса для быстрого поиска по ID напоминания
CREATE INDEX idx_calls_reminder_id ON calls(reminder_id);

-- Комментарии к значениям поля outcome:
-- 'success' - Успешно (цель достигнута, клиент доволен)
-- 'failed' - Неудачно (цель не достигнута, клиент недоволен)
-- 'postponed' - Отложено (вопрос требует дополнительного времени)
-- 'callback' - Перезвонить (нужно связаться позже)
-- 'send_info' - Отправить информацию (требуется отправка документов/информации)

-- Обновление триггера для автоматического обновления updated_at при изменении outcome
-- (триггер уже существует и будет работать автоматически)
