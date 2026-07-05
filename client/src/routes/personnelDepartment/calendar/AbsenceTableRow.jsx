import { useEffect, useRef, useState } from 'react'
import { fetchWorkloadSummary } from '../../../utils/userAbsenceUtils'
import WorkloadSummaryContent from './WorkloadSummaryContent'

const HOVER_DELAY_MS = 300

const AbsenceTableRow = ({ userId, employeeName, children }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const timerRef = useRef(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleEnter = () => {
    clearTimer()
    timerRef.current = setTimeout(async () => {
      setShowTooltip(true)
      setLoading(true)
      setData(null)
      try {
        const summary = await fetchWorkloadSummary(userId)
        setData(summary)
      } catch {
        setData(null)
      } finally {
        setLoading(false)
      }
    }, HOVER_DELAY_MS)
  }

  const handleLeave = () => {
    clearTimer()
    setShowTooltip(false)
    setLoading(false)
    setData(null)
  }

  useEffect(() => () => clearTimer(), [])

  return (
    <tr
      className="active-absences__row--hoverable"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <td className="active-absences__name active-absences__name--with-tip">
        {employeeName}
        {showTooltip && (
          <div className="workload-tooltip" role="tooltip">
            <WorkloadSummaryContent data={data} loading={loading} compact />
          </div>
        )}
      </td>
      {children}
    </tr>
  )
}

export default AbsenceTableRow
