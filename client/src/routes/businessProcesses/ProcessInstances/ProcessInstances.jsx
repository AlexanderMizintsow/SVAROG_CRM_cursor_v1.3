import { useEffect, useMemo, useState } from 'react'
import Toastify from 'toastify-js'
import { cancelInstance, deleteInstance, getInstancesOverview } from '../../../api/businessProcessApi'
import useUserStore from '../../../store/userStore'
import { formatLocalDateTime } from '../../../utils/dateUtils'
import './ProcessInstances.scss'

const STATUS_LABELS = {
  running: 'Выполняется',
  waiting_gateway: 'Ожидает условия (развилка)',
  waiting_timer: 'Ожидает таймер',
  waiting_user_input: 'Ожидает ввода пользователя',
  completed: 'Завершён',
  failed: 'Ошибка',
  cancelled: 'Отменён',
}

function getWaitingText(item) {
  const w = item.waiting
  if (!w) return '—'
  if (w.type === 'gateway') {
    const parts = []
    parts.push(w.task_id ? `Задача #${w.task_id}` : 'По задаче')
    const status = w.last_status || w.last_status_raw
    if (status) parts.push(`статус: ${status}`)
    if (w.last_resume_reason) parts.push(`событие: ${w.last_resume_reason}`)
    if (w.last_checked_at) parts.push(`проверено: ${formatLocalDateTime(w.last_checked_at)}`)
    return parts.join(' · ')
  }
  if (w.type === 'timer') return w.resume_at ? `До ${formatLocalDateTime(w.resume_at)}` : 'Таймер'
  if (w.type === 'user_input') return 'Создание задачи (модалка)'
  return '—'
}

const ProcessInstances = () => {
  const { user } = useUserStore()
  const isAdmin = user?.role_name === 'Администратор'
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [collapsed, setCollapsed] = useState({})
  const [filter, setFilter] = useState({ q: '', status: 'all' })
  const [busyIds, setBusyIds] = useState({})

  const load = async () => {
    try {
      const list = await getInstancesOverview({ limit: 500 })
      setItems(Array.isArray(list) ? list : [])
    } catch (e) {
      console.error(e)
      Toastify({
        text: e.response?.data?.error || 'Не удалось загрузить экземпляры процессов',
        close: true,
        backgroundColor: '#64748b',
      }).showToast()
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const setBusy = (id, v) => setBusyIds((prev) => ({ ...prev, [id]: v }))

  const handleCancel = async (it) => {
    const ok = window.confirm(`Отменить экземпляр #${it.id}?`)
    if (!ok) return
    setBusy(it.id, true)
    try {
      await cancelInstance(it.id)
      Toastify({ text: `Экземпляр #${it.id} отменён`, close: true, backgroundColor: '#64748b' }).showToast()
      await load()
    } catch (e) {
      Toastify({ text: e.response?.data?.error || 'Не удалось отменить экземпляр', close: true, backgroundColor: '#b91c1c' }).showToast()
    } finally {
      setBusy(it.id, false)
    }
  }

  const handleDelete = async (it) => {
    const ok = window.confirm(`Удалить экземпляр #${it.id}? Это действие нельзя отменить.`)
    if (!ok) return
    setBusy(it.id, true)
    try {
      await deleteInstance(it.id)
      Toastify({ text: `Экземпляр #${it.id} удалён`, close: true, backgroundColor: '#059669' }).showToast()
      await load()
    } catch (e) {
      Toastify({ text: e.response?.data?.error || 'Не удалось удалить экземпляр', close: true, backgroundColor: '#b91c1c' }).showToast()
    } finally {
      setBusy(it.id, false)
    }
  }

  const filtered = useMemo(() => {
    const q = (filter.q || '').trim().toLowerCase()
    const status = filter.status
    return (Array.isArray(items) ? items : []).filter((it) => {
      if (status && status !== 'all' && it.status !== status) return false
      if (!q) return true
      const hay = [
        it.process_name,
        String(it.process_id),
        String(it.id),
        it.current_node_label,
        it.status,
        it.error_message,
        it.waiting?.type,
        it.waiting?.task_id != null ? String(it.waiting.task_id) : '',
        it.last_task_id != null ? String(it.last_task_id) : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [items, filter.q, filter.status])

  const groups = useMemo(() => {
    const map = new Map()
    for (const it of filtered) {
      const key = it.process_id
      const name = it.process_name || `Процесс #${it.process_id}`
      if (!map.has(key)) map.set(key, { process_id: key, process_name: name, items: [] })
      map.get(key).items.push(it)
    }
    // сортируем группы по имени, элементы внутри по started_at desc уже с бэка
    return Array.from(map.values()).sort((a, b) => String(a.process_name).localeCompare(String(b.process_name), 'ru'))
  }, [filtered])

  if (loading) {
    return (
      <div className="bp-instances bp-instances--loading">
        <p>Загрузка экземпляров...</p>
      </div>
    )
  }

  return (
    <div className="bp-instances">
      <div className="bp-instances__toolbar">
        <div className="bp-instances__filters">
          <input
            className="bp-instances__search"
            type="text"
            placeholder="Поиск: процесс, id, статус, блок, задача…"
            value={filter.q}
            onChange={(e) => setFilter((prev) => ({ ...prev, q: e.target.value }))}
          />
          <select
            className="bp-instances__select"
            value={filter.status}
            onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">Все статусы</option>
            {Object.keys(STATUS_LABELS).map((k) => (
              <option key={k} value={k}>{STATUS_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <button className="bp-instances__refresh" type="button" onClick={load}>
          Обновить
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="bp-instances__empty">
          <p>Нет экземпляров процессов по текущему фильтру.</p>
        </div>
      ) : (
        <div className="bp-instances__groups">
          {groups.map((g) => {
            const isCollapsed = collapsed[g.process_id] === true
            return (
              <section key={g.process_id} className="bp-instances__group">
                <button
                  type="button"
                  className="bp-instances__group-header"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [g.process_id]: !isCollapsed }))}
                >
                  <span className="bp-instances__group-title">{g.process_name}</span>
                  <span className="bp-instances__group-count">{g.items.length}</span>
                </button>

                {!isCollapsed && (
                  <div className="bp-instances__table">
                    <div className="bp-instances__row bp-instances__row--head">
                      <div>ID</div>
                      <div>Статус</div>
                      <div>Текущий этап</div>
                      <div>Ожидает</div>
                      <div>Связ. задача</div>
                      <div>Запуск</div>
                      <div></div>
                    </div>
                    {g.items.map((it) => (
                      <div key={it.id} className={`bp-instances__row ${it.status === 'failed' ? 'bp-instances__row--error' : ''}`}>
                        <div className="bp-instances__cell-mono">#{it.id}</div>
                        <div>{STATUS_LABELS[it.status] || it.status}</div>
                        <div title={it.current_node_id || ''}>{it.current_node_label || '—'}</div>
                        <div>{getWaitingText(it)}</div>
                        <div className="bp-instances__cell-mono">{it.last_task_id ? `#${it.last_task_id}` : '—'}</div>
                        <div>{formatLocalDateTime(it.started_at)}</div>
                        <div className="bp-instances__actions">
                          {isAdmin && it.status !== 'completed' && it.status !== 'failed' && it.status !== 'cancelled' && (
                            <button
                              type="button"
                              className="bp-instances__btn bp-instances__btn--secondary"
                              onClick={() => handleCancel(it)}
                              disabled={busyIds[it.id]}
                            >
                              Отменить
                            </button>
                          )}
                          {isAdmin && (it.status === 'completed' || it.status === 'failed' || it.status === 'cancelled') && (
                            <button
                              type="button"
                              className="bp-instances__btn bp-instances__btn--danger"
                              onClick={() => handleDelete(it)}
                              disabled={busyIds[it.id]}
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                        {it.error_message && (
                          <div className="bp-instances__row-error-text">
                            {it.error_message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ProcessInstances

