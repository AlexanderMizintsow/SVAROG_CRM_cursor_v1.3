const PRIORITIES = new Set(['low', 'medium', 'high'])

export const PROJECT_PRIORITY_LABELS = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
}

export function deadlineToTemplateParts(deadline) {
  if (!deadline) return { deadlineOffsetDays: null, deadlineTime: null }
  const date = deadline instanceof Date ? deadline : new Date(deadline)
  if (Number.isNaN(date.getTime())) return { deadlineOffsetDays: null, deadlineTime: null }
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff < 0) diff = 0
  if (diff > 3650) diff = 3650
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return { deadlineOffsetDays: diff, deadlineTime: `${hours}:${minutes}` }
}

export function templatePartsToDeadline(offsetDays, time) {
  if (offsetDays == null || offsetDays === '') return null
  const days = Number(offsetDays)
  if (!Number.isFinite(days)) return null
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  date.setDate(date.getDate() + days)
  const clock = typeof time === 'string' && /^\d{2}:\d{2}$/.test(time) ? time : '09:00'
  const [hours, minutes] = clock.split(':').map((part) => parseInt(part, 10))
  date.setHours(hours, minutes, 0, 0)
  return date
}

export function formToTemplateBody(form, name) {
  const parts = deadlineToTemplateParts(form?.deadline)
  const goals = (Array.isArray(form?.goals) ? form.goals : [])
    .map((goal) => String(goal || '').trim())
    .filter(Boolean)
  const responsibles = (Array.isArray(form?.responsibles) ? form.responsibles : [])
    .map((item) => ({
      userId: Number(item.id),
      role: item.role || '',
      requiresApproval: item.requires_approval === true,
    }))
    .filter((item) => Number.isInteger(item.userId) && item.userId > 0)
  const priority = PRIORITIES.has(form?.priority) ? form.priority : 'medium'
  return {
    name: String(name || '').trim(),
    title: form?.title || '',
    description: form?.description || '',
    priority,
    goals,
    additionalInfo:
      form?.additionalInfo && typeof form.additionalInfo === 'object' ? form.additionalInfo : {},
    responsibles,
    deadlineOffsetDays: parts.deadlineOffsetDays,
    deadlineTime: parts.deadlineTime,
  }
}

export function projectFormHasContent(form) {
  if (!form) return false
  if (String(form.title || '').trim()) return true
  if (String(form.description || '').trim()) return true
  if ((form.goals || []).some((goal) => String(goal || '').trim())) return true
  if (form.deadline) return true
  if ((form.responsibles || []).length > 0) return true
  const info = form.additionalInfo || {}
  return Object.keys(info).some((key) => String(key || '').trim())
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

function userShortName(user) {
  if (!user) return ''
  const last = String(user.last_name || '').trim()
  const first = String(user.first_name || '').trim()
  if (last && first) return `${last} ${first.charAt(0)}.`
  return last || first || ''
}

export function responsiblesPreview(users, responsibles) {
  const list = Array.isArray(responsibles) ? responsibles : []
  const names = []
  list.forEach((item) => {
    const user = (users || []).find((entry) => String(entry.id) === String(item.userId))
    const label = userShortName(user)
    if (!label) return
    names.push(item.requiresApproval ? `${label} (согласование)` : label)
  })
  if (!names.length) return ''
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`
}

export function keepKnownResponsibles(responsibles, users) {
  const list = Array.isArray(responsibles) ? responsibles : []
  if (!users || users.length === 0) return { kept: list, dropped: 0 }
  const known = new Set(users.map((user) => String(user.id)))
  const kept = []
  let dropped = 0
  list.forEach((item) => {
    if (known.has(String(item.userId))) kept.push(item)
    else dropped += 1
  })
  return { kept, dropped }
}
