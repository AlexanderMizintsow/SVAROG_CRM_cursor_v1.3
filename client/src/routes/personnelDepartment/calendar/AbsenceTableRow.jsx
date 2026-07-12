import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchWorkloadSummary } from '../../../utils/userAbsenceUtils'
import WorkloadSummaryContent from './WorkloadSummaryContent'

const HOVER_DELAY_MS = 300
const TOOLTIP_MAX_WIDTH = 380
const TOOLTIP_GAP = 6

const AbsenceTableRow = ({ userId, employeeName, children }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [tooltipStyle, setTooltipStyle] = useState(null)
  const timerRef = useRef(null)
  const nameCellRef = useRef(null)
  const tooltipRef = useRef(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const updateTooltipPosition = useCallback(() => {
    const anchor = nameCellRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const tooltipEl = tooltipRef.current
    const tooltipHeight = tooltipEl?.offsetHeight || 220
    const tooltipWidth = Math.min(
      tooltipEl?.offsetWidth || TOOLTIP_MAX_WIDTH,
      TOOLTIP_MAX_WIDTH
    )

    const spaceBelow = window.innerHeight - rect.bottom - TOOLTIP_GAP
    const showAbove = spaceBelow < tooltipHeight && rect.top > tooltipHeight + TOOLTIP_GAP

    let top = showAbove ? rect.top - TOOLTIP_GAP : rect.bottom + TOOLTIP_GAP
    if (showAbove) {
      top -= tooltipHeight
    }

    let left = rect.left
    if (left + tooltipWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - tooltipWidth - 12)
    }

    setTooltipStyle({ top, left })
  }, [])

  const handleEnter = () => {
    clearTimer()
    timerRef.current = setTimeout(async () => {
      const rect = nameCellRef.current?.getBoundingClientRect()
      if (rect) {
        setTooltipStyle({ top: rect.bottom + TOOLTIP_GAP, left: rect.left })
      }
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
    setTooltipStyle(null)
  }

  useEffect(() => () => clearTimer(), [])

  useLayoutEffect(() => {
    if (!showTooltip) return undefined

    updateTooltipPosition()

    const handleReposition = () => updateTooltipPosition()
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)

    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [showTooltip, loading, data, updateTooltipPosition])

  return (
    <tr
      className="active-absences__row--hoverable"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <td ref={nameCellRef} className="active-absences__name active-absences__name--with-tip">
        {employeeName}
        {showTooltip &&
          createPortal(
            <div
              ref={tooltipRef}
              className="workload-tooltip"
              role="tooltip"
              style={tooltipStyle || undefined}
            >
              <WorkloadSummaryContent data={data} loading={loading} compact />
            </div>,
            document.body
          )}
      </td>
      {children}
    </tr>
  )
}

export default AbsenceTableRow
