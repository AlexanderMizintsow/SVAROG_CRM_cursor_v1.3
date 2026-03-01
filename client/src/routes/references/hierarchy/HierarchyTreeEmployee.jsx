import { useEffect, useState } from 'react'
import axios from 'axios'
import ReactFlow, { useNodesState, useEdgesState, ReactFlowProvider } from 'react-flow-renderer'
import { CircularProgress } from '@mui/material'
import { LiaSmsSolid } from 'react-icons/lia'
import { TbPhoneCall } from 'react-icons/tb'
import { IoMdVideocam } from 'react-icons/io'
import { API_BASE_URL } from '../../../../config'
import malePlaceholder from '../../../../src/assets/img/manAvatar.png'
import femalePlaceholder from '../../../../src/assets/img/womanAvatar.png'
import './HierarchyTreeEmployee.scss'

const HierarchyTreeEmployee = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5000/api/employees/hierarchy`)
      const hierarchicalData = buildHierarchy(response.data)

      // Загружаем аватары и строим данные для React Flow
      // await fetchAvatars(hierarchicalData)
      const { nodes, edges } = buildFlowData(hierarchicalData)
      setNodes(nodes)
      setEdges(edges)
    } catch (error) {
      console.error('Ошибка при загрузке данных сотрудников:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const buildHierarchy = (employees) => {
    const map = {}
    const roots = []

    employees.forEach((employee) => {
      map[employee.id] = { ...employee, children: [] }
    })

    employees.forEach((employee) => {
      if (employee.supervisor_id) {
        map[employee.supervisor_id].children.push(map[employee.id])
      } else {
        roots.push(map[employee.id])
      }
    })

    return roots
  }

  const fetchAvatars = async (employees) => {
    await Promise.all(
      employees.map(async (employee) => {
        try {
          const response = await axios.get(`${API_BASE_URL}5000/api/users/${employee.id}/avatar`)
          employee.avatar = response.data.image
        } catch (error) {
          employee.avatar = null
        }

        if (employee.children && employee.children.length > 0) {
          await fetchAvatars(employee.children)
        }
      })
    )
  }

  const buildFlowData = (hierarchicalData) => {
    const nodes = []
    const edges = []
    const colorMapping = {} // Используем объект для хранения цветов по руководителям

    // Алгоритм раскладки дерева:
    // 1) Рекурсивно вычисляем X‑позиции снизу вверх, чтобы родители
    //    располагались по центру своих детей.
    // 2) Проходим дерево ещё раз и создаём узлы и рёбра для React Flow.

    const horizontalGap = 260
    const verticalGap = 260

    let xCounter = 0
    const positions = {} // { [employee.id]: { x, y } }

    const assignPositions = (employee, depth = 0) => {
      const children = employee.children || []

      if (!children.length) {
        const x = xCounter++
        positions[employee.id] = { x, y: depth }
        return x
      }

      const childXs = children.map((child) => assignPositions(child, depth + 1))
      const avgX = childXs.reduce((sum, val) => sum + val, 0) / childXs.length
      positions[employee.id] = { x: avgX, y: depth }
      return avgX
    }

    const buildGraph = (employee) => {
      const pos = positions[employee.id]
      if (!pos) return

      const supervisorId = employee.supervisor_id
      if (supervisorId && !colorMapping[supervisorId]) {
        colorMapping[supervisorId] = `#${Math.floor(Math.random() * 16777215).toString(16)}`
      }
      const lineColor = supervisorId ? colorMapping[supervisorId] : '#000'

      nodes.push({
        id: employee.id.toString(),
        data: {
          label: (
            <div className="hierarchy-card">
              <div className="image">
                <img
                  src={
                    employee.avatar ||
                    (employee.gender === 'Муж' ? malePlaceholder : femalePlaceholder)
                  }
                  alt="Profile"
                />
              </div>
              <div className="card-body">
                <h4>{employee.name}</h4>
                <p>{employee.job_title}</p>
                <p>{employee.department || 'Не указан отдел'}</p>
                <div className="card-footer">
                  <TbPhoneCall className="card-footer-icon" title="Не доступно!" />
                  <LiaSmsSolid className="card-footer-icon" title="Не доступно!" />
                  <IoMdVideocam className="card-footer-icon" title="Не доступно!" />
                </div>
              </div>
            </div>
          ),
        },
        position: {
          x: pos.x * horizontalGap,
          y: pos.y * verticalGap,
        },
      })

      const children = employee.children || []
      children.forEach((child) => {
        edges.push({
          id: `${employee.id}-${child.id}`,
          source: employee.id.toString(),
          target: child.id.toString(),
          style: { stroke: lineColor },
        })
        buildGraph(child)
      })
    }

    hierarchicalData.forEach((root) => assignPositions(root, 0))
    hierarchicalData.forEach((root) => buildGraph(root))

    return { nodes, edges }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '90vh',
        }}
      >
        <CircularProgress className="progress" color="primary" size={50} variant="indeterminate" />
      </div>
    )
  }

  return (
    <div style={{ height: '78vh' }}>
      <h3>Иерархия сотрудников</h3>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        />
      </ReactFlowProvider>
    </div>
  )
}

export default HierarchyTreeEmployee
