import { useState, useEffect } from 'react'
import { getReferencesDepartments, getReferencesUsers } from '../../../../api/businessProcessApi'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import './ProcessDesignerVisibility.scss'

const formatFio = (u) => {
  const parts = [(u.last_name || ''), (u.first_name || ''), (u.middle_name || '')].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : u.username || `ID ${u.id}`
}

const ProcessDesignerVisibility = () => {
  const { visibilityUserIds, setVisibilityUserIds } = useBusinessProcessStore()
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedDeptIds, setExpandedDeptIds] = useState(new Set())
  const [isModalOpen, setIsModalOpen] = useState(false)

  const selectedSet = new Set((visibilityUserIds || []).map(Number))

  useEffect(() => {
    Promise.all([getReferencesDepartments(), getReferencesUsers()])
      .then(([depts, us]) => {
        setDepartments(Array.isArray(depts) ? depts : [])
        setUsers(Array.isArray(us) ? us : [])
      })
      .catch(() => {
        setDepartments([])
        setUsers([])
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleUser = (userId) => {
    const id = Number(userId)
    const next = selectedSet.has(id)
      ? (visibilityUserIds || []).filter((x) => Number(x) !== id)
      : [...(visibilityUserIds || []), id]
    setVisibilityUserIds(next)
  }

  const usersByDept = (deptId) =>
    (users || []).filter((u) => u.department_id != null && Number(u.department_id) === Number(deptId))

  const toggleDepartment = (deptId) => {
    const deptUsers = usersByDept(deptId)
    const deptUserIds = deptUsers.map((u) => Number(u.id))
    const allIn = deptUserIds.length > 0 && deptUserIds.every((id) => selectedSet.has(id))
    let next
    if (allIn) {
      next = (visibilityUserIds || []).filter((id) => !deptUserIds.includes(Number(id)))
    } else {
      const added = new Set(visibilityUserIds || [])
      deptUserIds.forEach((id) => added.add(id))
      next = Array.from(added)
    }
    setVisibilityUserIds(next)
  }

  const isDeptAllSelected = (deptId) => {
    const deptUserIds = usersByDept(deptId).map((u) => Number(u.id))
    return deptUserIds.length > 0 && deptUserIds.every((id) => selectedSet.has(id))
  }

  const toggleExpanded = (deptId) => {
    setExpandedDeptIds((prev) => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  if (loading) {
    return <div className="process-designer-visibility__loading">Загрузка отделов и сотрудников...</div>
  }

  const summaryText =
    selectedSet.size === 0
      ? 'Выбрано сотрудников: 0. Процесс будет виден всем.'
      : `Выбрано сотрудников: ${selectedSet.size}.`

  return (
    <div className="process-designer-visibility">
      <p className="process-designer-visibility__hint">
        Укажите, кому процесс будет виден во вкладке «Опубликованные». Администратор всегда видит все процессы. Если ни один сотрудник не выбран — процесс отображается всем.
      </p>

      <div className="process-designer-visibility__summary-row">
        <div className="process-designer-visibility__summary">{summaryText}</div>
        <button
          type="button"
          className="process-designer-visibility__open-modal-btn"
          onClick={() => setIsModalOpen(true)}
        >
          Настроить видимость процесса
        </button>
      </div>

      {isModalOpen && (
        <div className="process-designer-visibility__modal-backdrop">
          <div className="process-designer-visibility__modal">
            <div className="process-designer-visibility__modal-header">
              <h3>Настройка видимости процесса</h3>
              <button
                type="button"
                className="process-designer-visibility__modal-close"
                onClick={() => setIsModalOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className="process-designer-visibility__modal-body">
              <div className="process-designer-visibility__section">
        <div className="process-designer-visibility__section-title">По отделам</div>
        {departments.length === 0 ? (
          <p className="process-designer-visibility__empty">Нет отделов в справочнике</p>
        ) : (
          <ul className="process-designer-visibility__dept-list">
            {departments.map((dept) => {
              const deptUsers = usersByDept(dept.id)
              const expanded = expandedDeptIds.has(dept.id)
              const allSelected = isDeptAllSelected(dept.id)
              return (
                <li key={dept.id} className="process-designer-visibility__dept-item">
                  <div className="process-designer-visibility__dept-head">
                    <label className="process-designer-visibility__dept-check">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => toggleDepartment(dept.id)}
                      />
                      <span>{dept.name || `Отдел ${dept.id}`}</span>
                    </label>
                    <button
                      type="button"
                      className="process-designer-visibility__dept-expand"
                      onClick={() => toggleExpanded(dept.id)}
                      aria-expanded={expanded}
                    >
                      {expanded ? '−' : '+'}
                    </button>
                  </div>
                  {expanded && (
                    <ul className="process-designer-visibility__user-list">
                      {deptUsers.length === 0 ? (
                        <li className="process-designer-visibility__user-empty">В отделе нет сотрудников</li>
                      ) : (
                        deptUsers.map((u) => (
                          <li key={u.id} className="process-designer-visibility__user-row">
                            <label>
                              <input
                                type="checkbox"
                                checked={selectedSet.has(Number(u.id))}
                                onChange={() => toggleUser(u.id)}
                              />
                              <span>{formatFio(u)}</span>
                            </label>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

              <div className="process-designer-visibility__section">
        <div className="process-designer-visibility__section-title">Дополнительные сотрудники (независимо от отдела)</div>
        {users.length === 0 ? (
          <p className="process-designer-visibility__empty">Нет пользователей</p>
        ) : (
          <div className="process-designer-visibility__all-users" style={{ maxHeight: 200, overflowY: 'auto' }}>
            {users.map((u) => (
              <label key={u.id} className="process-designer-visibility__user-row">
                <input
                  type="checkbox"
                  checked={selectedSet.has(Number(u.id))}
                  onChange={() => toggleUser(u.id)}
                />
                <span>{formatFio(u)}</span>
                {u.department_id != null && (
                  <span className="process-designer-visibility__user-dept">
                    {departments.find((d) => Number(d.id) === Number(u.department_id))?.name || ''}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
              </div>
            </div>

            <div className="process-designer-visibility__modal-footer">
              <span className="process-designer-visibility__summary">{summaryText}</span>
              <button
                type="button"
                className="process-designer-visibility__modal-submit"
                onClick={() => setIsModalOpen(false)}
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProcessDesignerVisibility
