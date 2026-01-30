import { useCallback, useEffect, useRef } from 'react'
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
import 'react-flow-renderer/dist/style.css'
import './FlowCanvas.scss'

const nodeTypes = { block: BlockNode }

const schemeToFlow = (scheme) => {
  const schemeData = scheme && typeof scheme === 'object' ? scheme : {}
  const nodes = (Array.isArray(schemeData.nodes) ? schemeData.nodes : []).map((n) => ({
    id: n.id,
    type: 'block',
    position: n.position || { x: 0, y: 0 },
    data: {
      nodeType: n.type,
      label: n.label,
      settings: n.settings,
    },
  }))
  const edges = (Array.isArray(schemeData.edges) ? schemeData.edges : []).map((e, i) => ({
    id: e.id || `e-${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    ...(e.condition != null && { condition: e.condition }),
  }))
  return { nodes, edges }
}

const flowToScheme = (nodes, edges) => {
  const nodesList = Array.isArray(nodes) ? nodes : []
  const edgesList = Array.isArray(edges) ? edges : []
  const schemeNodes = nodesList.map((n) => ({
    id: n.id,
    type: n.data?.nodeType || 'create_task',
    position: n.position,
    label: n.data?.label,
    settings: n.data?.settings || {},
  }))
  const schemeEdges = edgesList.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.condition != null && { condition: e.condition }),
  }))
  return { nodes: schemeNodes, edges: schemeEdges }
}

function FlowCanvasInner() {
  const { scheme, setScheme, setSelectedNodeId } = useBusinessProcessStore()
  const initial = schemeToFlow(scheme)
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  useEffect(() => {
    const flow = schemeToFlow(scheme)
    setNodes(flow.nodes)
    setEdges(flow.edges)
  }, [scheme])

  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        id: params.id || `e-${params.source}-${params.target}-${uuidv4().slice(0, 8)}`,
      }
      setEdges((eds) => addEdge(newEdge, eds))
      setScheme(
        flowToScheme(nodesRef.current, [...edgesRef.current, newEdge])
      )
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
