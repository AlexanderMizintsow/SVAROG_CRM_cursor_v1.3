import { API_BASE_URL } from '../../../config'
import axios from 'axios'
import { useState, useEffect } from 'react'
import './competitorForm.scss'

const CompetitorForm = () => {
  const [competitor, setCompetitor] = useState({
    name: '',
    industry: '',
    contact_email: '',
  })
  const [competitorsList, setCompetitorsList] = useState([])

  const handleChange = (e) => {
    setCompetitor({ ...competitor, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await axios.post(
        `${API_BASE_URL}5003/api/competitors`,
        competitor
      )
      console.log('Конкурент успешно добавлен:', response.data)
      setCompetitor({ name: '', industry: '', contact_email: '' })
      fetchCompetitors()
    } catch (error) {
      console.error('Ошибка при добавлении конкурента:', error)
    }
  }

  const fetchCompetitors = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5003/api/competitors`)
      setCompetitorsList(response.data)
    } catch (error) {
      console.error('Ошибка при получении конкурентов:', error)
    }
  }

  useEffect(() => {
    fetchCompetitors()
  }, [])

  return (
    <div className="competitor-form-container">
      <div className="form-section">
        <h1>Добавить конкурента</h1>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="name">Название конкурента</label>
            <input
              type="text"
              name="name"
              value={competitor.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="industry">Отрасль</label>
            <input
              type="text"
              name="industry"
              value={competitor.industry}
              onChange={handleChange}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="contact_email">Контактный email</label>
            <input
              type="email"
              name="contact_email"
              value={competitor.contact_email}
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" className="submit-button">
            Добавить
          </button>
        </form>
      </div>
      <div className="list-section">
        <h2>Список конкурентов</h2>
        <ul>
          {competitorsList.map((comp) => (
            <li key={comp.id} className="competitor-item">
              <h3>{comp.name}</h3>
              <p>
                Отрасль: {comp.industry}, Email: {comp.contact_email}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default CompetitorForm
