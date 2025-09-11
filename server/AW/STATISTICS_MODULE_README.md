# Модуль статистики и отчетов

## Обзор

Модуль статистики и отчетов предоставляет API для анализа данных по заказам, материалам и изделиям. Логика разделена на отдельные файлы для лучшей организации и поддержки кода.

## Структура модуля

```
server/AW/
├── controllers/
│   ├── statisticsController.js    # Основной контроллер статистики
│   └── README.md                  # Документация контроллеров
├── utils/
│   └── statisticsUtils.js         # Утилиты для работы со статистикой
├── constants/
│   └── statisticsConstants.js     # Константы для статистики
├── index.js                       # Основной файл сервера с маршрутами
├── database_schema.md             # Схема базы данных
├── README_STATISTICS.md           # Руководство пользователя
├── QUICK_START.md                 # Быстрый старт
└── STATISTICS_MODULE_README.md    # Этот файл
```

## Компоненты модуля

### 1. StatisticsController (`controllers/statisticsController.js`)

Основной контроллер, содержащий бизнес-логику для работы со статистикой.

**Основные методы:**

- `getOrdersStatistics()` - Детальная статистика по заказам
- `getSummaryStatistics()` - Сводная статистика по материалам
- `getStuffTypes()` - Список типов товаров
- `getOrdersOverview()` - Общая статистика по заказам
- `getMaterialsStatistics()` - Статистика по материалам

### 2. StatisticsUtils (`utils/statisticsUtils.js`)

Утилиты для работы со статистикой и отчетами.

**Основные функции:**

- `validateFilters()` - Валидация параметров фильтра
- `buildWhereConditions()` - Построение условий WHERE для SQL
- `formatDate()` - Форматирование дат
- `formatCurrency()` - Форматирование валюты
- `groupByMaterialType()` - Группировка по типам материалов
- `calculateTotals()` - Расчет общих показателей
- `sortData()` - Сортировка данных
- `paginateData()` - Пагинация данных
- `exportToCSV()` - Экспорт в CSV
- `getPeriodStatistics()` - Статистика по периодам

### 3. StatisticsConstants (`constants/statisticsConstants.js`)

Константы для модуля статистики.

**Основные константы:**

- `ORDER_STATUS` - Статусы заказов
- `STUFF_TYPE_CODES` - Коды типов товаров
- `EXCLUDED_STUFF_TYPES` - Исключаемые типы товаров
- `ERROR_MESSAGES` - Сообщения об ошибках
- `SUCCESS_MESSAGES` - Сообщения об успехе
- `SORT_FIELDS` - Поля для сортировки
- `EXPORT_FORMATS` - Форматы экспорта

## API Endpoints

### Основные маршруты статистики

| Метод | Путь                                 | Описание                         |
| ----- | ------------------------------------ | -------------------------------- |
| POST  | `/app/statistics/orders`             | Детальная статистика по заказам  |
| POST  | `/app/statistics/summary`            | Сводная статистика по материалам |
| GET   | `/app/statistics/stuff-types/:year?` | Список типов товаров             |
| POST  | `/app/statistics/overview`           | Общая статистика по заказам      |
| POST  | `/app/statistics/materials`          | Статистика по материалам         |

### Параметры запросов

#### POST /app/statistics/orders

```json
{
  "startDate": "2024-01-01", // Дата начала (YYYY-MM-DD)
  "endDate": "2024-12-31", // Дата окончания (YYYY-MM-DD)
  "orderStatus": 4, // Статус заказа (3-закрыт, 4-в производстве)
  "stuffType": "Profil", // Тип товара (код)
  "materialName": "сэндвич", // Наименование материала
  "year": "2025" // Год базы данных
}
```

#### POST /app/statistics/summary

```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "orderStatus": 4,
  "year": "2025"
}
```

## Примеры использования

### 1. Анализ сэндвич-панелей за месяц

```javascript
const filters = {
  startDate: '2024-03-01',
  endDate: '2024-03-31',
  materialName: 'сэндвич',
  year: '2025',
}

const response = await fetch('http://localhost:5005/app/statistics/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(filters),
})

const result = await response.json()
```

### 2. Статистика по заказам в производстве

