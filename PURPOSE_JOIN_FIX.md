# Исправление проблемы с JOIN для звонков без цели

## 🎯 Проблема

Когда пользователь сохраняет только итог звонка (без выбора цели), то `purpose_id` остается `NULL`. Это приводит к тому, что запрос:

```sql
SELECT * FROM calls
JOIN call_purposes ON call_purposes.id = calls.purpose_id
```

**НЕ возвращает** записи звонков без выбранной цели, что критично для отображения всех звонков.

## ✅ Решение

### 1. **Добавление цели "Без цели"**

Создана специальная цель "Без цели" для звонков, где пользователь не выбрал конкретную цель.

### 2. **Автоматическое назначение цели**

При сохранении звонка с итогом, но без выбранной цели, автоматически устанавливается цель "Без цели".

### 3. **Обновление существующих записей**

Все существующие записи с `purpose_id = NULL` обновляются на цель "Без цели".

## 🔧 Внесенные изменения

### **База данных (`db/add_default_purpose.sql`):**

```sql
-- Добавление цели "Без цели"
INSERT INTO call_purposes (name, description) VALUES
    ('Без цели', 'Звонок без указанной цели')
ON CONFLICT (name) DO NOTHING;

-- Обновление существующих записей
UPDATE calls
SET purpose_id = (SELECT id FROM call_purposes WHERE name = 'Без цели')
WHERE purpose_id IS NULL;
```

### **Frontend (`CallNotification.jsx`):**

```javascript
// Автоматическое назначение цели "Без цели"
let finalPurposeId = selectedPurpose;
if (outcome && !selectedPurpose) {
  const noPurpose = callPurposes.find((p) => p.name === "Без цели");
  if (noPurpose) {
    finalPurposeId = noPurpose.id;
  }
}
```

## 🎉 Результат

### **До исправления:**

```sql
-- Возвращает только звонки с выбранной целью
SELECT * FROM calls
JOIN call_purposes ON call_purposes.id = calls.purpose_id
-- Результат: 0 записей для звонков без цели
```

### **После исправления:**

```sql
-- Возвращает ВСЕ звонки, включая без выбранной цели
SELECT * FROM calls
JOIN call_purposes ON call_purposes.id = calls.purpose_id
-- Результат: все записи, включая с целью "Без цели"
```

## 🚀 Применение изменений

### 1. **Выполнить SQL скрипт:**

```bash
# Подключиться к базе данных и выполнить:
psql -d your_database -f db/add_default_purpose.sql
```

### 2. **Перезапустить клиент:**

```bash
cd client
npm run dev
```

### 3. **Проверить результат:**

```sql
-- Проверка всех звонков с целями
SELECT
    c.id,
    c.caller_number,
    cp.name as purpose_name,
    c.outcome,
    c.created_at
FROM calls c
LEFT JOIN call_purposes cp ON cp.id = c.purpose_id
ORDER BY c.created_at DESC;
```

## 📋 Чек-лист проверки

- [ ] Цель "Без цели" добавлена в таблицу `call_purposes`
- [ ] Существующие записи с `purpose_id = NULL` обновлены
- [ ] При сохранении только итога автоматически устанавливается цель "Без цели"
- [ ] JOIN запрос возвращает все записи звонков
- [ ] Поле "Цель звонка" остается пустым для выбора пользователем

## 🎯 Преимущества

- ✅ **Полнота данных** - все звонки попадают в JOIN запросы
- ✅ **Обратная совместимость** - существующие записи корректно обрабатываются
- ✅ **Гибкость** - пользователь может позже выбрать реальную цель
- ✅ **Аналитика** - можно анализировать звонки без выбранной цели
- ✅ **Целостность данных** - нет записей с `purpose_id = NULL`

## 🔍 Примеры запросов

### **Все звонки с целями:**

```sql
SELECT
    c.id,
    c.caller_number,
    cp.name as purpose_name,
    c.outcome,
    c.description
FROM calls c
JOIN call_purposes cp ON cp.id = c.purpose_id
ORDER BY c.created_at DESC;
```

### **Звонки без выбранной цели:**

```sql
SELECT
    c.id,
    c.caller_number,
    c.outcome,
    c.created_at
FROM calls c
JOIN call_purposes cp ON cp.id = c.purpose_id
WHERE cp.name = 'Без цели'
ORDER BY c.created_at DESC;
```

### **Статистика по целям:**

```sql
SELECT
    cp.name as purpose_name,
    COUNT(*) as call_count,
    COUNT(CASE WHEN c.outcome = 'success' THEN 1 END) as successful_calls
FROM calls c
JOIN call_purposes cp ON cp.id = c.purpose_id
GROUP BY cp.name, cp.id
ORDER BY call_count DESC;
```
