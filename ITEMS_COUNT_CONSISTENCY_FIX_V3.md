# Исправление несогласованности количества изделий в заказах (версия 3)

## Проблема

После раскрытия заказа количество изделий менялось с того, что показывалось изначально. Например:

- До загрузки: 7 изделий с искомым материалом
- После загрузки: 3 изделия

## Причина

В методе `getOrderMaterials` использовались только фильтры по материалам (`buildMaterialWhereConditions`), но не применялись фильтры по датам и статусу заказа, которые использовались в основном запросе `getFullOrdersData`.

## Решение

Изменили метод `getOrderMaterials` в `statisticsController_new.js`:

### До исправления:

```javascript
// Строим условия фильтрации ТОЛЬКО по материалам (без дат и статуса)
const materialFilters = {
  stuffType: filters.stuffType || '',
  materialName: filters.materialName || '',
  materialMarking: filters.materialMarking || '',
  year: filters.year || '2025',
}

const { whereClause, params } = buildMaterialWhereConditions(materialFilters)
```

### После исправления:

```javascript
// Строим условия фильтрации - используем ВСЕ фильтры как в основном запросе
const { whereClause, params } = buildWhereConditions(filters)
```

## Результат

Теперь при раскрытии заказа применяются те же фильтры, что и при первоначальном поиске, что обеспечивает согласованность количества изделий.

## Файлы изменены

- `server/AW/controllers/statisticsController_new.js` - метод `getOrderMaterials`
