/**
 * Узел «Создать проект» (global_task):
 * - prepared: создать проект сразу в register
 * - modal_at_runtime: поставить экземпляр на waiting_user_input и отдать templateData на клиент
 */
const { computeConditionalDeadline } = require('./deadlineUtils')

function getOutgoingEdges(scheme, nodeId) {
  const edges = scheme.edges || []
  return edges.filter((e) => e.source === nodeId)
}

function substituteText(text, context) {
  if (!text || typeof text !== 'string') return text
  let out = text
  const addInfo = context && typeof context === 'object' && context.additional_info && typeof context.additional_info === 'object'
    ? context.additional_info
    : {}
  out = out.replace(/\{доп:([^}]+)\}/gi, (_, kRaw) => {
    const k = String(kRaw || '').trim()
    if (!k) return ''
    const v = addInfo[k]
    if (v === undefined || v === null) return 'false'
    if (typeof v === 'string') return v.trim() ? v : 'false'
    if (v === false) return 'false'
    return String(v)
  })
  out = out.replace(/\{\{([^}]+)\}\}/g, (_, kRaw) => {
    const k = String(kRaw || '').trim()
    if (!k) return ''
    const v = addInfo[k]
    if (v === undefined || v === null) return ''
    if (typeof v === 'string') return v.trim()
    if (v === false) return ''
    return String(v)
  })
  return out
}

function normalizeAdditionalInfo(items) {
  const list = Array.isArray(items) ? items : []
  const out = {}
  for (const it of list) {
    const k = String(it?.key || '').trim()
    if (!k) continue
    const vRaw = it?.value
    const v = vRaw == null ? '' : String(vRaw)
    out[k] = v
  }
  return out
}

async function handle(instance, node, scheme, integrations, dbPool) {
  const { registerClient: reg } = integrations
  const settings = node.settings || {}
  const context = typeof instance.context === 'object' ? instance.context : (instance.context ? JSON.parse(instance.context) : {})

  const createMode = settings.createMode || 'prepared'
  const createdBy = context.initiator_id || instance.launched_by_user_id || null
  if (!createdBy) return { fail: 'Создать проект: не определён created_by (initiator_id)' }

  if (createMode === 'modal_at_runtime') {
    let templateDeadline = null
    if (settings.deadlineMode === 'fixed' && settings.deadline) {
      const dt = new Date(settings.deadline)
      if (Number.isFinite(dt.getTime())) templateDeadline = dt.toISOString()
    } else if (settings.deadlineMode === 'conditional') {
      const def = { boundary: '12:00', sameDayTime: '18:00', nextDayTime: '16:00' }
      const raw = settings.conditionalDeadline || {}
      const rule = {
        boundary: raw.boundary ?? def.boundary,
        sameDayTime: raw.sameDayTime ?? raw.same_day_time ?? def.sameDayTime,
        nextDayTime: raw.nextDayTime ?? raw.next_day_time ?? def.nextDayTime,
      }
      templateDeadline = computeConditionalDeadline(rule)
    }
    const templateResponsibles = (Array.isArray(settings.responsibles) ? settings.responsibles : [])
      .filter((r) => r && r.id != null)
      .map((r) => ({ id: r.id, role: r.role || 'Исполнитель', requires_approval: !!r.requires_approval }))
    const templateData = {
      title: substituteText(settings.title || 'Проект из бизнес‑процесса', context),
      description: substituteText(settings.description || '', context),
      goals: Array.isArray(settings.goals) ? settings.goals.map((x) => substituteText(String(x || ''), context)).filter((x) => x.trim()) : [],
      deadline: templateDeadline,
      priority: settings.priority || 'medium',
      additionalInfo: Array.isArray(settings.additionalInfo) ? settings.additionalInfo : [],
      responsibles: templateResponsibles,
    }
    const pending = { nodeId: node.id, type: 'create_project', templateData }
    const newContext = { ...context, pending_project_creation: pending }
    await dbPool.query(
      'UPDATE bp_process_instances SET context = $1, status = $2 WHERE id = $3',
      [JSON.stringify(newContext), 'waiting_user_input', instance.id]
    )
    return { waitUserInput: true }
  }

  const title = substituteText(settings.title || 'Проект из бизнес‑процесса', context)
  const description = substituteText(settings.description || '', context)
  const goals = Array.isArray(settings.goals) ? settings.goals.map((x) => substituteText(String(x || ''), context)).filter((x) => x.trim()) : []
  let deadline = null
  if (settings.deadlineMode === 'fixed' && settings.deadline) {
    const dt = new Date(settings.deadline)
    if (Number.isFinite(dt.getTime())) deadline = dt.toISOString()
  } else if (settings.deadlineMode === 'conditional') {
    const def = { boundary: '12:00', sameDayTime: '18:00', nextDayTime: '16:00' }
    const raw = settings.conditionalDeadline || {}
    const rule = {
      boundary: raw.boundary ?? def.boundary,
      sameDayTime: raw.sameDayTime ?? raw.same_day_time ?? def.sameDayTime,
      nextDayTime: raw.nextDayTime ?? raw.next_day_time ?? def.nextDayTime,
    }
    deadline = computeConditionalDeadline(rule)
  }
  const priority = settings.priority || 'medium'
  const additionalInfo = normalizeAdditionalInfo(settings.additionalInfo)
  const responsiblesRaw = Array.isArray(settings.responsibles) ? settings.responsibles : []
  const responsibles = responsiblesRaw
    .filter((r) => r && r.id != null)
    .map((r) => ({
      id: r.id,
      role: r.role || 'Исполнитель',
      requires_approval: !!r.requires_approval,
    }))

  let created
  try {
    created = await reg.createGlobalTask({
      title,
      description,
      goals,
      deadline: deadline || null,
      priority,
      additionalInfo,
      responsibles,
      created_by: createdBy,
    })
  } catch (e) {
    return { fail: `Создать проект: не удалось создать проект в register: ${e?.message || 'ошибка'}` }
  }

  const projectId = created?.taskId || created?.id || null
  if (!projectId) return { fail: 'Создать проект: register не вернул taskId' }

  const projectOutputs = context.project_outputs && typeof context.project_outputs === 'object' ? context.project_outputs : {}
  projectOutputs[node.id] = { global_task_id: Number(projectId) || projectId }

  const addInfo = context.additional_info && typeof context.additional_info === 'object' ? context.additional_info : {}
  const nextAddInfo = { ...addInfo, project_id: Number(projectId) || projectId }

  const newContext = {
    ...context,
    additional_info: nextAddInfo,
    project_outputs: projectOutputs,
    last_global_task_id: Number(projectId) || projectId,
  }
  await dbPool.query('UPDATE bp_process_instances SET context = $1 WHERE id = $2', [JSON.stringify(newContext), instance.id])

  const edges = getOutgoingEdges(scheme, node.id)
  const nextEdge = edges[0]
  if (!nextEdge) return { fail: 'У узла «Создать проект» нет исходящего ребра' }
  return { nextNodeId: nextEdge.target }
}

module.exports = { handle }

