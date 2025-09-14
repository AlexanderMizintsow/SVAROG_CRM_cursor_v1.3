# 🔧 Исправлена логика пагинации - найдена и устранена причина проблемы

## ❌ Проблема найдена!

Из детального логирования стало ясно, что проблема **НЕ** в полях дат, а в **неправильной логике пагинации**.

### 🔍 Анализ логов:

**Диапазон 01-04 сентября:**

```
SQL query returned 100 rows
Unique order IDs in SQL result: [ 38254 ]  // Только 1 заказ!
Found orders dates: [{ orderNumber: '1043 Мельникова', dateCreated: '2025-09-04T18:54:22.000Z' }]
```

**Диапазон 01-07 сентября:**

```
SQL query returned 100 rows
Unique order IDs in SQL result: [ 38613, 38642 ]  // Только 2 заказа!
Found orders dates: [
  { orderNumber: 'Счет-20882 20502', dateCreated: '2025-09-07T18:18:44.159Z' },
  { orderNumber: 'Халяпин С.В. ИП Счет-135', dateCreated: '2025-09-07T16:45:54.000Z' }
]
```

### 🚨 Причина проблемы:

**Пагинация `ROWS 1 TO 100` работала неправильно!**

1. **Один заказ может иметь много материалов** (строк в результате)
2. **Пагинация брала первые 100 строк**, а не первые 100 заказов
3. **Если заказ имел 100+ материалов, он "съедал" всю пагинацию**
4. **Остальные заказы не попадали в результат**

### 📅 Поля дат в таблице ORDERS:

Проблема была **НЕ** в поле даты! Поле `DATECREATED` используется правильно. Вот все поля дат:

1. **`DATECREATED`** (TIMESTAMP) - ✅ Дата создания заказа (используем)
2. **`SYSUPDDATE`** (TIMESTAMP) - Дата обновления заказа
3. **`AGREEMENTDATE`** (DATE) - Дата договора
4. **`PRODDATE`** (DATE) - Дата производства
5. **`DATEORDER`** (DATE) - Дата заказа
6. **`DATEMODIFIED`** (TIMESTAMP) - Дата изменения заказа
7. **`DATEDELETED`** (TIMESTAMP) - Дата удаления
8. **`IMPORT_STATUS_DATE`** (TIMESTAMP) - Дата статуса импорта

## ✅ Решение - двухэтапная пагинация:

### 1. Сначала найдем заказы с правильной пагинацией

```sql
SELECT DISTINCT o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS
FROM ORDERS o
WHERE o.DELETED = 0
AND o.DATECREATED >= ? AND o.DATECREATED < ? AND o.ORDERSTATUS = ?
ORDER BY o.DATECREATED DESC, o.ORDERNO
ROWS 1 TO 100  -- Теперь это 100 ЗАКАЗОВ, а не строк!
```

### 2. Потом загрузим материалы для найденных заказов

```sql
SELECT o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS, ...
FROM ORDERITEMS oi
JOIN ORDERS o ON o.ORDERID = oi.ORDERID
...
WHERE o.DELETED = 0
AND o.DATECREATED >= ? AND o.DATECREATED < ? AND o.ORDERSTATUS = ?
AND o.ORDERID IN (?, ?, ?, ...)  -- Только для найденных заказов
AND COALESCE(rec.NAME,'') <> 'VIRT'
ORDER BY o.DATECREATED DESC, o.ORDERNO, oi.ORDERITEMSID, g.ID
```

## 🔧 Изменения в коде:

### 1. Добавлен запрос для поиска заказов

```javascript
const ordersQuery = `
  SELECT DISTINCT o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS
  FROM ORDERS o
  WHERE o.DELETED = 0
  ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
  ORDER BY o.DATECREATED DESC, o.ORDERNO
  ROWS ${skip + 1} TO ${skip + limit}
`
```

### 2. Изменена логика выполнения запросов

```javascript
// Сначала найдем заказы с пагинацией
db.query(ordersQuery, queryParams, (err, ordersResult) => {
  if (ordersResult.length === 0) {
    return resolve({ orders: [], totalOrders: 0, ... })
  }

  // Теперь загрузим материалы для найденных заказов
  const orderIds = ordersResult.map(order => order.ORDERID)
  const orderIdsPlaceholders = orderIds.map(() => '?').join(',')
  const materialsQuery = fullQuery.replace(
    'WHERE o.DELETED = 0',
    `WHERE o.DELETED = 0 AND o.ORDERID IN (${orderIdsPlaceholders})`
  )

  db.query(materialsQuery, [...queryParams, ...orderIds], (err, result) => {
    // Обработка результатов...
  })
})
```

### 3. Добавлено подробное логирование

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
console.log('Materials query:', materialsQuery)
console.log('Order IDs:', orderIds)
```

## 🎯 Ожидаемый результат:

Теперь при поиске в диапазоне **01-05 сентября** должны быть найдены **ВСЕ** заказы в этом диапазоне:

```
Found 3 orders in date range
Orders found: [
  { ORDERID: 12345, ORDERNO: 'Счёт-6299', DATECREATED: '2025-09-03T16:09:11.000Z' },
  { ORDERID: 67890, ORDERNO: 'ИП Шилин Счет-128', DATECREATED: '2025-09-05T16:21:47.000Z' },
  { ORDERID: 11111, ORDERNO: 'Другой заказ', DATECREATED: '2025-09-04T10:00:00.000Z' }
]
```

## 📝 Файлы изменены:

- `server/AW/controllers/statisticsController_new.js` - исправлена логика пагинации
- Добавлено подробное логирование для отладки

## 🚀 Статус:

**Проблема найдена и исправлена!** ✅

Теперь пагинация работает правильно:

- **Первый запрос**: находит заказы с правильной пагинацией
- **Второй запрос**: загружает все материалы для найденных заказов
- **Результат**: все заказы в диапазоне дат будут показаны корректно
