/**
 * Проверка расписания: нужно ли запустить процесс в указанную минуту, и расчёт следующих запусков.
 * Время — локальное сервера. Дни недели: 1 = понедельник, 7 = воскресенье (ISO).
 */

/**
 * День недели по ISO (1 = Пн, 7 = Вс). Из Date: getDay() 0=Вс,1=Пн..6=Сб → Пн=1..Вс=7.
 */
function getIsoWeekday(d) {
  const day = d.getDay()
  return day === 0 ? 7 : day
}

function dateToYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Проверяет, совпадает ли текущий момент (год, месяц, день, час, минута) с расписанием.
 * Чтобы не запускать дважды в одну минуту, учитываем last_triggered_at.
 */
function shouldRunNow(schedule, now, lastTriggeredAt) {
  const hour = schedule.time_hour
  const minute = schedule.time_minute
  if (now.getHours() !== hour || now.getMinutes() !== minute) return false

  const ymd = dateToYMD(now)
  const weekday = getIsoWeekday(now)
  const config = schedule.config || {}
  const excludeDates = Array.isArray(config.exclude_dates) ? config.exclude_dates : []
  const excludeWeekdays = Array.isArray(config.exclude_weekdays) ? config.exclude_weekdays : []

  if (excludeDates.includes(ymd)) return false
  if (excludeWeekdays.includes(weekday)) return false

  if (schedule.schedule_type === 'dates') {
    const dates = Array.isArray(config.dates) ? config.dates : []
    return dates.includes(ymd)
  }
  if (schedule.schedule_type === 'weekdays') {
    const weekdays = Array.isArray(config.weekdays) ? config.weekdays : []
    return weekdays.includes(weekday)
  }
  if (schedule.schedule_type === 'interval') {
    const anchor = config.anchor_date || dateToYMD(now)
    const intervalDays = Math.max(1, parseInt(config.interval_days, 10) || 1)
    const anchorTime = new Date(anchor + 'T00:00:00')
    if (isNaN(anchorTime.getTime())) return false
    const nowStart = new Date(ymd + 'T00:00:00')
    const diffDays = Math.round((nowStart - anchorTime) / (24 * 60 * 60 * 1000))
    if (diffDays < 0) return false
    return diffDays % intervalDays === 0
  }
  return false
}

/**
 * Возвращает массив следующих дат/времени запуска (до count штук).
 * Каждый элемент: { date: 'YYYY-MM-DD', time: 'HH:mm', label }.
 */
function getNextRuns(schedule, fromDate, count = 10) {
  const result = []
  const hour = schedule.time_hour
  const minute = schedule.time_minute
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const config = schedule.config || {}
  const excludeDates = Array.isArray(config.exclude_dates) ? config.exclude_dates : []
  const excludeWeekdays = Array.isArray(config.exclude_weekdays) ? config.exclude_weekdays : []

  const fromTime = fromDate.getTime()
  const add = (d) => {
    const ymd = dateToYMD(d)
    if (excludeDates.includes(ymd)) return
    if (excludeWeekdays.includes(getIsoWeekday(d))) return
    const runAt = new Date(d)
    runAt.setHours(hour, minute, 0, 0)
    if (runAt.getTime() <= fromTime) return
    result.push({
      date: ymd,
      time: timeStr,
      datetime: `${ymd}T${timeStr}:00`,
      label: `${ymd} ${timeStr}`,
    })
  }

  if (schedule.schedule_type === 'dates') {
    const dates = (Array.isArray(config.dates) ? config.dates : [])
      .filter((x) => x && typeof x === 'string')
      .sort()
    const fromYMD = dateToYMD(fromDate)
    for (const d of dates) {
      if (result.length >= count) break
      if (d >= fromYMD) add(new Date(d + 'T00:00:00'))
    }
  } else if (schedule.schedule_type === 'weekdays') {
    const weekdays = Array.isArray(config.weekdays) ? config.weekdays : []
    if (weekdays.length === 0) return result
    let d = new Date(fromDate)
    d.setHours(hour, minute, 0, 0)
    if (d <= fromDate) d.setDate(d.getDate() + 1)
    for (let i = 0; i < 400 && result.length < count; i++) {
      if (weekdays.includes(getIsoWeekday(d))) add(d)
      d.setDate(d.getDate() + 1)
    }
  } else if (schedule.schedule_type === 'interval') {
    const anchor = config.anchor_date || dateToYMD(fromDate)
    const intervalDays = Math.max(1, parseInt(config.interval_days, 10) || 1)
    const anchorTime = new Date(anchor + 'T00:00:00')
    if (isNaN(anchorTime.getTime())) return result
    let d = new Date(anchorTime)
    d.setHours(hour, minute, 0, 0)
    const fromTime = fromDate.getTime()
    while (d.getTime() < fromTime) d.setDate(d.getDate() + intervalDays)
    for (let i = 0; i < 400 && result.length < count; i++) {
      add(d)
      d.setDate(d.getDate() + intervalDays)
    }
  }

  return result.slice(0, count)
}

module.exports = { shouldRunNow, getNextRuns, getIsoWeekday, dateToYMD }
