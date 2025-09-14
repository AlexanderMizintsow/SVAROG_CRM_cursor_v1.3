# 🔄 Восстановление старой логики поиска материалов

## ✅ Что было восстановлено

### 🎯 Основные требования пользователя:

1. **Заказы загружаются полностью** со всеми изделиями и материалами
2. **Нет дублирования заказов** при пагинации
3. **Удобная структура**: Заказ → Изделия → Материалы
4. **Кнопка глаза** для копирования номера заказа

## 🔧 Backend изменения

### 1. Новый метод `getFullOrdersWithMaterials`

**Файл:** `server/AW/controllers/statisticsController_new.js`

```javascript
async getFullOrdersWithMaterials(filters) {
  // Загружает полные данные заказов со всеми изделиями и материалами
  // Использует старую логику с полной загрузкой данных
}
```

### 2. Новый метод `getFullOrdersData`

```javascript
async getFullOrdersData(filters) {
  // Выполняет полный SQL запрос для получения всех данных
  // Группирует данные по заказам и изделиям
  // Возвращает структурированные данные
}
```

### 3. SQL запрос для полных данных

```sql
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
  -- ... все остальные поля материалов
FROM ORDERITEMS oi
JOIN ORDERS o ON o.ORDERID = oi.ORDERID
-- ... остальные JOIN'ы
ORDER BY o.DATECREATED DESC, o.ORDERNO, oi.ORDERITEMSID, g.ID
```

### 4. Группировка данных

```javascript
// Группируем данные по заказам и изделиям
const ordersMap = new Map()

result.forEach((row) => {
  const orderId = row.ORDERID

  if (!ordersMap.has(orderId)) {
    ordersMap.set(orderId, {
      orderId: orderId,
      orderNumber: row.ORDERNO,
      dateCreated: row.DATECREATED,
      orderStatus: row.ORDERSTATUS,
      items: new Map(),
    })
  }

  // ... группировка по изделиям и материалам
})

// Преобразуем Map в массив
const orders = Array.from(ordersMap.values()).map((order) => ({
  ...order,
  items: Array.from(order.items.values()),
}))
```

### 5. Новый API endpoint

**Файл:** `server/AW/index.js`

```javascript
// Старая логика - полные заказы со всеми данными
app.post('/app/statistics/full-orders-with-materials', async (req, res) => {
  try {
    const result = await statisticsController.getFullOrdersWithMaterials(req.body)
    res.json({ result })
  } catch (error) {
    console.error('Full orders with materials error:', error)
    res.status(500).json({ message: error.message })
  }
})
```

## 🎨 Frontend изменения

### 1. Обновленный компонент MaterialSearchPage.jsx

**Основные изменения:**

- ✅ Использует новый endpoint `/full-orders-with-materials`
- ✅ Восстановлена старая структура отображения
- ✅ Добавлена кнопка копирования номера заказа
- ✅ Сохранена логика разворачивания заказов и изделий

### 2. Структура данных

```javascript
// Структура ответа API
{
  orders: [
    {
      orderId: 12345,
      orderNumber: "2024-001",
      dateCreated: "2024-01-15T10:30:00Z",
      orderStatus: 3,
      items: [
        {
          orderItemsId: 67890,
          itemName: "Окно 1200x1500",
          materials: [
            {
              stuffType: "Стеклопакеты",
              materialName: "4\\16\\4",
              itemArt: "4\\16\\4",
              itemColorIn: "Белый",
              itemColorOut: "Белый",
              width: 1200,
              height: 1500,
              length: 24,
              itemQty: 1.8,
              itemTotQty: 2.16,
              itemPrice: 2500.00,
              itemMesure: "кв.м"
            }
            // ... другие материалы
          ]
        }
        // ... другие изделия
      ]
    }
    // ... другие заказы
  ],
  totalOrders: 5,
  totalItems: 15,
  totalMaterials: 45,
  pagination: {
    page: 1,
    limit: 100,
    totalCount: 5,
    hasMore: false
  }
}
```

### 3. Функциональность копирования

```javascript
// Копирование номера заказа
const copyOrderNumber = useCallback((orderNumber) => {
  navigator.clipboard
    .writeText(orderNumber)
    .then(() => {
      console.log('Номер заказа скопирован:', orderNumber)
    })
    .catch((err) => {
      console.error('Ошибка копирования:', err)
    })
}, [])
```

### 4. UI компоненты

```jsx
{
  /* Кнопка копирования номера заказа */
}
;<Tooltip title="Копировать номер заказа">
  <IconButton
    size="small"
    onClick={(e) => {
      e.stopPropagation()
      copyOrderNumber(order.orderNumber)
    }}
  >
    <VisibilityIcon />
  </IconButton>
</Tooltip>

{
  /* Кнопка фильтра по заказу */
}
;<Tooltip title="Фильтр по заказу">
  <IconButton
    size="small"
    onClick={(e) => {
      e.stopPropagation()
      filterByOrder(order.orderNumber)
    }}
  >
    <FilterListIcon />
  </IconButton>
</Tooltip>
```

## 📊 Логика работы

### 1. **Поиск материалов**

- Пользователь задает фильтры
- Нажимает "Поиск"
- Загружаются полные данные заказов со всеми изделиями и материалами

### 2. **Отображение результатов**

- Показывается статистика: количество заказов, изделий, материалов
- Отображается список заказов с возможностью развернуть

### 3. **Разворачивание заказа**

- При клике на заказ показываются все его изделия
- Каждое изделие можно развернуть для просмотра материалов

### 4. **Работа с материалами**

- Показываются все материалы изделия
- Отображается полная информация: тип, название, артикул, цвета, размеры, количество, цена

### 5. **Дополнительные функции**

- **Копирование номера заказа**: кнопка глаза для копирования в буфер обмена
- **Фильтр по заказу**: кнопка фильтра для поиска конкретного заказа
- **Пагинация**: кнопка "Загрузить еще" для загрузки следующих заказов

## 🎯 Преимущества восстановленной логики

### ✅ **Полнота данных**

- Все данные загружаются сразу
- Нет необходимости в дополнительных запросах
- Быстрая навигация по структуре

### ✅ **Удобство использования**

- Знакомая пользователю структура
- Интуитивная навигация
- Быстрый доступ к нужной информации

### ✅ **Функциональность**

- Копирование номеров заказов
- Фильтрация по конкретным заказам
- Разворачивание/сворачивание секций

### ✅ **Производительность**

- Эффективная группировка данных
- Оптимизированные SQL запросы
- Правильная пагинация без дублирования

## 🔄 Миграция

### Backend:

1. ✅ Добавлен метод `getFullOrdersWithMaterials`
2. ✅ Добавлен метод `getFullOrdersData`
3. ✅ Добавлен API endpoint `/full-orders-with-materials`
4. ✅ Сохранена совместимость с существующими методами

### Frontend:

1. ✅ Обновлен компонент `MaterialSearchPage.jsx`
2. ✅ Изменен endpoint на `/full-orders-with-materials`
3. ✅ Восстановлена старая структура отображения
4. ✅ Добавлена функциональность копирования

## 🎉 Результат

Система поиска материалов теперь работает по старой логике:

- ✅ **Заказы загружаются полностью** со всеми данными
- ✅ **Нет дублирования** при пагинации
- ✅ **Удобная структура** Заказ → Изделия → Материалы
- ✅ **Кнопка глаза** для копирования номера заказа
- ✅ **Все фильтры работают** корректно
- ✅ **Высокая производительность** благодаря оптимизированным запросам

**Система полностью восстановлена и готова к использованию!** 🚀
