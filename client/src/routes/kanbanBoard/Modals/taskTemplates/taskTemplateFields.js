export function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function deadlineToTemplateParts(deadlineLocal) {
  if (!deadlineLocal || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(deadlineLocal)) {
    return { deadlineOffsetDays: null, deadlineTime: null }
  }
  const [datePart, timePart] = deadlineLocal.split('T')
  const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10))
  const target = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff < 0) diff = 0
  if (diff > 3650) diff = 3650
  return { deadlineOffsetDays: diff, deadlineTime: timePart.slice(0, 5) }
}

export function templatePartsToDeadline(offsetDays, time) {
  if (offsetDays == null || offsetDays === '') return ''
  const days = Number(offsetDays)
  if (!Number.isFinite(days)) return ''
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const clock = typeof time === 'string' && /^\d{2}:\d{2}$/.test(time) ? time : '09:00'
  return `${y}-${m}-${day}T${clock}`
}

export function formToTemplateBody(form, name) {
  const parts = deadlineToTemplateParts(form?.deadline)
  const tags = form?.tags
  return {
    name: String(name || '').trim(),
    title: form?.title || '',
    description: form?.description || '',
    priority: form?.priority || 'низкий',
    tags: typeof tags === 'string' ? tags : JSON.stringify(tags || ''),
    implementerIds: Array.isArray(form?.implementers) ? form.implementers : [],
    approverIds: Array.isArray(form?.approvers) ? form.approvers : [],
    viewerIds: Array.isArray(form?.viewers) ? form.viewers : [],
    deadlineOffsetDays: parts.deadlineOffsetDays,
    deadlineTime: parts.deadlineTime,
  }
}

export function formatOffsetLabel(offsetDays, time) {
  if (offsetDays == null || offsetDays === '') return 'Срок не задан'
  const n = Number(offsetDays)
  if (!Number.isFinite(n)) return 'Срок не задан'
  const timeLabel = time ? ` в ${time}` : ''
  if (n === 0) return `Срок: в день создания${timeLabel}`
  const mod10 = n % 10
  const mod100 = n % 100
  let word = 'дней'
  if (mod10 === 1 && mod100 !== 11) word = 'день'
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = 'дня'
  return `Срок: через ${n} ${word}${timeLabel}`
}

export function userShortName(user) {
  if (!user) return ''
  const last = String(user.last_name || '').trim()
  const first = String(user.first_name || '').trim()
  if (last && first) return `${last} ${first.charAt(0)}.`
  return last || first || ''
}

export function peoplePreview(users, ids) {
  const list = Array.isArray(ids) ? ids : []
  const names = []
  list.forEach((id) => {
    const user = (users || []).find((item) => String(item.id) === String(id))
    const label = userShortName(user)
    if (label) names.push(label)
  })
  if (!names.length) return ''
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`
}

export function keepKnownUserIds(ids, users) {
  const list = Array.isArray(ids) ? ids : []
  if (!users || users.length === 0) return { kept: list, dropped: 0 }
  const known = new Set(users.map((user) => String(user.id)))
  const kept = []
  let dropped = 0
  list.forEach((id) => {
    if (known.has(String(id))) kept.push(id)
    else dropped += 1
  })
  return { kept, dropped }
}

export function clampDeadlineToProject(deadlineLocal, projectDeadline) {
  if (!deadlineLocal || !projectDeadline) return { value: deadlineLocal || '', clamped: false }
  const taskDate = new Date(deadlineLocal)
  const projectDate = new Date(projectDeadline)
  if (Number.isNaN(taskDate.getTime()) || Number.isNaN(projectDate.getTime())) {
    return { value: deadlineLocal, clamped: false }
  }
  if (taskDate.getTime() <= projectDate.getTime()) return { value: deadlineLocal, clamped: false }
  const y = projectDate.getFullYear()
  const m = String(projectDate.getMonth() + 1).padStart(2, '0')
  const day = String(projectDate.getDate()).padStart(2, '0')
  const h = String(projectDate.getHours()).padStart(2, '0')
  const min = String(projectDate.getMinutes()).padStart(2, '0')
  return { value: `${y}-${m}-${day}T${h}:${min}`, clamped: true }
}
