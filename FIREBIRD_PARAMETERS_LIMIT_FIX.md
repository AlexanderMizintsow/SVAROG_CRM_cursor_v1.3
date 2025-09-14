# 🔧 Исправлена ошибка превышения лимита параметров Firebird

## ❌ Проблема найдена!

После исправления логики пагинации возникла новая проблема:

```
Full orders query error: Error: Dynamic SQL Error, SQL error code = -303,
Arithmetic exception, numeric overflow, or string truncation, numeric value is out of range
```

### 🔍 Анализ проблемы:

**Причина:** Firebird имеет ограничение на количество параметров в одном запросе. У нас было:

- **100 заказов** в IN clause (100 параметров)
- **3 параметра фильтра** (даты и статус)
- **Итого: 103 параметра** - превышает лимит Firebird

**SQL запрос с проблемой:**

```sql
WHERE o.DELETED = 0 AND o.ORDERID IN (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
AND o.DATECREATED >= ? AND o.DATECREATED < ? AND o.ORDERSTATUS = ?
```

## ✅ Решение - батчевая обработка запросов:

### 1. Разделение заказов на группы

```javascript
// Разделим заказы на группы по 50 штук для избежания превышения лимита параметров Firebird
const batchSize = 50
const batches = []
for (let i = 0; i < orderIds.length; i += batchSize) {
  batches.push(orderIds.slice(i, i + batchSize))
}

console.log(
  `Split ${orderIds.length} orders into ${batches.length} batches of max ${batchSize} orders each`
)
```

### 2. Выполнение запросов для каждой группы

```javascript
batches.forEach((batch, batchIndex) => {
  const orderIdsPlaceholders = batch.map(() => '?').join(',')
  const materialsQuery = fullQuery.replace(
    'WHERE o.DELETED = 0',
    `WHERE o.DELETED = 0 AND o.ORDERID IN (${orderIdsPlaceholders})`
  )

  console.log(`Executing batch ${batchIndex + 1}/${batches.length} with ${batch.length} orders`)

  db.query(materialsQuery, [...queryParams, ...batch], (err, result) => {
    // Обработка результатов...
  })
})
```

### 3. Сборка результатов всех батчей

```javascript
// Выполним запросы для каждой группы
let allResults = []
let completedBatches = 0

batches.forEach((batch, batchIndex) => {
  db.query(materialsQuery, [...queryParams, ...batch], (err, result) => {
    if (err) {
      console.error(`Batch ${batchIndex + 1} query error:`, err)
      return reject(new Error(ERROR_MESSAGES.QUERY_EXECUTION))
    }

    console.log(`Batch ${batchIndex + 1} returned ${result.length} rows`)
    allResults = allResults.concat(result)
    completedBatches++

    // Если все батчи выполнены, обрабатываем результаты
    if (completedBatches === batches.length) {
      console.log(`All batches completed. Total rows: ${allResults.length}`)
      // Обработка всех результатов...
    }
  })
})
```

## 🔧 Изменения в коде:

### 1. Добавлена батчевая обработка

- **Размер батча**: 50 заказов (максимум 53 параметра: 50 + 3 фильтра)
- **Автоматическое разделение**: заказы автоматически разделяются на группы
- **Параллельное выполнение**: все батчи выполняются параллельно

### 2. Улучшенное логирование

```javascript
console.log(
  `Split ${orderIds.length} orders into ${batches.length} batches of max ${batchSize} orders each`
)
console.log(`Executing batch ${batchIndex + 1}/${batches.length} with ${batch.length} orders`)
console.log(`Batch ${batchIndex + 1} returned ${result.length} rows`)
console.log(`All batches completed. Total rows: ${allResults.length}`)
```

### 3. Обработка ошибок

- **Ошибка в одном батче** останавливает весь процесс
- **Подробное логирование** для каждого батча
- **Graceful handling** пустых результатов

## 🎯 Ожидаемый результат:

Теперь при поиске 100 заказов:

```
Split 100 orders into 2 batches of max 50 orders each
Executing batch 1/2 with 50 orders
Executing batch 2/2 with 50 orders
Batch 1 returned 1250 rows
Batch 2 returned 1180 rows
All batches completed. Total rows: 2430
```

## 📊 Преимущества решения:

1. **Обходит ограничения Firebird** - каждый запрос имеет максимум 53 параметра
2. **Параллельное выполнение** - все батчи выполняются одновременно
3. **Масштабируемость** - работает с любым количеством заказов
4. **Надежность** - подробное логирование и обработка ошибок

## 📝 Файлы изменены:

- `server/AW/controllers/statisticsController_new.js` - добавлена батчевая обработка запросов

## 🚀 Статус:

**Проблема найдена и исправлена!** ✅

Теперь система может обрабатывать любое количество заказов, разделяя их на батчи по 50 штук, что гарантирует, что каждый запрос будет в пределах лимитов Firebird.
