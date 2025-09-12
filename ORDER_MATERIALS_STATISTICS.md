# Статистика по материалам для каждого заказа

## 🎯 Новая функциональность

Теперь для каждого отображаемого заказа показывается **детальная статистика по материалам**, которая загружается автоматически при раскрытии заказа.

## 📊 Что отображается

### 1. В списке заказов (свернутом виде)

```
Заказ № 12345
15.01.2024 • 5 изделий • 12 материалов • 25.5 ед. • 15000 ₽
```

### 2. В развернутом заказе

**Статистика по материалам заказа:**
| Тип материала | Материал | Артикул | Изделий | Количество | Стоимость |
|---------------|----------|---------|---------|------------|-----------|
| Стеклопакеты | Стеклопакет 4-16-4 | SP-4-16-4 | 3 | 15.5 м² | 8000 ₽ |
| Профиль | Профиль 70 | PR-70 | 5 | 10 м | 7000 ₽ |

**Итоговые чипы:**

- Итого: 5 изделий
- 2 материалов
- 25.5 ед.
- 15000 ₽

## 🔄 Логика работы

### 1. Автоматическая загрузка

При раскрытии заказа автоматически загружается:

- Детальная информация по заказу (изделия и материалы)
- **Статистика по материалам заказа** (новая функциональность)

### 2. Кэширование

- Статистика по материалам кэшируется в `orderMaterialsStats`
- Повторное раскрытие заказа не требует повторной загрузки

### 3. Группировка по фильтрам

Статистика по материалам заказа учитывает те же фильтры, что и общий поиск:

- **По типу материала**: группировка по типам
- **По артикулу/наименованию**: группировка по конкретным материалам
- **По периоду**: группировка по всем материалам

## 🛠️ Техническая реализация

### Backend

#### Новый метод: `getOrderMaterialsSummary(orderId, filters)`

```javascript
async getOrderMaterialsSummary(orderId, filters) {
  // Определяем уровень группировки на основе фильтров
  let groupByFields = 'ggt.ID, ggt.NAME, g.ID, g.NAME, g.MARKING, m.SHORTNAME'

  // Если есть фильтр по конкретному материалу
  if (validatedFilters.materialName || validatedFilters.materialMarking) {
    groupByFields = 'g.ID, g.NAME, g.MARKING, ggt.ID, ggt.NAME, m.SHORTNAME'
  }
  // Если есть фильтр только по типу материала
  else if (validatedFilters.stuffType) {
    groupByFields = 'ggt.ID, ggt.NAME'
  }

  // SQL запрос с группировкой
  const orderMaterialsQuery = `
    SELECT
      ${selectFields},
      COUNT(DISTINCT oi.ORDERITEMSID) as items_count,
      SUM(...) as total_quantity,
      SUM(itd.SAVINGCOST) as total_cost
    FROM ORDERITEMS oi
    JOIN ORDERS o ON o.ORDERID = oi.ORDERID
    -- ... остальные JOIN'ы
    WHERE o.ORDERID = ?
    AND o.DELETED = 0
    AND COALESCE(rec.NAME,'') <> 'VIRT'
    ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
    GROUP BY ${groupByFields}
    ORDER BY total_cost DESC
  `
}
```

#### Новый API endpoint

```
POST /app/statistics/order-materials/:orderId
```

### Frontend

#### Новые состояния

```javascript
const [orderMaterialsStats, setOrderMaterialsStats] = useState(new Map())
const [loadingMaterialsStats, setLoadingMaterialsStats] = useState(new Set())
```

#### Новая функция загрузки

```javascript
const loadOrderMaterialsStats = useCallback(
  async (orderId) => {
    // Загрузка статистики по материалам для конкретного заказа
    const response = await fetch(`/app/statistics/order-materials/${orderId}`, {
      method: 'POST',
      body: JSON.stringify(cleanFilters),
    })
    const result = await response.json()
    setOrderMaterialsStats((prev) => new Map(prev).set(orderId, result.result))
  },
  [filters]
)
```

#### Обновленная функция раскрытия

```javascript
const toggleOrderExpansion = useCallback(
  async (orderId) => {
    // ... существующая логика ...

    // Загружаем статистику по материалам заказа
    if (!orderMaterialsStats.has(orderId) && !loadingMaterialsStats.has(orderId)) {
      loadOrderMaterialsStats(orderId)
    }
  },
  [
    orderDetails,
    loadingDetails,
    loadOrderDetails,
    orderMaterialsStats,
    loadingMaterialsStats,
    loadOrderMaterialsStats,
  ]
)
```

## 📈 Структура данных

### Ответ API `/app/statistics/order-materials/:orderId`

