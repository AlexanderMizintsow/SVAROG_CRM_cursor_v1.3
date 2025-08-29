import React from 'react';

const RatingDistribution = ({ ratings }) => {
  if (!ratings || ratings.length === 0) {
    return (
      <div className="rating-distribution">
        <h4 className="rating-distribution__title">Распределение оценок</h4>
        <div className="rating-distribution__empty">
          <p>Нет данных об оценках</p>
        </div>
      </div>
    );
  }

  const distribution = [5, 4, 3, 2, 1].map(star => {
    const count = ratings.filter(r => Math.floor(r) === star).length;
    const percentage = ratings.length > 0 ? (count / ratings.length) * 100 : 0;
    return { star, count, percentage };
  });

  return (
    <div className="rating-distribution">
      <h4 className="rating-distribution__title">Распределение оценок</h4>
      
      <div className="rating-distribution__chart">
        {distribution.map(({ star, count, percentage }) => (
          <div key={star} className="rating-distribution__bar">
            <div className="rating-distribution__label">
              <span className="rating-distribution__star">{star}★</span>
              <span className="rating-distribution__count">({count})</span>
            </div>
            
            <div className="rating-distribution__progress">
              <div 
                className="rating-distribution__fill"
                style={{ width: `${percentage}%` }}
              />
            </div>
            
            <div className="rating-distribution__percentage">
              {percentage.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
      
      <div className="rating-distribution__summary">
        <div className="rating-distribution__total">
          Всего оценок: {ratings.length}
        </div>
      </div>
    </div>
  );
};

export default RatingDistribution;