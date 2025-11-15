// calendar.js - Календарь для выбора даты в Telegram боте

/**
 * Создает inline-клавиатуру календаря для выбора даты
 * @param {Date} currentDate - Текущая дата для отображения календаря
 * @param {string} callbackPrefix - Префикс для callback_data (например, 'verification_date_')
 * @returns {Array} Массив массивов кнопок для inline_keyboard
 */
function createCalendar(currentDate = new Date(), callbackPrefix = 'calendar_') {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Получаем первый день месяца и количество дней
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay() // 0 = воскресенье, 1 = понедельник и т.д.

  // Названия месяцев на русском
  const monthNames = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ]

  // Названия дней недели
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  const buttons = []

  // Заголовок с месяцем и годом, кнопки навигации
  buttons.push([
    {
      text: '◀️',
      callback_data: `${callbackPrefix}prev_month_${year}_${month}`,
    },
    {
      text: `${monthNames[month]} ${year}`,
      callback_data: 'ignore', // Неактивная кнопка
    },
    {
      text: '▶️',
      callback_data: `${callbackPrefix}next_month_${year}_${month}`,
    },
  ])

  // Дни недели
  buttons.push(
    dayNames.map((day) => ({
      text: day,
      callback_data: 'ignore', // Неактивные кнопки для заголовков
    }))
  )

  // Дни месяца
  let currentRow = []
  let dayCounter = 1

  // Заполняем пустые ячейки до первого дня месяца
  // В России неделя начинается с понедельника (1), но getDay() возвращает 0 для воскресенья
  const adjustedStartingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1

  for (let i = 0; i < adjustedStartingDay; i++) {
    currentRow.push({
      text: ' ',
      callback_data: 'ignore',
    })
  }

  // Добавляем дни месяца
  while (dayCounter <= daysInMonth) {
    const date = new Date(year, month, dayCounter)
    const dateStr = date.toISOString().split('T')[0] // Формат YYYY-MM-DD

    currentRow.push({
      text: dayCounter.toString(),
      callback_data: `${callbackPrefix}select_${dateStr}`,
    })

    dayCounter++

    // Если строка заполнена (7 дней) или достигнут конец месяца
    if (currentRow.length === 7) {
      buttons.push([...currentRow])
      currentRow = []
    }
  }

  // Заполняем оставшиеся ячейки в последней строке
  while (currentRow.length > 0 && currentRow.length < 7) {
    currentRow.push({
      text: ' ',
      callback_data: 'ignore',
    })
  }

  if (currentRow.length > 0) {
    buttons.push(currentRow)
  }

  // Кнопка отмены
  buttons.push([{ text: '❌ Отмена', callback_data: '/cancel' }])

  return buttons
}

/**
 * Обрабатывает навигацию по календарю (переключение месяцев)
 * @param {string} callbackData - Данные callback (например, 'verification_date_prev_month_2024_11')
 * @returns {Date|null} Новая дата для отображения календаря или null если это не навигация
 */
function handleCalendarNavigation(callbackData) {
  const parts = callbackData.split('_')

  // Формат: verification_date_prev_month_2024_11 или verification_date_next_month_2024_11
  // parts[0] = 'verification'
  // parts[1] = 'date'
  // parts[2] = 'prev' или 'next'
  // parts[3] = 'month'
  // parts[4] = год
  // parts[5] = месяц

  if (parts.length < 6) return null

  const action = parts[2] // 'prev' или 'next'
  const type = parts[3] // 'month'
  const year = parseInt(parts[4])
  const month = parseInt(parts[5])

  if (isNaN(year) || isNaN(month) || type !== 'month') return null

  let newDate = new Date(year, month, 1)

  if (action === 'prev') {
    newDate.setMonth(month - 1)
  } else if (action === 'next') {
    newDate.setMonth(month + 1)
  } else {
    return null
  }

  return newDate
}

/**
 * Извлекает выбранную дату из callback_data
 * @param {string} callbackData - Данные callback (например, 'calendar_select_2024-11-15')
 * @returns {string|null} Дата в формате YYYY-MM-DD или null
 */
function extractSelectedDate(callbackData) {
  if (!callbackData.includes('select_')) return null

  const parts = callbackData.split('select_')
  if (parts.length < 2) return null

  return parts[1]
}

module.exports = {
  createCalendar,
  handleCalendarNavigation,
  extractSelectedDate,
}