```javascript
{
  orderId: 12345,
  materials: [
    {
      STUFF_TYPE_ID: 1,
      STUFF_TYPE_NAME: "Стеклопакеты",
      MATERIAL_ID: 123,
      MATERIAL_NAME: "Стеклопакет 4-16-4",
      MATERIAL_MARKING: "SP-4-16-4",
      MEASURE_UNIT: "м²",
      ITEMS_COUNT: 3,           // В скольких изделиях заказа
      TOTAL_QUANTITY: 15.5,     // Общее количество в заказе
      TOTAL_COST: 8000.00       // Общая стоимость в заказе
    }
  ],
  totals: {
    totalItems: 5,              // Общее количество изделий
    totalMaterials: 2,          // Количество уникальных материалов
    totalQuantity: 25.5,        // Общее количество
    totalCost: 15000.00         // Общая стоимость
  },
  grouping: "by_material"       // Тип группировки
}
```

## 🎨 UI компоненты

### 1. Статистика в списке заказов

```jsx
<Typography variant="body2" color="text.secondary">
  {format(new Date(order.DATECREATED), 'dd.MM.yyyy', { locale: ru })} •{order.items_count} изделий •{' '}
  {order.materials_count} материалов
  {order.total_quantity && <> • {order.total_quantity.toFixed(2)} ед.</>}
  {order.total_cost && <> • {order.total_cost.toFixed(2)} ₽</>}
</Typography>
```

### 2. Детальная таблица материалов

```jsx
<TableContainer>
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell>Тип материала</TableCell>
        <TableCell>Материал</TableCell>
        <TableCell>Артикул</TableCell>
        <TableCell>Изделий</TableCell>
        <TableCell>Количество</TableCell>
        <TableCell>Стоимость</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {materialsStats.materials.map((material, index) => (
        <TableRow key={index}>
          <TableCell>
            <Chip label={material.STUFF_TYPE_NAME} size="small" />
          </TableCell>
          <TableCell>{material.MATERIAL_NAME || '-'}</TableCell>
          <TableCell>
            <Typography variant="body2" fontFamily="monospace">
              {material.MATERIAL_MARKING || '-'}
            </Typography>
          </TableCell>
          <TableCell>{material.ITEMS_COUNT}</TableCell>
          <TableCell>
            {material.TOTAL_QUANTITY
              ? `${material.TOTAL_QUANTITY.toFixed(2)} ${material.MEASURE_UNIT || 'ед.'}`
              : '-'}
          </TableCell>
          <TableCell>{material.TOTAL_COST ? `${material.TOTAL_COST.toFixed(2)} ₽` : '-'}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

### 3. Итоговые чипы

```jsx
<Box display="flex" gap={2} mt={2}>
  <Chip label={`Итого: ${materialsStats.totals.totalItems} изделий`} color="primary" size="small" />
  <Chip
    label={`${materialsStats.totals.totalMaterials} материалов`}
    color="secondary"
    size="small"
  />
  {materialsStats.totals.totalQuantity > 0 && (
    <Chip
      label={`${materialsStats.totals.totalQuantity.toFixed(2)} ед.`}
      color="warning"
      size="small"
      variant="outlined"
    />
  )}
  {materialsStats.totals.totalCost > 0 && (
    <Chip
      label={`${materialsStats.totals.totalCost.toFixed(2)} ₽`}
      color="success"
      size="small"
      variant="outlined"
    />
  )}
</Box>
```

## ⚡ Производительность

### Оптимизации

1. **Ленивая загрузка**: Статистика загружается только при раскрытии заказа
2. **Кэширование**: Повторное раскрытие не требует повторной загрузки
3. **Параллельная загрузка**: Статистика и детали загружаются одновременно
4. **Эффективные запросы**: Группировка на уровне SQL

### Индексы

```sql
-- Для ускорения запросов по заказам
CREATE INDEX IDX_ORDERS_MAIN_FILTERS ON ORDERS (DELETED, ORDERSTATUS, DATECREATED DESC);
CREATE INDEX IDX_ORDERITEMS_ORDER ON ORDERITEMS (ORDERID, ORDERITEMSID);
CREATE INDEX IDX_ITEMSDETAIL_ORDER_GOODS ON ITEMSDETAIL (ORDERITEMSID, GOODSID, MODELNO);
```

## 🎯 Преимущества

1. **Детальная информация**: Полная статистика по материалам для каждого заказа
2. **Контекстная группировка**: Учитывает активные фильтры поиска
3. **Удобство использования**: Автоматическая загрузка при раскрытии
4. **Производительность**: Быстрые запросы с кэшированием
5. **Визуальная ясность**: Понятные таблицы и чипы с итогами

## 📝 Заключение

Теперь каждый заказ показывает:

- ✅ Общую статистику в свернутом виде
- ✅ Детальную статистику по материалам в развернутом виде
- ✅ Группировку по материалам в зависимости от фильтров
- ✅ Количество, стоимость и единицы измерения
- ✅ Быструю загрузку с кэшированием

**Функциональность полностью готова к использованию!** 🚀
