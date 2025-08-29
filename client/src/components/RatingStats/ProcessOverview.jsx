import React from 'react'

const ProcessOverview = ({ process }) => {
  const { name, totalRatings, averageRating, period, lastUpdated } = process

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return 'excellent'
    if (rating >= 4.0) return 'good'
    if (rating >= 3.0) return 'average'
    return 'poor'
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Нет данных'
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="process-overview">
      <div className="process-overview__main">
        <div className="process-overview__rating">
          <div
            className={`process-overview__score process-overview__score--${getRatingColor(
              averageRating
            )}`}
          >
            {averageRating ? averageRating.toFixed(1) : '0.0'}
          </div>
          <div className="process-overview__stars">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className={`process-overview__star ${
                  i < Math.floor(averageRating || 0) ? 'active' : ''
                }`}
              >
                ★
              </span>
            ))}
          </div>
        </div>

        <div className="process-overview__info">
          <h3 className="process-overview__title">{name}</h3>
          <div className="process-overview__stats">
            <div className="process-overview__stat">
              <span className="process-overview__stat-value">{totalRatings || 0}</span>
              <span className="process-overview__stat-label">оценок</span>
            </div>
            <div className="process-overview__stat">
              <span className="process-overview__stat-value">{period || '30 дней'}</span>
              <span className="process-overview__stat-label">период</span>
            </div>
          </div>
        </div>
      </div>

      <div className="process-overview__meta">
        <span className="process-overview__updated">Обновлено: {formatDate(lastUpdated)}</span>
      </div>
    </div>
  )
}

export default ProcessOverview
