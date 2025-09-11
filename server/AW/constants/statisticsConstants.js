/**
 * Константы для модуля статистики и отчетов
 */

// Статусы заказов
const ORDER_STATUS = {
  CLOSED: 3,
  IN_PRODUCTION: 4,
  DRAFT: 0,
  PENDING: 1,
  APPROVED: 2,
}

// Коды типов товаров
const STUFF_TYPE_CODES = {
  PROFILE: 'Profil',
  GLASS_UNIT: 'SP',
  WORK: 'Work',
  SHPROSSES: 'Shpros',
  ADDITIONAL_PROFILE: 'Dop_Profil_Optim',
  SERVICES: 'Uslugi',
}

// Исключаемые типы товаров из статистики
const EXCLUDED_STUFF_TYPES = ['Work', 'Shpros', 'Dop_Profil_Optim', 'Uslugi']

// Исключаемые ID типов товаров
const EXCLUDED_STUFF_TYPE_IDS = [28]

// Поля для группировки в SQL запросах
const GROUP_BY_FIELDS = [
  'ORDERITEMSID',
  'MODELID',
  'ITEM_NAME',
  'ORDERNO',
  'DATECREATED',
  'ORDERSTATUS',
  'ITEM_ORDNO',
  'ITEM_ART',
  'ITEM_DESC',
  'MATERIAL_NAME',
  'ITEM_COLOR_IN',
  'ITEM_COLOR_OUT',
  'EI_NAME',
  'EI_NAME1',
  'ITEM_MESURE',
  'W',
  'H',
  'ITEM_PARTNO',
  'ITEM_QTY',
  'ITEM_TOTQTY',
  'DOP',
  'ITEM_ID',
  'ITEM_TYPE',
  'ITEM_PRICE',
  'OG_ID',
  'ELEMNO',
  'IZDPART',
  'MARK',
  'WP_SIDE',
  'EXT1',
  'ISADDITION',
  'ISEXTENDED',
  'AMOUNTGROUPID',
  'WEIGHT',
]

// Поля для сводной статистики
const SUMMARY_GROUP_BY_FIELDS = ['STUFF_TYPE', 'MATERIAL_NAME', 'MARKING']

// Максимальное количество записей для экспорта
const MAX_EXPORT_RECORDS = 10000

// Размер страницы по умолчанию
const DEFAULT_PAGE_SIZE = 50

// Максимальный размер страницы
const MAX_PAGE_SIZE = 500

// Периоды для группировки
const PERIODS = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
}

// Порядки сортировки
const SORT_ORDERS = {
  ASC: 'asc',
  DESC: 'desc',
}

// Поля для сортировки
const SORT_FIELDS = {
  DATE_CREATED: 'DATECREATED',
  ORDER_NUMBER: 'ORDERNO',
  MATERIAL_NAME: 'MATERIAL_NAME',
  ITEM_NAME: 'ITEM_NAME',
  QUANTITY: 'ITEM_QTY',
  COST: 'ITEM_PRICE',
  STATUS: 'ORDERSTATUS',
}

// Форматы экспорта
const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
  XLSX: 'xlsx',
}

// Типы отчетов
const REPORT_TYPES = {
  DETAILED: 'detailed',
  SUMMARY: 'summary',
  OVERVIEW: 'overview',
  MATERIALS: 'materials',
  PERIOD: 'period',
}

// Сообщения об ошибках
const ERROR_MESSAGES = {
  DB_CONNECTION: 'Ошибка подключения к базе данных',
  QUERY_EXECUTION: 'Ошибка выполнения запроса',
  INVALID_DATE: 'Неверный формат даты',
  INVALID_STATUS: 'Неверный статус заказа',
  INVALID_YEAR: 'Неверный год',
  INVALID_FILTERS: 'Неверные параметры фильтра',
  NO_DATA: 'Нет данных для отображения',
  EXPORT_LIMIT: 'Превышен лимит записей для экспорта',
}

// Сообщения об успехе
const SUCCESS_MESSAGES = {
  DATA_LOADED: 'Данные успешно загружены',
  EXPORT_COMPLETED: 'Экспорт завершен',
  STATISTICS_CALCULATED: 'Статистика рассчитана',
}

// Настройки кэширования
const CACHE_SETTINGS = {
  TTL: 300, // 5 минут
  MAX_SIZE: 100, // Максимум 100 записей в кэше
  ENABLED: true,
}

// Лимиты запросов
const RATE_LIMITS = {
  REQUESTS_PER_MINUTE: 60,
  REQUESTS_PER_HOUR: 1000,
  MAX_CONCURRENT_REQUESTS: 10,
}

// Настройки логирования
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
}

module.exports = {
  ORDER_STATUS,
  STUFF_TYPE_CODES,
  EXCLUDED_STUFF_TYPES,
  EXCLUDED_STUFF_TYPE_IDS,
  GROUP_BY_FIELDS,
  SUMMARY_GROUP_BY_FIELDS,
  MAX_EXPORT_RECORDS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PERIODS,
  SORT_ORDERS,
  SORT_FIELDS,
  EXPORT_FORMATS,
  REPORT_TYPES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  CACHE_SETTINGS,
  RATE_LIMITS,
  LOG_LEVELS,
}
