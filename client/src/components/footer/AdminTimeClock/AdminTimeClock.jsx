import { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import './AdminTimeClock.scss'

const formatLocal = (date) => {
  if (!date || Number.isNaN(date.getTime())) return '—'
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${d}.${m}.${y} ${h}:${min}:${s}`
}

const AdminTimeClock = () => {
  const [clientTime, setClientTime] = useState(() => new Date())
  const [serverTime, setServerTime] = useState(null)
  const [serverTimeUtc, setServerTimeUtc] = useState(null)

  // Обновление времени клиента каждую секунду
  useEffect(() => {
    const tick = () => setClientTime(new Date())
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Запрос времени сервера периодически
  useEffect(() => {
    const fetchServerTime = () => {
      axios
        .get(`${API_BASE_URL}5000/api/server-time`)
        .then((res) => {
          const iso = res.data?.serverTime
          if (iso) {
            const d = new Date(iso)
            setServerTimeUtc(iso)
            setServerTime(d)
          }
        })
        .catch(() => {
          setServerTime(null)
          setServerTimeUtc(null)
        })
    }
    fetchServerTime()
    const id = setInterval(fetchServerTime, 20000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="admin-time-clock" title="Сверка времени клиента и сервера для отладки дедлайнов">
      <span className="admin-time-clock__label">Клиент:</span>
      <span className="admin-time-clock__value">{formatLocal(clientTime)}</span>
      <span className="admin-time-clock__divider">|</span>
      <span className="admin-time-clock__label">Сервер (UTC):</span>
      <span className="admin-time-clock__value">
        {serverTimeUtc != null ? serverTimeUtc : '—'}
      </span>
      {serverTime != null && (
        <span className="admin-time-clock__hint" title="Время сервера в вашей локальной зоне">
          ({formatLocal(serverTime)})
        </span>
      )}
    </div>
  )
}

export default AdminTimeClock
