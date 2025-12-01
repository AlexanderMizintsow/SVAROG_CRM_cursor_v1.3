import { useState, useEffect } from 'react'
import axios from 'axios'
import Toastify from 'toastify-js'
import { API_BASE_URL } from '../../../../../../config'
import './SendLog.scss'

const SendLog = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    campaign_id: '',
    company_id: '',
    status: '',
    send_type: '',
    date_from: '',
    date_to: '',
  })
  const [campaigns, setCampaigns] = useState([])
  const [companies, setCompanies] = useState([])

  useEffect(() => {
    loadCampaigns()
    loadCompanies()
    loadLogs()
  }, [filters])

  const loadCampaigns = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/campaigns`)
      setCampaigns(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке кампаний:', error)
    }
  }

  const loadCompanies = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/companies`)
      setCompanies(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке компаний:', error)
    }
  }

  const loadLogs = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filters.campaign_id) params.campaign_id = filters.campaign_id
      if (filters.company_id) params.company_id = filters.company_id
      if (filters.status) params.status = filters.status
      if (filters.send_type) params.send_type = filters.send_type
      if (filters.date_from) params.date_from = filters.date_from
      if (filters.date_to) params.date_to = filters.date_to

      const response = await axios.get(`${API_BASE_URL}5778/api/marketing/send-log`, { params })
      setLogs(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке журнала:', error)
      Toastify({
        text: 'Ошибка при загрузке журнала отправок',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const statuses = {
      sent: { text: 'Отправлено', class: 'status-sent' },
      error: { text: 'Ошибка', class: 'status-error' },
      skipped: { text: 'Пропущено', class: 'status-skipped' },
      no_telegram: { text: 'Нет ТГ', class: 'status-no-telegram' },
    }
    return statuses[status] || { text: status, class: '' }
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleExport = async (format = 'csv') => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key]) params.append(key, filters[key])
      })
      params.append('format', format)

      const response = await axios.get(
        `${API_BASE_URL}5778/api/marketing/send-log/export?${params.toString()}`,
        {
          responseType: 'blob',
        }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const extension = format === 'excel' ? 'xlsx' : 'csv'
      link.setAttribute(
        'download',
        `send-log-${new Date().toISOString().split('T')[0]}.${extension}`
      )
      document.body.appendChild(link)
      link.click()
      link.remove()

      Toastify({
        text: 'Экспорт выполнен',
        close: true,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      }).showToast()
    } catch (error) {
      console.error('Ошибка при экспорте:', error)
      Toastify({
        text: 'Ошибка при экспорте',
        close: true,
        backgroundColor: 'linear-gradient(to right, #FF5F6D, #FFC371)',
      }).showToast()
    }
  }

  if (loading) {
    return <div className="send-log__loading">Загрузка...</div>
  }

  return (
    <div className="send-log">
      <div className="send-log__header">
        <h2>Журнал отправок</h2>
        <div className="send-log__export-buttons">
          <button className="send-log__btn-export" onClick={() => handleExport('csv')}>
            Экспорт CSV
          </button>
          <button className="send-log__btn-export" onClick={() => handleExport('excel')}>
            Экспорт Excel
          </button>
        </div>
      </div>

      <div className="send-log__filters">
        <div className="send-log__filter-group">
          <label>Кампания</label>
          <select
            value={filters.campaign_id}
            onChange={(e) => setFilters({ ...filters, campaign_id: e.target.value })}
          >
            <option value="">Все кампании</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>
        <div className="send-log__filter-group">
          <label>Компания</label>
          <select
            value={filters.company_id}
            onChange={(e) => setFilters({ ...filters, company_id: e.target.value })}
          >
            <option value="">Все компании</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name || company.company_name}
              </option>
            ))}
          </select>
        </div>
        <div className="send-log__filter-group">
          <label>Статус</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Все статусы</option>
            <option value="sent">Отправлено</option>
            <option value="error">Ошибка</option>
            <option value="skipped">Пропущено</option>
            {
              //<option value="no_telegram">Нет ТГ</option>
            }
          </select>
        </div>
        <div className="send-log__filter-group">
          <label>Тип отправки</label>
          <select
            value={filters.send_type}
            onChange={(e) => setFilters({ ...filters, send_type: e.target.value })}
          >
            <option value="">Все типы</option>
            <option value="auto">Автоматическая</option>
            <option value="manual">Ручная</option>
          </select>
        </div>
        <div className="send-log__filter-group">
          <label>Дата от</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          />
        </div>
        <div className="send-log__filter-group">
          <label>Дата до</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          />
        </div>
      </div>

      <div className="send-log__table-container">
        <table className="send-log__table">
          <thead>
            <tr>
              <th>Дата/время</th>
              <th>Кампания</th>
              <th>Компания</th>
              <th>Локация</th>
              <th>Статус</th>
              <th>Тип</th>
              <th>Ошибка</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="7" className="send-log__empty">
                  Записи не найдены
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const statusBadge = getStatusBadge(log.status)
                return (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.sent_at)}</td>
                    <td>{log.campaign_name || '-'}</td>
                    <td>{log.company_name || '-'}</td>
                    <td>{log.location || '-'}</td>
                    <td>
                      <span className={`send-log__status ${statusBadge.class}`}>
                        {statusBadge.text}
                      </span>
                    </td>
                    <td>{log.send_type === 'auto' ? 'Авто' : 'Ручная'}</td>
                    <td className="send-log__error-cell">
                      {log.error_message ? (
                        <span title={log.error_message}>
                          {log.error_message.substring(0, 50)}...
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SendLog
