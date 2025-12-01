import { useState, useEffect } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import { API_BASE_URL } from '../../../../../../config'
import './Statistics.scss'

const Statistics = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    date_from: '',
    date_to: '',
  })

  useEffect(() => {
    loadStatistics()
  }, [dateRange])

  const loadStatistics = async () => {
    try {
      setLoading(true)
      const params = {}
      if (dateRange.date_from) params.date_from = dateRange.date_from
      if (dateRange.date_to) params.date_to = dateRange.date_to

      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/statistics`, { params })
      setStats(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке статистики:', error)
      Toastify({
        text: 'Ошибка при загрузке статистики',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="statistics__loading">Загрузка...</div>
  }

  if (!stats) {
    return <div className="statistics__empty">Нет данных</div>
  }

  const successRate = stats.total_sent > 0 
    ? ((stats.total_sent - stats.total_errors) / stats.total_sent * 100).toFixed(1)
    : 0

  return (
    <div className="statistics">
      <div className="statistics__header">
        <h2>Статистика</h2>
        <div className="statistics__date-range">
          <label>
            От:
            <input
              type="date"
              value={dateRange.date_from}
              onChange={(e) => setDateRange({ ...dateRange, date_from: e.target.value })}
            />
          </label>
          <label>
            До:
            <input
              type="date"
              value={dateRange.date_to}
              onChange={(e) => setDateRange({ ...dateRange, date_to: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="statistics__cards">
        <div className="statistics__card">
          <div className="statistics__card-title">Всего отправок</div>
          <div className="statistics__card-value">{stats.total_sent || 0}</div>
        </div>
        <div className="statistics__card">
          <div className="statistics__card-title">Успешных</div>
          <div className="statistics__card-value statistics__card-value--success">
            {stats.total_sent - stats.total_errors || 0}
          </div>
        </div>
        <div className="statistics__card">
          <div className="statistics__card-title">Ошибок</div>
          <div className="statistics__card-value statistics__card-value--error">
            {stats.total_errors || 0}
          </div>
        </div>
        <div className="statistics__card">
          <div className="statistics__card-title">Процент успеха</div>
          <div className="statistics__card-value">{successRate}%</div>
        </div>
        <div className="statistics__card">
          <div className="statistics__card-title">Активных кампаний</div>
          <div className="statistics__card-value">{stats.active_campaigns || 0}</div>
        </div>
      </div>

      {stats.by_category && stats.by_category.length > 0 && (
        <div className="statistics__section">
          <h3>По категориям</h3>
          <div className="statistics__table-container">
            <table className="statistics__table">
              <thead>
                <tr>
                  <th>Категория</th>
                  <th>Отправок</th>
                  <th>Успешных</th>
                  <th>Ошибок</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_category.map((item) => (
                  <tr key={item.category_id}>
                    <td>{item.category_name || 'Без категории'}</td>
                    <td>{item.total}</td>
                    <td>{item.success}</td>
                    <td>{item.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.by_location && stats.by_location.length > 0 && (
        <div className="statistics__section">
          <h3>По локациям</h3>
          <div className="statistics__table-container">
            <table className="statistics__table">
              <thead>
                <tr>
                  <th>Локация</th>
                  <th>Отправок</th>
                  <th>Успешных</th>
                  <th>Ошибок</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_location.map((item) => (
                  <tr key={item.location_id}>
                    <td>{item.location_name || 'Все локации'}</td>
                    <td>{item.total}</td>
                    <td>{item.success}</td>
                    <td>{item.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default Statistics