```javascript
const filters = {
  orderStatus: 4,
  year: '2025',
}

const response = await fetch('http://localhost:5005/app/statistics/summary', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(filters),
})

const result = await response.json()
```

### 3. Получение типов товаров

```javascript
const response = await fetch('http://localhost:5005/app/statistics/stuff-types/2025')
const result = await response.json()
```

## Обработка ошибок

Все методы используют единообразную обработку ошибок:

```javascript
try {
  const result = await statisticsController.getOrdersStatistics(filters)
  res.json({ result })
} catch (error) {
  console.error('Statistics error:', error)
  res.status(500).json({ message: error.message })
}
```

**Типы ошибок:**

- `ERROR_MESSAGES.DB_CONNECTION` - Ошибка подключения к БД
- `ERROR_MESSAGES.QUERY_EXECUTION` - Ошибка выполнения запроса
- `ERROR_MESSAGES.INVALID_DATE` - Неверный формат даты
- `ERROR_MESSAGES.INVALID_STATUS` - Неверный статус заказа
- `ERROR_MESSAGES.INVALID_YEAR` - Неверный год

## Валидация данных

Все входящие параметры проходят валидацию:

```javascript
const validatedFilters = validateFilters(filters)
```

**Проверяется:**

- Формат дат (YYYY-MM-DD)
- Статусы заказов (3, 4)
- Год (2020-2030)
- Другие параметры

## Производительность

### Оптимизации

- Используются оптимизированные SQL запросы
- Группировка данных на уровне БД
- Валидация параметров перед выполнением запросов
- Обработка ошибок без утечек ресурсов

### Лимиты

- Максимум 10,000 записей для экспорта
- Размер страницы по умолчанию: 50 записей
- Максимальный размер страницы: 500 записей

## Безопасность

- Валидация всех входящих параметров
- Защита от SQL инъекций через параметризованные запросы
- Обработка ошибок без раскрытия внутренней информации
- Логирование всех операций

## Логирование

Все операции логируются:

```javascript
console.log('Executing statistics query with params:', allParams)
console.log(`Found ${result.length} records`)
console.error('Database query error:', err)
```

## Расширение модуля

### Добавление нового метода статистики

1. **Добавьте метод в StatisticsController:**

```javascript
async getNewStatistics(filters) {
  return new Promise((resolve, reject) => {
    // Логика метода
  })
}
```

2. **Добавьте маршрут в index.js:**

```javascript
app.post('/app/statistics/new', async (req, res) => {
  try {
    const result = await statisticsController.getNewStatistics(req.body)
    res.json({ result })
  } catch (error) {
    console.error('New statistics error:', error)
    res.status(500).json({ message: error.message })
  }
})
```

3. **Добавьте константы при необходимости:**

```javascript
// В statisticsConstants.js
const NEW_CONSTANTS = {
  // Новые константы
}
```

4. **Добавьте утилиты при необходимости:**

```javascript
// В statisticsUtils.js
function newUtilityFunction() {
  // Логика утилиты
}
```

5. **Обновите документацию**

## Тестирование

### Ручное тестирование

```bash
# Запуск сервера
cd server/AW
npm start

# Тестирование API
curl -X POST http://localhost:5005/app/statistics/orders \
  -H "Content-Type: application/json" \
  -d '{"year": "2025", "orderStatus": 4}'
```

### Автоматическое тестирование

Рекомендуется добавить unit-тесты для каждого метода контроллера.

## Мониторинг

### Метрики для отслеживания

- Время выполнения запросов
- Количество записей в результатах
- Частота ошибок
- Использование памяти

### Логи для анализа

- Параметры запросов
- Время выполнения
- Количество найденных записей
- Ошибки выполнения

## Поддержка

При возникновении проблем:

1. Проверьте логи сервера
2. Убедитесь в корректности параметров запроса
3. Проверьте подключение к базе данных
4. Обратитесь к администратору системы

## Версионирование

При изменении API рекомендуется:

1. Обновить версию в документации
2. Сохранить обратную совместимость
3. Уведомить пользователей об изменениях
4. Обновить тесты

## Заключение

Модуль статистики и отчетов предоставляет мощный и гибкий API для анализа данных по заказам. Модульная архитектура обеспечивает легкую поддержку и расширение функциональности.
