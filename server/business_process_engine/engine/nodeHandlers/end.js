/**
 * Узел Конец: завершение процесса (completed).
 */
async function handle(instance, node, scheme, integrations, dbPool) {
  const label = (node.settings && node.settings.label) || null
  return { end: true, label }
}

module.exports = { handle }
