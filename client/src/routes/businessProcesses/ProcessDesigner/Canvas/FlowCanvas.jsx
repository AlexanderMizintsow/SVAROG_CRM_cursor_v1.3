import { useCallback, useEffect, useMemo, useRef } from 'react'
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
} from 'react-flow-renderer'
import { v4 as uuidv4 } from 'uuid'
import useBusinessProcessStore from '../../../../store/useBusinessProcessStore'
import BlockNode from './BlockNode'
import LaneNode from './LaneNode'
import ColoredSmoothEdge from './ColoredSmoothEdge'
import 'react-flow-renderer/dist/style.css'
import './FlowCanvas.scss'

const LANE_TYPE = 'lane'
const LANE_HEADER_WIDTH = 56
const EDGE_TYPE = 'coloredSmooth'

const nodeTypes = { block: BlockNode, [LANE_TYPE]: LaneNode }
const edgeTypes = { [EDGE_TYPE]: ColoredSmoothEdge }

const BLOCK_COLORS = {
  start: '#22c55e',
  end: '#94a3b8',
  create_project: '#0ea5e9',
  project_update_status: '#0284c7',
  project_add_comment: '#0284c7',
  project_post_chat: '#0284c7',
  project_add_responsibles: '#0284c7',
  project_update_goals: '#0284c7',
  project_update_additional_info: '#0284c7',
  project_add_attachment: '#0284c7',
  project_update_task_status: '#8b5cf6',
  create_task: '#3b82f6',
  assign_task: '#8b5cf6',
  notification: '#f59e0b',
  decision: '#8b5cf6',
  gateway: '#e11d48',
  gateway_join: '#c026d3',
  splitter: '#dc2626',
  timer: '#0ea5e9',
}

function getColorForNodeType(type) {
  return BLOCK_COLORS[type] || 'rgba(148, 163, 184, 0.9)'
}

const schemeToFlow = (scheme) => {
  const schemeData = scheme && typeof scheme === 'object' ? scheme : {}
  const rawNodes = Array.isArray(schemeData.nodes) ? schemeData.nodes : []
  const rawEdges = Array.isArray(schemeData.edges) ? schemeData.edges : []
  const normalizedEdges = rawEdges.map((e, i) => ({
    ...(e || {}),
    __id: e?.id || `e-${e?.source}-${e?.target}-${i}`,
    __i: i,
  }))

  const posById = rawNodes.reduce((acc, n) => {
    acc[n.id] = n.position || { x: 0, y: 0 }
    return acc
  }, {})

  const typeById = rawNodes.reduce((acc, n) => {
    acc[n.id] = n.type
    return acc
  }, {})

  const laneNodes = rawNodes
    .filter((n) => n.type === LANE_TYPE)
    .map((n) => {
      const w = Math.max(200, Number(n.settings?.width) || 420)
      const h = Math.max(120, Number(n.settings?.height) || 220)
      return {
        id: n.id,
        type: LANE_TYPE,
        position: n.position || { x: 0, y: 0 },
        data: {
          // label может быть пустой строкой — это важно для корректного редактирования
          label: n.label ?? '',
          width: w,
          height: h,
        },
        style: { width: w + LANE_HEADER_WIDTH, height: h, zIndex: 0 },
        draggable: true,
        connectable: false,
      }
    })

  const blockNodes = rawNodes
    .filter((n) => n.type !== LANE_TYPE)
    .map((n) => ({
      id: n.id,
      type: 'block',
      position: n.position || { x: 0, y: 0 },
      data: {
        nodeType: n.type,
        label: n.label,
        settings: n.settings,
      },
      style: { zIndex: 1 },
    }))

  const nodes = [...laneNodes, ...blockNodes]

  // Разносим исходящие линии от одного источника, чтобы они не «слипались»
  const outgoingBySource = normalizedEdges.reduce((acc, e) => {
    if (!e?.source) return acc
    acc[e.source] = acc[e.source] || []
    acc[e.source].push(e)
    return acc
  }, {})

  const routeOffsetByEdgeId = {}
  Object.keys(outgoingBySource).forEach((sourceId) => {
    const list = outgoingBySource[sourceId] || []
    const sorted = [...list].sort((a, b) => {
      const pa = posById[a.target] || { x: 0, y: 0 }
      const pb = posById[b.target] || { x: 0, y: 0 }
      if (pa.y !== pb.y) return pa.y - pb.y
      return pa.x - pb.x
    })
    const n = sorted.length
    sorted.forEach((e, idx) => {
      const centerIdx = idx - (n - 1) / 2
      routeOffsetByEdgeId[e.__id] = centerIdx * 24
    })
  })

  const edges = normalizedEdges.map((e) => {
    const id = e.__id
    const sourceType = typeById[e.source]
    const stroke = getColorForNodeType(sourceType)
    return {
      id,
      source: e.source,
      target: e.target,
      type: EDGE_TYPE,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
      ...(e.condition != null ? { condition: e.condition } : {}),
      style: { stroke, strokeWidth: 2 },
      data: { routeOffset: routeOffsetByEdgeId[id] || 0 },
    }
  })

  return { nodes, edges }
}

