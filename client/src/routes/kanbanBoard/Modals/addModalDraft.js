const STORAGE_PREFIX = 'kanban_add_task_draft_'

export const getAddModalDraftKey = (userId, globalTaskId, parentTaskId, rootTaskId) =>
  `${STORAGE_PREFIX}${userId ?? 'anon'}_${globalTaskId ?? 'main'}_${parentTaskId ?? ''}_${rootTaskId ?? ''}`

export const loadAddModalDraft = (key) => {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const saveAddModalDraft = (key, payload) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // quota / private mode
  }
}

export const clearAddModalDraft = (key) => {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export const hasAddModalDraftContent = (taskData) => {
  if (!taskData || typeof taskData !== 'object') return false
  const plainDescription = String(taskData.description || '')
    .replace(/<[^>]+>/g, '')
    .trim()
  let hasTags = false
  try {
    const parsed = taskData.tags ? JSON.parse(taskData.tags) : []
    hasTags = Array.isArray(parsed) && parsed.length > 0
  } catch {
    hasTags = !!String(taskData.tags || '').trim()
  }
  return !!(
    String(taskData.title || '').trim() ||
    plainDescription ||
    taskData.deadline ||
    (Array.isArray(taskData.implementers) && taskData.implementers.length > 0) ||
    (Array.isArray(taskData.approvers) && taskData.approvers.length > 0) ||
    (Array.isArray(taskData.viewers) && taskData.viewers.length > 0) ||
    hasTags
  )
}

export const buildEmptyTaskData = (userId, globalTaskId, parentTaskId, rootTaskId) => ({
  title: '',
  description: '',
  deadline: '',
  priority: 'низкий',
  status: '',
  notification_status: false,
  tags: '',
  created_by: userId,
  implementers: [],
  approvers: [],
  viewers: [],
  file_url: '',
  file_type: '',
  comment_file: '',
  name_file: '',
  global_task_id: globalTaskId,
  parentTaskId,
  rootTaskId,
})
