import { memo, useCallback, useMemo } from 'react'
import { ResizableBox } from 'react-resizable'
import './LaneNode.scss'

const LANE_HEADER_WIDTH = 56

const clamp = (v, min, max) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

const LaneNode = ({ data, selected }) => {
  const rawLabel = data?.label ?? ''
  const displayLabel = rawLabel === '' ? 'Дорожка' : rawLabel
  const isPlaceholder = rawLabel === ''

  const width = clamp(data?.width ?? 420, 200, 4000)
  const height = clamp(data?.height ?? 220, 120, 4000)

  const totalWidth = useMemo(() => width + LANE_HEADER_WIDTH, [width])

  const onResizeStop = useCallback(
    (_, resizeData) => {
      const nextTotalWidth = resizeData?.size?.width ?? totalWidth
      const nextHeight = resizeData?.size?.height ?? height
      const nextBodyWidth = Math.max(200, nextTotalWidth - LANE_HEADER_WIDTH)
      data?.onResize?.(nextBodyWidth, Math.max(120, nextHeight))
    },
    [data, height, totalWidth]
  )

  return (
    <ResizableBox
      width={totalWidth}
      height={height}
      minConstraints={[LANE_HEADER_WIDTH + 200, 120]}
      resizeHandles={['se']}
      onResizeStop={onResizeStop}
      handle={<span className="lane-node__resize-handle nodrag" />}
      className={`lane-node ${selected ? 'lane-node--selected' : ''}`}
    >
      <div className="lane-node__header" style={{ width: LANE_HEADER_WIDTH }}>
        <div className={`lane-node__label ${isPlaceholder ? 'lane-node__label--placeholder' : ''}`}>
          {displayLabel}
        </div>
      </div>
      <div className="lane-node__body" style={{ left: LANE_HEADER_WIDTH }} />
    </ResizableBox>
  )
}

export default memo(LaneNode)

