/**
 * Узел Старт: инициализация контекста, переход по единственному исходящему ребру.
 */
function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) {
    return { fail: 'У узла Старт нет исходящего ребра' }
  }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }
