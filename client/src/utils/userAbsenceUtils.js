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

/** Сравнение сотрудников для сортировки: фамилия → имя → отчество (русская локаль). */
export function compareUsersByLastName(a, b) {
  const lastCmp = (a?.last_name || '').trim().localeCompare((b?.last_name || '').trim(), 'ru', {
    sensitivity: 'base',
  })
  if (lastCmp !== 0) return lastCmp
  const firstCmp = (a?.first_name || '').trim().localeCompare((b?.first_name || '').trim(), 'ru', {
    sensitivity: 'base',
  })
  if (firstCmp !== 0) return firstCmp
  return (a?.middle_name || '').trim().localeCompare((b?.middle_name || '').trim(), 'ru', {
    sensitivity: 'base',
  })
}

/** Копия массива сотрудников, отсортированная по фамилии. */
export function sortUsersByLastName(users) {
  if (!Array.isArray(users)) return []
  return [...users].sort(compareUsersByLastName)
}

/** Календарная дата YYYY-MM-DD без сдвига из-за UTC (node-pg DATE → ISO с T) */
export function normalizeDateOnly(value) {
  if (value == null || value === '') return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    // Локальные компоненты — для Date из datetime-local / пользовательского ввода
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const str = String(value).trim()
  if (!str) return ''
  // Важно: брать префикс даты ДО new Date(...), иначе ISO с Z съезжает на −1/+1 день
  const prefix = str.match(/^(\d{4}-\d{2}-\d{2})/)
  if (prefix) return prefix[1]
  if (str.includes('T')) {
    const d = new Date(str)
    if (!Number.isNaN(d.getTime())) {
      return normalizeDateOnly(d)
    }
  }
  return str
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

/** Последний день отсутствия (YYYY-MM-DD) или null */
export function getAbsenceEndDate(absence) {
  if (!absence) return null
  const end = normalizeDateOnly(absence.end_date)
  if (end) return end
  if (Array.isArray(absence.specific_dates) && absence.specific_dates.length > 0) {
    const dates = absence.specific_dates.map(normalizeDateOnly).filter(Boolean).sort()
    return dates.length ? dates[dates.length - 1] : null
  }
  return null
}

/** Дедлайн задачи позже последнего дня отсутствия */
export function isDeadlineAfterAbsence(deadline, absence) {
  const deadlineDay = normalizeDateOnly(deadline)
  const endDay = getAbsenceEndDate(absence)
  if (!deadlineDay || !endDay) return false
  return deadlineDay > endDay
}

/**
 * Календарные дни от дня после выхода до дедлайна включительно.
 * Пример: выход 25-го, дедлайн 27-го → 2.
 */
export function daysAvailableAfterReturn(deadline, absence) {
  const deadlineDay = normalizeDateOnly(deadline)
  const endDay = getAbsenceEndDate(absence)
  if (!deadlineDay || !endDay || deadlineDay <= endDay) return null
  const start = new Date(`${endDay}T00:00:00`)
  const end = new Date(`${deadlineDay}T00:00:00`)
  const diffMs = end.getTime() - start.getTime()
  return Math.round(diffMs / (24 * 60 * 60 * 1000))
}

function buildOkResult(partial) {
  return {
    effectiveId: null,
    added: false,
    blocked: false,
    substituted: false,
    message: null,
    note: null,
    originalId: null,
    needsSkipSubstitution: false,
    choiceAtSavePossible: false,
    daysAfterReturn: null,
    ...partial,
  }
}

/**
 * Определяет, кого добавить вместо выбранного пользователя.
 * @param {object} [options]
 * @param {string|Date|null} [options.deadline] — срок задачи (для допуска отсутствующего после выхода)
 * @returns {{ effectiveId, added, blocked, substituted, message, note, originalId, needsSkipSubstitution, choiceAtSavePossible, daysAfterReturn }}
 */
export function resolveUserSelection(userId, absencesMap, users, options = {}) {
  const id = Number(userId)
  const absence = absencesMap?.[id]
  const deadline = options.deadline || null

  if (!absence) {
    return buildOkResult({
      effectiveId: id,
      added: true,
      originalId: id,
    })
  }

  const user = (users || []).find((u) => Number(u.id) === id)
  const userName = formatUserFullName(user) || `ID ${id}`
  const period = formatAbsencePeriod(absence)
  const statusLabel = absence.status || 'отсутствует'
  const endDay = getAbsenceEndDate(absence)
  const endLabel = endDay ? formatDateRu(endDay) : null
  const afterLeave = isDeadlineAfterAbsence(deadline, absence)
  const days = afterLeave ? daysAvailableAfterReturn(deadline, absence) : null

  if (!absence.substitute_user_id) {
    if (afterLeave) {
      return buildOkResult({
        effectiveId: id,
        added: true,
        originalId: id,
        needsSkipSubstitution: true,
        daysAfterReturn: days,
        message: `${userName} — ${statusLabel} (${period}). Замещающий не назначен. Срок после выхода — сотрудник добавлен. На выполнение после отпуска остаётся ${days} дн.`,
        note: `Отсутствует до ${endLabel}. После отпуска на выполнение: ${days} дн.`,
      })
    }
    return buildOkResult({
      blocked: true,
      originalId: id,
      message: endLabel
        ? `${userName} — ${statusLabel} (${period}). Замещающий не назначен. Укажите срок после ${endLabel}, чтобы назначить этого сотрудника.`
        : `${userName} — ${statusLabel} (${period}). Замещающий не назначен.`,
    })
  }

  const substituteId = Number(absence.substitute_user_id)
  const substitute = (users || []).find((u) => Number(u.id) === substituteId)
  const subName =
    formatUserFullName(substitute) ||
    formatUserFullName({
      first_name: absence.substitute_first_name,
      last_name: absence.substitute_last_name,
      middle_name: absence.substitute_middle_name,
    }) ||
    `ID ${substituteId}`

  if (absencesMap[substituteId]) {
    if (afterLeave) {
      return buildOkResult({
        effectiveId: id,
        added: true,
        originalId: id,
        needsSkipSubstitution: true,
        daysAfterReturn: days,
        message: `${userName} — ${statusLabel} (${period}). Замещающий ${subName} тоже отсутствует. Срок после выхода — добавлен ${userName}. На выполнение после отпуска: ${days} дн.`,
        note: `Замещающий недоступен. После отпуска на выполнение: ${days} дн.`,
      })
    }
    return buildOkResult({
      blocked: true,
      originalId: id,
      message: `${userName} — ${statusLabel} (${period}). Замещающий ${subName} тоже отсутствует.`,
    })
  }

  const choiceHint = endLabel
    ? afterLeave
      ? ` При сохранении можно выбрать ${userName} (срок после выхода, на выполнение ~${days} дн.).`
      : ` Если укажете срок после ${endLabel}, при сохранении можно будет назначить ${userName}.`
    : ''

  return buildOkResult({
    effectiveId: substituteId,
    added: true,
    substituted: true,
    originalId: id,
    choiceAtSavePossible: Boolean(endLabel),
    daysAfterReturn: days,
    message: `${userName} — ${statusLabel} (${period}). Замещает: ${subName} (добавлен в поле).${choiceHint}`,
    note: afterLeave
      ? `Замещает ${userName} (до ${endLabel}). При сохранении возможен выбор ${userName} (~${days} дн. после отпуска).`
      : endLabel
        ? `Замещает ${userName} (до ${endLabel}). При сроке после ${endLabel} при сохранении возможен выбор ${userName}.`
        : `Замещает ${userName}.`,
  })
}

export function getAbsenceLabel(absence) {
  if (!absence) return ''
  const period = formatAbsencePeriod(absence)
  return `${absence.status} (${period})`
}

/**
 * Записи замещения, по которым при сохранении нужен выбор «замещающий / исходный».
 * @param {Array} absenceMeta
 * @param {string|Date|null} deadline
 * @param {object} [absencesMap] — актуальная карта отсутствий (предпочтительнее снимка в meta)
 */
export function getAbsenceChoicesAtSave(absenceMeta, deadline, absencesMap = {}) {
  if (!Array.isArray(absenceMeta) || !absenceMeta.length) return []
  return absenceMeta
    .map((entry) => {
      const liveAbsence =
        (absencesMap && absencesMap[Number(entry.originalId)]) || entry.absence || null
      return { ...entry, absence: liveAbsence }
    })
    .filter((entry) => {
      if (!entry?.substituted || !entry.originalId || !entry.effectiveId) return false
      if (String(entry.originalId) === String(entry.effectiveId)) return false
      return isDeadlineAfterAbsence(deadline, entry.absence)
    })
}

/**
 * Fallback: если meta потерялась, ищем в списке назначенных замещающих,
 * у которых исходный сейчас в отпуске, а срок задачи — после выхода.
 */
export function findAbsenceChoicesFromAssignees(
  assigneeIds,
  deadline,
  absencesMap = {},
  roleKey = 'implementers'
) {
  if (!Array.isArray(assigneeIds) || !assigneeIds.length) return []
  if (!deadline || !absencesMap) return []

  const result = []
  const absences = Object.values(absencesMap)

  assigneeIds.forEach((assigneeId) => {
    const match = absences.find(
      (a) =>
        a &&
        Number(a.substitute_user_id) === Number(assigneeId) &&
        isDeadlineAfterAbsence(deadline, a)
    )
    if (!match) return
    if (result.some((e) => String(e.effectiveId) === String(assigneeId))) return
    result.push({
      roleKey,
      effectiveId: String(assigneeId),
      originalId: String(match.user_id),
      substituted: true,
      needsSkipSubstitution: false,
      choiceAtSavePossible: true,
      note: null,
      absence: match,
    })
  })

  return result
}

/** Обновляет тексты пометок при смене дедлайна */
export function refreshAbsenceMetaNotes(absenceMeta, deadline, users = [], absencesMap = {}) {
  return (absenceMeta || []).map((entry) => {
    const absence =
      (absencesMap && absencesMap[Number(entry.originalId)]) || entry.absence || null
    if (!absence) return entry
    const after = isDeadlineAfterAbsence(deadline, absence)
    const days = after ? daysAvailableAfterReturn(deadline, absence) : null
    const endDay = getAbsenceEndDate(absence)
    const endLabel = endDay ? formatDateRu(endDay) : null
    const originalUser = users.find((u) => String(u.id) === String(entry.originalId))
    const originalName = formatUserFullName(originalUser) || `ID ${entry.originalId}`

    if (entry.substituted) {
      return {
        ...entry,
        absence,
        note: after
          ? `Замещает ${originalName} (до ${endLabel}). При сохранении возможен выбор ${originalName} (~${days} дн. после отпуска).`
          : endLabel
            ? `Замещает ${originalName} (до ${endLabel}). При сроке после ${endLabel} при сохранении возможен выбор ${originalName}.`
            : entry.note,
      }
    }

    if (entry.needsSkipSubstitution) {
      if (!after) {
        return {
          ...entry,
          absence,
          note: endLabel
            ? `Срок теперь в период отсутствия (до ${endLabel}). Измените срок или удалите сотрудника.`
            : entry.note,
        }
      }
      return {
        ...entry,
        absence,
        note: `Отсутствует до ${endLabel}. После отпуска на выполнение: ${days} дн.`,
      }
    }

    return { ...entry, absence }
  })
}

/**
 * Применяет решения диалога к списку ответственных проекта.
 * decisions: { [effectiveId]: 'substitute' | 'original' }
 */
export function applyAbsenceDecisionsToResponsibles(
  responsibles,
  absenceMeta,
  decisions = {},
  users = []
) {
  return (responsibles || []).map((resp) => {
    const meta = (absenceMeta || []).find(
      (entry) => String(entry.effectiveId) === String(resp.id)
    )
    if (!meta) {
      return { ...resp, skip_absence_substitution: false }
    }

    const decision = decisions[String(resp.id)]
    if (meta.substituted && decision === 'original') {
      const originalUser = users.find((u) => String(u.id) === String(meta.originalId))
      return {
        ...resp,
        id: Number(meta.originalId),
        first_name: originalUser?.first_name ?? resp.first_name,
        last_name: originalUser?.last_name ?? resp.last_name,
        middle_name: originalUser?.middle_name ?? resp.middle_name,
        skip_absence_substitution: true,
      }
    }

    if (meta.needsSkipSubstitution) {
      return { ...resp, skip_absence_substitution: true }
    }

    return { ...resp, skip_absence_substitution: false }
  })
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
