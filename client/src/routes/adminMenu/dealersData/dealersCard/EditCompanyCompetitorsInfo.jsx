import React, { useEffect, useState } from 'react'
import useCompanyStore from '../../../../store/useCompanyStore'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'

import './EditCompanyForm.scss'
import { AiOutlineUserDelete } from 'react-icons/ai'

const EditCompanyCompetitorsInfo = ({ companyId, onClose }) => {
  const { fetchCompanies, updateCompanyCompetitors } = useCompanyStore(
    (state) => ({
      fetchCompanies: state.fetchCompanies,
      updateCompanyCompetitors: state.updateCompanyCompetitors,
    })
  )

  const [competitors, setCompetitors] = useState([])
  const [selectedCompetitorId, setSelectedCompetitorId] = useState('')
  const [competitorConnections, setCompetitorConnections] = useState([])

  useEffect(() => {
    fetchCompetitors()
    fetchCompetitorConnections()
  }, [companyId])

  const fetchCompetitors = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5003/api/competitors`)
      setCompetitors(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке конкурентов:', error)
    }
  }

  const fetchCompetitorConnections = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}5003/api/companies/${companyId}/competitors`
      )
      setCompetitorConnections(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке связей компании и конкурентов:', error)
    }
  }

  const handleAddCompetitor = () => {
    if (selectedCompetitorId) {
      const existingConnection = competitorConnections.find(
        (conn) => conn.competitor_id === selectedCompetitorId
      )

      // Найдем информацию о новом конкуренте
      const newCompetitor = competitors.find(
        (c) => c.id.toString() === selectedCompetitorId
      )

      if (!existingConnection && newCompetitor) {
        setCompetitorConnections((prev) => [
          ...prev,
          { competitor_id: newCompetitor.id, name: newCompetitor.name }, // Сохраняем имя конкурента
        ])
      }
      setSelectedCompetitorId('')
    }
  }

  const handleRemoveCompetitor = (competitorId) => {
    setCompetitorConnections((prev) =>
      prev.filter((conn) => conn.competitor_id !== competitorId)
    )
  }

  const handleSaveChanges = async () => {
    try {
      await updateCompanyCompetitors(companyId, competitorConnections)
      onClose() // Закрытие модального окна после сохранения
    } catch (error) {
      console.error('Ошибка при сохранении изменений:', error)
    }
  }

  return (
    <div style={{ margin: '17px' }} className="container editor-card-element">
      <h3>Существующие конкуренты:</h3>

      <select
        value={selectedCompetitorId}
        onChange={(e) => setSelectedCompetitorId(e.target.value)}
      >
        <option value="" disabled>
          Выберите конкурента
        </option>
        {competitors.map((competitor) => (
          <option key={competitor.id} value={competitor.id}>
            {competitor.name}
          </option>
        ))}
      </select>
      <button style={{ marginLeft: '15px' }} onClick={handleAddCompetitor}>
        Добавить конкурента
      </button>

      <h4>Добавленные в карту:</h4>
      <ul>
        {competitorConnections.map((conn) => {
          return (
            <li key={conn.competitor_id}>
              {conn.name || 'Неизвестный конкурент'}{' '}
              {/* Используем имя из связей */}
              <span onClick={() => handleRemoveCompetitor(conn.competitor_id)}>
                <AiOutlineUserDelete
                  style={{ color: 'red' }}
                  className="icon-pointer"
                />
              </span>
            </li>
          )
        })}
      </ul>

      <button onClick={handleSaveChanges}>Сохранить изменения</button>
      <button style={{ marginLeft: '15px' }} onClick={onClose}>
        Закрыть
      </button>
    </div>
  )
}

export default EditCompanyCompetitorsInfo
//1
