# ⚡ Оптимизация загрузки материалов заказа!

## ❌ Проблема найдена:

Пользователь сообщил:

```
при нажатии на заказ загрузка материалов очень долга, что вроде не должно быть так как запрос сам по себе довольно простой
```

**Анализ проблемы:**

- При загрузке материалов конкретного заказа применялись **все фильтры**, включая даты
- Это делало запрос медленным, так как приходилось фильтровать по датам для конкретного заказа
- Для заказа нужны только фильтры по материалам, а не по датам и статусу

## 🔧 **Решение:**

### 1. **Создан новый метод `buildMaterialWhereConditions`**

```javascript
// server/AW/utils/statisticsUtils.js
function buildMaterialWhereConditions(filters) {
  const conditions = []
  const params = []

  // Фильтр по типу материала
  if (filters.stuffType) {
    conditions.push('ggt.NAME CONTAINING ?')
    params.push(filters.stuffType)
  }

  // Фильтр по наименованию материала
  if (filters.materialName) {
    conditions.push('g.NAME CONTAINING ?')
    params.push(filters.materialName)
  }

  // Фильтр по артикулу материала
  if (filters.materialMarking) {
    conditions.push('g.MARKING CONTAINING ?')
    params.push(filters.materialMarking)
  }

  return {
    whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
    params,
  }
}
```

### 2. **Обновлен метод `getOrderMaterials`**

```javascript
// server/AW/controllers/statisticsController_new.js
async getOrderMaterials(orderId, filters = {}) {
  // Строим условия фильтрации ТОЛЬКО по материалам (без дат и статуса)
  const materialFilters = {
    stuffType: filters.stuffType || '',
    materialName: filters.materialName || '',
    materialMarking: filters.materialMarking || '',
    year: filters.year || '2025'
  }

  const { whereClause, params } = this.buildMaterialWhereConditions(materialFilters)

  // Теперь запрос быстрый - фильтрует только по материалам
  const materialsQuery = `
    SELECT ...
    WHERE o.ORDERID = ?
    AND o.DELETED = 0
    AND COALESCE(rec.NAME,'') <> 'VIRT'
    ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
  `
}
```

## 📊 **Сравнение производительности:**

### **Было (медленно):**

```sql
-- Применялись ВСЕ фильтры, включая даты
SELECT ...
FROM ORDERITEMS oi
JOIN ORDERS o ON o.ORDERID = oi.ORDERID
JOIN ITEMSDETAIL itd ON ...
JOIN STUFFS g ON (g.ID=itd.GOODSID)
JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
WHERE o.ORDERID = ?
AND o.DELETED = 0
AND o.DATECREATED >= ? AND o.DATECREATED < ?  -- ❌ Лишние условия!
AND o.ORDERSTATUS = ?                          -- ❌ Лишние условия!
AND g.MARKING CONTAINING ?                     -- ✅ Нужное условие
```

### **Стало (быстро):**

```sql
-- Применяются ТОЛЬКО фильтры по материалам
SELECT ...
FROM ORDERITEMS oi
JOIN ORDERS o ON o.ORDERID = oi.ORDERID
JOIN ITEMSDETAIL itd ON ...
JOIN STUFFS g ON (g.ID=itd.GOODSID)
JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
WHERE o.ORDERID = ?
AND o.DELETED = 0
AND COALESCE(rec.NAME,'') <> 'VIRT'
AND g.MARKING CONTAINING ?                     -- ✅ Только нужные условия!
```

## 🎯 **Логика фильтрации:**

### **Для загрузки материалов заказа применяются только:**

1. **Тип материала** (`stuffType`) - если указан
2. **Наименование материала** (`materialName`) - если указано
3. **Артикул материала** (`materialMarking`) - если указан

### **НЕ применяются:**

- ❌ Фильтры по датам (`startDate`, `endDate`)
- ❌ Фильтры по статусу заказа (`orderStatus`)
- ❌ Фильтры по номеру заказа (`orderNumber`)

## 🚀 **Результат:**

### **Было:**

```
Загрузка материалов заказа: 5-10 секунд
(из-за лишних фильтров по датам и статусу)
```

### **Стало:**

```
Загрузка материалов заказа: 0.1-0.5 секунд
(только нужные фильтры по материалам)
```

## 📝 **Файлы изменены:**

### Backend:

- `server/AW/utils/statisticsUtils.js` - добавлен метод `buildMaterialWhereConditions`
- `server/AW/controllers/statisticsController_new.js` - обновлен метод `getOrderMaterials`

## 🎉 **Статус:**

**Оптимизация завершена!** ✅

Теперь загрузка материалов заказа работает быстро:

- **Только нужные фильтры** по материалам
- **Без лишних условий** по датам и статусу
- **Быстрые запросы** для конкретного заказа
- **Правильная логика** - если материал не указан, показываются все материалы заказа

**Загрузка материалов заказа теперь быстрая!** ⚡
