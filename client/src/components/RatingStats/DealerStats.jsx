import React, { useState } from 'react'
import PropTypes from 'prop-types'

const DealerStats = ({ dealers }) => {
  const [expandedDealer, setExpandedDealer] = useState(null)
  const [commentsPages, setCommentsPages] = useState({})
  const COMMENTS_PER_PAGE = 5

  if (!dealers || dealers.length === 0) {
    return (
      <div className="dealer-stats">
        <h3 className="dealer-stats__title">Топ дилеров по оценкам</h3>
        <div className="dealer-stats__empty">
          <p>Нет данных о дилерах за выбранный период</p>
        </div>
      </div>
    )
  }

  const handleDealerClick = (userId) => {
    setExpandedDealer(expandedDealer === userId ? null : userId)
    if (!commentsPages[userId]) {
      setCommentsPages((prev) => ({ ...prev, [userId]: 1 }))
    }
  }

  const loadMoreComments = (userId) => {
    setCommentsPages((prev) => ({
      ...prev,
      [userId]: (prev[userId] || 1) + 1,
    }))
  }

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return 'excellent'
    if (rating >= 4.0) return 'good'
    if (rating >= 3.0) return 'average'
    return 'poor'
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderCompanyInfo = (dealer) => {
    if (!dealer.company_name || dealer.company_name === 'Не указана') {
      return null
    }
    return (
      <div className="dealer-stats__company">
        <span className="dealer-stats__company-icon">🏢</span>
        {dealer.company_name}
      </div>
    )
  }

  const renderComments = (dealer) => {
    if (expandedDealer !== dealer.user_id) return null

    const currentPage = commentsPages[dealer.user_id] || 1
    const visibleComments = dealer.comments.slice(0, currentPage * COMMENTS_PER_PAGE)
    const hasMore = dealer.comments.length > visibleComments.length

    return (
      <div className="dealer-stats__comments">
        <h4 className="dealer-stats__comments-title">
          Последние отзывы ({dealer.comments.length})
        </h4>

        {visibleComments.length > 0 ? (
          <div className="dealer-stats__comments-list">
            {visibleComments.map((comment, idx) => (
              <div key={`${dealer.user_id}-${idx}`} className="dealer-stats__comment">
                <div className="dealer-stats__comment-header">
                  <span
                    className={`dealer-stats__comment-rating rating-${Math.floor(comment.rating)}`}
                  >
                    {comment.rating} ★
                  </span>
                  <span className="dealer-stats__comment-date">{formatDate(comment.date)}</span>
                  {comment.requestNumber && (
                    <span className="dealer-stats__comment-request">№{comment.requestNumber}</span>
                  )}
                </div>
                <div className="dealer-stats__comment-text">
                  {comment.comment || <em>Без комментария</em>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="dealer-stats__no-comments">Нет комментариев за выбранный период</div>
        )}

        {hasMore && (
          <button
            className="dealer-stats__show-more"
            onClick={() => loadMoreComments(dealer.user_id)}
          >
            Показать ещё{' '}
            {Math.min(COMMENTS_PER_PAGE, dealer.comments.length - visibleComments.length)}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="dealer-stats">
      <h3 className="dealer-stats__title">Топ дилеров по оценкам</h3>

      <div className="dealer-stats__list">
        {dealers.map((dealer, index) => (
          <div
            key={dealer.user_id}
            className={`dealer-stats__item ${expandedDealer === dealer.user_id ? 'expanded' : ''}`}
          >
            <div className="dealer-stats__header" onClick={() => handleDealerClick(dealer.user_id)}>
              <div className="dealer-stats__rank">#{index + 1}</div>

              <div className="dealer-stats__info">
                <div className="dealer-stats__name">
                  {dealer.user_name || `Дилер ${dealer.user_id}`}
                  {renderCompanyInfo(dealer)}
                </div>

                <div className="dealer-stats__metrics">
                  <span className="dealer-stats__count">{dealer.totalRatings} оценок</span>
                  <span className="dealer-stats__period">за {dealer.period || '30 дней'}</span>
                </div>
              </div>

              <div className="dealer-stats__rating">
                <div className={`dealer-stats__score ${getRatingColor(dealer.averageRating)}`}>
                  {dealer.averageRating.toFixed(1)}
                </div>
                <div className="dealer-stats__stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={star <= Math.round(dealer.averageRating) ? 'active' : ''}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {renderComments(dealer)}
          </div>
        ))}
      </div>
    </div>
  )
}

DealerStats.propTypes = {
  dealers: PropTypes.arrayOf(
    PropTypes.shape({
      user_id: PropTypes.number.isRequired,
      user_name: PropTypes.string,
      company_name: PropTypes.string,
      totalRatings: PropTypes.number.isRequired,
      averageRating: PropTypes.number.isRequired,
      period: PropTypes.string,
      comments: PropTypes.arrayOf(
        PropTypes.shape({
          rating: PropTypes.number.isRequired,
          comment: PropTypes.string,
          date: PropTypes.string.isRequired,
          requestNumber: PropTypes.string,
        })
      ),
    })
  ),
}

DealerStats.defaultProps = {
  dealers: [],
}

export default DealerStats
