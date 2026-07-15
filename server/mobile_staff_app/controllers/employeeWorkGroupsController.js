/**
 * Рабочие группы для POZ-Staff.
 * CRUD + голосование через register/DB; уведомления только mobile (без TG).
 */

const { registerFetch } = require('../services/registerClient')
const { getGroupParticipantIds } = require('../services/workGroupNotifyService')

const toYmd = (value) => {
  if (!value) return ''
  if (value instanceof Date) {
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(value)
  return s.length >= 10 ? s.substring(0, 10) : s
}

const buildDateTimeIso = (dateYmd, timeHhMm) => {
  const [hh, mm] = String(timeHhMm || '09:00').split(':')
  const d = new Date(`${dateYmd}T00:00:00.000Z`)
  d.setUTCHours(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, 0, 0)
  return d.toISOString()
}

const userCanAccessGroup = (group, userId, participantIds) => {
  const uid = Number(userId)
  if (Number(group.created_by) === uid) return true
  return (participantIds || []).map(Number).includes(uid)
}

const mapFixedRow = (row) => {
  const participantIds = (row.participant_ids || []).filter(
    (id) => id != null && Number(id) > 0
  )
  const names = row.participants || []
  return {
    ...row,
    participant_ids: participantIds.map(Number),
    participants: participantIds.map((id, idx) => ({
      id: Number(id),
      full_name: names[idx] || `ID ${id}`,
    })),
    created_by_id: Number(row.created_by),
  }
}

const mapRangeRow = (row) => {
  const parts = Array.isArray(row.participants)
    ? row.participants.filter((p) => p && p.id != null)
    : []
  return {
    ...row,
    participants: parts.map((p) => ({
      id: Number(p.id),
      full_name: p.full_name || `ID ${p.id}`,
    })),
    participant_ids: parts.map((p) => Number(p.id)),
    created_by_id: Number(row.created_by_id || row.created_by),
  }
}

const findCommonDate = (votesByParticipant) => {
  const dateCounts = {}
  Object.values(votesByParticipant).forEach((dates) => {
    ;(dates || []).forEach((date) => {
      const key = toYmd(date)
      if (!key) return
      dateCounts[key] = (dateCounts[key] || 0) + 1
    })
  })
  const total = Object.keys(votesByParticipant).length
  for (const [date, count] of Object.entries(dateCounts)) {
    if (count === total) return date
  }
  return null
}

const getTimeFromStartDate = (startDate) => {
  const date = new Date(startDate)
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mm = String(date.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const listGroups = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const type = String(req.query.type || 'all').toLowerCase()

    const loadRange = type === 'range' || type === 'all'
    const loadFixed = type === 'fixed' || type === 'all'

    const [rangeRaw, fixedRaw] = await Promise.all([
      loadRange ? registerFetch('/api/range-groups') : Promise.resolve([]),
      loadFixed ? registerFetch('/api/fixed-groups') : Promise.resolve([]),
    ])

    const range = (rangeRaw || [])
      .map(mapRangeRow)
      .filter((g) =>
        userCanAccessGroup(g, userId, g.participant_ids || [])
      )
    const fixed = (fixedRaw || [])
      .map(mapFixedRow)
      .filter((g) =>
        userCanAccessGroup(g, userId, g.participant_ids || [])
      )

    return res.json({ range, fixed })
  } catch (error) {
    console.error('[mobile_staff_app][work-groups][list]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки групп' })
  }
}

const getCounts = () => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const data = await registerFetch(`/api/group-counts/${userId}`)
    return res.json(data || { fixed: 0, range: 0 })
  } catch (error) {
    console.error('[mobile_staff_app][work-groups][counts]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка счётчиков' })
  }
}

const listVotes = () => async (req, res) => {
  try {
    const data = await registerFetch('/api/participant_votes')
    return res.json(data || {})
  } catch (error) {
    console.error('[mobile_staff_app][work-groups][votes]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка голосов' })
  }
}

