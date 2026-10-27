const AW_BASE = process.env.AW_BASE_URL || 'http://127.0.0.1:5005'

const KIND = ['decision', 'external', 'notice']
let ioRef = null

function setApprovalIo(io) {
  ioRef = io || null
}

function clean(value) {
  return String(value || '').trim()
}

function cleanDeadlineHours(value) {
  const hours = Math.round(Number(value))
  if (!Number.isFinite(hours) || hours < 1) return null
  return Math.min(hours, 60 * 24 + 23)
}

async function personName(db, userId) {
  const result = await db.query(
    `SELECT TRIM(CONCAT(first_name, ' ', last_name)) AS name FROM users WHERE id = $1`,
    [userId]
  )
  return result.rows[0]?.name || 'Сотрудник'
}

async function publisherAccess(db, userId) {
  const result = await db.query(
    `SELECT u.department_id, r.name AS role_name, p.name AS position_name,
            EXISTS (SELECT 1 FROM departments d WHERE d.head_user_id = u.id) AS is_head
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN positions p ON p.id = u.position_id
     WHERE u.id = $1`,
    [userId]
  )
  const row = result.rows[0]
  if (!row) return { canOfficial: false, departmentId: null, officialForAll: false }
  const officialForAll = row.role_name === 'Администратор' || row.role_name === 'Директор' || row.position_name === 'Директор'
  if (officialForAll) return { canOfficial: true, departmentId: null, officialForAll: true }
  const isHead = row.role_name === 'Руководитель отдела' || row.is_head === true
  if (isHead && row.department_id) {
    return { canOfficial: true, departmentId: Number(row.department_id), officialForAll: false }
  }
  if (isHead) {
    return { canOfficial: false, departmentId: null, officialForAll: false, missingDepartment: true }
  }
  return { canOfficial: false, departmentId: null, officialForAll: false }
}

async function canPublishOfficial(db, userId) {
  const access = await publisherAccess(db, userId)
  return access.canOfficial
}

async function canSeeTemplate(db, row, userId) {
  if (Number(row.owner_user_id) === Number(userId)) return true
  if (row.scope !== 'official' || row.is_published !== true) return false
  if (row.department_id == null) return true
  const viewer = await db.query(`SELECT department_id FROM users WHERE id = $1`, [userId])
  return Number(viewer.rows[0]?.department_id) === Number(row.department_id)
}

async function substituteFor(db, userId) {
  const result = await db.query(
    `SELECT us.substitute_user_id
     FROM user_statuses us
     WHERE us.user_id = $1
       AND us.substitute_user_id IS NOT NULL
       AND (
         (us.start_date IS NOT NULL AND us.start_date <= CURRENT_DATE AND (us.end_date IS NULL OR us.end_date >= CURRENT_DATE))
         OR EXISTS (
           SELECT 1 FROM user_status_dates usd
           WHERE usd.user_status_id = us.id AND usd.specific_date = CURRENT_DATE
         )
       )
     LIMIT 1`,
    [userId]
  )
  return result.rows[0]?.substitute_user_id || null
}

async function resolveUserIds(db, step) {
  return Array.isArray(step.assignee_user_ids) ? step.assignee_user_ids.map(Number).filter(Boolean) : []
}

function rulePasses(rule, fields) {
  if (!rule || !rule.op) return true
  const actual = Number(fields.find((field) => field.field_key === rule.fieldKey)?.value_number)
  const expected = Number(rule.value)
  if (actual == null || Number.isNaN(Number(actual)) || Number.isNaN(expected)) return false
  const value = Number(actual)
  if (rule.op === 'gt') return value > expected
  if (rule.op === 'gte') return value >= expected
  if (rule.op === 'lt') return value < expected
  if (rule.op === 'lte') return value <= expected
  return value === expected
}

async function systemMessage(db, cardId, body) {
  await db.query(
    `INSERT INTO approval_messages (card_id, author_user_id, body) VALUES ($1, NULL, $2)`,
    [cardId, body]
  )
  await broadcastCard(db, cardId)
}

function emitTemplatesChanged() {
  if (!ioRef) return
  setTimeout(() => {
    if (!ioRef) return
    ioRef.emit('approvalTemplates')
  }, 300)
}

function emitTo(userId, event, payload) {
  if (!ioRef || !userId) return
  setTimeout(() => {
    if (!ioRef) return
    ioRef.to(String(userId)).emit(event, payload)
  }, 300)
}

async function pushNotice(db, userId, message, eventType = 'approval_step', cardId = null) {
  const text = cardId ? `${message} [approval:${cardId}]` : message
  try {
    await db.query(
      `INSERT INTO notifications (user_id, task_id, message, event_type, is_read, is_sent)
       VALUES ($1, NULL, $2, $3, false, false)`,
      [userId, text, eventType]
    )
    emitTo(userId, 'notification', {
      type: eventType,
      message: text,
      userId: Number(userId),
      cardId: cardId || null,
    })
  } catch (error) {
    console.error('approval notice', error.message)
  }
}

async function broadcastCard(db, cardId, kind = 'card') {
  try {
    const ids = await participantIds(db, cardId)
    const card = await db.query(`SELECT author_user_id FROM approval_cards WHERE id = $1`, [cardId])
    const userIds = [...new Set([...ids, card.rows[0]?.author_user_id].map(Number).filter(Boolean))]
    userIds.forEach((id) => emitTo(id, 'approvalUpdated', { cardId: Number(cardId), userIds, kind }))
  } catch (error) {
    console.error('approval live', error.message)
  }
}

async function notifyAssignees(db, card, step) {
  const people = await db.query(
    `SELECT user_id FROM approval_card_step_assignees WHERE step_id = $1`,
    [step.id]
  )
  const told = new Set()
  if (step.step_kind !== 'external' && step.step_kind !== 'notice') {
    const text = `Согласование «${card.title}»: ваш шаг «${step.title}»`
    for (const person of people.rows) {
      told.add(Number(person.user_id))
      await pushNotice(db, person.user_id, text, 'approval_step', card.id)
    }
  }
  if (!told.has(Number(card.author_user_id))) {
    await pushNotice(
      db,
      card.author_user_id,
      `Согласование «${card.title}»: открыт шаг «${step.title}»`,
      'approval_step',
      card.id
    )
  }
  await broadcastCard(db, card.id)
}

async function notifyDeadlines(db) {
  const result = await db.query(
    `SELECT s.id, s.title, c.id AS card_id, c.title AS card_title, c.author_user_id
     FROM approval_card_steps s
     JOIN approval_cards c ON c.id = s.card_id
     WHERE c.status = 'running' AND s.status = 'active'
       AND s.due_at IS NOT NULL AND s.due_at <= NOW() AND s.deadline_notified = false`
  )
  for (const step of result.rows) {
    const people = await db.query(
      `SELECT user_id FROM approval_card_step_assignees WHERE step_id = $1 AND decision IS NULL`,
      [step.id]
    )
    const text = `Срок шага «${step.title}» в согласовании «${step.card_title}» вышел. Шаг не закрыт.`
    await systemMessage(db, step.card_id, text)
    const ids = new Set([step.author_user_id, ...people.rows.map((row) => row.user_id)].filter(Boolean))
    for (const userId of ids) await pushNotice(db, userId, text, 'approval_deadline', step.card_id)
    await db.query(`UPDATE approval_card_steps SET deadline_notified = true WHERE id = $1`, [step.id])
  }
}

async function writeAssignees(db, step, authorId) {
  await db.query(`DELETE FROM approval_card_step_assignees WHERE step_id = $1`, [step.id])
  const ids = await resolveUserIds(db, step)
  for (const userId of ids) {
    await db.query(
      `INSERT INTO approval_card_step_assignees (step_id, user_id, is_substitute)
       VALUES ($1, $2, false)
       ON CONFLICT (step_id, user_id) DO NOTHING`,
      [step.id, userId]
    )
    const substituteId = await substituteFor(db, userId)
    if (substituteId && substituteId !== userId && !ids.includes(Number(substituteId))) {
      await db.query(
        `INSERT INTO approval_card_step_assignees (step_id, user_id, is_substitute, covers_user_id)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (step_id, user_id) DO NOTHING`,
        [step.id, substituteId, userId]
      )
    }
  }
}

