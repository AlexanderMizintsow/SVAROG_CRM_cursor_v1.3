import axios from 'axios'
import Toastify from 'toastify-js'
import { API_BASE_URL } from '../../config'

export async function fetchActiveAbsences() {
  const response = await axios.get(`${API_BASE_URL}5000/api/users/absences/active`)
  return Array.isArray(response.data) ? response.data : []
}

export async function fetchUpcomingAbsences() {
  const response = await axios.get(`${API_BASE_URL}5000/api/users/absences/upcoming`)
  return Array.isArray(response.data) ? response.data : []
}

export function buildAbsencesMap(absences) {
  const map = {}
  if (!Array.isArray(absences)) return map
  absences.forEach((absence) => {
    if (absence && absence.user_id != null) {
      map[Number(absence.user_id)] = absence
    }
  })
  return map
}

export function formatUserFullName(user) {
  if (!user) return ''
  return `${user.last_name || ''} ${user.first_name || ''} ${user.middle_name || ''}`
    .replace(/\s+/g, ' ')
    .trim()
}

/** Календарная дата YYYY-MM-DD без сдвига из-за UTC (node-pg DATE → ISO с T) */
export function normalizeDateOnly(value) {
  if (value == null || value === '') return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const str = String(value).trim()
  if (!str) return ''
  if (str.includes('T')) {
    const d = new Date(str)
    if (!Number.isNaN(d.getTime())) {
      return normalizeDateOnly(d)
    }
  }
  return str.length >= 10 ? str.slice(0, 10) : str
}

function formatDateRu(dateStr) {
  const normalized = normalizeDateOnly(dateStr)
  if (!normalized) return ''
  const parts = normalized.split('-')
  if (parts.length !== 3) return normalized
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

export function formatAbsencePeriod(absence) {
  if (!absence) return 'не указан'
  if (absence.start_date && absence.end_date) {
    return `с ${formatDateRu(absence.start_date)} по ${formatDateRu(absence.end_date)}`
  }
  if (Array.isArray(absence.specific_dates) && absence.specific_dates.length > 0) {
    return absence.specific_dates.map(formatDateRu).join(', ')
  }
  return 'не указан'
}

/**
 * Определяет, кого добавить вместо выбранного пользователя.
 * @returns {{ effectiveId, added, blocked, substituted, message }}
 */
export function resolveUserSelection(userId, absencesMap, users) {
  const id = Number(userId)
  const absence = absencesMap[id]

  if (!absence) {
    return { effectiveId: id, added: true, blocked: false, substituted: false, message: null }
  }

  const user = users.find((u) => Number(u.id) === id)
  const userName = formatUserFullName(user) || `ID ${id}`
  const period = formatAbsencePeriod(absence)
  const statusLabel = absence.status || 'отсутствует'

  if (!absence.substitute_user_id) {
    return {
      effectiveId: null,
      added: false,
      blocked: true,
      substituted: false,
      message: `${userName} — ${statusLabel} (${period}). Замещающий не назначен.`,
    }
  }

  const substituteId = Number(absence.substitute_user_id)
  const substitute = users.find((u) => Number(u.id) === substituteId)
  const subName =
    formatUserFullName(substitute) ||
    formatUserFullName({
      first_name: absence.substitute_first_name,
      last_name: absence.substitute_last_name,
      middle_name: absence.substitute_middle_name,
    }) ||
    `ID ${substituteId}`

  if (absencesMap[substituteId]) {
    return {
      effectiveId: null,
      added: false,
      blocked: true,
      substituted: false,
      message: `${userName} — ${statusLabel} (${period}). Замещающий ${subName} тоже отсутствует.`,
    }
  }

  return {
    effectiveId: substituteId,
    added: true,
    blocked: false,
    substituted: true,
    message: `${userName} — ${statusLabel} (${period}). Замещает: ${subName} (добавлен автоматически).`,
  }
}

export function getAbsenceLabel(absence) {
  if (!absence) return ''
  const period = formatAbsencePeriod(absence)
  return `${absence.status} (${period})`
}

/**
 * Сообщение для конструктора БП: в схему сохраняется исходный сотрудник,
 * замещение выполняется на сервере при создании задачи в день запуска узла.
 */
export function buildBpSchemaAbsenceNotice(userId, absencesMap, users) {
  const id = Number(userId)
  const absence = absencesMap[id]
  if (!absence) return null

  const user = users.find((u) => Number(u.id) === id)
  const userName = formatUserFullName(user) || `ID ${id}`
  const period = formatAbsencePeriod(absence)
  const statusLabel = absence.status || 'отсутствует'

  if (!absence.substitute_user_id) {
    return `${userName} — ${statusLabel} (${period}). В схему сохранён этот сотрудник. При запуске процесса в период отсутствия задача не будет назначена (замещающий не указан).`
  }

  const substituteId = Number(absence.substitute_user_id)
  const substitute = users.find((u) => Number(u.id) === substituteId)
  const subName =
    formatUserFullName(substitute) ||
    formatUserFullName({
      first_name: absence.substitute_first_name,
      last_name: absence.substitute_last_name,
      middle_name: absence.substitute_middle_name,
    }) ||
    `ID ${substituteId}`

  if (absencesMap[substituteId]) {
    return `${userName} — ${statusLabel} (${period}). В схему сохранён этот сотрудник. При запуске в период отсутствия замещение может быть недоступно (${subName} тоже отсутствует).`
  }

  return `${userName} — ${statusLabel} (${period}). В схему сохранён этот сотрудник. При запуске процесса в период отсутствия задача будет назначена замещающему: ${subName}.`
}

export function showAbsenceMessage(message, isError = false) {
  if (!message) return
  Toastify({
    text: message,
    close: true,
    duration: 6000,
    backgroundColor: isError
      ? 'linear-gradient(to right, #8B0000, #ff0000)'
      : 'linear-gradient(to right, #f7971e, #ffd200)',
  }).showToast()
}

export async function fetchStatusPermissions(actorUserId) {
  const response = await axios.get(`${API_BASE_URL}5000/api/user-statuses/permissions`, {
    params: { actor_user_id: actorUserId },
  })
  return response.data
}

export function canManageEmployeeStatusClient(permissions, targetDepartmentId) {
  if (!permissions) return false
  if (permissions.isAdmin || permissions.isDirector || permissions.isHr) return true
  const depId = targetDepartmentId != null ? Number(targetDepartmentId) : null
  if (depId == null) return false
  return (permissions.headDepartmentIds || []).map(Number).includes(depId)
}

export function filterManageableUsers(users, permissions) {
  if (!permissions?.canCreate) return []
  if (permissions.isAdmin || permissions.isDirector || permissions.isHr) return users
  const headIds = new Set((permissions.headDepartmentIds || []).map(Number))
  return users.filter((u) => headIds.has(Number(u.department_id)))
}

export async function fetchWorkloadSummary(userId) {
  const response = await axios.get(`${API_BASE_URL}5000/api/users/${userId}/workload-summary`)
  return response.data
}
