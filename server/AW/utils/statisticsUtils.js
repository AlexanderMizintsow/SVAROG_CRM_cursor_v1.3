/**
 * Утилиты для работы со статистикой и отчетами
 */

/**
 * Форматирование даты для отображения
 * @param {string|Date} date - Дата для форматирования
 * @returns {string} Отформатированная дата
 */
function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('ru-RU')
}

/**
 * Форматирование валюты
 * @param {number} amount - Сумма
 * @returns {string} Отформатированная валюта
 */
function formatCurrency(amount) {
  if (!amount) return '0 ₽'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Получение цвета статуса заказа
 * @param {number} status - Статус заказа
 * @returns {string} Цвет статуса
 */
function getStatusColor(status) {
  switch (status) {
    case 3:
      return 'success'
    case 4:
      return 'warning'
    default:
      return 'default'
  }
}

/**
 * Получение текста статуса заказа
 * @param {number} status - Статус заказа
 * @returns {string} Текст статуса
 */
function getStatusText(status) {
  switch (status) {
    case 3:
      return 'Закрыт'
    case 4:
      return 'В производстве'
    default:
      return 'Неизвестно'
  }
}

/**
 * Валидация параметров фильтра
 * @param {Object} filters - Параметры фильтра
 * @returns {Object} Валидированные параметры
 */
function validateFilters(filters) {
  const validated = { ...filters }

  // Валидация дат
  if (validated.startDate && !isValidDate(validated.startDate)) {
    throw new Error('Неверный формат даты начала')
  }
  if (validated.endDate && !isValidDate(validated.endDate)) {
    throw new Error('Неверный формат даты окончания')
  }

  // Валидация статуса заказа
  if (validated.orderStatus && ![3, 4].includes(Number(validated.orderStatus))) {
    throw new Error('Неверный статус заказа')
  }

  // Валидация года
  if (validated.year && (Number(validated.year) < 2020 || Number(validated.year) > 2030)) {
    throw new Error('Неверный год')
  }

  return validated
}

/**
 * Проверка валидности даты
 * @param {string} dateString - Строка даты
 * @returns {boolean} Валидна ли дата
 */
function isValidDate(dateString) {
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date)
}

/**
 * Построение условий WHERE для SQL запроса
 * @param {Object} filters - Параметры фильтра
 * @returns {Object} Объект с условиями и параметрами
 */
function buildWhereConditions(filters) {
  const conditions = ['o.DELETED = 0']
  const params = []

  if (filters.startDate) {
    conditions.push('o.DATECREATED >= ?')
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    conditions.push('o.DATECREATED <= ?')
    params.push(filters.endDate)
  }
  if (
    filters.orderStatus !== undefined &&
    filters.orderStatus !== null &&
    filters.orderStatus !== ''
  ) {
    conditions.push('o.ORDERSTATUS = ?')
    params.push(filters.orderStatus)
  }
  if (filters.stuffType) {
    conditions.push('ggt.CODE = ?')
    params.push(filters.stuffType)
  }
  if (filters.materialName) {
    conditions.push('UPPER(g.NAME) LIKE UPPER(?)')
    params.push(`%${filters.materialName}%`)
  }

  return {
    whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
    params,
  }
}

/**
 * Группировка данных по типу материала
 * @param {Array} data - Массив данных
 * @returns {Object} Сгруппированные данные
 */
function groupByMaterialType(data) {
  return data.reduce((acc, item) => {
    const type = item.ITEM_DESC || 'Неизвестно'
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(item)
    return acc
  }, {})
}

/**
 * Расчет общих показателей
 * @param {Array} data - Массив данных
 * @returns {Object} Общие показатели
 */
function calculateTotals(data) {
  return data.reduce((totals, item) => {
    totals.totalOrders = (totals.totalOrders || 0) + 1
    totals.totalQuantity = (totals.totalQuantity || 0) + (item.ITEM_QTY || 0)
    totals.totalCost = (totals.totalCost || 0) + (item.ITEM_PRICE || 0)
    return totals
  }, {})
}

/**
 * Сортировка данных по различным критериям
 * @param {Array} data - Массив данных
 * @param {string} sortBy - Поле для сортировки
 * @param {string} sortOrder - Порядок сортировки (asc/desc)
 * @returns {Array} Отсортированные данные
 */
function sortData(data, sortBy = 'DATECREATED', sortOrder = 'desc') {
  return data.sort((a, b) => {
    let aVal = a[sortBy]
    let bVal = b[sortBy]

    // Обработка дат
    if (sortBy.includes('DATE')) {
      aVal = new Date(aVal)
      bVal = new Date(bVal)
    }

    // Обработка чисел
    if (typeof aVal === 'string' && !isNaN(aVal)) {
      aVal = Number(aVal)
      bVal = Number(bVal)
    }

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })
}

/**
 * Пагинация данных
 * @param {Array} data - Массив данных
 * @param {number} page - Номер страницы
 * @param {number} limit - Количество элементов на странице
 * @returns {Object} Объект с данными и метаинформацией
 */
function paginateData(data, page = 1, limit = 50) {
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit
  const paginatedData = data.slice(startIndex, endIndex)

  return {
    data: paginatedData,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(data.length / limit),
      totalItems: data.length,
      itemsPerPage: limit,
      hasNextPage: endIndex < data.length,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Экспорт данных в CSV формат
 * @param {Array} data - Массив данных
 * @param {Array} headers - Заголовки колонок
 * @returns {string} CSV строка
 */
function exportToCSV(data, headers) {
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header] || ''
          // Экранируем запятые и кавычки
          return typeof value === 'string' && value.includes(',')
            ? `"${value.replace(/"/g, '""')}"`
            : value
        })
        .join(',')
    ),
  ].join('\n')

  return csvContent
}

/**
 * Получение статистики по периодам
 * @param {Array} data - Массив данных
 * @param {string} period - Период группировки (day/week/month)
 * @returns {Object} Статистика по периодам
 */
function getPeriodStatistics(data, period = 'month') {
  const grouped = data.reduce((acc, item) => {
    const date = new Date(item.DATECREATED)
    let key

    switch (period) {
      case 'day':
        key = date.toISOString().split('T')[0]
        break
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]
        break
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        break
      default:
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }

    if (!acc[key]) {
      acc[key] = {
        period: key,
        orders: 0,
        items: 0,
        quantity: 0,
        cost: 0,
      }
    }

    acc[key].orders++
    acc[key].items++
    acc[key].quantity += item.ITEM_QTY || 0
    acc[key].cost += item.ITEM_PRICE || 0

    return acc
  }, {})

  return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period))
}

module.exports = {
  formatDate,
  formatCurrency,
  getStatusColor,
  getStatusText,
  validateFilters,
  isValidDate,
  buildWhereConditions,
  groupByMaterialType,
  calculateTotals,
  sortData,
  paginateData,
  exportToCSV,
  getPeriodStatistics,
}
