import { FaRegStar, FaStar } from 'react-icons/fa'

const KnowledgeSidebar = ({
  departments,
  categories,
  documents,
  departmentId,
  category,
  favoriteOnly = false,
  favoriteCount = 0,
  totalCount = 0,
  onSelectDepartment,
  onSelectCategory,
  onSelectFavorites,
  onClear,
}) => {
  const countsByDept = {}
  const countsByDeptCat = {}
  ;(documents || []).forEach((doc) => {
    const d = String(doc.ownerDepartmentId)
    countsByDept[d] = (countsByDept[d] || 0) + 1
    const key = `${d}::${doc.category}`
    countsByDeptCat[key] = (countsByDeptCat[key] || 0) + 1
  })

  const activeDept = departmentId ? String(departmentId) : ''
  const allActive = !activeDept && !category && !favoriteOnly

  return (
    <aside className="kb-sidebar">
      <button
        type="button"
        className={`kb-sidebar__all ${allActive ? 'is-active' : ''}`}
        onClick={onClear}
      >
        Все документы
        <span className="kb-sidebar__count">{totalCount || documents.length}</span>
      </button>

      <button
        type="button"
        className={`kb-sidebar__fav ${favoriteOnly ? 'is-active' : ''}`}
        onClick={onSelectFavorites}
      >
        <span className="kb-sidebar__fav-label">
          {favoriteOnly ? <FaStar /> : <FaRegStar />}
          Избранное
        </span>
        <span className="kb-sidebar__count">{favoriteCount}</span>
      </button>

      <div className="kb-sidebar__title">Отделы</div>
      <ul className="kb-sidebar__list">
        {(departments || []).map((dep) => {
          const id = String(dep.id)
          const count = countsByDept[id] || 0
          const expanded = activeDept === id && !favoriteOnly
          return (
            <li key={dep.id} className="kb-sidebar__dept">
              <button
                type="button"
                className={`kb-sidebar__dept-btn ${expanded ? 'is-active' : ''}`}
                onClick={() => onSelectDepartment(expanded ? '' : id)}
              >
                <span className="kb-sidebar__dept-name" title={dep.name}>
                  {dep.name}
                </span>
                <span className="kb-sidebar__count">{count}</span>
              </button>
              {expanded ? (
                <ul className="kb-sidebar__cats">
                  {(categories || []).map((cat) => {
                    const c = countsByDeptCat[`${id}::${cat.id}`] || 0
                    return (
                      <li key={cat.id}>
                        <button
                          type="button"
                          className={`kb-sidebar__cat-btn ${
                            category === cat.id ? 'is-active' : ''
                          }`}
                          onClick={() =>
                            onSelectCategory(category === cat.id ? '' : cat.id)
                          }
                        >
                          <span>{cat.label}</span>
                          <span className="kb-sidebar__count">{c}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

export default KnowledgeSidebar
