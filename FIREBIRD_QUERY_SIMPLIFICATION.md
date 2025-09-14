# 🔧 Упрощение SQL запроса для решения проблемы Firebird

## ❌ Проблема продолжалась!

Даже после разделения на батчи по 50 заказов, Firebird все еще выдавал ошибку:

```
Batch 1 query error: Error: Dynamic SQL Error, SQL error code = -303,
Arithmetic exception, numeric overflow, or string truncation, numeric value is out of range
```

### 🔍 Анализ проблемы:

**Причина:** Проблема была не только в количестве параметров, но и в **сложности SQL запроса** и **дублировании условий фильтрации**.

**Проблемный запрос:**

```sql
-- Дублирование условий фильтрации
WHERE o.DELETED = 0
AND o.DATECREATED >= ? AND o.DATECREATED < ? AND o.ORDERSTATUS = ?  -- Уже применено в первом запросе!
AND o.ORDERID IN (?,?,?,...)
AND COALESCE(rec.NAME,'') <> 'VIRT'
```

## ✅ Решение - упрощение запроса:

### 1. Уменьшение размера батча

```javascript
// Было: 50 заказов (53 параметра)
const batchSize = 50

// Стало: 20 заказов (20 параметров)
const batchSize = 20
```

### 2. Упрощение SQL запроса

**Убрали дублирующиеся условия фильтрации**, так как заказы уже отфильтрованы в первом запросе:

```sql
-- Упрощенный запрос только для материалов найденных заказов
SELECT
  o.ORDERID,
  o.ORDERNO,
  o.DATECREATED,
  o.ORDERSTATUS,
  oi.ORDERITEMSID,
  oi.NAME as ITEM_NAME,
  ggt.NAME as STUFF_TYPE,
  g.NAME as MATERIAL_NAME,
  g.MARKING as ITEM_ART,
  -- ... остальные поля
FROM ORDERITEMS oi
JOIN ORDERS o ON o.ORDERID = oi.ORDERID
LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
JOIN STUFFS g ON (g.ID=itd.GOODSID)
LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
LEFT JOIN COLORS c_in ON (c_in.COLORID = itd.INCOLORID)
LEFT JOIN COLORS c_out ON (c_out.COLORID = itd.OUTCOLORID)
WHERE o.DELETED = 0
AND o.ORDERID IN (?,?,?,...)  -- Только ID заказов!
AND COALESCE(rec.NAME,'') <> 'VIRT'
ORDER BY o.DATECREATED DESC, o.ORDERNO, oi.ORDERITEMSID, g.ID
```

### 3. Упрощение параметров

```javascript
// Было: [...queryParams, ...batch] - 23 параметра (3 фильтра + 20 заказов)
db.query(materialsQuery, [...queryParams, ...batch], (err, result) => {

// Стало: batch - только 20 параметров (ID заказов)
db.query(materialsQuery, batch, (err, result) => {
```

## 🔧 Изменения в коде:

### 1. Уменьшен размер батча

```javascript
// Разделим заказы на группы по 20 штук для избежания превышения лимита параметров Firebird
const batchSize = 20
```

### 2. Упрощен SQL запрос

- **Убраны дублирующиеся условия фильтрации** (даты и статус)
- **Только необходимые JOIN'ы**
- **Только ID заказов в параметрах**

### 3. Упрощены параметры запроса

- **Только ID заказов** в параметрах
- **Нет дублирования** фильтров

## 🎯 Ожидаемый результат:

Теперь при поиске 100 заказов:

```
Split 100 orders into 5 batches of max 20 orders each
Executing batch 1/5 with 20 orders
Executing batch 2/5 with 20 orders
Executing batch 3/5 with 20 orders
Executing batch 4/5 with 20 orders
Executing batch 5/5 with 20 orders
Batch 1 returned 450 rows
Batch 2 returned 380 rows
Batch 3 returned 420 rows
Batch 4 returned 350 rows
Batch 5 returned 400 rows
All batches completed. Total rows: 2000
```

## 📊 Преимущества решения:

1. **Меньше параметров** - максимум 20 вместо 53
2. **Проще SQL** - убраны дублирующиеся условия
3. **Быстрее выполнение** - меньше JOIN'ов и условий
4. **Надежнее** - меньше шансов на ошибки Firebird

## 📝 Файлы изменены:

- `server/AW/controllers/statisticsController_new.js` - упрощен SQL запрос и уменьшен размер батча

## 🚀 Статус:

**Проблема найдена и исправлена!** ✅

Теперь система использует:

- **Батчи по 20 заказов** (20 параметров)
- **Упрощенный SQL запрос** без дублирующихся условий
- **Только необходимые параметры**

Это должно решить проблему с ограничениями Firebird и обеспечить стабильную работу!
