import React, { useState, useEffect, useRef } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps'
import { zoom, zoomIdentity } from 'd3-zoom'
import { select } from 'd3-selection'
import './DealerMap.scss'
import level0 from './level_0.json'
import level1 from './level_1.json'

const DealerMap = () => {
  const [currentMap, setCurrentMap] = useState(level1)
  const [currentLevel, setCurrentLevel] = useState(0)
  const [geographies, setGeographies] = useState([])
  const svgRef = useRef()

  useEffect(() => {
    setGeographies(currentMap.features)
  }, [currentMap])

  useEffect(() => {
    const svg = select(svgRef.current)
    const zoomBehavior = zoom()
      .scaleExtent([1, 15]) // Увеличиваем верхний предел зумирования
      .on('zoom', (event) => {
        svg.attr('transform', event.transform)
      })

    svg.call(zoomBehavior)
    svg.attr('transform', zoomIdentity)
  }, [])

  const handleClick = (geo) => {
    if (currentLevel === 0) {
      setCurrentMap(level1)
      setCurrentLevel(1)
      console.log(`Entering ${geo.properties.COUNTRY}`)
    } else {
      setCurrentMap(level1)
      setCurrentLevel(1)
      console.log(`Going back to previous map`)
    }
  }

  return (
    <div className="map-container">
      <svg ref={svgRef} width="100%" height="100%">
        <ComposableMap>
          <Geographies geography={currentMap}>
            {({ geographies }) =>
              geographies.map((geo, index) => (
                <g key={`${geo.properties.GID_0}-${index}`}>
                  <Geography
                    geography={geo}
                    onClick={() => handleClick(geo)}
                    style={{
                      default: { fill: '#74b9ff', outline: 'none' },
                      hover: { fill: '#0984e3', outline: 'none' },
                      pressed: { fill: '#0056b3', outline: 'none' },
                    }}
                  />
                  {/* Добавляем название региона */}
                  <text
                    transform={`translate(${geo.properties.LOCATION})`}
                    fill="#333" // Цвет текста
                    fontSize={10} // Размер шрифта
                    textAnchor="middle" // Центрирование текста
                  >
                    {geo.properties.NAME}
                  </text>
                </g>
              ))
            }
          </Geographies>
          <Marker coordinates={[37.6173, 55.7558]}>
            <circle r={3} fill="#e74c3c" />
            <text
              textAnchor="middle"
              y={-10}
              style={{ fontSize: 12, fontWeight: 'bold' }}
            >
              Москва
            </text>
          </Marker>
        </ComposableMap>
      </svg>
    </div>
  )
}

export default DealerMap
