import { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../config'
import useUserStore from '../../../store/userStore'
import Toastify from 'toastify-js'
import './ratingModal.scss'

const RatingModal = ({ onClose }) => {
  const { user } = useUserStore()
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [existingReview, setExistingReview] = useState(null)
  const [averageRating, setAverageRating] = useState(0)
  const [reviews, setReviews] = useState([])
  const [showReviewModal, setShowReviewModal] = useState(false)

  useEffect(() => {
    if (user) {
      axios
        .get(`${API_BASE_URL}5000/api/employees/rating/${user.id}`)
        .then((response) => {
          const data = response.data
          if (data) {
            setExistingReview(data)
            setRating(data.rating)
            setFeedback(data.feedback)
          }
        })
        .catch((error) => {
          Toastify({
            text: 'Ошибка при получении отзыва',
            close: true,
            style: {
              background: 'linear-gradient(to right, #ff7e79, #ff1e00)',
            },
          }).showToast()
          console.error('Ошибка при получении отзыва:', error)
        })

      // Получение средней оценки
      axios
        .get(`${API_BASE_URL}5000/api/reviews/average`)
        .then((response) => {
          // console.log('Ответ от API:', response.data)
          const data = response.data
          const averageRating = parseFloat(data.average_rating)
          if (!isNaN(averageRating)) {
            setAverageRating(averageRating)
          } else {
            console.warn('Средний рейтинг не является корректным числом:', data)
            setAverageRating(0)
          }
        })
        .catch((error) => {
          Toastify({
            text: 'Ошибка при получении средней оценки',
            close: true,
            style: {
              background: 'linear-gradient(to right, #ff7e79, #ff1e00)',
            },
          }).showToast()
          console.error('Ошибка при получении средней оценки:', error)
        })
    }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const response = await axios.post(
        `${API_BASE_URL}5000/api/employees/rating`,
        {
          userId: user.id,
          rating,
          feedback,
        }
      )
      Toastify({
        text: 'Отзыв успешно добавлен',
        close: true,
        style: {
          background: 'linear-gradient(to right, #00b09b, #96c93d)',
        },
      }).showToast()
      console.log('Отзыв успешно добавлен или обновлён:', response.data)
      onClose()
    } catch (error) {
      Toastify({
        text: 'Ошибка при отправке отзыва',
        close: true,
        style: {
          background: 'linear-gradient(to right, #ff7e79, #ff1e00)',
        },
      }).showToast()
      console.error('Ошибка при отправке отзыва:', error)
    }
  }

  const handleShowReviews = () => {
    axios
      .get(`${API_BASE_URL}5000/api/reviews`)
      .then((response) => {
        setReviews(response.data)
        setShowReviewModal(true)
      })
      .catch((error) => {
        Toastify({
          text: 'Ошибка при получении отзывов',
          close: true,
          style: {
            background: 'linear-gradient(to right, #ff7e79, #ff1e00)',
          },
        }).showToast()
        console.error('Ошибка при получении отзывов:', error)
      })
  }

  return (
    <div className="rating-modal-overlay">
      <div className="rating-modal-content">
        {user && user.role_name === 'Администратор' ? (
          <h3 onClick={handleShowReviews} style={{ cursor: 'pointer' }}>
            Средняя оценка: {averageRating.toFixed(1)}
          </h3>
        ) : (
          <h3 style={{ cursor: 'default' }}>
            Средняя оценка: {averageRating.toFixed(1)}
          </h3>
        )}
        <h2>Оцените приложение</h2>

        <form onSubmit={handleSubmit}>
          <div className="rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <label
                key={star}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
              >
                <input
                  type="radio"
                  value={star}
                  onChange={() => setRating(star)}
                  checked={rating === star}
                />
                <span
                  className={
                    rating >= star || hoveredRating >= star ? 'filled' : ''
                  }
                >
                  ★
                </span>
              </label>
            ))}
          </div>
          <textarea
            placeholder="Ваш отзыв..."
            required
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <button type="submit">Отправить</button>
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </form>

        {showReviewModal && (
          <div className="review-modal">
            <h2>Отзывы</h2>
            <ul>
              {reviews.map((review) => (
                <li key={review.id}>
                  <p>
                    ФИО: {review.first_name} {review.middle_name}{' '}
                    {review.last_name}
                  </p>
                  <p>Оценка: {review.rating}</p>
                  <p>Отзыв: {review.feedback}</p>
                  <p>
                    Обновлено: {new Date(review.updated_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowReviewModal(false)}>Закрыть</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default RatingModal
