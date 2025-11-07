import { useRef, useEffect } from 'react'
import { Box } from '@mui/material'

const LeafVisualizer = ({ leafTypeId, leafTypes, foundHandles }) => {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = 970 // ширина в мм (по умолчанию)
    const height = 1990 // высота в мм (по умолчанию)

    // Устанавливаем размер canvas (компактный)
    canvas.width = 150
    canvas.height = 100

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Масштаб для отображения
    const scaleX = canvas.width / width
    const scaleY = canvas.height / height
    const scale = Math.min(scaleX, scaleY) * 0.9 // Оставляем немного места для отступов

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const scaledWidth = width * scale
    const scaledHeight = height * scale

    // Рисуем внешнюю раму створки
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.strokeRect(
      centerX - scaledWidth / 2,
      centerY - scaledHeight / 2,
      scaledWidth,
      scaledHeight
    )

    // Рисуем внутреннюю раму (стеклопакет)
    const innerPadding = 50 * scale
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 1
    ctx.strokeRect(
      centerX - scaledWidth / 2 + innerPadding,
      centerY - scaledHeight / 2 + innerPadding,
      scaledWidth - innerPadding * 2,
      scaledHeight - innerPadding * 2
    )

    // Рисуем диагональные линии (обозначение стекла)
    ctx.strokeStyle = '#999'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(
      centerX - scaledWidth / 2 + innerPadding,
      centerY - scaledHeight / 2 + innerPadding
    )
    ctx.lineTo(
      centerX + scaledWidth / 2 - innerPadding,
      centerY + scaledHeight / 2 - innerPadding
    )
    ctx.moveTo(
      centerX + scaledWidth / 2 - innerPadding,
      centerY - scaledHeight / 2 + innerPadding
    )
    ctx.lineTo(
      centerX - scaledWidth / 2 + innerPadding,
      centerY + scaledHeight / 2 - innerPadding
    )
    ctx.stroke()

    // Рисуем ручку (если есть найденные ручки)
    if (foundHandles && foundHandles.length > 0) {
      // Позиция ручки: примерно на 1/3 от верха и слева
      const handleX = centerX - scaledWidth / 2 + innerPadding + 20 * scale
      const handleY = centerY - scaledHeight / 2 + innerPadding + (scaledHeight - innerPadding * 2) / 3

      // Рисуем ручку схематично
      ctx.fillStyle = '#4a90e2'
      ctx.beginPath()
      ctx.arc(handleX, handleY, 8, 0, Math.PI * 2)
      ctx.fill()

      // Рисуем изогнутую часть ручки
      ctx.strokeStyle = '#4a90e2'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(handleX, handleY, 15, Math.PI / 2, Math.PI * 1.5)
      ctx.stroke()

      // Рисуем горизонтальную часть ручки
      ctx.beginPath()
      ctx.moveTo(handleX, handleY - 15)
      ctx.lineTo(handleX + 25, handleY - 15)
      ctx.stroke()

      // Подсказка при наведении
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(handleX - 50, handleY - 60, 150, 30)
      ctx.fillStyle = '#fff'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(
        `Ручка: ${foundHandles[0].article}`,
        handleX + 25,
        handleY - 40
      )
    }

    // Рисуем размеры
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.font = '14px Arial'
    ctx.fillStyle = '#000'

    // Ширина
    const widthX = centerX
    const widthY1 = centerY + scaledHeight / 2 + 30
    const widthY2 = centerY + scaledHeight / 2 + 50
    ctx.beginPath()
    ctx.moveTo(widthX - scaledWidth / 2, widthY1)
    ctx.lineTo(widthX - scaledWidth / 2, widthY2)
    ctx.lineTo(widthX + scaledWidth / 2, widthY2)
    ctx.lineTo(widthX + scaledWidth / 2, widthY1)
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.fillText(`${width} мм`, widthX, widthY2 + 20)

    // Высота
    const heightX1 = centerX + scaledWidth / 2 + 30
    const heightX2 = centerX + scaledWidth / 2 + 50
    const heightY = centerY
    ctx.beginPath()
    ctx.moveTo(heightX1, centerY - scaledHeight / 2)
    ctx.lineTo(heightX2, centerY - scaledHeight / 2)
    ctx.lineTo(heightX2, centerY + scaledHeight / 2)
    ctx.lineTo(heightX1, centerY + scaledHeight / 2)
    ctx.stroke()
    ctx.save()
    ctx.translate(heightX2 + 20, heightY)
    ctx.rotate(Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText(`${height} мм`, 0, 0)
    ctx.restore()

    // Маркировка типа створки
    const selectedLeafType = leafTypes.find(lt => lt.id.toString() === leafTypeId)
    if (selectedLeafType) {
      ctx.fillStyle = '#4a90e2'
      ctx.font = 'bold 16px Arial'
      ctx.textAlign = 'left'
      ctx.fillText(
        selectedLeafType.name,
        centerX - scaledWidth / 2 + innerPadding + 10,
        centerY + scaledHeight / 2 - innerPadding - 10
      )
    }
  }, [leafTypeId, leafTypes, foundHandles])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box
        sx={{
          border: '1px solid #ddd',
          borderRadius: 1,
          p: 1,
          backgroundColor: '#f9f9f9',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <canvas ref={canvasRef} />
      </Box>
    </Box>
  )
}

export default LeafVisualizer



