import { CiSearch } from 'react-icons/ci'
import './searchBar.scss'

const SearchBar = ({
  searchTerm,
  setSearchTerm,
  placeholder = 'Поиск ...',
  transform = '-10',
}) => {
  const searchTransform = `translateY(${transform}px)`
  return (
    <div className="search-container" style={{ transform: searchTransform }}>
      <input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />
      <CiSearch className="search-icon" />
    </div>
  )
}
export default SearchBar
