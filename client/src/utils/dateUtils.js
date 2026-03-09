/**
 * Форматирование даты в локальной зоне браузера (как в AdminTimeClock).
 * Использует getDate(), getHours() и т.д. — всегда соответствует часам пользователя.
 */
export const formatLocalDateTime = (value) => {
  if (!value) return '—'
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—'
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${d}.${m}.${y} ${h}:${min}:${s}`
}
