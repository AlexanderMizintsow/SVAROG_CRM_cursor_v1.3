function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

function resolveTaskId(context, settings) {
  const source = settings?.taskSource || 'last' // last | by_node | fixed
  if (source === 'fixed') {
    const id = settings?.fixedTaskId
    return id != null ? (Number(id) || id) : null
  }
  if (source === 'by_node') {
    const nodeId = settings?.taskSourceNodeId
    if (!nodeId) return null
    const outs = context?.block_outputs && typeof context.block_outputs === 'object' ? context.block_outputs : {}
    const v = outs[nodeId]?.task_id
    return v != null ? (Number(v) || v) : null
  }
  const last = context?.last_task_id
  return last != null ? (Number(last) || last) : null
}

function isTaskSourceSkipped(context, settings) {
  const source = settings?.taskSource || 'last'
  if (source !== 'by_node') return false
  const nodeId = settings?.taskSourceNodeId
  if (!nodeId) return false
  const outs =
    context?.block_outputs && typeof context.block_outputs === 'object'
      ? context.block_outputs
      : {}
  return outs[nodeId]?.skipped === true
}

module.exports = { getOutgoingEdges, resolveTaskId, isTaskSourceSkipped }
