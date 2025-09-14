# 🔧 Исправление ошибки SQL JOIN

## ❌ **Проблема:**

Пользователь получил ошибку:

```
Orders query error: Error: Dynamic SQL Error, SQL error code = -206, Column unknown, OI.ORDERITEMSID, At line 7, column 24
```

**Причина:** В запросе использовалось поле `oi.ORDERITEMSID`, но таблица `ORDERITEMS` (с алиасом `oi`) не была подключена через JOIN, когда фильтры не требовали материалов.

## 🔍 **Анализ проблемы:**

### **Логика запроса:**

```javascript
const needsMaterialJoins =
  whereClause.includes('ggt.') || whereClause.includes('g.') || whereClause.includes('rec.')
```

**Проблема:** Когда нет фильтров по материалам (`needsMaterialJoins = false`):

- JOIN'ы не добавляются
- Но в SELECT все равно используется `COUNT(oi.ORDERITEMSID)`
- Таблица `ORDERITEMS` (алиас `oi`) не существует в запросе

### **Пример проблемного запроса:**

```sql
-- Когда нет фильтров по материалам:
SELECT
  o.ORDERID,
  o.ORDERNO,
  o.DATECREATED,
  o.ORDERSTATUS,
  COUNT(oi.ORDERITEMSID) as ITEMS_WITH_MATERIAL  -- ← ОШИБКА! Таблица oi не подключена
FROM ORDERS o
-- НЕТ JOIN'ов для ORDERITEMS!
WHERE o.DELETED = 0
AND o.DATECREATED >= ? AND o.DATECREATED < ? AND o.ORDERSTATUS = ?
GROUP BY o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS  -- ← ОШИБКА! GROUP BY без JOIN'ов
```

## 🔧 **Решение:**

### **Исправлено в `server/AW/controllers/statisticsController_new.js`:**

```javascript
// БЫЛО (неправильно):
const ordersQuery = `
  SELECT 
    o.ORDERID, 
    o.ORDERNO, 
    o.DATECREATED, 
    o.ORDERSTATUS,
    COUNT(oi.ORDERITEMSID) as ITEMS_WITH_MATERIAL  -- ← Всегда используется
  FROM ORDERS o
  ${needsMaterialJoins ? 'JOIN ORDERITEMS oi ON ...' : ''}  -- ← JOIN только если нужен
  GROUP BY o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS  -- ← Всегда GROUP BY
`

// СТАЛО (правильно):
const ordersQuery = `
  SELECT 
    o.ORDERID, 
    o.ORDERNO, 
    o.DATECREATED, 
    o.ORDERSTATUS,
    ${
      needsMaterialJoins
        ? 'COUNT(oi.ORDERITEMSID) as ITEMS_WITH_MATERIAL'
        : '0 as ITEMS_WITH_MATERIAL'
    }  -- ← Условно
  FROM ORDERS o
  ${needsMaterialJoins ? 'JOIN ORDERITEMS oi ON ...' : ''}  -- ← JOIN только если нужен
  ${
    needsMaterialJoins ? 'GROUP BY o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS' : ''
  }  -- ← GROUP BY только если нужен
`
```

## 📊 **Сравнение запросов:**

### **Было (неправильно):**

```sql
-- Когда нет фильтров по материалам:
SELECT
  o.ORDERID,
  o.ORDERNO,
  o.DATECREATED,
  o.ORDERSTATUS,
  COUNT(oi.ORDERITEMSID) as ITEMS_WITH_MATERIAL  -- ← ОШИБКА!
FROM ORDERS o
WHERE o.DELETED = 0
AND o.DATECREATED >= ? AND o.DATECREATED < ? AND o.ORDERSTATUS = ?
GROUP BY o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS  -- ← ОШИБКА!
```

### **Стало (правильно):**

```sql
-- Когда нет фильтров по материалам:
SELECT
  o.ORDERID,
  o.ORDERNO,
  o.DATECREATED,
  o.ORDERSTATUS,
  0 as ITEMS_WITH_MATERIAL  -- ← Правильно!
FROM ORDERS o
WHERE o.DELETED = 0
AND o.DATECREATED >= ? AND o.DATECREATED < ? AND o.ORDERSTATUS = ?
ORDER BY o.DATECREATED DESC, o.ORDERNO
```

```sql
-- Когда есть фильтры по материалам:
SELECT
  o.ORDERID,
  o.ORDERNO,
  o.DATECREATED,
  o.ORDERSTATUS,
  COUNT(oi.ORDERITEMSID) as ITEMS_WITH_MATERIAL  -- ← Правильно!
FROM ORDERS o
JOIN ORDERITEMS oi ON o.ORDERID = oi.ORDERID
-- ... другие JOIN'ы ...
WHERE o.DELETED = 0
AND o.DATECREATED >= ? AND o.DATECREATED < ? AND o.ORDERSTATUS = ?
GROUP BY o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS  -- ← Правильно!
ORDER BY o.DATECREATED DESC, o.ORDERNO
```

## 🎯 **Логика исправления:**

### **Условные части запроса:**

1. **SELECT поле:** `COUNT(oi.ORDERITEMSID)` только если есть JOIN'ы
2. **GROUP BY:** только если есть агрегатные функции
3. **JOIN'ы:** только если нужны для фильтрации

### **Результат:**

- **Без фильтров по материалам:** `ITEMS_WITH_MATERIAL = 0` (нет JOIN'ов)
- **С фильтрами по материалам:** `ITEMS_WITH_MATERIAL = COUNT(oi.ORDERITEMSID)` (есть JOIN'ы)

## ✅ **Преимущества исправления:**

1. ✅ **Нет SQL ошибок** - запрос работает в любых условиях
2. ✅ **Оптимизированные запросы** - JOIN'ы только когда нужны
3. ✅ **Правильная логика** - GROUP BY только при необходимости
4. ✅ **Стабильная работа** - система не падает при разных фильтрах

## 🚀 **Статус:**

**Исправление завершено!** ✅

Теперь:

- ✅ **Нет ошибки** `Column unknown, OI.ORDERITEMSID`
- ✅ **Запросы работают** для любых комбинаций фильтров
- ✅ **Оптимизированная производительность** - JOIN'ы только когда нужны
- ✅ **Стабильная работа** системы

**Теперь поиск работает без ошибок для любых фильтров!** 🎉
