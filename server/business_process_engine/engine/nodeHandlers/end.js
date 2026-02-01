/**
 * Узел Конец: завершение процесса (completed).
 * outcome: УСПЕХ | НЕУДАЧА (для аналитики), comment — комментарий.
 */
async function handle(instance, node, scheme, integrations, dbPool) {
  const settings = node.settings || {}
  const outcome = settings.outcome || 'SUCCESS'
  const comment = settings.comment || ''
  return { end: true, outcome, comment }
}

module.exports = { handle }
