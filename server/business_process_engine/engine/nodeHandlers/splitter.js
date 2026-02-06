/**
 * Узел «Разделитель»: разветвляет выполнение на несколько параллельных веток без условий.
 * Возвращает nextNodeIds — массив всех исходящих целей (AND-split).
 */
function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const edges = getOutgoingEdges(scheme, node.id)
  if (edges.length < 2) {
    return { fail: 'У узла «Разделитель» должно быть минимум две исходящие ветки' }
  }
  const nextNodeIds = edges.map((e) => e.target)
  return { nextNodeIds }
}

module.exports = { handle }
