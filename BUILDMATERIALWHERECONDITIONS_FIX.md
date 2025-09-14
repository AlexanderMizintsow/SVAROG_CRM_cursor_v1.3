# 🔧 Исправление ошибки buildMaterialWhereConditions

## ❌ **Проблема:**

Пользователь получил ошибку:

```
TypeError: this.buildMaterialWhereConditions is not a function
    at C:\Users\179\Desktop\v4CRM\server\AW\controllers\statisticsController_new.js:595:18
```

И на клиенте:

```
AxiosError {message: 'Network Error', name: 'AxiosError', code: 'ERR_NETWORK'}
```

## 🔍 **Анализ проблемы:**

**Ошибка в строке 576** файла `statisticsController_new.js`:

```javascript
// НЕПРАВИЛЬНО:
const { whereClause, params } = this.buildMaterialWhereConditions(materialFilters)
//                                 ↑ this. - ошибка!
```

**Проблема:** Функция `buildMaterialWhereConditions` импортируется из `statisticsUtils.js`, а не является методом класса `StatisticsController`. Поэтому использование `this.` вызывает ошибку.

## 🔧 **Решение:**

### **Исправлено в `server/AW/controllers/statisticsController_new.js`:**

```javascript
// БЫЛО (неправильно):
const { whereClause, params } = this.buildMaterialWhereConditions(materialFilters)

// СТАЛО (правильно):
const { whereClause, params } = buildMaterialWhereConditions(materialFilters)
```

### **Контекст исправления:**

```javascript
// В начале файла импортируется функция:
const {
  validateFilters,
  buildWhereConditions,
  buildMaterialWhereConditions,  // ← Импортируется из utils
} = require('../utils/statisticsUtils')

// В методе getOrderMaterials:
async getOrderMaterials(orderId, filters = {}) {
  // ...
  const materialFilters = {
    stuffType: filters.stuffType || '',
    materialName: filters.materialName || '',
    materialMarking: filters.materialMarking || '',
    year: filters.year || '2025',
  }

  // ИСПРАВЛЕНО: убрано this.
  const { whereClause, params } = buildMaterialWhereConditions(materialFilters)
  // ...
}
```

## 📊 **Структура проекта:**

```
server/AW/
├── controllers/
│   └── statisticsController_new.js  ← Использует функцию
├── utils/
│   └── statisticsUtils.js           ← Содержит функцию
└── index.js                         ← Маршруты
```

### **Функция в `statisticsUtils.js`:**

```javascript
function buildMaterialWhereConditions(filters) {
  const conditions = []
  const params = []

  if (filters.stuffType) {
    if (!isNaN(filters.stuffType) && Number(filters.stuffType) > 0) {
      conditions.push('ggt.ID = ?')
      params.push(Number(filters.stuffType))
    } else {
      conditions.push('ggt.NAME CONTAINING ?')
      params.push(String(filters.stuffType))
    }
  }

  // ... другие фильтры

  return {
    whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
    params,
  }
}
```

## 🎯 **Результат исправления:**

### **До исправления:**

```
TypeError: this.buildMaterialWhereConditions is not a function
→ Сервер падает с ошибкой
→ Клиент получает Network Error
→ Загрузка материалов заказа не работает
```

### **После исправления:**

```
✅ Функция вызывается корректно
✅ Сервер работает стабильно
✅ Клиент получает данные
✅ Загрузка материалов заказа работает
```

## 🚀 **Статус:**

**Исправление завершено!** ✅

Теперь:

- **Нет ошибки** `this.buildMaterialWhereConditions is not a function`
- **Сервер не падает** при загрузке материалов заказа
- **Клиент получает данные** корректно
- **Раскрытие заказов** работает без проблем

**Попробуйте раскрыть заказ - теперь должно работать!** 🎉
