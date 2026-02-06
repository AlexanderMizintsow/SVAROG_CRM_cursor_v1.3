import { memo, useMemo } from 'react'
import { getSmoothStepPath } from 'react-flow-renderer'

function getOffsetCenter(sourceX, sourceY, targetX, targetY, offset) {
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const len = Math.sqrt(dx * dx + dy * dy) || 1

  // Перпендикулярный сдвиг, чтобы параллельные линии расходились и не «слипались»
  const nx = -dy / len
  const ny = dx / len
  return { centerX: midX + nx * offset, centerY: midY + ny * offset }
}

const ColoredSmoothEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  selected,
  className,
  markerEnd,
  markerStart,
  data,
}) => {
  const routeOffset = Number(data?.routeOffset) || 0

  const { centerX, centerY } = useMemo(
    () => getOffsetCenter(sourceX, sourceY, targetX, targetY, routeOffset),
    [sourceX, sourceY, targetX, targetY, routeOffset]
  )

  const path = useMemo(
    () =>
      getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius: 14,
        centerX,
        centerY,
      }),
    [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, centerX, centerY]
  )

  const mergedStyle = useMemo(
    () => ({
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      opacity: selected ? 1 : 0.92,
      strokeWidth: selected ? 3 : (style?.strokeWidth ?? 2),
      ...(style || {}),
    }),
    [style, selected]
  )

  return (
    <g className={className}>
      <path
        id={id}
        className="react-flow__edge-path"
        d={path}
        style={mergedStyle}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
    </g>
  )
}

export default memo(ColoredSmoothEdge)

