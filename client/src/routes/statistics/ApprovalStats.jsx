import { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../config'
import './ApprovalStats.scss'

function formatDuration(seconds) {
  if (seconds == null) return '—'
  const total = Math.max(0, Math.round(Number(seconds)))
  if (total < 60) return 'меньше минуты'
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days) return hours ? `${days} д ${hours} ч` : `${days} д`
  if (hours) return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`
  return `${minutes} мин`
}

function formatWhen(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS = {
  approved: 'Одобрено',
  rejected: 'Отказ',
  running: 'Идёт',
  cancelled: 'Отменено',
}

function namesLine(list, empty) {
  if (!list?.length) return empty
  return list.slice(0, 4).map((item) => `${item.name} (${item.count})`).join(', ') + (list.length > 4 ? ` и ещё ${list.length - 4}` : '')
}

export default function ApprovalStats({ filters, reloadTick }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openKey, setOpenKey] = useState('')

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.departmentId) params.set('departmentId', filters.departmentId)
    if (filters.userId) params.set('userId', filters.userId)
    setLoading(true)
    axios.get(`${API_BASE_URL}5000/api/approvals/stats?${params}`)
      .then((response) => {
        if (!cancelled) setData(response.data || { summary: {}, templates: [] })
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [filters.dateFrom, filters.dateTo, filters.departmentId, filters.userId, reloadTick])

  const summary = data?.summary || {}
  const templates = data?.templates || []
  const slowest = templates.find((item) => item.avgSeconds != null)
  const maxSeconds = templates.reduce((max, item) => Math.max(max, item.avgSeconds || 0), 0)

  return (
    <section className="approval-stats">
      <header className="approval-stats__head">
        <div>
          <h2>Согласования</h2>
          <p>Какой шаблон идёт дольше и на каком шаге. Период, отдел автора и сотрудник берутся из фильтров сверху.</p>
        </div>
      </header>

      {loading && <div className="approval-stats__state">Считаю согласования…</div>}
      {!loading && !data && <div className="approval-stats__state">Не удалось загрузить статистику согласований</div>}
      {!loading && data && summary.launched === 0 && (
        <div className="approval-stats__state">За выбранный период согласований нет</div>
      )}

      {!loading && data && summary.launched > 0 && (
        <>
          <div className="approval-stats__metrics">
            <div className="approval-stats__metric">
              <span>Запущено</span>
              <strong>{summary.launched}</strong>
            </div>
            <div className="approval-stats__metric is-ok">
              <span>Одобрено</span>
              <strong>{summary.approved}</strong>
            </div>
            <div className="approval-stats__metric is-no">
              <span>Отказ</span>
              <strong>{summary.rejected}</strong>
            </div>
            <div className="approval-stats__metric">
              <span>Ещё идёт</span>
              <strong>{summary.running}</strong>
            </div>
            <div className="approval-stats__metric">
              <span>Среднее время</span>
              <strong>{formatDuration(summary.avgSeconds)}</strong>
            </div>
          </div>

          <div className="approval-stats__list">
            {templates.map((item) => {
              const open = openKey === item.key
              const width = maxSeconds && item.avgSeconds ? Math.max(8, Math.round((item.avgSeconds / maxSeconds) * 100)) : 0
              return (
                <article key={item.key} className={`approval-stats__card ${slowest && slowest.key === item.key ? 'is-slow' : ''}`}>
                  <button type="button" className="approval-stats__toggle" onClick={() => setOpenKey(open ? '' : item.key)}>
                    <div className="approval-stats__title">
                      <strong>{item.title}</strong>
                      {slowest && slowest.key === item.key && <em>дольше всех</em>}
                      {item.free && <em className="is-free">без шаблона</em>}
                    </div>
                    <div className="approval-stats__counts">
                      <span>{item.launched} зап.</span>
                      <span className="is-ok">{item.approved} одобр.</span>
                      <span className="is-no">{item.rejected} отказ.</span>
                      <span>{item.running} идёт</span>
                    </div>
                    <div className="approval-stats__time">
                      <b>{formatDuration(item.avgSeconds)}</b>
                      <i style={{ width: `${width}%` }} />
                    </div>
                    <div className="approval-stats__why">
                      {item.slowestStep
                        ? `${item.slowestStep.title} · ${item.slowestStep.personName} · ${formatDuration(item.slowestStep.avgSeconds)}`
                        : 'Пока нет завершённых шагов'}
                    </div>
                    <span className="approval-stats__more">{open ? 'Свернуть' : 'Почему'}</span>
                  </button>
                  {open && (
                    <div className="approval-stats__detail">
                      <p>Кто запускал: {namesLine(item.authors, '—')}</p>
                      <p>Отделы: {namesLine(item.departments, '—')}</p>
                      <p>Последний запуск: {formatWhen(item.lastStartedAt)}</p>
                      <h3>Где ждут дольше всего</h3>
                      {!item.steps.length && <p>Ответов по шагам ещё нет.</p>}
                      {!!item.steps.length && (
                        <table>
                          <thead>
                            <tr>
                              <th>Шаг</th>
                              <th>Кто отвечает</th>
                              <th>Отдел</th>
                              <th>Раз</th>
                              <th>В среднем</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.steps.map((step, index) => (
                              <tr key={`${step.title}-${step.personName}`} className={index === 0 ? 'is-slow' : ''}>
                                <td>{step.title}</td>
                                <td>{step.personName}</td>
                                <td>{step.departmentName}</td>
                                <td>{step.count}</td>
                                <td>{formatDuration(step.avgSeconds)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <h3>Заявки</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>Название</th>
                            <th>Автор</th>
                            <th>Отдел</th>
                            <th>Старт</th>
                            <th>Итог</th>
                            <th>Время</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.cards.map((card) => (
                            <tr key={card.id}>
                              <td>{card.title}</td>
                              <td>{card.authorName}</td>
                              <td>{card.departmentName}</td>
                              <td>{formatWhen(card.startedAt)}</td>
                              <td>{STATUS[card.status] || card.status}</td>
                              <td>{formatDuration(card.seconds)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