async function loadFields(db, cardId) {
  const result = await db.query(
    `SELECT field_key, value_number FROM approval_card_fields WHERE card_id = $1`,
    [cardId]
  )
  return result.rows
}

async function finishCard(db, card, status, outcome) {
  await db.query(
    `UPDATE approval_cards
     SET status = $2, outcome_text = $3, finished_at = NOW(), current_step_id = NULL
     WHERE id = $1`,
    [card.id, status, outcome]
  )
  await systemMessage(db, card.id, outcome)
  const rejected = status === 'rejected'
  const text = rejected
    ? `Согласование «${card.title}» отклонено`
    : `Согласование «${card.title}» завершено`
  const ids = await participantIds(db, card.id)
  const targets = [...new Set([card.author_user_id, ...ids].map(Number).filter(Boolean))]
  for (const userId of targets) {
    await pushNotice(db, userId, text, rejected ? 'approval_rejected' : 'approval_done', card.id)
  }
}

async function activateFrom(db, card, steps, startIndex) {
  const fields = await loadFields(db, card.id)
  for (let index = startIndex; index < steps.length; index += 1) {
    const step = steps[index]
    if (!rulePasses(step.enter_rule, fields)) {
      await db.query(
        `UPDATE approval_card_steps SET status = 'skipped', result = 'notified', acted_at = NOW() WHERE id = $1`,
        [step.id]
      )
      continue
    }
    const due = step.deadline_hours
      ? new Date(Date.now() + Number(step.deadline_hours) * 3600000)
      : null
    await db.query(
      `UPDATE approval_card_steps
       SET status = 'active', due_at = $2, deadline_notified = false, result = NULL, result_comment = NULL, acted_at = NULL, acted_by_user_id = NULL
       WHERE id = $1`,
      [step.id, due]
    )
    await db.query(`UPDATE approval_cards SET current_step_id = $2 WHERE id = $1`, [card.id, step.id])
    await writeAssignees(db, step, card.author_user_id)
    await notifyAssignees(db, card, step)
    if (step.step_kind === 'notice') {
      await db.query(
        `UPDATE approval_card_steps SET status = 'done', result = 'notified', acted_at = NOW() WHERE id = $1`,
        [step.id]
      )
      await systemMessage(db, card.id, `Уведомление: ${step.title}`)
      continue
    }
    if (step.step_kind === 'external' || waitsOrder(step)) {
      try {
        await checkStep(db, card, { ...step, status: 'active', checks: orderChecks(step) }, null, false)
      } catch (error) {
        console.error('approval open check', error.message)
      }
    }
    return
  }
  await finishCard(db, card, 'approved', 'Согласовано')
}

async function stepsOf(db, cardId) {
  const result = await db.query(
    `SELECT * FROM approval_card_steps WHERE card_id = $1 ORDER BY sort_order, id`,
    [cardId]
  )
  return result.rows
}

async function advanceAfter(db, card, step) {
  const steps = await stepsOf(db, card.id)
  const index = steps.findIndex((item) => item.id === step.id)
  await activateFrom(db, card, steps, index + 1)
}

function orderChecks(step) {
  const value = step.checks
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      return []
    }
  }
  return []
}

function checksForOrder(step) {
  const checks = orderChecks(step).filter((item) => (item.check_code || item.code) !== 'order_status_eq')
  if (checks.length) return checks
  if (orderChecks(step).length) return [{ code: 'order_exists', params: {} }]
  return []
}

function waitsOrder(step) {
  return step.step_kind === 'decision' && orderChecks(step).length > 0
}

async function quorumMet(db, stepId, quorum) {
  const open = await db.query(
    `SELECT COUNT(*)::int AS left_count
     FROM approval_card_step_assignees orig
     WHERE orig.step_id = $1 AND orig.is_substitute = false AND orig.decision IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM approval_card_step_assignees sub
         WHERE sub.step_id = orig.step_id AND sub.covers_user_id = orig.user_id AND sub.decision = 'approved'
       )`,
    [stepId]
  )
  const approved = await db.query(
    `SELECT COUNT(*)::int AS approved_count
     FROM approval_card_step_assignees
     WHERE step_id = $1 AND decision = 'approved'`,
    [stepId]
  )
  return quorum === 'any' ? approved.rows[0].approved_count > 0 : open.rows[0].left_count === 0
}

function matchExternal(step, checks) {
  if (!checks.length) return false
  const needAll = step.external_match !== 'any'
  return needAll ? checks.every((item) => item.passed) : checks.some((item) => item.passed)
}

const SEARCH_LABEL = {
  orderno: 'наименование заказа',
  agreementno: 'номер договора 1С',
}

function orderCheckReason(ref, payload) {
  const how = SEARCH_LABEL[ref.searchBy] || ref.searchBy || 'поле поиска'
  const value = clean(ref.searchValue)
  if (!ref.searchBy || !value) return 'В заявке не указано, как найти заказ. Проверка не выполнена.'
  if (payload?.error) {
    const text = clean(payload.error)
    if (/timeout|aborted|не ответил/i.test(text)) {
      return `Альтавин не ответил за отведённое время. Искали ${how} «${value}». Шаг не закрыт.`
    }
    return `Альтавин вернул ошибку: ${text}. Искали ${how} «${value}». Шаг не закрыт.`
  }
  if (!payload || payload.found === 'none') {
    return `Заказ не найден. Искали ${how} «${value}». Шаг остаётся открытым.`
  }
  if (payload.found === 'many') {
    return `По полю «${how}» «${value}» найдено несколько заказов. Нужен один, шаг не закрыт.`
  }
  if (payload.found === 'one') {
    const failed = (payload.checks || []).filter((item) => !item.passed)
    if (!failed.length) return ''
    const order = payload.order || {}
    const number = order.orderNo ? `Заказ «${order.orderNo}»` : 'Заказ найден'
    const wait = failed.map((item) => item.detail).filter(Boolean).join('; ') || 'условие не выполнено'
    return `${number}. Событие ещё не наступило: ${wait}.`
  }
  return 'Проверка заказа завершилась без понятного результата.'
}

async function writeCheckLog(db, card, step, reason) {
  const text = clean(reason)
  if (!text || !step?.id) return
  try {
    let title = card?.title
    if (!title && card?.id) {
      const row = await db.query(`SELECT title FROM approval_cards WHERE id = $1`, [card.id])
      title = row.rows[0]?.title || ''
    }
    const last = await db.query(
      `SELECT id, reason FROM approval_check_logs WHERE step_id = $1 ORDER BY id DESC LIMIT 1`,
      [step.id]
    )
    if (last.rows[0] && last.rows[0].reason === text) {
      await db.query(
        `UPDATE approval_check_logs SET repeat_count = repeat_count + 1, updated_at = NOW() WHERE id = $1`,
        [last.rows[0].id]
      )
      return
    }
    await db.query(
      `INSERT INTO approval_check_logs (card_id, step_id, card_title, step_title, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [card?.id || null, step.id, title || '', step.title || '', text]
    )
  } catch (error) {
    console.error('approval check log', error.message)
  }
}

function snapshotText(payload) {
  if (!payload || payload.found === 'none') return 'заказ не найден'
  if (payload.found === 'many') return 'найдено несколько заказов'
  const order = payload.order || {}
  const waiting = (payload.checks || []).filter((item) => !item.passed).map((item) => item.detail)
  const name = order.orderNo ? `Заказ «${order.orderNo}»` : 'Заказ найден'
  const agreement = order.agreementNo ? `Договор: ${order.agreementNo}` : 'Договор ещё не заполнен'
  const wait = waiting.length ? `Ждём: ${waiting.join('; ')}` : 'Условие выполнено'
  return `${name}. ${agreement}. ${wait}`
}

async function checkStep(db, card, step, actorId, manual) {
  if (manual) {
    const comment = clean(step.manualComment)
    if (!comment) {
      const error = new Error('Комментарий обязателен')
      error.status = 400
      throw error
    }
    await db.query(
      `UPDATE approval_card_steps
       SET status = 'done', result = 'manual', result_comment = $2, acted_by_user_id = $3, acted_at = NOW()
       WHERE id = $1`,
      [step.id, comment, actorId]
    )
    await systemMessage(db, card.id, `${step.title}: закрыто вручную. ${comment}`)
    await advanceAfter(db, card, step)
    return
  }

  const fieldKey = step.order_field_key
  const fieldResult = await db.query(
    `SELECT value_json FROM approval_card_fields WHERE card_id = $1 AND field_key = $2`,
    [card.id, fieldKey]
  )
  const ref = fieldResult.rows[0]?.value_json || {}
  let payload = { found: 'none', checks: [] }
  if (ref.searchBy && ref.searchValue) {
    try {
      const response = await fetch(`${AW_BASE}/app/approval/order-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchBy: ref.searchBy,
          searchValue: ref.searchValue,
          checks: checksForOrder(step),
        }),
        signal: AbortSignal.timeout(8000),
      })
      const data = await response.json()
      payload = response.ok
        ? data
        : { found: 'none', error: data.message || 'Альтавин недоступен', checks: [] }
    } catch (error) {
      console.error('approval open check', error.message)
      payload = { found: 'none', error: error.message || 'Альтавин не ответил', checks: [] }
    }
  }
  await writeCheckLog(db, card, step, orderCheckReason(ref, payload))
  await db.query(
    `UPDATE approval_card_steps SET external_snapshot = $2, external_checked_at = NOW() WHERE id = $1`,
    [step.id, JSON.stringify(payload)]
  )
  if (payload.found === 'one' && matchExternal(step, payload.checks || [])) {
    if (step.step_kind === 'decision' && !(await quorumMet(db, step.id, step.quorum))) return
    const result = step.step_kind === 'decision' ? 'approved' : 'auto'
    await db.query(
      `UPDATE approval_card_steps SET status = 'done', result = $2, acted_at = NOW() WHERE id = $1`,
      [step.id, result]
    )
    await systemMessage(db, card.id, `${step.title}: ${snapshotText(payload)}`)
    await advanceAfter(db, card, step)
  }
}

async function participantIds(db, cardId) {
  const result = await db.query(
    `SELECT DISTINCT a.user_id
     FROM approval_card_step_assignees a
     JOIN approval_card_steps s ON s.id = a.step_id
     WHERE s.card_id = $1`,
    [cardId]
  )
  return result.rows.map((row) => row.user_id)
}

async function assertVisible(db, card, userId) {
  const uid = Number(userId)
  if (Number(card.author_user_id) === uid) return
  const ids = await participantIds(db, card.id)
  if (!ids.map(Number).includes(uid)) {
    const error = new Error('Заявка вам не доступна')
    error.status = 403
    throw error
  }
}

function normalizeStep(step, index) {
  const kind = KIND.includes(step.stepKind) ? step.stepKind : 'decision'
  return {
    sort_order: index,
    step_kind: kind,
    title: clean(step.title) || 'Шаг',
    assignee_mode: 'users',
    assignee_user_ids: Array.isArray(step.assigneeUserIds) ? step.assigneeUserIds.map(Number).filter(Boolean) : [],
    department_id: null,
    role_name: null,
    position_id: null,
    quorum: step.quorum === 'any' ? 'any' : 'all',
    deadline_hours: cleanDeadlineHours(step.deadlineHours),
    on_reject: step.onReject === 'return' ? 'return' : 'stop',
    return_to_sort_order: step.returnToSortOrder ?? null,
    allow_manual_close: step.allowManualClose !== false,
    external_match: step.externalMatch === 'any' ? 'any' : 'all',
    enter_rule: step.enterRule || null,
    checks: Array.isArray(step.checks) ? step.checks : [],
    order_field_key: step.orderFieldKey || null,
  }
}

