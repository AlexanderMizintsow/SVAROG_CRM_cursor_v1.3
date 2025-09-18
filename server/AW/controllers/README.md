# Контроллеры поиска материалов

## Описание

Модуль содержит контроллеры для работы с поиском материалов в заказах. Логика разделена на отдельные файлы для лучшей организации кода.

## Структура

```
controllers/
├── statisticsController.js    # Основной контроллер поиска материалов
├── README.md                  # Документация контроллеров
└── ...

utils/
├── statisticsUtils.js         # Утилиты для работы с поиском
└── ...

constants/
├── statisticsConstants.js     # Константы для поиска
└── ...
```

## StatisticsController

Основной контроллер для работы с поиском материалов в заказах.

### Методы

#### `getOrdersWithMaterials(filters)`

Получение заказов с материалами для поиска.

**Параметры:**

- `filters.startDate` - Дата начала (YYYY-MM-DD)
- `filters.endDate` - Дата окончания (YYYY-MM-DD)
- `filters.orderStatus` - Статус заказа (3-закрыт, 4-в производстве)
- `filters.stuffType` - Тип товара (код)
- `filters.materialName` - Наименование материала
- `filters.materialMarking` - Артикул материала
- `filters.orderNumber` - Номер заказа
- `filters.year` - Год базы данных

**Возвращает:** Promise<Object> - Объект с заказами и пагинацией

#### `getStuffTypes(year)`

Получение списка типов товаров.

**Параметры:**

- `year` - Год базы данных

**Возвращает:** Promise<Array> - Массив типов товаров

## API Endpoints

### GET /app/statistics/stuff-types/:year?

Получение типов товаров.

**Параметры URL:**

- `year` - Год базы данных (опционально)

### POST /app/statistics/full-orders-data

Получение списка заказов для поиска материалов.

### POST /app/statistics/order-materials/:orderId

Получение материалов конкретного заказа.

## Обработка ошибок

Все методы контроллера используют единообразную обработку ошибок:

- **Ошибки подключения к БД** - `ERROR_MESSAGES.DB_CONNECTION`
- **Ошибки выполнения запросов** - `ERROR_MESSAGES.QUERY_EXECUTION`
- **Ошибки валидации** - Соответствующие сообщения из `ERROR_MESSAGES`

## Валидация

Все входящие параметры проходят валидацию через `validateFilters()` из `statisticsUtils.js`:

- Проверка формата дат
- Проверка статусов заказов
- Проверка года
- Проверка других параметров

## Константы

Используются константы из `statisticsConstants.js`:

- `EXCLUDED_STUFF_TYPES` - Исключаемые типы товаров
- `EXCLUDED_STUFF_TYPE_IDS` - Исключаемые ID типов
- `ERROR_MESSAGES` - Сообщения об ошибках
- И другие константы

## Утилиты

Используются утилиты из `statisticsUtils.js`:

- `validateFilters()` - Валидация фильтров
- `buildWhereConditions()` - Построение условий WHERE
- И другие утилиты

## Примеры использования

### Получение статистики по сэндвич-панелям за месяц

```javascript
const filters = {
  startDate: '2024-03-01',
  endDate: '2024-03-31',
  materialName: 'сэндвич',
  year: '2025',
}

const result = await statisticsController.getOrdersStatistics(filters)
```

### Получение сводной статистики по заказам в производстве

```javascript
const filters = {
  orderStatus: 4,
  year: '2025',
}

const result = await statisticsController.getSummaryStatistics(filters)
```

## Логирование

Все операции логируются:

- Параметры запросов
- Количество найденных записей
- Ошибки выполнения

## Производительность

- Используются оптимизированные SQL запросы
- Группировка данных на уровне БД
- Валидация параметров перед выполнением запросов
- Обработка ошибок без утечек ресурсов

## Расширение

Для добавления новых методов статистики:

1. Добавьте метод в `StatisticsController`
2. Добавьте соответствующий маршрут в `index.js`
3. При необходимости добавьте константы в `statisticsConstants.js`
4. Добавьте утилиты в `statisticsUtils.js`
5. Обновите документацию
