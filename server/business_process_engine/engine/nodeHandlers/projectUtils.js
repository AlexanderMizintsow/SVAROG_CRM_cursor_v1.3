function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

function resolveProjectId(context, settings) {
  const source = settings?.projectSource || 'last' // last | by_node | fixed
  if (source === 'fixed') {
    const id = settings?.fixedProjectId
    return id != null ? (Number(id) || id) : null
  }
  if (source === 'by_node') {
    const nodeId = settings?.projectNodeId
    if (!nodeId) return null
    const outs = context?.project_outputs && typeof context.project_outputs === 'object' ? context.project_outputs : {}
    const v = outs[nodeId]?.global_task_id
    return v != null ? (Number(v) || v) : null
  }
  const last = context?.last_global_task_id
  return last != null ? (Number(last) || last) : null
}

module.exports = { getOutgoingEdges, resolveProjectId }