async function insertSteps(db, cardId, steps) {
  for (const step of steps) {
    await db.query(
      `INSERT INTO approval_card_steps (
         card_id, sort_order, step_kind, title, assignee_mode, assignee_user_ids,
         department_id, role_name, position_id, quorum, deadline_hours, on_reject,
         return_to_sort_order, allow_manual_close, external_match, enter_rule, checks, order_field_key
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        cardId, step.sort_order, step.step_kind, step.title, step.assignee_mode, step.assignee_user_ids,
        step.department_id, step.role_name, step.position_id, step.quorum, step.deadline_hours, step.on_reject,
        step.return_to_sort_order, step.allow_manual_close, step.external_match,
        step.enter_rule ? JSON.stringify(step.enter_rule) : null,
        JSON.stringify(step.checks), step.order_field_key,
      ]
    )
  }
}

async function createCard(db, payload) {
  const authorId = Number(payload.userId)
  const title = clean(payload.title)
  if (!authorId || !title) {
    const error = new Error('Укажите название и автора')
    error.status = 400
    throw error
  }
  let source = 'free'
  let templateTitle = null
  let templateId = payload.templateId ? Number(payload.templateId) : null
  let steps = []
  if (templateId) {
    const template = await db.query(`SELECT * FROM approval_templates WHERE id = $1`, [templateId])
    if (!template.rows[0]) {
      const error = new Error('Шаблон не найден')
      error.status = 404
      throw error
    }
    source = template.rows[0].scope === 'official' ? 'official' : 'personal'
    templateTitle = template.rows[0].title || null
    const stepRows = await db.query(
      `SELECT s.*, COALESCE(json_agg(c ORDER BY c.sort_order) FILTER (WHERE c.id IS NOT NULL), '[]') AS checks
       FROM approval_template_steps s
       LEFT JOIN approval_template_checks c ON c.template_step_id = s.id
       WHERE s.template_id = $1
       GROUP BY s.id
       ORDER BY s.sort_order, s.id`,
      [templateId]
    )
    steps = stepRows.rows.map((row, index) => ({
      sort_order: index,
      step_kind: row.step_kind,
      title: row.title,
      assignee_mode: 'users',
      assignee_user_ids: row.assignee_user_ids || [],
      department_id: null,
      role_name: null,
      position_id: null,
      quorum: row.quorum,
      deadline_hours: row.deadline_hours,
      on_reject: row.on_reject,
      return_to_sort_order: row.return_to_sort_order,
      allow_manual_close: row.allow_manual_close,
      external_match: row.external_match,
      enter_rule: row.enter_rule,
      checks: (row.checks || []).map((check) => ({
        code: check.check_code || check.code,
        params: check.params || {},
      })),
      order_field_key: row.order_field_key || (row.checks[0] && row.checks[0].order_field_key) || null,
    }))
  } else {
    steps = (payload.steps || []).map(normalizeStep)
  }
  if (!steps.length) {
    const error = new Error('Добавьте хотя бы один шаг')
    error.status = 400
    throw error
  }
  if (source !== 'official') {
    steps = steps.map((step) => ({ ...step, on_reject: 'stop', return_to_sort_order: null, enter_rule: null }))
    if (steps.some((step) => step.step_kind === 'notice')) {
      const error = new Error('Уведомление ставится только в общем шаблоне')
      error.status = 400
      throw error
    }
  }
  for (const step of steps) {
    if (step.step_kind === 'decision' && !(step.assignee_user_ids || []).length) {
      const error = new Error(`Укажите, кто выполняет шаг «${step.title}»`)
      error.status = 400
      throw error
    }
    if (step.step_kind === 'external' && !(step.checks || []).length) {
      const error = new Error(`Выберите событие заказа на шаге «${step.title}»`)
      error.status = 400
      throw error
    }
  }
  if (steps.some((step) => step.step_kind === 'external' || waitsOrder(step))) {
    const order = (payload.fields || []).find((field) => (field.fieldKey || field.field_key) === 'order')
    const value = order?.valueJson?.searchValue || order?.value_json?.searchValue
    if (!clean(value)) {
      const error = new Error('Для проверки Альтавин укажите, как найти заказ')
      error.status = 400
      throw error
    }
  }
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const cardResult = await client.query(
      `INSERT INTO approval_cards (template_id, source, author_user_id, title, body, status, started_at, template_title)
       VALUES ($1, $2, $3, $4, $5, 'running', NOW(), $6)
       RETURNING *`,
      [templateId, source, authorId, title, clean(payload.body), templateTitle]
    )
    const card = cardResult.rows[0]
    for (const field of payload.fields || []) {
      await client.query(
        `INSERT INTO approval_card_fields (card_id, field_key, label, field_type, value_text, value_number, value_date, value_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          card.id,
          field.fieldKey || 'text',
          field.label || 'Поле',
          field.fieldType || 'text',
          field.valueText || null,
          field.valueNumber ?? null,
          field.valueDate || null,
          field.valueJson ? JSON.stringify(field.valueJson) : null,
        ]
      )
    }
    await insertSteps(client, card.id, steps)
    const fresh = await client.query(
      `SELECT * FROM approval_card_steps WHERE card_id = $1 ORDER BY sort_order, id`,
      [card.id]
    )
    await activateFrom(client, card, fresh.rows, 0)
    await client.query('COMMIT')
    return { id: card.id }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function listInbox(db, userId) {
  const result = await db.query(
    `SELECT c.id, c.title, c.source, c.status, s.sort_order, s.title AS step_title, s.step_kind,
            (COALESCE(s.checks, '[]'::jsonb) <> '[]'::jsonb) AS waits_order,
            (SELECT COUNT(*) FROM approval_card_steps cs WHERE cs.card_id = c.id) AS step_count
     FROM approval_cards c
     JOIN approval_card_steps s ON s.id = c.current_step_id
     JOIN approval_card_step_assignees a ON a.step_id = s.id AND a.user_id = $1
       AND (
         (
           a.decision IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM approval_card_step_assignees sub
             WHERE sub.step_id = a.step_id AND sub.covers_user_id = a.user_id AND sub.decision IS NOT NULL
           )
         )
         OR (
           a.decision = 'approved'
           AND s.step_kind = 'decision'
           AND COALESCE(s.checks, '[]'::jsonb) <> '[]'::jsonb
         )
       )
     WHERE c.status = 'running' AND s.status = 'active' AND s.step_kind <> 'external'
     ORDER BY c.created_at DESC`,
    [userId]
  )
  return result.rows
}

async function listMine(db, userId) {
  const result = await db.query(
    `SELECT c.id, c.title, c.source, c.status, s.sort_order, s.title AS step_title, s.step_kind,
            (SELECT COUNT(*) FROM approval_card_steps cs WHERE cs.card_id = c.id) AS step_count,
            EXISTS (
              SELECT 1 FROM approval_card_step_assignees a
              WHERE a.step_id = s.id AND a.user_id = $1 AND s.step_kind <> 'external'
                AND (
                  (
                    a.decision IS NULL
                    AND NOT EXISTS (
                      SELECT 1 FROM approval_card_step_assignees sub
                      WHERE sub.step_id = a.step_id AND sub.covers_user_id = a.user_id AND sub.decision IS NOT NULL
                    )
                  )
                  OR (
                    a.decision = 'approved'
                    AND s.step_kind = 'decision'
                    AND COALESCE(s.checks, '[]'::jsonb) <> '[]'::jsonb
                  )
                )
            ) AS mine_now
     FROM approval_cards c
     LEFT JOIN approval_card_steps s ON s.id = c.current_step_id
     WHERE c.author_user_id = $1 AND c.status = 'running'
     ORDER BY c.created_at DESC`,
    [userId]
  )
  return result.rows
}

async function listCompleted(db, userId, from, to) {
  const result = await db.query(
    `SELECT c.id, c.title, c.status, c.outcome_text, c.finished_at, c.author_done_at, c.author_user_id,
            TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS author_name
     FROM approval_cards c
     JOIN users u ON u.id = c.author_user_id
     WHERE c.status IN ('approved', 'rejected', 'cancelled')
       AND c.finished_at >= $2 AND c.finished_at < $3
       AND (
         c.author_user_id = $1
         OR EXISTS (
           SELECT 1 FROM approval_card_step_assignees a
           JOIN approval_card_steps s ON s.id = a.step_id
           WHERE s.card_id = c.id AND a.user_id = $1
         )
       )
     ORDER BY c.finished_at DESC`,
    [userId, from, to]
  )
  return result.rows
}

async function getCard(db, cardId, userId) {
  const cardResult = await db.query(`SELECT * FROM approval_cards WHERE id = $1`, [cardId])
  const card = cardResult.rows[0]
  if (!card) {
    const error = new Error('Заявка не найдена')
    error.status = 404
    throw error
  }
  if (card.status === 'running' && card.author_user_id !== userId) {
    const waiting = await db.query(
      `SELECT 1 FROM approval_card_step_assignees a
       JOIN approval_card_steps s ON s.id = a.step_id
       WHERE a.step_id = $1 AND a.user_id = $2
         AND (
           (
             a.decision IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM approval_card_step_assignees sub
               WHERE sub.step_id = a.step_id AND sub.covers_user_id = a.user_id AND sub.decision IS NOT NULL
             )
           )
           OR (
             a.decision = 'approved'
             AND s.step_kind = 'decision'
             AND COALESCE(s.checks, '[]'::jsonb) <> '[]'::jsonb
           )
         )`,
      [card.current_step_id, userId]
    )
    if (!waiting.rows.length) {
      const error = new Error('Сейчас эта заявка вам не показана')
      error.status = 403
      throw error
    }
  } else {
    await assertVisible(db, card, userId)
  }
  if (card.status === 'running' && card.current_step_id) {
    const current = await db.query(`SELECT * FROM approval_card_steps WHERE id = $1`, [card.current_step_id])
    const step = current.rows[0]
    if (step && step.status === 'active' && (step.step_kind === 'external' || waitsOrder(step))) {
      checkStep(db, card, step, null, false).catch((error) => {
        console.error('approval open check', error.message)
      })
    }
  }
  const [steps, fields, messages, files] = await Promise.all([
    db.query(
      `SELECT s.*,
              COALESCE(json_agg(json_build_object(
                'userId', a.user_id,
                'name', TRIM(CONCAT(u.first_name, ' ', u.last_name)),
                'decision', a.decision,
                'comment', a.comment,
                'isSubstitute', a.is_substitute,
                'coversUserId', a.covers_user_id,
                'decidedAt', a.decided_at
              )) FILTER (WHERE a.id IS NOT NULL), '[]') AS assignees
       FROM approval_card_steps s
       LEFT JOIN approval_card_step_assignees a ON a.step_id = s.id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE s.card_id = $1
       GROUP BY s.id
       ORDER BY s.sort_order, s.id`,
      [cardId]
    ),
    db.query(`SELECT * FROM approval_card_fields WHERE card_id = $1 ORDER BY id`, [cardId]),
    db.query(
      `SELECT m.*, TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS author_name
       FROM approval_messages m
       LEFT JOIN users u ON u.id = m.author_user_id
       WHERE m.card_id = $1
       ORDER BY m.created_at`,
      [cardId]
    ),
    db.query(
      `SELECT f.id, f.card_id, f.step_id, f.message_id, f.file_name, f.created_at,
              TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS uploader_name
       FROM approval_files f
       LEFT JOIN users u ON u.id = f.uploader_user_id
       WHERE f.card_id = $1
       ORDER BY f.created_at, f.id`,
      [cardId]
    ),
  ])
  const links = await db.query(
    `SELECT task_id, global_task_id FROM approval_card_links WHERE card_id = $1`,
    [cardId]
  )
  card.links = {
    taskId: Number(links.rows.find((row) => row.task_id)?.task_id) || null,
    globalTaskId: Number(links.rows.find((row) => row.global_task_id)?.global_task_id) || null,
  }
  if (Number(card.author_user_id) !== Number(userId)) card.author_note = null
  return {
    card,
    steps: steps.rows,
    fields: fields.rows,
    messages: messages.rows,
    files: files.rows,
  }
}

async function decide(db, cardId, stepId, userId, decision, comment) {
  const cardResult = await db.query(`SELECT * FROM approval_cards WHERE id = $1 AND status = 'running'`, [cardId])
  const card = cardResult.rows[0]
  const stepResult = await db.query(`SELECT * FROM approval_card_steps WHERE id = $1 AND card_id = $2`, [stepId, cardId])
  const step = stepResult.rows[0]
  if (!card || !step || step.status !== 'active') {
    const error = new Error('Шаг уже закрыт')
    error.status = 400
    throw error
  }
  if (decision === 'rejected' && !clean(comment)) {
    const error = new Error('Отказ только с комментарием')
    error.status = 400
    throw error
  }
  const assignee = await db.query(
    `SELECT * FROM approval_card_step_assignees WHERE step_id = $1 AND user_id = $2 AND decision IS NULL`,
    [stepId, userId]
  )
  if (!assignee.rows[0]) {
    const answered = await db.query(
      `SELECT decision FROM approval_card_step_assignees WHERE step_id = $1 AND user_id = $2 AND decision IS NOT NULL`,
      [stepId, userId]
    )
    const error = new Error(answered.rows[0] ? 'Вы уже ответили на этот шаг' : 'Этот шаг решает другой сотрудник')
    error.status = 403
    throw error
  }
  await db.query(
    `UPDATE approval_card_step_assignees
     SET decision = $3, comment = $4, decided_at = NOW()
     WHERE step_id = $1 AND user_id = $2`,
    [stepId, userId, decision, clean(comment) || null]
  )
  let name = await personName(db, userId)
  if (assignee.rows[0].is_substitute && assignee.rows[0].covers_user_id) {
    name = `${name} вместо ${await personName(db, assignee.rows[0].covers_user_id)}`
  }
  if (decision === 'rejected') {
    await db.query(
      `UPDATE approval_card_steps
       SET status = 'rejected', result = 'rejected', result_comment = $2, acted_by_user_id = $3, acted_at = NOW()
       WHERE id = $1`,
      [stepId, clean(comment), userId]
    )
    if (step.on_reject === 'return' && step.return_to_sort_order != null) {
      await systemMessage(db, cardId, `${name} вернул шаг «${step.title}»: ${clean(comment)}`)
      const steps = await stepsOf(db, cardId)
      const target = steps.findIndex((item) => item.sort_order === step.return_to_sort_order)
      if (target >= 0) {
        await db.query(
          `UPDATE approval_card_steps SET status = 'pending' WHERE card_id = $1 AND sort_order >= $2 AND id <> $3`,
          [cardId, step.return_to_sort_order, stepId]
        )
        await activateFrom(db, card, steps, target)
        return
      }
    }
    await finishCard(db, card, 'rejected', `${name}: ${clean(comment)}`)
    return
  }

  const done = await quorumMet(db, stepId, step.quorum)
  if (!done) {
    await systemMessage(db, cardId, `${name} согласовал «${step.title}»`)
    return
  }
  if (waitsOrder(step)) {
    try {
      await checkStep(db, card, step, userId, false)
    } catch (error) {
      console.error('approval event after decision', error.message)
    }
    const fresh = await db.query(`SELECT status FROM approval_card_steps WHERE id = $1`, [stepId])
    if (fresh.rows[0]?.status === 'active') {
      await systemMessage(db, cardId, `${name} согласовал «${step.title}». Событие заказа ещё не наступило`)
    }
    return
  }
  await db.query(
    `UPDATE approval_card_steps
     SET status = 'done', result = 'approved', acted_by_user_id = $2, acted_at = NOW()
     WHERE id = $1`,
    [stepId, userId]
  )
  await systemMessage(db, cardId, `${name} закрыл «${step.title}»`)
  await advanceAfter(db, card, step)
}

async function manualOrCheck(db, cardId, stepId, userId, manualComment) {
  const cardResult = await db.query(`SELECT * FROM approval_cards WHERE id = $1 AND status = 'running'`, [cardId])
  const stepResult = await db.query(
    `SELECT * FROM approval_card_steps
     WHERE id = $1 AND card_id = $2 AND status = 'active'
       AND (step_kind = 'external' OR (step_kind = 'decision' AND COALESCE(checks, '[]'::jsonb) <> '[]'::jsonb))`,
    [stepId, cardId]
  )
  if (!cardResult.rows[0] || !stepResult.rows[0]) {
    const error = new Error('Проверка уже закрыта')
    error.status = 400
    throw error
  }
  const step = stepResult.rows[0]
  if (manualComment != null) {
    const assignee = await db.query(
      `SELECT 1 FROM approval_card_step_assignees WHERE step_id = $1 AND user_id = $2`,
      [stepId, userId]
    )
    const allowed = cardResult.rows[0].author_user_id === userId || Boolean(assignee.rows[0])
    if (!allowed) {
      const error = new Error('Закрыть проверку может автор заявки или исполнитель шага')
      error.status = 403
      throw error
    }
    await checkStep(db, cardResult.rows[0], { ...step, manualComment }, userId, true)
    return
  }
  await checkStep(db, cardResult.rows[0], step, userId, false)
}

async function cancelCard(db, cardId, userId) {
  const result = await db.query(
    `UPDATE approval_cards
     SET status = 'cancelled', finished_at = NOW(), current_step_id = NULL, outcome_text = 'Отменено автором'
     WHERE id = $1 AND author_user_id = $2 AND status = 'running'
     RETURNING id, title`,
    [cardId, userId]
  )
  if (!result.rows[0]) {
    const error = new Error('Отменить можно только свою идущую заявку')
    error.status = 400
    throw error
  }
  await systemMessage(db, cardId, 'Автор отменил заявку')
  const ids = await participantIds(db, cardId)
  const targets = [...new Set(ids.map(Number).filter((id) => id && id !== Number(userId)))]
  const text = `Согласование «${result.rows[0].title}» отменено автором`
  for (const targetId of targets) await pushNotice(db, targetId, text, 'approval_cancelled', cardId)
}

async function addMessage(db, cardId, userId, body) {
  const text = clean(body)
  if (!text) {
    const error = new Error('Пустое сообщение')
    error.status = 400
    throw error
  }
  const cardResult = await db.query(`SELECT * FROM approval_cards WHERE id = $1`, [cardId])
  if (!cardResult.rows[0]) {
    const error = new Error('Заявка не найдена')
    error.status = 404
    throw error
  }
  await assertVisible(db, cardResult.rows[0], userId)
  const result = await db.query(
    `INSERT INTO approval_messages (card_id, author_user_id, body) VALUES ($1, $2, $3) RETURNING id, created_at`,
    [cardId, userId, text]
  )
  await tellOthers(db, cardResult.rows[0], userId, `Согласование «${cardResult.rows[0].title}»: новое сообщение`, 'approval_chat')
  return result.rows[0]
}

async function addFile(db, cardId, userId, meta) {
  const cardResult = await db.query(`SELECT * FROM approval_cards WHERE id = $1`, [cardId])
  const card = cardResult.rows[0]
  if (!card) {
    const error = new Error('Заявка не найдена')
    error.status = 404
    throw error
  }
  await assertVisible(db, card, userId)
  const text = clean(meta.body) || `Файл: ${meta.fileName}`
  const message = await db.query(
    `INSERT INTO approval_messages (card_id, author_user_id, body) VALUES ($1, $2, $3) RETURNING id, created_at`,
    [cardId, userId, text]
  )
  const inserted = await db.query(
    `INSERT INTO approval_files (card_id, message_id, uploader_user_id, file_name, storage_path)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, file_name, created_at`,
    [cardId, message.rows[0].id, userId, meta.fileName, meta.storagePath]
  )
  await tellOthers(
    db,
    card,
    userId,
    `Согласование «${card.title}»: прикреплён файл ${meta.fileName}`,
    'approval_file'
  )
  return inserted.rows[0]
}

async function tellOthers(db, card, actorId, message, eventType) {
  const ids = await participantIds(db, card.id)
  const targets = [...new Set([card.author_user_id, ...ids].map(Number).filter((id) => id && id !== Number(actorId)))]
  for (const userId of targets) await pushNotice(db, userId, message, eventType, card.id)
  await broadcastCard(db, card.id, eventType === 'approval_file' ? 'file' : 'chat')
}

async function getFile(db, fileId, userId) {
  const result = await db.query(
    `SELECT f.*, c.author_user_id
     FROM approval_files f
     JOIN approval_cards c ON c.id = f.card_id
     WHERE f.id = $1`,
    [fileId]
  )
  const row = result.rows[0]
  if (!row) {
    const error = new Error('Файл не найден')
    error.status = 404
    throw error
  }
  await assertVisible(db, { id: row.card_id, author_user_id: row.author_user_id }, userId)
  return row
}

async function pollExternal(db) {
  const result = await db.query(
    `SELECT s.*, c.author_user_id, c.id AS card_id, c.title AS card_title
     FROM approval_card_steps s
     JOIN approval_cards c ON c.id = s.card_id
     WHERE c.status = 'running' AND s.status = 'active'
       AND (s.step_kind = 'external' OR (s.step_kind = 'decision' AND COALESCE(s.checks, '[]'::jsonb) <> '[]'::jsonb))`
  )
  for (const step of result.rows) {
    try {
      await checkStep(
        db,
        { id: step.card_id, author_user_id: step.author_user_id, title: step.card_title },
        step,
        null,
        false
      )
    } catch (error) {
      console.error('approval poll', step.id, error.message)
      await writeCheckLog(
        db,
        { id: step.card_id, title: step.card_title },
        step,
        `Проверка прервалась: ${error.message || 'неизвестная ошибка'}`
      )
    }
  }
  await notifyDeadlines(db)
}

async function listCheckLogs(db, userId) {
  const role = await db.query(
    `SELECT r.name AS role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [userId]
  )
  if (role.rows[0]?.role_name !== 'Администратор') return { admin: false, rows: [] }
  const result = await db.query(
    `SELECT id, card_id, step_id, card_title, step_title, reason, repeat_count, created_at, updated_at
     FROM approval_check_logs
     ORDER BY updated_at DESC
     LIMIT 200`
  )
  return { admin: true, rows: result.rows }
}

async function saveTemplate(db, payload) {
  const userId = Number(payload.userId)
  const official = payload.scope === 'official'
  const access = await publisherAccess(db, userId)
  if (official && access.missingDepartment) {
    const error = new Error('У руководителя не указан отдел, общий шаблон сохранить нельзя')
    error.status = 400
    throw error
  }
  if (official && !access.canOfficial) {
    const error = new Error('Общий шаблон сохраняет администратор, директор или руководитель отдела')
    error.status = 403
    throw error
  }
  const title = clean(payload.title)
  if (!title) {
    const error = new Error('Укажите название шаблона')
    error.status = 400
    throw error
  }
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const template = await client.query(
      `INSERT INTO approval_templates (scope, owner_user_id, department_id, title, hint, is_published)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [official ? 'official' : 'personal', userId, official ? access.departmentId : null, title, clean(payload.hint), official]
    )
    await writeTemplateChildren(client, template.rows[0].id, payload)
    await client.query('COMMIT')
    emitTemplatesChanged()
    return template.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function writeTemplateChildren(client, templateId, payload) {
  for (const [index, field] of (payload.fields || []).entries()) {
    await client.query(
      `INSERT INTO approval_template_fields (template_id, sort_order, field_key, label, field_type, required, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [templateId, index, field.fieldKey || `field_${index}`, field.label || 'Поле', field.fieldType || 'text', Boolean(field.required), JSON.stringify(field.config || {})]
    )
  }
  for (const [index, raw] of (payload.steps || []).entries()) {
    const step = normalizeStep(raw, index)
    const inserted = await client.query(
      `INSERT INTO approval_template_steps (
         template_id, sort_order, step_kind, title, assignee_mode, assignee_user_ids, department_id,
         role_name, position_id, quorum, deadline_hours, on_reject, return_to_sort_order,
         allow_manual_close, external_match, enter_rule
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        templateId, step.sort_order, step.step_kind, step.title, step.assignee_mode, step.assignee_user_ids,
        step.department_id, step.role_name, step.position_id, step.quorum, step.deadline_hours, step.on_reject,
        step.return_to_sort_order, step.allow_manual_close, step.external_match,
        step.enter_rule ? JSON.stringify(step.enter_rule) : null,
      ]
    )
    for (const [checkIndex, check] of step.checks.entries()) {
      await client.query(
        `INSERT INTO approval_template_checks (template_step_id, sort_order, source, check_code, params, order_field_key)
         VALUES ($1, $2, 'altawin', $3, $4, $5)`,
        [inserted.rows[0].id, checkIndex, check.code || check.check_code, JSON.stringify(check.params || {}), step.order_field_key]
      )
    }
  }
}

async function ownedTemplate(db, templateId, userId) {
  const template = await db.query(`SELECT * FROM approval_templates WHERE id = $1`, [templateId])
  const row = template.rows[0]
  if (!row) {
    const error = new Error('Шаблон не найден')
    error.status = 404
    throw error
  }
  if (Number(row.owner_user_id) !== Number(userId)) {
    const error = new Error('Шаблон может менять только его автор')
    error.status = 403
    throw error
  }
  return row
}

function templateScope(payload, access) {
  const official = payload.scope === 'official'
  if (official && access.missingDepartment) {
    const error = new Error('У руководителя не указан отдел, общий шаблон сохранить нельзя')
    error.status = 400
    throw error
  }
  if (official && !access.canOfficial) {
    const error = new Error('Общий шаблон сохраняет администратор, директор или руководитель отдела')
    error.status = 403
    throw error
  }
  const title = clean(payload.title)
  if (!title) {
    const error = new Error('Укажите название шаблона')
    error.status = 400
    throw error
  }
  return { official, title }
}

async function updateTemplate(db, templateId, payload) {
  const userId = Number(payload.userId)
  await ownedTemplate(db, templateId, userId)
  const access = await publisherAccess(db, userId)
  const { official, title } = templateScope(payload, access)
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const template = await client.query(
      `UPDATE approval_templates
       SET scope = $2, department_id = $3, title = $4, hint = $5, is_published = $6, updated_at = NOW()
       WHERE id = $1 AND owner_user_id = $7
       RETURNING *`,
      [templateId, official ? 'official' : 'personal', official ? access.departmentId : null, title, clean(payload.hint), official, userId]
    )
    if (!template.rows[0]) {
      const error = new Error('Шаблон может менять только его автор')
      error.status = 403
      throw error
    }
    await client.query(`DELETE FROM approval_template_fields WHERE template_id = $1`, [templateId])
    await client.query(`DELETE FROM approval_template_steps WHERE template_id = $1`, [templateId])
    await writeTemplateChildren(client, templateId, payload)
    await client.query('COMMIT')
    emitTemplatesChanged()
    return template.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function deleteTemplate(db, templateId, userId) {
  await ownedTemplate(db, templateId, userId)
  const removed = await db.query(
    `DELETE FROM approval_templates WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
    [templateId, userId]
  )
  if (!removed.rows[0]) {
    const error = new Error('Шаблон может менять только его автор')
    error.status = 403
    throw error
  }
  emitTemplatesChanged()
  return { ok: true }
}

async function listTemplates(db, userId) {
  const access = await publisherAccess(db, userId)
  const result = await db.query(
    `SELECT t.*, TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS owner_name
     FROM approval_templates t
     JOIN users u ON u.id = t.owner_user_id
     WHERE t.owner_user_id = $1
        OR (
          t.scope = 'official'
          AND t.is_published = true
          AND (
            t.department_id IS NULL
            OR t.department_id = (SELECT department_id FROM users WHERE id = $1)
          )
        )
     ORDER BY t.scope, t.title`,
    [userId]
  )
  return {
    templates: result.rows,
    canOfficial: access.canOfficial,
    officialForAll: access.officialForAll,
  }
}

async function getTemplate(db, templateId, userId) {
  const template = await db.query(`SELECT * FROM approval_templates WHERE id = $1`, [templateId])
  const row = template.rows[0]
  if (!row) {
    const error = new Error('Шаблон не найден')
    error.status = 404
    throw error
  }
  if (!(await canSeeTemplate(db, row, userId))) {
    const error = new Error('Этот шаблон вам не доступен')
    error.status = 403
    throw error
  }
  const [fields, steps] = await Promise.all([
    db.query(`SELECT * FROM approval_template_fields WHERE template_id = $1 ORDER BY sort_order, id`, [templateId]),
    db.query(
      `SELECT s.*, COALESCE(json_agg(c ORDER BY c.sort_order) FILTER (WHERE c.id IS NOT NULL), '[]') AS checks
       FROM approval_template_steps s
       LEFT JOIN approval_template_checks c ON c.template_step_id = s.id
       WHERE s.template_id = $1
       GROUP BY s.id
       ORDER BY s.sort_order, s.id`,
      [templateId]
    ),
  ])
  return { template: row, fields: fields.rows, steps: steps.rows }
}

function httpError(message, status) {
  const error = new Error(message)
  error.status = status
  return error
}

async function approvedAuthorCard(db, cardId, userId) {
  const result = await db.query(`SELECT * FROM approval_cards WHERE id = $1`, [cardId])
  const card = result.rows[0]
  if (!card) throw httpError('Заявка не найдена', 404)
  if (Number(card.author_user_id) !== Number(userId)) throw httpError('Это делает автор согласования', 403)
  if (card.status !== 'approved') throw httpError('Это доступно после успешного завершения', 400)
  return card
}

async function setAuthorDone(db, cardId, userId, done) {
  await approvedAuthorCard(db, cardId, userId)
  const stamp = done ? new Date() : null
  await db.query(`UPDATE approval_cards SET author_done_at = $2 WHERE id = $1`, [cardId, stamp])
  return { authorDoneAt: stamp }
}

async function setAuthorNote(db, cardId, userId, note) {
  await approvedAuthorCard(db, cardId, userId)
  const text = clean(note).slice(0, 2000)
  await db.query(`UPDATE approval_cards SET author_note = $2 WHERE id = $1`, [cardId, text || null])
  return { note: text }
}

async function linkCard(db, cardId, userId, payload) {
  await approvedAuthorCard(db, cardId, userId)
  const taskId = Number(payload.taskId) || null
  const globalTaskId = Number(payload.globalTaskId) || null
  if (!taskId && !globalTaskId) throw httpError('Укажите задачу или проект', 400)
  if (taskId && globalTaskId) throw httpError('Задачу и проект прикрепляют по отдельности', 400)
  if (taskId) {
    const task = await db.query(`SELECT id, created_by FROM tasks WHERE id = $1`, [taskId])
    if (!task.rows[0]) throw httpError('Задача не найдена', 404)
    if (Number(task.rows[0].created_by) !== Number(userId)) throw httpError('Прикрепить можно задачу, которую создали вы', 403)
    const exists = await db.query(
      `SELECT id FROM approval_card_links WHERE card_id = $1 AND task_id IS NOT NULL`,
      [cardId]
    )
    if (exists.rows[0]) throw httpError('Из этого согласования задача уже создана', 400)
    await db.query(
      `INSERT INTO approval_card_links (card_id, task_id, created_by) VALUES ($1, $2, $3)`,
      [cardId, taskId, userId]
    )
    return { taskId, globalTaskId: null }
  }
  const project = await db.query(`SELECT id, created_by FROM global_tasks WHERE id = $1`, [globalTaskId])
  if (!project.rows[0]) throw httpError('Проект не найден', 404)
  if (Number(project.rows[0].created_by) !== Number(userId)) throw httpError('Прикрепить можно проект, который создали вы', 403)
  const exists = await db.query(
    `SELECT id FROM approval_card_links WHERE card_id = $1 AND global_task_id IS NOT NULL`,
    [cardId]
  )
  if (exists.rows[0]) throw httpError('Из этого согласования проект уже создан', 400)
  await db.query(
    `INSERT INTO approval_card_links (card_id, global_task_id, created_by) VALUES ($1, $2, $3)`,
    [cardId, globalTaskId, userId]
  )
  return { taskId: null, globalTaskId }
}

function idListParam(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',')
  return [...new Set(source.map(Number).filter((id) => id > 0))].slice(0, 200)
}

async function marksForTargets(db, userId, taskIds, globalTaskIds) {
  const tasks = idListParam(taskIds)
  const projects = idListParam(globalTaskIds)
  if (!tasks.length && !projects.length) return []
  const result = await db.query(
    `SELECT l.task_id, l.global_task_id, c.title, c.body, c.finished_at, c.author_done_at,
            COALESCE(ap.approvers, '[]'::json) AS approvers
     FROM approval_card_links l
     JOIN approval_cards c ON c.id = l.card_id AND c.status = 'approved'
     LEFT JOIN LATERAL (
       SELECT json_agg(
         json_build_object(
           'name', TRIM(CONCAT(u.first_name, ' ', u.last_name)),
           'stepTitle', s.title,
           'decidedAt', a.decided_at,
           'insteadOf', CASE
             WHEN a.is_substitute AND covered.id IS NOT NULL
               THEN NULLIF(TRIM(CONCAT(covered.first_name, ' ', covered.last_name)), '')
             ELSE NULL
           END
         )
         ORDER BY s.sort_order, a.decided_at NULLS LAST, a.id
       ) AS approvers
       FROM approval_card_steps s
       JOIN approval_card_step_assignees a ON a.step_id = s.id AND a.decision = 'approved'
       JOIN users u ON u.id = a.user_id
       LEFT JOIN users covered ON covered.id = a.covers_user_id
       WHERE s.card_id = c.id AND s.step_kind = 'decision'
     ) ap ON true
     WHERE (
       l.task_id = ANY($1::int[])
       AND (
         EXISTS (SELECT 1 FROM tasks t WHERE t.id = l.task_id AND t.created_by = $3)
         OR EXISTS (SELECT 1 FROM task_assignments a WHERE a.task_id = l.task_id AND a.user_id = $3)
         OR EXISTS (SELECT 1 FROM task_approvals a WHERE a.task_id = l.task_id AND a.approver_id = $3)
         OR EXISTS (SELECT 1 FROM task_visibility v WHERE v.task_id = l.task_id AND v.user_id = $3)
       )
     ) OR (
       l.global_task_id = ANY($2::int[])
       AND (
         EXISTS (SELECT 1 FROM global_tasks g WHERE g.id = l.global_task_id AND g.created_by = $3)
         OR EXISTS (SELECT 1 FROM global_task_responsibles r WHERE r.global_task_id = l.global_task_id AND r.user_id = $3)
       )
     )`,
    [tasks.length ? tasks : [0], projects.length ? projects : [0], userId]
  )
  return result.rows.map((row) => ({
    taskId: row.task_id ? Number(row.task_id) : null,
    globalTaskId: row.global_task_id ? Number(row.global_task_id) : null,
    title: row.title,
    body: row.body || '',
    finishedAt: row.finished_at,
    authorDoneAt: row.author_done_at,
    approvers: approverList(row.approvers),
  }))
}

function secondsBetween(from, to) {
  if (!from || !to) return null
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.round(ms / 1000)
}

function averageSeconds(values) {
  const nums = values.filter((value) => value != null)
  if (!nums.length) return null
  return Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length)
}

function countNames(map) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'))
}

async function approvalStats(db, query) {
  const dateFrom = clean(query.dateFrom)
  const dateTo = clean(query.dateTo)
  const departmentId = Number(query.departmentId) || null
  const userId = Number(query.userId) || null
  const params = []
  const where = [`c.status <> 'draft'`]
  if (dateFrom) {
    params.push(dateFrom)
    where.push(`COALESCE(c.started_at, c.created_at) >= $${params.length}::date`)
  }
  if (dateTo) {
    params.push(dateTo)
    where.push(`COALESCE(c.started_at, c.created_at) < ($${params.length}::date + interval '1 day')`)
  }
  if (departmentId) {
    params.push(departmentId)
    where.push(`u.department_id = $${params.length}`)
  }
  if (userId) {
    params.push(userId)
    where.push(`(
      c.author_user_id = $${params.length}
      OR EXISTS (
        SELECT 1 FROM approval_card_steps sx
        JOIN approval_card_step_assignees ax ON ax.step_id = sx.id
        WHERE sx.card_id = c.id AND ax.user_id = $${params.length} AND ax.decision IS NOT NULL
      )
    )`)
  }
  const cards = await db.query(
    `SELECT c.id, c.title, c.source, c.status, c.template_id, c.template_title,
            t.title AS live_title, c.started_at, c.finished_at, c.created_at,
            TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS author_name,
            COALESCE(d.name, 'Без отдела') AS author_department
     FROM approval_cards c
     JOIN users u ON u.id = c.author_user_id
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN approval_templates t ON t.id = c.template_id
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(c.started_at, c.created_at) DESC`,
    params
  )
  const ids = cards.rows.map((row) => row.id)
  const steps = ids.length
    ? await db.query(
      `SELECT s.card_id, s.id, s.sort_order, s.title, s.step_kind, s.acted_at, s.status,
              a.user_id, a.decision, a.decided_at,
              TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS person_name,
              COALESCE(dep.name, 'Без отдела') AS department_name
       FROM approval_card_steps s
       LEFT JOIN approval_card_step_assignees a ON a.step_id = s.id AND a.decision IS NOT NULL
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       WHERE s.card_id = ANY($1::int[])
       ORDER BY s.card_id, s.sort_order, s.id, a.decided_at`,
      [ids]
    )
    : { rows: [] }
  const stepsByCard = new Map()
  steps.rows.forEach((row) => {
    if (!stepsByCard.has(row.card_id)) stepsByCard.set(row.card_id, [])
    stepsByCard.get(row.card_id).push(row)
  })

  const groups = new Map()
  const summarySeconds = []
  const summary = { launched: 0, approved: 0, rejected: 0, running: 0, cancelled: 0, avgSeconds: null }

  cards.rows.forEach((card) => {
    summary.launched += 1
    if (card.status === 'approved') summary.approved += 1
    else if (card.status === 'rejected') summary.rejected += 1
    else if (card.status === 'running') summary.running += 1
    else if (card.status === 'cancelled') summary.cancelled += 1
    const cardSeconds = secondsBetween(card.started_at || card.created_at, card.finished_at)
    if ((card.status === 'approved' || card.status === 'rejected') && cardSeconds != null) summarySeconds.push(cardSeconds)

    const free = card.source === 'free' || (!card.template_id && !card.template_title && card.source !== 'official' && card.source !== 'personal')
    const title = free ? 'Свободное' : (card.live_title || card.template_title || 'Удалённый шаблон')
    const key = free ? 'free' : (card.template_id ? `id:${card.template_id}` : `title:${title}`)
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title,
        free,
        launched: 0,
        approved: 0,
        rejected: 0,
        running: 0,
        cancelled: 0,
        seconds: [],
        lastStartedAt: null,
        authors: new Map(),
        departments: new Map(),
        steps: new Map(),
        cards: [],
      })
    }
    const group = groups.get(key)
    group.launched += 1
    if (card.status === 'approved') group.approved += 1
    else if (card.status === 'rejected') group.rejected += 1
    else if (card.status === 'running') group.running += 1
    else if (card.status === 'cancelled') group.cancelled += 1
    if ((card.status === 'approved' || card.status === 'rejected') && cardSeconds != null) group.seconds.push(cardSeconds)
    const started = card.started_at || card.created_at
    if (!group.lastStartedAt || new Date(started) > new Date(group.lastStartedAt)) group.lastStartedAt = started
    const author = card.author_name || 'Сотрудник'
    group.authors.set(author, (group.authors.get(author) || 0) + 1)
    group.departments.set(card.author_department, (group.departments.get(card.author_department) || 0) + 1)
    if (group.cards.length < 30) {
      group.cards.push({
        id: card.id,
        title: card.title,
        status: card.status,
        authorName: author,
        departmentName: card.author_department,
        startedAt: started,
        finishedAt: card.finished_at,
        seconds: cardSeconds,
      })
    }

    const cardSteps = stepsByCard.get(card.id) || []
    const seen = []
    let previousClose = card.started_at || card.created_at
    cardSteps.forEach((step) => {
      if (seen.includes(step.id)) return
      seen.push(step.id)
      const openedAt = previousClose
      const same = cardSteps.filter((item) => item.id === step.id)
      const decisions = same.filter((item) => item.decided_at)
      if (step.step_kind === 'external') {
        addStepStat(group, step, 'Событие заказа', 'Альтавин', secondsBetween(openedAt, step.acted_at))
      } else {
        decisions.forEach((item) => {
          addStepStat(group, step, item.person_name || 'Сотрудник', item.department_name || 'Без отдела', secondsBetween(openedAt, item.decided_at))
        })
      }
      if (step.acted_at) previousClose = step.acted_at
    })
  })

  summary.avgSeconds = averageSeconds(summarySeconds)
  const templates = [...groups.values()].map((group) => {
    const steps = [...group.steps.values()]
      .map((step) => ({
        title: step.title,
        personName: step.personName,
        departmentName: step.departmentName,
        count: step.count,
        avgSeconds: averageSeconds(step.seconds),
      }))
      .filter((step) => step.count > 0)
      .sort((a, b) => (b.avgSeconds || 0) - (a.avgSeconds || 0))
    return {
      key: group.key,
      title: group.title,
      free: group.free,
      launched: group.launched,
      approved: group.approved,
      rejected: group.rejected,
      running: group.running,
      cancelled: group.cancelled,
      avgSeconds: averageSeconds(group.seconds),
      lastStartedAt: group.lastStartedAt,
      authors: countNames(group.authors),
      departments: countNames(group.departments),
      slowestStep: steps.find((step) => step.avgSeconds != null) || null,
      steps,
      cards: group.cards,
    }
  }).sort((a, b) => (b.avgSeconds || 0) - (a.avgSeconds || 0) || b.launched - a.launched)

  return { summary, templates }
}

function addStepStat(group, step, personName, departmentName, seconds) {
  if (step.step_kind === 'notice') return
  const key = `${step.sort_order}|${step.title}|${personName}`
  if (!group.steps.has(key)) {
    group.steps.set(key, {
      title: step.title || 'Шаг',
      personName,
      departmentName,
      count: 0,
      seconds: [],
    })
  }
  const stat = group.steps.get(key)
  if (seconds == null) return
  stat.count += 1
  stat.seconds.push(seconds)
}

function approverList(value) {
  const list = Array.isArray(value) ? value : []
  return list.map((person) => ({
    name: person?.name || '',
    stepTitle: person?.stepTitle || '',
    decidedAt: person?.decidedAt || null,
    insteadOf: person?.insteadOf || null,
  }))
}

module.exports = {
  setApprovalIo,
  canPublishOfficial,
  createCard,
  listInbox,
  listMine,
  listCompleted,
  getCard,
  setAuthorDone,
  setAuthorNote,
  linkCard,
  marksForTargets,
  decide,
  manualOrCheck,
  cancelCard,
  addMessage,
  addFile,
  getFile,
  pollExternal,
  listCheckLogs,
  notifyDeadlines,
  approvalStats,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  getTemplate,
  snapshotText,
}