const flowToScheme = (nodes, edges) => {
  const nodesList = Array.isArray(nodes) ? nodes : []
  const edgesList = Array.isArray(edges) ? edges : []

  const schemeNodes = nodesList.map((n) => {
    if (n.type === LANE_TYPE) {
      return {
        id: n.id,
        type: LANE_TYPE,
        position: n.position,
        // label может быть пустой строкой — сохраняем как есть
        label: n.data?.label ?? '',
        settings: {
          width: n.data?.width ?? 420,
          height: n.data?.height ?? 220,
        },
      }
    }
    return {
      id: n.id,
      type: n.data?.nodeType || 'create_task',
      position: n.position,
      label: n.data?.label,
      settings: n.data?.settings || {},
    }
  })

  const schemeEdges = edgesList.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
    ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
    ...(e.condition != null ? { condition: e.condition } : {}),
  }))

  return { nodes: schemeNodes, edges: schemeEdges }
}

function FlowCanvasInner() {
  const {
    scheme,
    selectedNodeId,
    setScheme,
    setSelectedNodeId,
    removeNodeFromScheme,
  } = useBusinessProcessStore()

  const initial = useMemo(() => schemeToFlow(scheme), [])
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  const resizeLane = useCallback(
    (laneId, width, height) => {
      const nextNodes = nodesRef.current.map((n) => {
        if (n.id !== laneId || n.type !== LANE_TYPE) return n
        const w = Math.max(200, Number(width) || 200)
        const h = Math.max(120, Number(height) || 120)
        return {
          ...n,
          data: { ...(n.data || {}), width: w, height: h },
          style: { ...(n.style || {}), width: w + LANE_HEADER_WIDTH, height: h },
        }
      })
      setNodes(nextNodes)
      setScheme(flowToScheme(nextNodes, edgesRef.current))
    },
    [setNodes, setScheme]
  )

  const attachLaneCallbacks = useCallback(
    (flowNodes) =>
      Array.isArray(flowNodes)
        ? flowNodes.map((n) => {
            if (n.type !== LANE_TYPE) return n
            return {
              ...n,
              data: {
                ...(n.data || {}),
                onResize: (w, h) => resizeLane(n.id, w, h),
              },
            }
          })
        : [],
    [resizeLane]
  )

  useEffect(() => {
    const flow = schemeToFlow(scheme)
    setNodes(attachLaneCallbacks(flow.nodes))
    setEdges(flow.edges)
  }, [scheme, setNodes, setEdges, attachLaneCallbacks])

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Удаление блока только по клавише Delete (Backspace — для редактирования текста)
      if (event.key !== 'Delete' || !selectedNodeId) return

      // Не удалять, если пользователь редактирует текст в input/textarea/select
      const activeEl = document.activeElement
      const isEditing =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable)
      if (isEditing) return

      event.preventDefault()

      const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
      const node = nodesList.find((n) => n.id === selectedNodeId)
      if (node?.type === 'start') {
        return
      }
      removeNodeFromScheme(selectedNodeId)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodeId, scheme?.nodes, removeNodeFromScheme])

  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        id: params.id || `e-${params.source}-${params.target}-${uuidv4().slice(0, 8)}`,
        type: EDGE_TYPE,
      }
      setEdges((eds) => addEdge(newEdge, eds))
      setScheme(flowToScheme(nodesRef.current, [...edgesRef.current, newEdge]))
    },
    [setEdges, setScheme]
  )

  const onNodeClick = useCallback(
    (_, node) => {
      setSelectedNodeId(node.id)
    },
    [setSelectedNodeId]
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  const onNodeDragStop = useCallback(
    (_, draggedNode) => {
      const allNodes = Array.isArray(nodesRef.current)
        ? nodesRef.current.map((n) =>
            n.id === draggedNode.id ? { ...n, position: draggedNode.position } : n
          )
        : []
      setScheme(flowToScheme(allNodes, edgesRef.current))
    },
    [setScheme]
  )

  const onNodesChangeApply = useCallback(
    (changes) => {
      onNodesChange(changes)
      const removeIds = changes.filter((c) => c.type === 'remove').map((c) => c.id)
      if (removeIds.length > 0) {
        const nextNodes = nodesRef.current.filter((n) => !removeIds.includes(n.id))
        const nextEdges = edgesRef.current.filter(
          (e) => !removeIds.includes(e.source) && !removeIds.includes(e.target)
        )
        setScheme(flowToScheme(nextNodes, nextEdges))
      }
    },
    [onNodesChange, setScheme]
  )

  const onEdgesChangeApply = useCallback(
    (changes) => {
      onEdgesChange(changes)
      const removeIds = changes.filter((c) => c.type === 'remove').map((c) => c.id)
      if (removeIds.length > 0) {
        const nextEdges = edgesRef.current.filter((e) => !removeIds.includes(e.id))
        setScheme(flowToScheme(nodesRef.current, nextEdges))
      }
    },
    [onEdgesChange, setScheme]
  )

  return (
    <div className="flow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeApply}
        onEdgesChange={onEdgesChangeApply}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineType="smoothstep"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="flow-canvas__react-flow"
      >
        <Controls className="flow-canvas__controls" />
        <Background gap={16} size={1} className="flow-canvas__background" />
      </ReactFlow>
    </div>
  )
}

const FlowCanvas = () => (
  <ReactFlowProvider>
    <FlowCanvasInner />
  </ReactFlowProvider>
)

export default FlowCanvas
