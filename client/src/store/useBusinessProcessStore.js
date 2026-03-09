/**
 * Стор для компонента «Бизнес-процессы».
 * Список процессов, конструктор (схема), выбранный узел, экземпляры.
 */
import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

const initialState = {
  processes: [],
  selectedProcess: null,
  instances: [],
  scheme: { nodes: [], edges: [], meta: { gatewayDebugNotify: false } },
  selectedNodeId: null,
  copiedNodeData: null, // { type, label, settings, position } для копирования/вставки блоков
  lastPastedPosition: null, // для смещения при повторной вставке
  processName: '',
  processDescription: '',
  isDraft: true,
  visibilityUserIds: [],
  isLoading: false,
  error: null,
}

const useBusinessProcessStore = create((set, get) => ({
  ...initialState,

  setProcesses: (processes) => set({ processes }),

  setSelectedProcess: (process) => set({ selectedProcess: process }),

  setInstances: (instances) => set({ instances }),

  setScheme: (scheme) => set({ scheme }),

  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),

  setCopiedNodeData: (data) => set({ copiedNodeData: data, lastPastedPosition: null }),

  copySelectedNode: () => {
    const { scheme, selectedNodeId } = get()
    if (!selectedNodeId) return
    const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
    const node = nodesList.find((n) => n.id === selectedNodeId)
    if (!node || node.type === 'start') return
    const pos = node.position || { x: 0, y: 0 }
    const settings = node.settings && typeof node.settings === 'object'
      ? JSON.parse(JSON.stringify(node.settings))
      : {}
    set({
      copiedNodeData: {
        type: node.type,
        label: node.label ?? '',
        settings,
        position: { x: Number(pos.x) || 0, y: Number(pos.y) || 0 },
      },
      lastPastedPosition: null,
    })
  },

  pasteNode: () => {
    const { scheme, copiedNodeData, lastPastedPosition } = get()
    if (!copiedNodeData) return
    const basePos = lastPastedPosition || copiedNodeData.position || { x: 0, y: 0 }
    const newPos = {
      x: (Number(basePos.x) || 0) + 100,
      y: (Number(basePos.y) || 0) + 100,
    }
    const settings = copiedNodeData.settings && typeof copiedNodeData.settings === 'object'
      ? JSON.parse(JSON.stringify(copiedNodeData.settings))
      : {}
    const newNode = {
      id: uuidv4(),
      type: copiedNodeData.type,
      position: newPos,
      label: copiedNodeData.label ?? '',
      settings,
    }
    const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
    set({
      scheme: { ...scheme, nodes: [...nodesList, newNode] },
      selectedNodeId: newNode.id,
      lastPastedPosition: newPos,
    })
  },

  setProcessName: (name) => set({ processName: name }),

  setProcessDescription: (description) => set({ processDescription: description }),

  setIsDraft: (isDraft) => set({ isDraft }),

  setVisibilityUserIds: (visibilityUserIds) =>
    set({ visibilityUserIds: Array.isArray(visibilityUserIds) ? visibilityUserIds : [] }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  updateNodeInScheme: (nodeId, updates) => {
    const { scheme } = get()
    const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
    const nodes = nodesList.map((n) =>
      n.id === nodeId ? { ...n, ...updates } : n
    )
    set({ scheme: { ...scheme, nodes } })
  },

  updateEdgeInScheme: (edgeId, updates) => {
    const { scheme } = get()
    const edgesList = Array.isArray(scheme?.edges) ? scheme.edges : []
    const edges = edgesList.map((e) =>
      e.id === edgeId ? { ...e, ...updates } : e
    )
    set({ scheme: { ...scheme, edges } })
  },

  addNodeToScheme: (node) => {
    const { scheme } = get()
    const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
    set({
      scheme: {
        ...scheme,
        nodes: [...nodesList, node],
      },
    })
  },

  removeNodeFromScheme: (nodeId) => {
    const { scheme } = get()
    const nodesList = Array.isArray(scheme?.nodes) ? scheme.nodes : []
    const edgesList = Array.isArray(scheme?.edges) ? scheme.edges : []
    set({
      scheme: {
        nodes: nodesList.filter((n) => n.id !== nodeId),
        edges: edgesList.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        ),
      },
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
    })
  },

  addEdgeToScheme: (edge) => {
    const { scheme } = get()
    const edgesList = Array.isArray(scheme?.edges) ? scheme.edges : []
    const exists = edgesList.some(
      (e) => e.source === edge.source && e.target === edge.target
    )
    if (exists) return
    set({
      scheme: {
        ...scheme,
        edges: [...edgesList, edge],
      },
    })
  },

  removeEdgeFromScheme: (source, target) => {
    const { scheme } = get()
    const edgesList = Array.isArray(scheme?.edges) ? scheme.edges : []
    set({
      scheme: {
        ...scheme,
        edges: edgesList.filter(
          (e) => !(e.source === source && e.target === target)
        ),
      },
    })
  },

  resetDesigner: () =>
    set({
      scheme: { nodes: [], edges: [], meta: { gatewayDebugNotify: false } },
      selectedNodeId: null,
      copiedNodeData: null,
      lastPastedPosition: null,
      processName: '',
      processDescription: '',
      isDraft: true,
      visibilityUserIds: [],
      selectedProcess: null,
    }),

  loadProcessIntoDesigner: (process) => {
    if (!process) return
    const raw = process.scheme
    const scheme =
      raw && typeof raw === 'object'
        ? {
            nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
            edges: Array.isArray(raw.edges) ? raw.edges : [],
            meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : { gatewayDebugNotify: false },
          }
        : { nodes: [], edges: [], meta: { gatewayDebugNotify: false } }
    const vis = process.visibility_user_ids
    const visibilityUserIds = Array.isArray(vis) ? vis : (typeof vis === 'string' ? (() => { try { const a = JSON.parse(vis); return Array.isArray(a) ? a : [] } catch (e) { return [] } })() : [])
    set({
      selectedProcess: process,
      scheme,
      processName: process.name || '',
      processDescription: process.description || '',
      isDraft: process.is_draft !== false,
      visibilityUserIds,
      selectedNodeId: null,
    })
  },

  loadImportedProcess: (importData) => {
    if (!importData || typeof importData !== 'object') return
    const scheme = importData.scheme
    const nodes = Array.isArray(scheme?.nodes) ? scheme.nodes : []
    const edges = Array.isArray(scheme?.edges) ? scheme.edges : []
    const meta = scheme?.meta && typeof scheme.meta === 'object' ? scheme.meta : { gatewayDebugNotify: false }
    set({
      selectedProcess: null,
      scheme: { nodes, edges, meta },
      processName: importData.name || '',
      processDescription: importData.description || '',
      isDraft: importData.is_draft !== false,
      visibilityUserIds: Array.isArray(importData.visibility_user_ids) ? importData.visibility_user_ids : [],
      selectedNodeId: null,
    })
  },
}))

export default useBusinessProcessStore
