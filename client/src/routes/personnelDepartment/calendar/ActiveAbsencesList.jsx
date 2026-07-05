import { useMemo, useState } from 'react'
import { formatAbsencePeriod, canManageEmployeeStatusClient } from '../../../utils/userAbsenceUtils'
import StatusEditModal from './StatusEditModal'
import AbsenceTableRow from './AbsenceTableRow'

const formatFio = (last, first, middle) =>
  [last, first, middle].filter(Boolean).join(' ').trim()

const formatDepartmentWithSupervisor = (absence) => {
  const dept = absence.department_name || 'Без отдела'
  const supervisor = formatFio(
    absence.supervisor_last_name,
    absence.supervisor_first_name,
    absence.supervisor_middle_name
  )
  if (!supervisor) return dept
  return `${dept} (${supervisor})`
}

const STATUS_CLASS = {
  отпуск: 'absence-status--vacation',
  болезнь: 'absence-status--sick',
  командировка: 'absence-status--trip',
  'на обучении': 'absence-status--training',
}

const ActiveAbsencesList = ({
  absences = [],
  loading = false,
  onRefresh,
  permissions = null,
  users = [],
  actorUserId = null,
}) => {
  const [editingAbsence, setEditingAbsence] = useState(null)

  const sortedRows = useMemo(() => {
    return [...absences].sort((a, b) => {
      const deptA = (a.department_name || 'яяя').toLowerCase()
      const deptB = (b.department_name || 'яяя').toLowerCase()
      if (deptA !== deptB) return deptA.localeCompare(deptB, 'ru')
      const nameA = formatFio(a.last_name, a.first_name, a.middle_name)
      const nameB = formatFio(b.last_name, b.first_name, b.middle_name)
      return nameA.localeCompare(nameB, 'ru')
    })
  }, [absences])

  const canEditRow = (row) =>
    canManageEmployeeStatusClient(permissions, row.user_department_id)

  const showActionsColumn =
    permissions &&
    (permissions.isAdmin || permissions.isHr || (permissions.headDepartmentIds || []).length > 0)

  if (loading) {
    return <p className="active-absences__empty">Загрузка списка…</p>
  }

  if (!sortedRows.length) {
    return (
      <div className="active-absences__empty-wrap">
        <p className="active-absences__empty">Сейчас нет сотрудников в отпуске или другом статусе отсутствия.</p>
        {onRefresh && (
          <button type="button" className="active-absences__refresh" onClick={onRefresh}>
            Обновить
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="active-absences">
      <div className="active-absences__toolbar">
        <span className="active-absences__count">
          Отсутствуют: <strong>{sortedRows.length}</strong>
          <span className="active-absences__hover-hint"> · наведите на строку для сводки по задачам</span>
        </span>
        {onRefresh && (
          <button type="button" className="active-absences__refresh" onClick={onRefresh}>
            Обновить
          </button>
        )}
      </div>

      <div className="active-absences__table-wrap">
        <table className="active-absences__table">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Отдел (руководитель)</th>
              <th>Статус</th>
              <th>Период / даты</th>
              <th>Замещающий</th>
              {showActionsColumn && <th className="active-absences__th-actions" />}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const statusKey = (row.status || '').toLowerCase()
              const statusClass = STATUS_CLASS[statusKey] || 'absence-status--default'
              const substitute = row.substitute_user_id
                ? formatFio(
                    row.substitute_last_name,
                    row.substitute_first_name,
                    row.substitute_middle_name
                  )
                : '—'

              return (
                <AbsenceTableRow
                  key={row.id}
                  userId={row.user_id}
                  employeeName={formatFio(row.last_name, row.first_name, row.middle_name)}
                >
                  <td className="active-absences__dept">{formatDepartmentWithSupervisor(row)}</td>
                  <td>
                    <span className={`absence-status ${statusClass}`}>{row.status}</span>
                  </td>
                  <td className="active-absences__period">{formatAbsencePeriod(row)}</td>
                  <td className="active-absences__substitute">{substitute}</td>
                  {showActionsColumn && (
                    <td className="active-absences__actions">
                      {canEditRow(row) && (
                        <button
                          type="button"
                          className="active-absences__edit-btn"
                          onClick={() => setEditingAbsence(row)}
                        >
                          Изменить
                        </button>
                      )}
                    </td>
                  )}
                </AbsenceTableRow>
              )
            })}
          </tbody>
        </table>
      </div>

      {editingAbsence && actorUserId && (
        <StatusEditModal
          absence={editingAbsence}
          users={users}
          actorUserId={actorUserId}
          onClose={() => setEditingAbsence(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  )
}

export default ActiveAbsencesList
