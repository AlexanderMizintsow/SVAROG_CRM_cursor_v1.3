# 🔧 Исправление конфигурации API

## ❌ Проблема

В компоненте `MaterialSearchPage.jsx` использовались хардкодные URL:

```javascript
// НЕПРАВИЛЬНО
const response = await fetch('http://localhost:5005/app/statistics/orders-with-materials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cleanFilters),
})
```

## ✅ Решение

Заменили на правильный подход с использованием конфигурации:

### 1. Добавили импорты

```javascript
import axios from 'axios'
import { API_BASE_URL } from '../../../config.js'
```

### 2. Заменили все fetch на axios

```javascript
// ПРАВИЛЬНО
const response = await axios.post(
  `${API_BASE_URL}5005/app/statistics/orders-with-materials`,
  cleanFilters
)
```

## 🔄 Изменения в файлах

### MaterialSearchPage.jsx

**Было:**

```javascript
// Загрузка типов товаров
const response = await fetch(`http://localhost:5005/app/statistics/stuff-types/${filters.year}`)
if (!response.ok) throw new Error('Ошибка загрузки типов товаров')
const result = await response.json()
setStuffTypes(result.result || [])
```

**Стало:**

```javascript
// Загрузка типов товаров
const response = await axios.get(`${API_BASE_URL}5005/app/statistics/stuff-types/${filters.year}`)
setStuffTypes(response.data.result || [])
```

**Было:**

```javascript
// Основной поиск
const response = await fetch('http://localhost:5005/app/statistics/orders-with-materials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cleanFilters),
})
if (!response.ok) throw new Error('Ошибка выполнения запроса')
const result = await response.json()
```

**Стало:**

```javascript
// Основной поиск
const response = await axios.post(
  `${API_BASE_URL}5005/app/statistics/orders-with-materials`,
  cleanFilters
)
const result = response.data
```

**Было:**

```javascript
// Поиск заказов
const response = await fetch('http://localhost:5005/app/statistics/search-orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...cleanFilters, orderNumber: query.trim() }),
})
if (!response.ok) throw new Error('Ошибка поиска заказов')
const result = await response.json()
```

**Стало:**

```javascript
// Поиск заказов
const response = await axios.post(`${API_BASE_URL}5005/app/statistics/search-orders`, {
  ...cleanFilters,
  orderNumber: query.trim(),
})
```

**Было:**

```javascript
// Детали заказа
const response = await fetch(`http://localhost:5005/app/statistics/order-details/${orderId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cleanFilters),
})
if (!response.ok) throw new Error('Ошибка загрузки деталей заказа')
const result = await response.json()
return result.result
```

**Стало:**

```javascript
// Детали заказа
const response = await axios.post(
  `${API_BASE_URL}5005/app/statistics/order-details/${orderId}`,
  cleanFilters
)
return response.data.result
```

**Было:**

```javascript
// Статистика по материалам заказа
const response = await fetch(`http://localhost:5005/app/statistics/order-materials/${orderId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cleanFilters),
})
if (!response.ok) throw new Error('Ошибка загрузки статистики по материалам')
const result = await response.json()
setOrderMaterialsStats((prev) => new Map(prev).set(orderId, result.result))
```

**Стало:**

```javascript
// Статистика по материалам заказа
const response = await axios.post(
  `${API_BASE_URL}5005/app/statistics/order-materials/${orderId}`,
  cleanFilters
)
setOrderMaterialsStats((prev) => new Map(prev).set(orderId, response.data.result))
```

## 🎯 Преимущества нового подхода

### 1. **Гибкость конфигурации**

- URL настраивается в одном месте (`config.js`)
- Легко переключаться между локальной и удаленной разработкой
- Поддержка разных окружений (dev, staging, production)

### 2. **Упрощение кода**

- Убрали дублирование заголовков
- Убрали проверки `response.ok`
- Убрали ручной парсинг JSON
- Более читаемый и лаконичный код

### 3. **Лучшая обработка ошибок**

- Axios автоматически обрабатывает HTTP ошибки
- Встроенная поддержка JSON парсинга
- Более предсказуемое поведение

### 4. **Консистентность**

- Единый подход во всем приложении
- Соответствие архитектуре проекта
- Легче поддерживать и развивать

## 📁 Структура конфигурации

```javascript
// client/config.js
export const API_BASE_URL = 'http://localhost:' //'http://192.168.57.112:' - рабочий
export const appTypeBuild = false
```

## 🔧 Использование в компонентах

```javascript
// Импорт
import axios from 'axios'
import { API_BASE_URL } from '../../../config.js'

// GET запрос
const response = await axios.get(`${API_BASE_URL}5005/endpoint`)

// POST запрос
const response = await axios.post(`${API_BASE_URL}5005/endpoint`, data)

// Доступ к данным
const result = response.data.result
```

## ✅ Результат

Теперь компонент `MaterialSearchPage.jsx`:

- ✅ Использует правильную конфигурацию API
- ✅ Совместим с архитектурой проекта
- ✅ Легко настраивается для разных окружений
- ✅ Имеет более чистый и читаемый код
- ✅ Лучше обрабатывает ошибки
- ✅ Соответствует стандартам проекта

**Все API вызовы теперь используют `API_BASE_URL` из конфигурации!** 🚀
