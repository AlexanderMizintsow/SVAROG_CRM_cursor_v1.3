/**
 * Узел Таймер: вычисление resume_at, возврат waitTimer.
 */
function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

function computeResumeAt(settings) {
  if (!settings) return null
  const type = settings.timerType || settings.type
  if (type === 'until_date' && settings.untilDate) {
    const d = new Date(settings.untilDate)
    return isNaN(d.getTime()) ? null : d
  }
  if (type === 'interval' && settings.intervalValue != null) {
    const value = Number(settings.intervalValue) || 0
    const unit = settings.intervalUnit || 'minutes'
    const now = new Date()
    if (unit === 'minutes') now.setMinutes(now.getMinutes() + value)
    else if (unit === 'hours') now.setHours(now.getHours() + value)
    else if (unit === 'days') now.setDate(now.getDate() + value)
    return now
  }
  return null
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const resumeAt = computeResumeAt(node.settings)
  if (!resumeAt) {
    return { fail: 'Не заданы настройки таймера (интервал или дата)' }
  }
  const edges = getOutgoingEdges(scheme, node.id)
  if (!edges[0]) {
    return { fail: 'У узла Таймер нет исходящего ребра' }
  }
  return { waitTimer: { resumeAt } }
}

module.exports = { handle }