const createGroup = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const {
      group_name,
      description,
      importance = 'low',
      create_type = 'range',
      start_date,
      end_date,
      selected_date,
      time = '09:00',
      participant_ids = [],
    } = req.body || {}

    if (!group_name || !description) {
      return res.status(400).json({ message: 'Название и описание обязательны' })
    }
    const participants = [
      ...new Set(
        (participant_ids || [])
          .map(Number)
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ]
    if (!participants.length) {
      return res.status(400).json({ message: 'Добавьте хотя бы одного участника' })
    }

    let startIso = null
    let endIso = null
    let selectedIso = null

    if (create_type === 'range') {
      if (!start_date || !end_date) {
        return res.status(400).json({ message: 'Укажите диапазон дат' })
      }
      startIso = buildDateTimeIso(toYmd(start_date), time)
      endIso = buildDateTimeIso(toYmd(end_date), time)
    } else if (create_type === 'fixed') {
      if (!selected_date) {
        return res.status(400).json({ message: 'Укажите дату встречи' })
      }
      selectedIso = buildDateTimeIso(toYmd(selected_date), time)
    } else {
      return res.status(400).json({ message: 'create_type: range или fixed' })
    }

    const created = await registerFetch('/api/work_groups', {
      method: 'POST',
      body: {
        group_name,
        description,
        importance,
        create_type,
        start_date: startIso,
        end_date: endIso,
        selected_date: selectedIso,
        created_by: userId,
      },
    })

    const groupId = created?.id
    if (!groupId) {
      return res.status(500).json({ message: 'Группа не создана' })
    }

    await Promise.all(
      participants.map((pid) =>
        registerFetch('/api/group_participants', {
          method: 'POST',
          body: { work_groups_id: groupId, user_id: pid },
        }).catch((err) => {
          console.warn('[work-groups] add participant', err.message)
        })
      )
    )

    const groupPayload = {
      id: groupId,
      group_name,
      description,
      importance,
      create_type,
      selected_date: selectedIso,
      start_date: startIso,
      end_date: endIso,
      created_by: userId,
    }

    // единый notify на register (in-app + push + socket), без Telegram и без дублей BFF
    await registerFetch(`/api/work_groups/${groupId}/notify-staff`, {
      method: 'POST',
      body: {
        create_type,
        exclude_user_id: userId,
      },
    }).catch((err) =>
      console.warn('[work-groups] notify-staff', err.message)
    )

    return res.status(201).json({ id: groupId, group: groupPayload })
  } catch (error) {
    console.error('[mobile_staff_app][work-groups][create]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка создания группы' })
  }
}

