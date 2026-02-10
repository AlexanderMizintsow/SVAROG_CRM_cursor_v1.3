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

function computeConditionalDeadline(rule, now = new Date()) {
  if (!rule || !rule.boundary) return null
  const boundary = parseTime(rule.boundary)
  const sameDayTime = rule.sameDayTime != null ? String(rule.sameDayTime) : '18:00'
  const nextDayTime = rule.nextDayTime != null ? String(rule.nextDayTime) : '16:00'

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
  return d.toISOString()
}

module.exports = { computeConditionalDeadline, parseTime, setTimeToDate }
