# 🔍 Добавлено детальное логирование для отладки

## ❌ Проблема

При фильтрации по диапазону дат наблюдается нелогичное поведение:

- **Диапазон 01-03 сентября**: находит заказ `Счёт-6299` (03 сентября)
- **Диапазон 01-05 сентября**: находит только заказ `ИП Шилин Счет-128` (05 сентября)

Но заказ `Счёт-6299` должен присутствовать в **обоих** диапазонах, так как он создан 03 сентября.

## 🔍 Анализ

Проблема может быть в том, что:

1. **Заказ `Счёт-6299` не содержит материалов** - фильтруется условием `COALESCE(rec.NAME,'') <> 'VIRT'`
2. **Проблема с группировкой данных** - заказ теряется при обработке
3. **Проблема с SQL запросом** - заказ не возвращается базой данных

## ✅ Решение - добавлено детальное логирование

### 1. Логирование SQL результата

```javascript
console.log(`SQL query returned ${result.length} rows`)
if (result.length > 0) {
  console.log(
    'First few rows:',
    result.slice(0, 3).map((row) => ({
      ORDERID: row.ORDERID,
      ORDERNO: row.ORDERNO,
      DATECREATED: row.DATECREATED,
      MATERIAL_NAME: row.MATERIAL_NAME,
    }))
  )
}
```

### 2. Логирование уникальных заказов

```javascript
const uniqueOrderIds = new Set()
result.forEach((row) => {
  uniqueOrderIds.add(row.ORDERID)
  // ... остальная логика
})

console.log(`Unique order IDs in SQL result:`, Array.from(uniqueOrderIds))
```

### 3. Логирование входных фильтров

```javascript
console.log('buildWhereConditions input filters:', filters)
console.log('buildWhereConditions result:', result)
```

### 4. Логирование SQL запроса

```javascript
console.log('Full SQL Query:', fullQuery)
console.log('Query parameters:', queryParams)
```

### 5. Логирование найденных заказов

```javascript
console.log(`Found ${totalOrders} orders for filters:`, validatedFilters)
if (orders.length > 0) {
  console.log(
    'Found orders dates:',
    orders.map((order) => ({
      orderNumber: order.orderNumber,
      dateCreated: order.dateCreated,
    }))
  )
}
```

## 📊 Что покажет логирование

Теперь в консоли будет видно:

1. **Входные фильтры** - какие даты и параметры передаются
2. **SQL запрос** - какой именно запрос выполняется к базе
3. **Параметры запроса** - с какими значениями
4. **Количество строк** - сколько строк вернула база данных
5. **Первые строки** - примеры возвращаемых данных
6. **Уникальные заказы** - какие заказы найдены в SQL результате
7. **Финальный результат** - какие заказы попали в ответ

## 🎯 Ожидаемый результат отладки

При правильной работе должно быть:

**Диапазон 01-03 сентября:**

```
Unique order IDs in SQL result: [12345]  // ID заказа Счёт-6299
Found orders dates: [{ orderNumber: 'Счёт-6299', dateCreated: '2025-09-03T16:09:11.000Z' }]
```

**Диапазон 01-05 сентября:**

```
Unique order IDs in SQL result: [12345, 67890]  // ID заказов Счёт-6299 и ИП Шилин Счет-128
Found orders dates: [
  { orderNumber: 'Счёт-6299', dateCreated: '2025-09-03T16:09:11.000Z' },
  { orderNumber: 'ИП Шилин Счет-128', dateCreated: '2025-09-05T16:21:47.000Z' }
]
```

## 🔍 Возможные причины проблемы

1. **Заказ без материалов** - если `Счёт-6299` не содержит материалов, он не попадет в SQL результат
2. **Фильтр VIRT** - материалы с `rec.NAME = 'VIRT'` исключаются
3. **Проблема с JOIN'ами** - заказ не связан с материалами через ITEMSDETAIL

## 📝 Файлы изменены

- `server/AW/controllers/statisticsController_new.js` - добавлено детальное логирование

## 🚀 Статус

**Готово к отладке!** ✅

Теперь при выполнении поиска в консоли будет подробная информация, которая поможет точно определить причину проблемы.
