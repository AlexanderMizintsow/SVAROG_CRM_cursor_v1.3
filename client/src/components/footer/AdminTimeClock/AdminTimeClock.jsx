/**
 * AdminTimeClock — сверка времени клиента и сервера для отладки.
 *
 * ВАЖНО: Референс для исправления проблем с часовыми поясами
 * =============================================================
 *
 * ЭТАЛОН: Время создания Задач и Проектов (register, tasks/global_tasks) — там отображается верно.
 * Любые другие даты в приложении должны соответствовать этому.
 *
 * ПРОБЛЕМА (сдвиг на 1 час и т.п.):
 * - В PostgreSQL колонки типа TIMESTAMP WITHOUT TIME ZONE хранят только "голую" дату/время
 * - При INSERT с NOW() используется session timezone (Europe/Moscow), значение пишется как московское
 * - Node.js драйвер pg при SELECT интерпретирует такие timestamp'ы как ЛОКАЛЬНОЕ время СЕРВЕРА (часто UTC)
 * - В итоге клиент получает некорректный момент (сдвиг на 1 час для Саратова UTC+4 vs Москва UTC+3)
 *
 * РЕШЕНИЕ:
 * 1) СЕРВЕР (Node/PostgreSQL): в SQL-запросах явно указать зону хранения:
 *    (column_name AT TIME ZONE 'Europe/Moscow') AS column_name
 *    Тогда PostgreSQL вернёт timestamptz с правильным UTC → JSON сериализует верно
 *
 * 2) КЛИЕНТ: использовать formatLocalDateTime из utils/dateUtils.js
 *    — форматирует через getDate(), getHours() и т.д. в локальной зоне браузера
 *    — время всегда соответствует часам пользователя (как в этом компоненте)
 *
 * 3) BPE/Register pool: SET timezone = 'Europe/Moscow' при connect для единообразия NOW()
 *
 * Пример: ProcessInstances (запуск БП), BPE processInstancesController getInstancesOverview
 */
import { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import { formatLocalDateTime } from '../../../utils/dateUtils'
import './AdminTimeClock.scss'

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
      <span className="admin-time-clock__value">{formatLocalDateTime(clientTime)}</span>
      <span className="admin-time-clock__divider">|</span>
      <span className="admin-time-clock__label">Сервер (UTC):</span>
      <span className="admin-time-clock__value">
        {serverTimeUtc != null ? serverTimeUtc : '—'}
      </span>
      {serverTime != null && (
        <span className="admin-time-clock__hint" title="Время сервера в вашей локальной зоне">
          ({formatLocalDateTime(serverTime)})
        </span>
      )}
    </div>
  )
}

export default AdminTimeClock
