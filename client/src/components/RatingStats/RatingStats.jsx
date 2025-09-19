import { useState, useEffect } from 'react'
import ProcessOverview from './ProcessOverview'
import DealerStats from './DealerStats'
import RatingDistribution from './RatingDistribution'
import { fetchProcessRatingsStats } from './api'
import './RatingStats.scss'

// Конфигурация доступных процессов
const PROCESS_TYPES = {
  'reclamation-closure': {
    id: 'reclamation-closure',
    name: 'Закрытие рекламации',
    endpoint: 'reclamation-ratings-stats',
  },
  // Здесь можно добавлять новые типы процессов:
  // 'service-quality': {
  //   id: 'service-quality',
  //   name: 'Качество обслуживания',
  //   endpoint: 'service-quality-stats'
  // }
}

const RatingStats = () => {
  const [selectedProcess, setSelectedProcess] = useState('reclamation-closure')
  const [selectedPeriod, setSelectedPeriod] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = async (processType, period) => {
    try {
      setLoading(true)
      setError(null)

      const processConfig = PROCESS_TYPES[processType]
      if (!processConfig) {
        throw new Error('Неизвестный тип процесса')
      }

      const result = await fetchProcessRatingsStats(processConfig.endpoint, period)
      setData(result)
    } catch (err) {
      console.error('Ошибка загрузки данных:', err)
      setError(err.message || 'Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(selectedProcess, selectedPeriod)
  }, [selectedProcess, selectedPeriod])

  const handleProcessChange = (processType) => {
    setSelectedProcess(processType)
  }

  const handlePeriodChange = (period) => {
    setSelectedPeriod(parseInt(period))
  }

  const handleRefresh = () => {
    loadData(selectedProcess, selectedPeriod)
  }

  if (loading) {
    return (
      <div className="rating-stats">
        <div className="rating-stats__loading">
          <div className="rating-stats__spinner"></div>
          <p>Загрузка статистики...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rating-stats">
        <div className="rating-stats__error">
          <h3>Ошибка загрузки</h3>
          <p>{error}</p>
          <button onClick={handleRefresh} className="rating-stats__retry-btn">
            Попробовать снова
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rating-stats">
        <div className="rating-stats__empty">
          <p>Нет данных для отображения</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rating-stats">
      <div className="rating-stats__header">
        <h2 className="rating-stats__title">Статистика рейтингов процессов</h2>
        <div className="rating-stats__controls">
          <select
            className="rating-stats__process-selector"
            value={selectedProcess}
            onChange={(e) => handleProcessChange(e.target.value)}
          >
            {Object.values(PROCESS_TYPES).map((process) => (
              <option key={process.id} value={process.id}>
                {process.name}
              </option>
            ))}
          </select>

          <select
            className="rating-stats__period-selector"
            value={selectedPeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
          >
            <option value={1}>1 день</option>
            <option value={7}>7 дней</option>
            <option value={14}>14 дней</option>
            <option value={30}>30 дней</option>
            <option value={60}>60 дней</option>
            <option value={90}>90 дней</option>
            <option value={180}>180 дней</option>
            <option value={365}>365 дней</option>
          </select>

          <button
            onClick={handleRefresh}
            className="rating-stats__refresh-btn"
            title="Обновить данные"
          >
            ↻
          </button>
        </div>
      </div>

      <div className="rating-stats__content">
        <ProcessOverview
          process={{
            ...data.overview,
            name: PROCESS_TYPES[selectedProcess].name,
          }}
        />

        <div className="rating-stats__grid">
          <div className="rating-stats__col">
            <RatingDistribution ratings={data.ratings} />
          </div>
          <div className="rating-stats__col">
            <DealerStats dealers={data.dealers} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default RatingStats
