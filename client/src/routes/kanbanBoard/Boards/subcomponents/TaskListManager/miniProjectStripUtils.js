const priorityRank = (p) => {
  if (p === 'high') return 0
  if (p === 'medium') return 1
  if (p === 'low') return 2
  return 1
}

export const getProjectCreatorId = (task) => {
  if (!task) return null
  if (typeof task.created_by === 'object' && task.created_by != null) {
    return task.created_by.id
  }
  return task.created_by
}

export const filterVisibleProjects = (projects, userId) => {
  if (!userId || !Array.isArray(projects)) return []
  return projects.filter((task) => {
    const creatorId = getProjectCreatorId(task)
    const isCreator = creatorId === userId
    const isResponsible = task.responsibles && task.responsibles.some((r) => r.id === userId)
    return isCreator || isResponsible
  })
}

export const sortMiniProjects = (tasks, userId, projectBlinkGreen, projectBlinkYellow) => {
  return tasks.slice().sort((a, b) => {
    const isAuthorA = getProjectCreatorId(a) === userId
    const isAuthorB = getProjectCreatorId(b) === userId
    const greenFirstA = isAuthorA && projectBlinkGreen[a.id]
    const greenFirstB = isAuthorB && projectBlinkGreen[b.id]
    if (greenFirstA && !greenFirstB) return -1
    if (greenFirstB && !greenFirstA) return 1

    const complete100AuthorA = isAuthorA && (a.completion_percentage ?? 0) >= 100
    const complete100AuthorB = isAuthorB && (b.completion_percentage ?? 0) >= 100
    if (complete100AuthorA && !complete100AuthorB) return -1
    if (complete100AuthorB && !complete100AuthorA) return 1

    const hasDeadlineA = !!a.deadline
    const hasDeadlineB = !!b.deadline
    const deadlineTimeA = a.deadline ? new Date(a.deadline).getTime() : Infinity
    const deadlineTimeB = b.deadline ? new Date(b.deadline).getTime() : Infinity
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
    const yellowA = projectBlinkYellow[a.id]
    const yellowB = projectBlinkYellow[b.id]

    if (hasDeadlineA && hasDeadlineB) {
      if (deadlineTimeA !== deadlineTimeB) return deadlineTimeA - deadlineTimeB
      const prA = priorityRank(a.priority)
      const prB = priorityRank(b.priority)
      if (prA !== prB) return prA - prB
      if (yellowA && !yellowB) return -1
      if (yellowB && !yellowA) return 1
      return 0
    }
    if (hasDeadlineA && !hasDeadlineB) return -1
    if (!hasDeadlineA && hasDeadlineB) return 1

    const prA = priorityRank(a.priority)
    const prB = priorityRank(b.priority)
    if (prA !== prB) return prA - prB
    if (createdA !== createdB) return createdA - createdB
    if (yellowA && !yellowB) return -1
    if (yellowB && !yellowA) return 1
    return 0
  })
}

export const SPLIT_STORAGE_KEY = 'miniProjectStripSplitPercent'
export const DEFAULT_SPLIT_PERCENT = 48
export const MIN_SPLIT_PERCENT = 20
export const MAX_SPLIT_PERCENT = 80

export const readStoredSplitPercent = () => {
  try {
    const saved = localStorage.getItem(SPLIT_STORAGE_KEY)
    const n = Number(saved)
    if (!Number.isNaN(n) && n >= MIN_SPLIT_PERCENT && n <= MAX_SPLIT_PERCENT) return n
  } catch {
    /* ignore */
  }
  return DEFAULT_SPLIT_PERCENT
}
