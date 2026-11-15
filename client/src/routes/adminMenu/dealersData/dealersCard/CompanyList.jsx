import { useState, useEffect } from 'react'
//import axios from 'axios'
import Card from './Card'
import useCompanyStore from '../../../../store/useCompanyStore'
//import { API_BASE_URL } from '../../../../../config'

const CompanyList = ({ searchTerm, focusCompanyId }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isDelete, setIsDelete] = useState()

  const { companies, fetchCompanies } = useCompanyStore((state) => ({
    companies: state.companies,
    fetchCompanies: state.fetchCompanies,
  }))

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies, isDelete])

  const toggleCardWidth = () => {
    setIsExpanded((prev) => !prev)
  }

  // Filter
  const filteredCompanies = companies.filter((company) =>
    Object.values(company).some((value) =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  )
  const shownCompanies = focusCompanyId
    ? filteredCompanies.filter(
        (company) => String(company.company_id) === String(focusCompanyId)
      )
    : filteredCompanies

  useEffect(() => {
    if (!focusCompanyId || !shownCompanies.length) return
    const card = document.getElementById(`company-card-${focusCompanyId}`)
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusCompanyId, shownCompanies.length])

  return (
    <div className={`container  ${isExpanded ? 'expanded' : ''}`}>
      {shownCompanies.map((company) => (
        <Card
          setIsDelete={setIsDelete}
          key={company.id || company.company_id}
          company={company}
          toggleCardWidth={toggleCardWidth}
        />
      ))}
    </div>
  )
}

export default CompanyList