const saveVotes = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const groupId = Number(req.params.groupId)
    const selected_dates = req.body?.selected_dates

    if (!groupId || !Array.isArray(selected_dates) || !selected_dates.length) {
      return res.status(400).json({ message: 'Выберите хотя бы одну дату' })
    }

    const meta = await getGroupParticipantIds(pool, groupId)
    if (!meta.group) {
      return res.status(404).json({ message: 'Группа не найдена' })
    }
    if (meta.group.create_type !== 'range') {
      return res.status(400).json({ message: 'Голосование уже завершено' })
    }
    if (!userCanAccessGroup(meta.group, userId, meta.userIds)) {
      return res.status(403).json({ message: 'Нет доступа к группе' })
    }

    const participantIdsOnly = (
      await pool.query(
        `SELECT user_id FROM group_participants WHERE work_groups_id = $1`,
        [groupId]
      )
    ).rows.map((r) => Number(r.user_id))

    if (!participantIdsOnly.includes(userId)) {
      return res.status(403).json({ message: 'Голосовать могут только участники' })
    }

    await registerFetch('/api/participant_votes', {
      method: 'POST',
      body: {
        group_id: groupId,
        participant: userId,
        selected_dates: selected_dates.map(toYmd),
      },
    })

    // после сохранения — проверка общего пересечения
    const votesRaw = await registerFetch('/api/participant_votes')
    const groupVotes = votesRaw?.[groupId] || votesRaw?.[String(groupId)] || {}
    const votesNormalized = {}
    Object.keys(groupVotes).forEach((pid) => {
      votesNormalized[Number(pid)] = (groupVotes[pid] || []).map(toYmd)
    })

    const allVoted = participantIdsOnly.every((pid) =>
      Array.isArray(votesNormalized[pid]) && votesNormalized[pid].length > 0
    )

    let agreed = null
    if (allVoted) {
      const commonDate = findCommonDate(votesNormalized)
      if (commonDate) {
        const timeFromStart = getTimeFromStartDate(meta.group.start_date)
        const selectedDateTime = `${commonDate} ${timeFromStart}`
        await registerFetch(`/api/updateWorkGroup/${groupId}`, {
          method: 'PATCH',
          body: {
            selected_date: selectedDateTime,
            start_date: null,
            end_date: null,
            create_type: 'fixed',
            exclude_user_id: userId,
          },
        })

        agreed = selectedDateTime
        // notify делает register updateWorkGroup (fixed → staff-notify)
      }
    }

    return res.json({
      ok: true,
      agreed_date: agreed,
      all_voted: allVoted,
    })
  } catch (error) {
    console.error('[mobile_staff_app][work-groups][votes-save]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка сохранения голосов' })
  }
}

const updateGroup = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const groupId = Number(req.params.groupId)
    const {
      create_type,
      selected_date,
      start_date = null,
      end_date = null,
    } = req.body || {}

    if (!groupId || !create_type || !selected_date) {
      return res.status(400).json({ message: 'Неверные данные' })
    }

    const meta = await getGroupParticipantIds(pool, groupId)
    if (!meta.group) {
      return res.status(404).json({ message: 'Группа не найдена' })
    }
    if (Number(meta.group.created_by) !== userId) {
      return res.status(403).json({ message: 'Только создатель может изменить статус' })
    }

    await registerFetch(`/api/updateWorkGroup/${groupId}`, {
      method: 'PATCH',
      body: {
        selected_date,
        start_date,
        end_date,
        create_type,
        exclude_user_id: userId,
      },
    })

    // notify: register updateWorkGroup для fixed/cancel/complect

    return res.json({ ok: true })
  } catch (error) {
    console.error('[mobile_staff_app][work-groups][update]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка обновления группы' })
  }
}

const deleteGroup = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const groupId = Number(req.params.groupId)
    const meta = await getGroupParticipantIds(pool, groupId)
    if (!meta.group) {
      return res.status(404).json({ message: 'Группа не найдена' })
    }
    if (Number(meta.group.created_by) !== userId) {
      return res.status(403).json({ message: 'Только создатель может удалить группу' })
    }
    await registerFetch(`/api/work_groups/${groupId}`, { method: 'DELETE' })
    return res.json({ ok: true })
  } catch (error) {
    console.error('[mobile_staff_app][work-groups][delete]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка удаления' })
  }
}

const removeParticipant = (pool) => async (req, res) => {
  try {
    const userId = Number(req.user.userId)
    const groupId = Number(req.params.groupId)
    const participantId = Number(req.params.participantId)
    const meta = await getGroupParticipantIds(pool, groupId)
    if (!meta.group) {
      return res.status(404).json({ message: 'Группа не найдена' })
    }
    if (Number(meta.group.created_by) !== userId) {
      return res.status(403).json({ message: 'Только создатель может удалять участников' })
    }
    await registerFetch(
      `/api/group_participants/${groupId}/${participantId}`,
      { method: 'DELETE' }
    )
    return res.json({ ok: true })
  } catch (error) {
    console.error('[mobile_staff_app][work-groups][remove-participant]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка удаления участника' })
  }
}

module.exports = {
  listGroups,
  getCounts,
  listVotes,
  createGroup,
  saveVotes,
  updateGroup,
  deleteGroup,
  removeParticipant,
}
