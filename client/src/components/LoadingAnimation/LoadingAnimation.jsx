import React from 'react'

function lerp(x, x0, x1, y0, y1) {
  const t = (x - x0) / (x1 - x0)
  return y0 + t * (y1 - y0)
}

function lerpColor(x, x0, x1, y0, y1) {
  const b0 = y0 & 0xff
  const g0 = (y0 & 0xff00) >> 8
  const r0 = (y0 & 0xff0000) >> 16

  const b1 = y1 & 0xff
  const g1 = (y1 & 0xff00) >> 8
  const r1 = (y1 & 0xff0000) >> 16

  const r = Math.floor(lerp(x, x0, x1, r0, r1))
  const g = Math.floor(lerp(x, x0, x1, g0, g1))
  const b = Math.floor(lerp(x, x0, x1, b0, b1))

  return '#' + ('00000' + ((r << 16) | (g << 8) | b).toString(16)).slice(-6)
}

function lerpTable(vIndex, tValue, table, canExtrapolate, lerpFunc = lerp) {
  const rowCount = table.length

  for (let i = 0; i < rowCount; ++i) {
    let a = table[i][0]

    if (i === 0 && tValue < a) {
      if (canExtrapolate) {
        return lerpFunc(
          tValue,
          a,
          table[i + 1][0],
          table[i][vIndex],
          table[i + 1][vIndex]
        )
      }
      return table[i][vIndex]
    }

    if (i === rowCount - 1 && tValue >= a) {
      if (canExtrapolate) {
        return lerpFunc(
          tValue,
          table[i - 1][0],
          a,
          table[i - 1][vIndex],
          table[i][vIndex]
        )
      }
      return table[i][vIndex]
    }

    if (tValue >= a && tValue <= table[i + 1][0]) {
      return lerpFunc(
        tValue,
        a,
        table[i + 1][0],
        table[i][vIndex],
        table[i + 1][vIndex]
      )
    }
  }

  return 0
}

class Spinner extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      stroke: '#ededed',
      offset: 445,
      animId: null,
    }

    this.startAnimation = this.startAnimation.bind(this)
    this.stopAnimation = this.stopAnimation.bind(this)
  }

  componentDidMount() {
    this.startAnimation()
  }

  componentWillUnmount() {
    this.stopAnimation()
  }

  startAnimation() {
    const pathWidth = 372
    const speed = 2
    const colorTable = [
      [0.0, 0xf15a31],
      [0.2, 0xffd31b],
      [0.33, 0xa6ce42],
      [0.4, 0x007ac1],
      [0.45, 0x007ac1],
      [0.55, 0x007ac1],
      [0.6, 0x007ac1],
      [0.67, 0xa6ce42],
      [0.8, 0xffd31b],
      [1.0, 0xf15a31],
    ]
    let animStart = Date.now()

    const animate = () => {
      let currentAnim = Date.now()
      let t = ((currentAnim - animStart) % 6000) / 6000
      let colorValue = lerpTable(1, t, colorTable, false, lerpColor)
      let offset = this.state.offset - speed
      if (offset < 0) offset = pathWidth

      this.setState({ stroke: colorValue, offset })

      this.setState({ animId: requestAnimationFrame(animate) })
    }

    this.setState({ animId: requestAnimationFrame(animate) })
  }

  stopAnimation() {
    if (this.state.animId) {
      cancelAnimationFrame(this.state.animId)
      this.setState({ animId: null })
    }
  }

  render() {
    const { offset, stroke } = this.state
    const pathStyle = { stroke, strokeDashoffset: offset }

    return (
      <svg
        height="10vh"
        viewBox="0 0 115 115"
        preserveAspectRatio="xMidYMid meet"
        className="root"
      >
        <path
          opacity="0.05"
          fill="none"
          stroke="#000000"
          strokeWidth="3"
          d="M 85 85 C -5 16 -39 127 78 30 C 126 -9 57 -16 85 85 C 94 123 124 111 85 85 Z"
        />
        <path
          style={pathStyle}
          className="progressPath"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          d="M 85 85 C -5 16 -39 127 78 30 C 126 -9 57 -16 85 85 C 94 123 124 111 85 85 Z"
        />
      </svg>
    )
  }
}

export default Spinner

// CSS style
const style = document.createElement('style')
style.textContent = `
  .progressPath {
    stroke-dasharray: 60, 310;
    will-change: stroke, stroke-dashoffset;
  }
`
document.head.appendChild(style)
