/**
 * Короткий кэш названий проектов для list-задач (избегаем N×HTTP на каждый list).
 */
const TTL_MS = 60_000
const store = new Map()

const getCachedTitle = (projectId) => {
  const hit = store.get(String(projectId))
  if (!hit) return undefined
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(String(projectId))
    return undefined
  }
  return hit.title
}

const setCachedTitle = (projectId, title) => {
  store.set(String(projectId), { title: title || null, at: Date.now() })
}

/**
 * @param {Array<string|number>} projectIds
 * @param {(id: string|number) => Promise<string|null>} fetchTitle
 */
const resolveProjectTitles = async (projectIds, fetchTitle) => {
  const ids = [...new Set((projectIds || []).filter(Boolean))]
  const titleByProject = {}
  const missing = []

  ids.forEach((pid) => {
    const cached = getCachedTitle(pid)
    if (cached !== undefined) titleByProject[String(pid)] = cached
    else missing.push(pid)
  })

  await Promise.all(
    missing.map(async (pid) => {
      try {
        const title = await fetchTitle(pid)
        setCachedTitle(pid, title)
        titleByProject[String(pid)] = title
      } catch {
        setCachedTitle(pid, null)
        titleByProject[String(pid)] = null
      }
    })
  )

  return titleByProject
}

module.exports = {
  resolveProjectTitles,
  getCachedTitle,
  setCachedTitle,
}
