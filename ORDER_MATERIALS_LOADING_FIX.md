# 🔧 Исправление бесконечной загрузки материалов заказа

## ❌ Проблема:

Пользователь сообщил:

```
загрузка на клиенте идет бесконечно
дело не в этом. Дело в том что при раскрытии заказа не отображаются изделия и идет загрузка бесконечно
```

## 🔍 **Анализ проблем:**

1. **Дублирование маршрутов** в `server/AW/index.js` для `/app/statistics/order-materials/:orderId`
2. **Недостаточное логирование** на клиенте для отладки
3. **Отсутствие обработки ошибок** с детальной информацией
4. **Проблема с useCallback** - функция `loadOrderMaterials` не была обернута в `useCallback`

## 🔧 **Решения:**

### 1. **Исправлено дублирование маршрутов**

```javascript
// server/AW/index.js
// БЫЛО (дублирование):
app.post('/app/statistics/order-materials/:orderId', async (req, res) => {
  // Первый маршрут
})
app.post('/app/statistics/order-materials/:orderId', async (req, res) => {
  // Второй маршрут - конфликт!
})

// СТАЛО (исправлено):
app.post('/app/statistics/order-materials/:orderId', async (req, res) => {
  // Основной маршрут для загрузки материалов заказа
})
app.post('/app/statistics/order-materials-summary/:orderId', async (req, res) => {
  // Отдельный маршрут для статистики
})
```

### 2. **Добавлено подробное логирование**

```javascript
// client/src/routes/statistics/MaterialSearchPage.jsx
const loadOrderMaterials = useCallback(
  async (orderId) => {
    try {
      setLoading(true)
      console.log(`Loading materials for order ${orderId}`)
      console.log('Sending filters:', filters) // ← Новое логирование

      const response = await axios.post(
        `${API_BASE_URL}5005/app/statistics/order-materials/${orderId}`,
        filters
      )

      console.log('Response received:', response.data) // ← Новое логирование

      if (response.data.success) {
        const orderData = response.data.data
        console.log('Order data:', orderData) // ← Новое логирование
        // ...
      }
    } catch (error) {
      console.error('Error loading order materials:', error)
      console.error('Error response:', error.response?.data) // ← Новое логирование
      console.error('Error status:', error.response?.status) // ← Новое логирование
      setError(`Ошибка при загрузке материалов заказа: ${error.message}`)
    } finally {
      setLoading(false)
    }
  },
  [filters]
)
```

### 3. **Исправлена проблема с useCallback**

```javascript
// БЫЛО:
const loadOrderMaterials = async (orderId) => {
  // Функция без useCallback
}

// СТАЛО:
const loadOrderMaterials = useCallback(
  async (orderId) => {
    // Функция с useCallback и правильными зависимостями
  },
  [filters]
)
```

### 4. **Добавлено логирование при раскрытии заказа**

```javascript
// Переключение развернутости заказа
const toggleOrderExpansion = useCallback(
  (orderId) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
        // Загружаем материалы при раскрытии заказа
        const order = data?.orders?.find((o) => o.orderId === orderId)
        if (order && !order.materialsLoaded) {
          console.log(`Expanding order ${orderId}, loading materials...`) // ← Новое логирование
          loadOrderMaterials(orderId)
        }
      }
      return newSet
    })
  },
  [data?.orders, loadOrderMaterials]
)
```

## 📊 **Структура исправлений:**

### **Backend (server/AW/index.js):**

- ✅ Убрано дублирование маршрута `/app/statistics/order-materials/:orderId`
- ✅ Создан отдельный маршрут `/app/statistics/order-materials-summary/:orderId`
- ✅ Основной маршрут использует `statisticsController.getOrderMaterials`

### **Frontend (client/src/routes/statistics/MaterialSearchPage.jsx):**

- ✅ Добавлено подробное логирование в `loadOrderMaterials`
- ✅ Улучшена обработка ошибок с детальной информацией
- ✅ Исправлена проблема с `useCallback` для `loadOrderMaterials`
- ✅ Добавлено логирование при раскрытии заказа

## 🎯 **Ожидаемый результат:**

### **Теперь при раскрытии заказа:**

1. **В консоли браузера** будет видно:

   ```
   Expanding order 12345, loading materials...
   Loading materials for order 12345
   Sending filters: {startDate: "2025-09-01", ...}
   Response received: {success: true, data: {...}}
   Order data: {orderId: 12345, items: [...], ...}
   ```

2. **При ошибке** будет видно:

   ```
   Error loading order materials: Error: Request failed with status code 500
   Error response: {success: false, message: "Database connection error"}
   Error status: 500
   ```

3. **Материалы заказа** должны загружаться и отображаться корректно

## 🚀 **Статус:**

**Исправление завершено!** ✅

Теперь:

- **Нет дублирования маршрутов** - каждый эндпоинт имеет уникальный путь
- **Подробное логирование** - можно отследить весь процесс загрузки
- **Правильная обработка ошибок** - пользователь видит детали ошибок
- **Исправлен useCallback** - нет проблем с зависимостями

**Попробуйте раскрыть заказ - теперь должно работать корректно!** 🎉
