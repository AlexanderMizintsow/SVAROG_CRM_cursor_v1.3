import { useEffect, useRef } from 'react'
import joint from 'jointjs'
import 'jointjs/dist/joint.css'

const JointJSModeler = () => {
  const paperRef = useRef(null)
  const graphRef = useRef(null)

  useEffect(() => {
    graphRef.current = new joint.dia.Graph()

    const paper = new joint.dia.Paper({
      el: paperRef.current,
      model: graphRef.current,
      width: '100%',
      height: '80vh',
      gridSize: 10,
      drawGrid: true,
    })

    // Создаем элемент и добавляем его на диаграмму
    const rect = new joint.shapes.standard.Rectangle()
    rect.position(100, 30)
    rect.resize(100, 40)
    rect.attr({
      body: {
        fill: 'blue',
      },
      label: {
        text: 'Hello',
        fill: 'white',
      },
    })
    rect.addTo(graphRef.current)

    const circle = new joint.shapes.standard.Circle()
    circle.position(300, 30)
    circle.resize(100, 40)
    circle.attr({
      body: {
        fill: 'red',
      },
      label: {
        text: 'World',
        fill: 'white',
      },
    })
    circle.addTo(graphRef.current)

    // Создаем линк (связь) между элементами
    const link = new joint.shapes.standard.Link()
    link.source(rect)
    link.target(circle)
    link.addTo(graphRef.current)

    return () => {
      paper.remove()
      graphRef.current.clear()
    }
  }, [])

  const handleSave = () => {
    const json = graphRef.current.toJSON()
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json))
    const a = document.createElement('a')
    a.href = dataStr
    a.download = 'diagram.json'
    a.click()
  }

  const handleOpen = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const json = JSON.parse(e.target.result)
        graphRef.current.fromJSON(json)
      }
      reader.readAsText(file)
    }
  }

  return (
    <div>
      <div>
        <button onClick={handleSave}>Save Diagram</button>
        <input type="file" onChange={handleOpen} />
      </div>
      <div
        ref={paperRef}
        style={{ width: '100%', height: '80vh', border: '1px solid #000' }}
      />
    </div>
  )
}

export default JointJSModeler
