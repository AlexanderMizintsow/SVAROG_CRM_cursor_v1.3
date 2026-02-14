/**
 * Стор для компонента «Бизнес-процессы».
 * Список процессов, конструктор (схема), выбранный узел, экземпляры.
 */
import { create } from 'zustand'

const initialState = {
  processes: [],
  selectedProcess: null,
  instances: [],
  scheme: { nodes: [], edges: [], meta: { gatewayDebugNotify: false } },
  selectedNodeId: null,
  processName: '',
  processDescription: '',
  isDraft: true,
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

  setProcessName: (name) => set({ processName: name }),

  setProcessDescription: (description) => set({ processDescription: description }),

  setIsDraft: (isDraft) => set({ isDraft }),

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
      processName: '',
      processDescription: '',
      isDraft: true,
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
    set({
      selectedProcess: process,
      scheme,
      processName: process.name || '',
      processDescription: process.description || '',
      isDraft: process.is_draft !== false,
      selectedNodeId: null,
    })
  },
}))

export default useBusinessProcessStore
