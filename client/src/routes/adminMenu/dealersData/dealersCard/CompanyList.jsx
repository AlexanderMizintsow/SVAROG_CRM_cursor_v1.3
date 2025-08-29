import { useState, useEffect } from 'react'
//import axios from 'axios'
import Card from './Card'
import useCompanyStore from '../../../../store/useCompanyStore'
//import { API_BASE_URL } from '../../../../../config'

const CompanyList = ({ searchTerm }) => {
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

  return (
    <div className={`container  ${isExpanded ? 'expanded' : ''}`}>
      {filteredCompanies.map((company, index) => (
        <Card
          setIsDelete={setIsDelete}
          key={company.id}
          company={company}
          toggleCardWidth={toggleCardWidth}
        />
      ))}
    </div>
  )
}

export default CompanyList
