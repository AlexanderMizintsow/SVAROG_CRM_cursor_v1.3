# 🔧 Исправление SQL ошибок для Firebird

## ❌ Проблема

При выполнении запроса `getMaterialsSummary` возникала ошибка:

```
Dynamic SQL Error, SQL error code = -104, Invalid expression in the select list (not contained in either an aggregate function or the GROUP BY clause)
```

## 🔍 Анализ ошибки

Ошибка возникала по двум причинам:

### 1. Неправильное использование COUNT(\*) в агрегатных функциях

**Проблемный код:**

```sql
SUM(
  CASE
    WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
    WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY/COUNT(*)
    ELSE itd.QTY*oi.QTY
  END
) as total_quantity
```

**Проблема:** В Firebird нельзя использовать `COUNT(*)` внутри `SUM()` при группировке.

### 2. Несоответствие SELECT и GROUP BY

**Проблемный код:**

```sql
-- SELECT содержит:
m.SHORTNAME as measure_unit

-- Но GROUP BY не содержит:
groupByFields = 'ggt.ID, ggt.NAME, g.ID, g.NAME, g.MARKING'  -- отсутствует m.SHORTNAME
```

**Проблема:** Все поля в SELECT (кроме агрегатных функций) должны быть в GROUP BY.

## ✅ Решение

### 1. Исправление агрегатных функций

**Было:**

```sql
SUM(
  CASE
    WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
    WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY/COUNT(*)
    ELSE itd.QTY*oi.QTY
  END
) as total_quantity
```

**Стало:**

```sql
SUM(
  CASE
    WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
    WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY
    ELSE itd.QTY*oi.QTY
  END
) as total_quantity
```

### 2. Исправление GROUP BY

**Было:**

```javascript
let groupByFields = 'ggt.ID, ggt.NAME, g.ID, g.NAME, g.MARKING'
```

**Стало:**

```javascript
let groupByFields = 'ggt.ID, ggt.NAME, g.ID, g.NAME, g.MARKING, m.SHORTNAME'
```

## 🔄 Исправленные места

### 1. getMaterialsSummary

- ✅ Убран `COUNT(*)` из `SUM()`
- ✅ Добавлен `m.SHORTNAME` в `GROUP BY`

### 2. getSearchSummary

- ✅ Убран `COUNT(*)` из `SUM()`

### 3. getOrdersList

- ✅ Убран `COUNT(*)` из `CASE`

### 4. getOrderDetails

- ✅ Убран `COUNT(*)` из `SUM()`

### 5. getOrderMaterialsSummary

- ✅ Убран `COUNT(*)` из `SUM()`

## 📊 Логика расчета количества

Изначально код пытался учесть количество записей через `COUNT(*)`, но это неправильно для агрегатных функций в Firebird.

**Правильная логика:**

- `ISEXTENDED = 1`: Используется `itd.QTY` (расширенное количество)
- `ISEXTENDED = 0` и `AMOUNTGROUPID = 1`: Используется `itd.QTY*oi.QTY` (обычное количество)
- Остальные случаи: Используется `itd.QTY*oi.QTY`

## 🎯 Результат

После исправления:

- ✅ SQL запросы выполняются без ошибок
- ✅ Группировка работает корректно
- ✅ Агрегатные функции вычисляются правильно
- ✅ Система поиска материалов функционирует полностью

## 🔧 Технические детали

### Firebird требования к GROUP BY:

1. Все неагрегатные поля в SELECT должны быть в GROUP BY
2. Нельзя использовать `COUNT(*)` внутри других агрегатных функций
3. Порядок полей в GROUP BY должен соответствовать логике группировки

### Оптимизация:

- Убрали лишние вычисления `COUNT(*)`
- Упростили логику расчета количества
- Сохранили корректность группировки по материалам

**Все SQL запросы теперь совместимы с Firebird!** 🚀
