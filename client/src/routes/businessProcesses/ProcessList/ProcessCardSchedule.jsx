import { useState, useEffect, useCallback } from 'react'
import { getProcessSchedule, setProcessSchedule, getReferencesUsers } from '../../../api/businessProcessApi'
import Toastify from 'toastify-js'
import './ProcessCardSchedule.scss'

const WEEKDAY_LABELS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 7, label: 'Вс' },
]

const defaultConfig = (scheduleType) => {
  if (scheduleType === 'dates') return { dates: [] }
  if (scheduleType === 'weekdays') return { weekdays: [] }
  if (scheduleType === 'interval') return { interval_days: 2, anchor_date: '' }
  return {}
}

function parseTime(str) {
  if (!str || typeof str !== 'string') return { hour: 9, minute: 0 }
  const m = str.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return { hour: 9, minute: 0 }
  return { hour: Math.min(23, Math.max(0, parseInt(m[1], 10))), minute: Math.min(59, Math.max(0, parseInt(m[2], 10))) }
}

function ProcessCardSchedule({ processId, currentUserId, onSaved, collapsed = false }) {
  const [enabled, setEnabled] = useState(false)
  const [scheduleType, setScheduleType] = useState('weekdays')
  const [time, setTime] = useState('09:00')
  const [config, setConfig] = useState(() => defaultConfig('weekdays'))
  const [nextRuns, setNextRuns] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scheduleLoaded, setScheduleLoaded] = useState(false)
  const [users, setUsers] = useState([])
  const [autostartInitiatorId, setAutostartInitiatorId] = useState(null)

  const loadSchedule = useCallback(async () => {
    if (!processId) return
    setLoading(true)
    try {
      const data = await getProcessSchedule(processId)
      setScheduleLoaded(true)
      if (data) {
        setEnabled(data.enabled)
        setScheduleType(data.schedule_type || 'weekdays')
        setTime(data.time || '09:00')
        setConfig(data.config && typeof data.config === 'object' ? { ...data.config } : defaultConfig(data.schedule_type || 'weekdays'))
        setNextRuns(Array.isArray(data.next_runs) ? data.next_runs : [])
        setAutostartInitiatorId(data.launched_by_user_id ?? currentUserId ?? null)
      } else {
        setEnabled(false)
        setScheduleType('weekdays')
        setTime('09:00')
        setConfig(defaultConfig('weekdays'))
        setNextRuns([])
        setAutostartInitiatorId(currentUserId ?? null)
      }
    } catch (err) {
      console.error('Ошибка загрузки расписания:', err)
      setScheduleLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [processId, currentUserId])

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  useEffect(() => {
    getReferencesUsers()
      .then((u) => setUsers(Array.isArray(u) ? u : []))
      .catch(() => setUsers([]))
  }, [])

  const handleToggleEnabled = (e) => {
    const checked = e.target.checked
    setEnabled(checked)
    if (!checked) {
      setSaving(true)
      setProcessSchedule(processId, {
        enabled: false,
        schedule_type: scheduleType,
        time,
        config,
        launched_by_user_id: autostartInitiatorId ?? currentUserId,
      })
        .then(() => {
          setNextRuns([])
          if (typeof onSaved === 'function') onSaved()
          Toastify({ text: 'Автозапуск отключён', close: true, backgroundColor: '#059669' }).showToast()
        })
        .catch((err) => {
          setEnabled(true)
          Toastify({ text: err.response?.data?.error || 'Ошибка сохранения', close: true, backgroundColor: '#b91c1c' }).showToast()
        })
        .finally(() => setSaving(false))
    }
  }

  const handleSave = () => {
    const initiatorId = autostartInitiatorId ?? currentUserId
    if (!initiatorId) {
      Toastify({ text: 'Выберите инициатора при автозапуске', close: true, backgroundColor: '#b91c1c' }).showToast()
      return
    }
    const { hour, minute } = parseTime(time)
    const payload = {
      enabled: true,
      schedule_type: scheduleType,
      time_hour: hour,
      time_minute: minute,
      config: { ...config },
      launched_by_user_id: initiatorId,
    }
    if (scheduleType === 'dates' && (!config.dates || !config.dates.length)) {
      Toastify({ text: 'Добавьте хотя бы одну дату', close: true, backgroundColor: '#b91c1c' }).showToast()
      return
    }
    if (scheduleType === 'weekdays' && (!config.weekdays || !config.weekdays.length)) {
      Toastify({ text: 'Выберите хотя бы один день недели', close: true, backgroundColor: '#b91c1c' }).showToast()
      return
    }
    if (scheduleType === 'interval') {
      const days = parseInt(config.interval_days, 10)
      if (!Number.isInteger(days) || days < 1) {
        Toastify({ text: 'Укажите интервал (целое число дней ≥ 1)', close: true, backgroundColor: '#b91c1c' }).showToast()
        return
      }
      payload.config.interval_days = days
      payload.config.anchor_date = config.anchor_date || new Date().toISOString().slice(0, 10)
    }
    setSaving(true)
    setProcessSchedule(processId, payload)
      .then((res) => {
        setNextRuns(Array.isArray(res.next_runs) ? res.next_runs : [])
        if (typeof onSaved === 'function') onSaved()
        Toastify({ text: 'Расписание сохранено', close: true, backgroundColor: '#059669' }).showToast()
      })
      .catch((err) => {
        Toastify({ text: err.response?.data?.error || 'Ошибка сохранения', close: true, backgroundColor: '#b91c1c' }).showToast()
      })
      .finally(() => setSaving(false))
  }

  const setConfigField = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const addDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const ymd = d.toISOString().slice(0, 10)
    setConfig((prev) => ({
      ...prev,
      dates: [...(prev.dates || []), ymd].sort(),
    }))
  }

  const removeDate = (idx) => {
    setConfig((prev) => ({
      ...prev,
      dates: (prev.dates || []).filter((_, i) => i !== idx),
    }))
  }

  const addExcludeDate = () => {
    const d = new Date()
    const ymd = d.toISOString().slice(0, 10)
    setConfig((prev) => ({
      ...prev,
      exclude_dates: [...(prev.exclude_dates || []), ymd].filter((v, i, a) => a.indexOf(v) === i).sort(),
    }))
  }

  const removeExcludeDate = (idx) => {
    setConfig((prev) => ({
      ...prev,
      exclude_dates: (prev.exclude_dates || []).filter((_, i) => i !== idx),
    }))
  }

  if (loading && !scheduleLoaded) {
    return (
      <div className="process-card-schedule">
        <p className="process-card-schedule__loading">Загрузка расписания...</p>
      </div>
    )
  }

  // Свёрнутый вид: одна строка с датой/временем
  if (collapsed) {
    const summary =
      !enabled
        ? 'Автозапуск отключён'
        : nextRuns.length > 0
          ? `Запуск в ${time}: ${nextRuns.slice(0, 5).map((r) => r.label).join(', ')}${nextRuns.length > 5 ? '…' : ''}`
          : `Время запуска: ${time}`
    return (
      <div className="process-card-schedule process-card-schedule--collapsed">
        <span className="process-card-schedule__summary">{summary}</span>
      </div>
    )
  }

  return (
    <div className="process-card-schedule">
      <label className="process-card-schedule__checkbox-wrap">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={handleToggleEnabled}
          className="process-card-schedule__checkbox"
        />
        <span className="process-card-schedule__checkbox-label">Установить автоматический запуск</span>
      </label>

      {enabled && (
        <div className="process-card-schedule__form">
          <div className="process-card-schedule__row">
            <span className="process-card-schedule__label">Инициатор при автозапуске:</span>
            <select
              className="process-card-schedule__select"
              value={autostartInitiatorId ?? ''}
              onChange={(e) => setAutostartInitiatorId(e.target.value ? Number(e.target.value) : null)}
              required
            >
              <option value="">— Выберите пользователя —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}
                </option>
              ))}
            </select>
          </div>
          <p className="process-card-schedule__hint">Этот пользователь будет указан как инициатор при автоматическом запуске процесса по расписанию.</p>

          <div className="process-card-schedule__row">
            <span className="process-card-schedule__label">Время запуска:</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="process-card-schedule__time"
            />
          </div>

          <div className="process-card-schedule__row">
            <span className="process-card-schedule__label">Режим:</span>
            <div className="process-card-schedule__radios">
              <label>
                <input
                  type="radio"
                  name={`schedule-type-${processId}`}
                  checked={scheduleType === 'dates'}
                  onChange={() => { setScheduleType('dates'); setConfig(defaultConfig('dates')); }}
                />
                По выбранным датам
              </label>
              <label>
                <input
                  type="radio"
                  name={`schedule-type-${processId}`}
                  checked={scheduleType === 'weekdays'}
                  onChange={() => { setScheduleType('weekdays'); setConfig(defaultConfig('weekdays')); }}
                />
                По дням недели
              </label>
              <label>
                <input
                  type="radio"
                  name={`schedule-type-${processId}`}
                  checked={scheduleType === 'interval'}
                  onChange={() => { setScheduleType('interval'); setConfig(defaultConfig('interval')); }}
                />
                Каждые N дней
              </label>
            </div>
          </div>

          {scheduleType === 'dates' && (
            <div className="process-card-schedule__block">
              <span className="process-card-schedule__label">Даты запуска (одно время для всех):</span>
              <div className="process-card-schedule__dates-list">
                {(config.dates || []).map((d, i) => (
                  <div key={i} className="process-card-schedule__date-row">
                    <input
                      type="date"
                      value={d}
                      onChange={(e) => {
                        const arr = [...(config.dates || [])]
                        arr[i] = e.target.value
                        setConfigField('dates', arr.sort())
                      }}
                      className="process-card-schedule__date-input"
                    />
                    <button type="button" onClick={() => removeDate(i)} className="process-card-schedule__btn-remove" title="Удалить">×</button>
                  </div>
                ))}
                <button type="button" onClick={addDate} className="process-card-schedule__btn-add">+ Добавить дату</button>
              </div>
            </div>
          )}

          {scheduleType === 'weekdays' && (
            <div className="process-card-schedule__block">
              <span className="process-card-schedule__label">Дни недели:</span>
              <div className="process-card-schedule__weekdays">
                {WEEKDAY_LABELS.map(({ value, label }) => (
                  <label key={value} className="process-card-schedule__weekday">
                    <input
                      type="checkbox"
                      checked={(config.weekdays || []).includes(value)}
                      onChange={(e) => {
                        const w = config.weekdays || []
                        const next = e.target.checked ? [...w, value].sort((a, b) => a - b) : w.filter((x) => x !== value)
                        setConfigField('weekdays', next)
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <span className="process-card-schedule__sublabel">Исключить дни:</span>
              <div className="process-card-schedule__weekdays process-card-schedule__weekdays--exclude">
                {WEEKDAY_LABELS.map(({ value, label }) => (
                  <label key={value} className="process-card-schedule__weekday">
                    <input
                      type="checkbox"
                      checked={(config.exclude_weekdays || []).includes(value)}
                      onChange={(e) => {
                        const w = config.exclude_weekdays || []
                        const next = e.target.checked ? [...w, value].sort((a, b) => a - b) : w.filter((x) => x !== value)
                        setConfigField('exclude_weekdays', next)
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {scheduleType === 'interval' && (
            <div className="process-card-schedule__block">
              <div className="process-card-schedule__row">
                <span className="process-card-schedule__label">Каждые (дней):</span>
                <input
                  type="number"
                  min={1}
                  value={config.interval_days ?? 2}
                  onChange={(e) => setConfigField('interval_days', parseInt(e.target.value, 10) || 1)}
                  className="process-card-schedule__number"
                />
              </div>
              <div className="process-card-schedule__row">
                <span className="process-card-schedule__label">Начиная с даты:</span>
                <input
                  type="date"
                  value={config.anchor_date || ''}
                  onChange={(e) => setConfigField('anchor_date', e.target.value)}
                  className="process-card-schedule__date-input"
                />
              </div>
              <span className="process-card-schedule__sublabel">Исключить дни недели:</span>
              <div className="process-card-schedule__weekdays process-card-schedule__weekdays--exclude">
                {WEEKDAY_LABELS.map(({ value, label }) => (
                  <label key={value} className="process-card-schedule__weekday">
                    <input
                      type="checkbox"
                      checked={(config.exclude_weekdays || []).includes(value)}
                      onChange={(e) => {
                        const w = config.exclude_weekdays || []
                        const next = e.target.checked ? [...w, value].sort((a, b) => a - b) : w.filter((x) => x !== value)
                        setConfigField('exclude_weekdays', next)
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="process-card-schedule__block">
            <span className="process-card-schedule__sublabel">Исключить конкретные даты:</span>
            <div className="process-card-schedule__dates-list">
              {(config.exclude_dates || []).map((d, i) => (
                <div key={i} className="process-card-schedule__date-row">
                  <input
                    type="date"
                    value={d}
                    onChange={(e) => {
                      const arr = [...(config.exclude_dates || [])]
                      arr[i] = e.target.value
                      setConfigField('exclude_dates', arr.sort())
                    }}
                    className="process-card-schedule__date-input"
                  />
                  <button type="button" onClick={() => removeExcludeDate(i)} className="process-card-schedule__btn-remove" title="Удалить">×</button>
                </div>
              ))}
              <button type="button" onClick={addExcludeDate} className="process-card-schedule__btn-add">+ Добавить дату исключения</button>
            </div>
          </div>

          <button type="button" onClick={handleSave} disabled={saving} className="process-card-schedule__btn-save">
            {saving ? 'Сохранение…' : 'Сохранить расписание'}
          </button>

          {nextRuns.length > 0 && (
            <div className="process-card-schedule__next-runs">
              <span className="process-card-schedule__next-runs-title">Будет запускаться:</span>
              <ul className="process-card-schedule__next-runs-list">
                {nextRuns.slice(0, 8).map((run, i) => (
                  <li key={i}>{run.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProcessCardSchedule
