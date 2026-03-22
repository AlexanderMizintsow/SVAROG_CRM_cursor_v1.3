/**
 * Вычисляет дедлайн по правилу «граница времени»:
 * если текущее время <= boundary → дедлайн сегодня в sameDayTime;
 * иначе → дедлайн завтра в nextDayTime.
 * @param {Object} rule - { boundary: "12:00", sameDayTime: "18:00", nextDayTime: "16:00" }
 * @param {Date} [now] - момент обработки (по умолчанию — текущее время)
 * @returns {string|null} ISO-строка даты или null при невалидных данных
 */
function parseTime(str) {
  if (!str || typeof str !== 'string') return { h: 0, m: 0 }
  const parts = str.trim().split(/[:\s]+/)
  const h = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0))
  const m = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0))
  return { h, m }
}

function setTimeToDate(date, timeStr) {
  const { h, m } = parseTime(timeStr)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d
}

/**
 * Дедлайн: дата запуска процесса + указанное время (ЧЧ:ММ).
 * @param {Date|string} startedAt - момент запуска процесса
 * @param {string} timeStr - время в формате "14:00"
 * @returns {string} ISO/YYYY-MM-DDTHH:mm
 */
function computeStartDayDeadline(startedAt, timeStr) {
  const d = new Date(startedAt)
  if (!Number.isFinite(d.getTime())) return null
  const result = setTimeToDate(d, timeStr || '23:59')
  const y = result.getFullYear()
  const m = String(result.getMonth() + 1).padStart(2, '0')
  const day = String(result.getDate()).padStart(2, '0')
  const h = String(result.getHours()).padStart(2, '0')
  const min = String(result.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

/**
 * Дедлайн: дата запуска процесса + N дней + указанное время.
 * @param {Date|string} startedAt - момент запуска процесса
 * @param {number} offsetDays - смещение в днях
 * @param {string} [timeStr] - время "14:00", по умолчанию "23:59"
 * @returns {string} ISO/YYYY-MM-DDTHH:mm
 */
function computeOffsetFromStartDeadline(startedAt, offsetDays, timeStr) {
  const d = new Date(startedAt)
  if (!Number.isFinite(d.getTime())) return null
  d.setDate(d.getDate() + Number(offsetDays))
  const result = setTimeToDate(d, timeStr || '23:59')
  const y = result.getFullYear()
  const m = String(result.getMonth() + 1).padStart(2, '0')
  const day = String(result.getDate()).padStart(2, '0')
  const h = String(result.getHours()).padStart(2, '0')
  const min = String(result.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

/**
 * Дедлайн: момент запуска процесса + смещение в минутах.
 * @param {Date|string} startedAt
 * @param {number} offsetMinutes
 * @returns {string|null} YYYY-MM-DDTHH:mm (локальное время)
 */
function computeOffsetFromNowDeadline(startedAt, offsetMinutes) {
  const d = new Date(startedAt)
  if (!Number.isFinite(d.getTime())) return null
  const mins = Number(offsetMinutes)
  if (!Number.isFinite(mins)) return null
  d.setMinutes(d.getMinutes() + mins)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

function computeConditionalDeadline(rule, now = new Date()) {
  if (!rule || !rule.boundary) return null
  const boundary = parseTime(rule.boundary)
  // Поддержка camelCase и snake_case (на случай разного формата из схемы/API)
  const sameDayRaw = rule.sameDayTime ?? rule.same_day_time
  const nextDayRaw = rule.nextDayTime ?? rule.next_day_time
  const sameDayTime = (sameDayRaw != null && String(sameDayRaw).trim() !== '') ? String(sameDayRaw).trim() : '18:00'
  const nextDayTime = (nextDayRaw != null && String(nextDayRaw).trim() !== '') ? String(nextDayRaw).trim() : '16:00'

  const currentMins = now.getHours() * 60 + now.getMinutes()
  const boundMins = boundary.h * 60 + boundary.m

  let d
  if (currentMins <= boundMins) {
    d = setTimeToDate(new Date(now), sameDayTime)
  } else {
    d = new Date(now)
    d.setDate(d.getDate() + 1)
    d = setTimeToDate(d, nextDayTime)
  }
  // Возвращаем YYYY-MM-DDTHH:mm (без timezone), как для конкретной даты в модалке,
  // чтобы в карточке задачи отображалось выбранное время (19:09), а не UTC (15:09)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

module.exports = {
  computeConditionalDeadline,
  computeStartDayDeadline,
  computeOffsetFromStartDeadline,
  computeOffsetFromNowDeadline,
  parseTime,
  setTimeToDate,
}
