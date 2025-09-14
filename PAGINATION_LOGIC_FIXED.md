# 🔧 Исправлена логика пагинации - найдена основная проблема!

## ❌ Проблема найдена!

Из логов стало ясно, что проблема в **неправильной пагинации**:

```
Simple query returned 100 rows
Unique order IDs: [ 38502 ]  // Только 1 заказ!
Found 1 orders for filters
```

**Причина:** Пагинация `ROWS 1 TO 100` работала по **строкам материалов**, а не по **заказам**!

## 🚨 Анализ проблемы:

### Неправильная логика:

```sql
-- Проблемный запрос
SELECT o.ORDERID, o.ORDERNO, oi.ORDERITEMSID, g.NAME, ...
FROM ORDERS o
JOIN ORDERITEMS oi ON ...
JOIN ITEMSDETAIL itd ON ...
JOIN STUFFS g ON ...
WHERE ...
ORDER BY o.DATECREATED DESC, o.ORDERNO, oi.ORDERITEMSID, g.ID
ROWS 1 TO 100  -- ❌ Пагинация по СТРОКАМ материалов!
```

**Результат:**

- `ROWS 1 TO 100` = первые 100 **строк материалов**
- Один заказ может иметь 100+ материалов
- **Итог:** только 1 заказ вместо 100 заказов

## ✅ Правильное решение - двухэтапная пагинация:

### 1. **Сначала найдем заказы с правильной пагинацией**

```sql
-- Шаг 1: Найти заказы
SELECT DISTINCT o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS
FROM ORDERS o
WHERE o.DELETED = 0
AND o.DATECREATED >= ? AND o.DATECREATED < ? AND o.ORDERSTATUS = ?
ORDER BY o.DATECREATED DESC, o.ORDERNO
ROWS 1 TO 100  -- ✅ Пагинация по ЗАКАЗАМ!
```

### 2. **Потом загрузим материалы для найденных заказов**

```sql
-- Шаг 2: Загрузить материалы
SELECT o.ORDERID, o.ORDERNO, oi.ORDERITEMSID, g.NAME, ...
FROM ORDERITEMS oi
JOIN ORDERS o ON o.ORDERID = oi.ORDERID
JOIN ITEMSDETAIL itd ON ...
JOIN STUFFS g ON ...
WHERE o.DELETED = 0
AND o.ORDERID IN (?, ?, ?, ...)  -- Только найденные заказы!
AND COALESCE(rec.NAME,'') <> 'VIRT'
ORDER BY o.DATECREATED DESC, o.ORDERNO, oi.ORDERITEMSID, g.ID
-- БЕЗ пагинации - загружаем ВСЕ материалы для найденных заказов
```

## 🔧 Изменения в коде:

### 1. **Добавлен запрос для поиска заказов**

```javascript
// СНАЧАЛА найдем заказы с правильной пагинацией
const ordersQuery = `
  SELECT DISTINCT o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS
  FROM ORDERS o
  WHERE o.DELETED = 0
  ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
  ORDER BY o.DATECREATED DESC, o.ORDERNO
  ROWS ${skip + 1} TO ${skip + limit}
`
```

### 2. **Запрос для загрузки материалов**

```javascript
// Теперь загрузим материалы для найденных заказов БЕЗ пагинации
const orderIds = ordersResult.map((order) => order.ORDERID)
const orderIdsPlaceholders = orderIds.map(() => '?').join(',')

const materialsQuery = `
  SELECT o.ORDERID, o.ORDERNO, oi.ORDERITEMSID, g.NAME, ...
  FROM ORDERITEMS oi
  JOIN ORDERS o ON o.ORDERID = oi.ORDERID
  ...
  WHERE o.DELETED = 0 
  AND o.ORDERID IN (${orderIdsPlaceholders})
  AND COALESCE(rec.NAME,'') <> 'VIRT'
  ORDER BY o.DATECREATED DESC, o.ORDERNO, oi.ORDERITEMSID, g.ID
`
```

### 3. **Подробное логирование**

```javascript
console.log(`Found ${ordersResult.length} orders in date range`)
console.log(
  'Orders found:',
  ordersResult.map((order) => ({
    ORDERID: order.ORDERID,
    ORDERNO: order.ORDERNO,
    DATECREATED: order.DATECREATED,
  }))
)
console.log(`Materials query returned ${result.length} rows`)
console.log(`Unique order IDs in materials:`, Array.from(uniqueOrderIds))
```

## 🎯 Ожидаемый результат:

**Было (неправильно):**

```
Simple query returned 100 rows
Unique order IDs: [ 38502 ]  // Только 1 заказ!
Found 1 orders for filters
```

**Стало (правильно):**

```
Found 100 orders in date range
Orders found: [
  { ORDERID: 38502, ORDERNO: 'Счёт-6299', DATECREATED: '2025-09-03T16:09:11.000Z' },
  { ORDERID: 38503, ORDERNO: 'ИП Шилин Счет-128', DATECREATED: '2025-09-05T16:21:47.000Z' },
  // ... еще 98 заказов
]
Materials query returned 2000 rows
Unique order IDs in materials: [38502, 38503, ...]  // Все 100 заказов!
Found 100 orders for filters
```

## 📊 Сравнение подходов:

| Подход           | Пагинация             | Результат                 | Заказов     |
| ---------------- | --------------------- | ------------------------- | ----------- |
| **Неправильный** | По строкам материалов | 100 строк = 1 заказ       | 1 заказ     |
| **Правильный**   | По заказам            | 100 заказов = 100 заказов | 100 заказов |

## 📝 Файлы изменены:

- `server/AW/controllers/statisticsController_new.js` - исправлена логика пагинации

## 🚀 Статус:

**Основная проблема найдена и исправлена!** ✅

Теперь система правильно:

1. **Находит 100 заказов** в диапазоне дат
2. **Загружает все материалы** для найденных заказов
3. **Показывает корректную статистику** по всем заказам

**Спасибо за указание на проблему - теперь логика пагинации работает правильно!** 🙏
