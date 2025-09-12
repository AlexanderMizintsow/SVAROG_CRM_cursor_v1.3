# Соответствие фильтров клиента и сервера

## Фильтры на клиенте (MaterialSearchPage.jsx)

```javascript
const [filters, setFilters] = useState({
  startDate: '', // Дата начала
  endDate: '', // Дата окончания
  orderStatus: '', // Статус заказа
  stuffType: '', // Тип товара
  materialName: '', // Наименование материала
  materialMarking: '', // Артикул материала
  orderNumber: '', // Номер заказа
  year: new Date().getFullYear().toString(), // Год БД
})
```

## Обработка фильтров на сервере

### 1. Валидация (validateFilters)

✅ **startDate** - проверка формата даты  
✅ **endDate** - проверка формата даты  
✅ **orderStatus** - проверка значений 3 или 4  
✅ **stuffType** - проверка типа  
✅ **materialName** - проверка строки  
✅ **materialMarking** - проверка строки  
✅ **orderNumber** - проверка строки  
✅ **year** - проверка диапазона 2020-2030

### 2. Построение SQL условий (buildWhereConditions)

| Фильтр клиента    | SQL условие              | Параметр |
| ----------------- | ------------------------ | -------- |
| `startDate`       | `o.DATECREATED >= ?`     | ✅       |
| `endDate`         | `o.DATECREATED <= ?`     | ✅       |
| `orderStatus`     | `o.ORDERSTATUS = ?`      | ✅       |
| `stuffType`       | `ggt.ID = ?`             | ✅       |
| `materialName`    | `g.NAME CONTAINING ?`    | ✅       |
| `materialMarking` | `g.MARKING CONTAINING ?` | ✅       |
| `orderNumber`     | `o.ORDERNO CONTAINING ?` | ✅       |

### 3. Использование в запросах

#### getSearchSummary()

```sql
SELECT
  COUNT(DISTINCT o.ORDERID) as total_orders,
  COUNT(DISTINCT oi.ORDERITEMSID) as total_items,
  COUNT(DISTINCT g.ID) as total_materials,
  SUM(...) as total_quantity,
  SUM(itd.SAVINGCOST) as total_cost
FROM ORDERITEMS oi
JOIN ORDERS o ON o.ORDERID = oi.ORDERID
-- ... остальные JOIN'ы
WHERE o.DELETED = 0
  ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
  AND COALESCE(rec.NAME,'') <> 'VIRT'
```

#### getOrdersList()

```sql
SELECT DISTINCT
  o.ORDERID,
  o.ORDERNO,
  o.DATECREATED,
  o.ORDERSTATUS,
  COUNT(DISTINCT oi.ORDERITEMSID) as items_count,
  COUNT(DISTINCT g.ID) as materials_count
FROM ORDERITEMS oi
JOIN ORDERS o ON o.ORDERID = oi.ORDERID
-- ... остальные JOIN'ы
WHERE o.DELETED = 0
  ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
  AND COALESCE(rec.NAME,'') <> 'VIRT'
GROUP BY o.ORDERID, o.ORDERNO, o.DATECREATED, o.ORDERSTATUS
ORDER BY o.DATECREATED DESC, o.ORDERNO
ROWS [пагинация]
```

#### getOrderDetails()

```sql
SELECT
  oi.ORDERITEMSID,
  oi.NAME,
  g.MARKING,
  ggt.NAME as ITEM_DESC,
  g.NAME as ITEM_NAME,
  -- ... остальные поля
FROM ORDERITEMS oi
JOIN ORDERS o ON o.ORDERID = oi.ORDERID
-- ... остальные JOIN'ы
WHERE o.ORDERID = ?
  AND o.DELETED = 0
  AND COALESCE(rec.NAME,'') <> 'VIRT'
  ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
GROUP BY [все поля]
ORDER BY oi.ORDERITEMSID, g.MARKING
```

## Специальная обработка фильтров

### Поиск по номеру заказа

```javascript
if (filters.orderNumber) {
  if (
    filters.orderNumber.includes('-') ||
    filters.orderNumber.includes('_') ||
    filters.orderNumber.includes(' ')
  ) {
    // Точный поиск для сложных номеров
    conditions.push('o.ORDERNO CONTAINING ?')
    params.push(filters.orderNumber)
  } else {
    // Поиск по цифрам для простых номеров
    const orderNumberDigits = filters.orderNumber.replace(/\D/g, '')
    if (orderNumberDigits) {
      conditions.push('o.ORDERNO CONTAINING ?')
      params.push(orderNumberDigits)
    } else {
      conditions.push('o.ORDERNO CONTAINING ?')
      params.push(filters.orderNumber)
    }
  }
}
```

## Проверка полноты

### ✅ Все фильтры обрабатываются:

1. **startDate** - фильтрация по дате начала
2. **endDate** - фильтрация по дате окончания
3. **orderStatus** - фильтрация по статусу заказа
4. **stuffType** - фильтрация по типу товара
5. **materialName** - поиск по названию материала
6. **materialMarking** - поиск по артикулу материала
7. **orderNumber** - поиск по номеру заказа (с умной обработкой)
8. **year** - выбор базы данных по году

### ✅ Дополнительные условия:

- `o.DELETED = 0` - исключение удаленных заказов
- `COALESCE(rec.NAME,'') <> 'VIRT'` - исключение виртуальных материалов

## Заключение

**ВСЕ ФИЛЬТРЫ С КЛИЕНТА ПРАВИЛЬНО ОБРАБАТЫВАЮТСЯ В ЗАПРОСАХ К БАЗЕ ДАННЫХ**

Система фильтрации работает корректно и покрывает все возможные варианты поиска материалов в заказах.
