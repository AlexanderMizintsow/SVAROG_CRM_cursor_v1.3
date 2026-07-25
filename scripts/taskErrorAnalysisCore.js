const fs = require('fs')
const path = require('path')
const { Pool } = require('../server/CRM-server/node_modules/pg')
const ROOT = path.join(__dirname, '..')
const ODT_PATH = path.join(ROOT, 'Ошибки которые прислали.odt')

const PERIOD_START = '2026-05-01'
const PERIOD_END = '2026-08-01'

const EXCLUDE_TITLE_PATTERNS = [
  /тестов/i,
  /заполнить таблицу по платежам/i,
  /сверка по доставкам/i,
  /сверки клиентам/i,
  /оповестить по\s*доставкам/i,
]

const ERROR_KEYWORDS_EXPLICIT = [
  'ошиб', 'неправиль', 'невер', 'не верн', 'исправ', 'передел', 'не так',
  'не работ', 'баг', 'слом', 'не посчит', 'не рассчит', 'выбил', 'опять',
  'снова', 'остал', 'не исправ', 'сохраняет', 'регресс',
]

const CATEGORY_RULES = [
  { id: 'lamination', name: 'Ламинация / плёнка', patterns: [/ламин/i, /пленк/i, /плёнк/i, /бел(ая|ой|ую)/i, /90\s*мм/i, /60\s*мм/i, /160\s*мм/i, /KDB/i, /DJ\d/i] },
  { id: 'drive', name: 'Приводы (500-660 / 661-1160)', patterns: [/привод/i, /500.?660/i, /661.?1160/i] },
  { id: 'powder', name: 'Порошковая покраска', patterns: [/порошков/i, /покраск/i, /RAL/i] },
  { id: 'planks', name: 'Ответные планки', patterns: [/ответн/i, /планк/i] },
  { id: 'hardware', name: 'Фурнитура', patterns: [/фурнитур/i, /GE\b/i, /РОТО/i, /ROTO/i, /РЕЗЕ/i, /REZE/i, /цапф/i, /петл/i, /нажимн/i, /наж.?гар/i, /ручк/i, /цилиндр/i, /окрашен/i, /неокрашен/i] },
  { id: 'sandwich', name: 'Сэндвич / заполнение', patterns: [/сэндвич/i, /сендвич/i, /sandwich/i, /штапик/i, /заполнен/i] },
  { id: 'settings', name: 'Выгрузка настроек дилерам', patterns: [/настро/i, /выгруз/i, /скрипт/i, /дилер/i] },
  { id: 'pricing', name: 'Цены / удорожание', patterns: [/цен/i, /удорож/i, /стоимост/i, /тариф/i] },
  { id: 'profile', name: 'Профиль / артикулы', patterns: [/профил/i, /артикул/i, /армирован/i, /соединител/i] },
  { id: 'other', name: 'Прочее', patterns: [] },
]

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'Svarog',
  password: 'postgres',
  port: 5432,
})

function stripHtml(text) {
  if (!text) return ''
  return String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeText(text) {
  return stripHtml(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

const FALSE_ORDER_NUMS = new Set(['2026', '2025', '1000', '792', '214', '466', '4661', '46618'])

function extractOrderNumbers(text) {
  const nums = new Set()
  const src = stripHtml(text)
  const patterns = [
    /заказ[аеу]?\s*(?:№|#)?\s*(\d[\d\s]{3,6})/gi,
    /ошибк[аи]\s*(\d[\d\s]{3,6})/gi,
    /сч[её]т[-\s]*(\d+)/gi,
    /№\s*(\d{4,6})/gi,
    /\b(\d{1,2}\s+\d{4,5})\b/g,
  ]
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      const n = m[1].replace(/\s+/g, '')
      if (n.length >= 4 && n.length <= 6 && !FALSE_ORDER_NUMS.has(n)) nums.add(n)
    }
  }
  // Номер в начале названия: "14530 ..." или "15 430"
  const titleLike = src.match(/^(\d[\d\s]{3,6})\b/)
  if (titleLike) {
    const n = titleLike[1].replace(/\s+/g, '')
    if (n.length >= 4 && !FALSE_ORDER_NUMS.has(n)) nums.add(n)
  }
  return [...nums]
}

function formatDate(d) {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleString('ru-RU', { timeZone: 'Europe/Samara', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function categorize(text) {
  const t = stripHtml(text)
  for (const rule of CATEGORY_RULES) {
    if (rule.id === 'other') continue
    if (rule.patterns.some((p) => p.test(t))) return rule
  }
  return CATEGORY_RULES.find((r) => r.id === 'other')
}

function hasExplicitError(text) {
  const n = normalizeText(text)
  return ERROR_KEYWORDS_EXPLICIT.some((k) => n.includes(k))
}

function isExcluded(title) {
  return EXCLUDE_TITLE_PATTERNS.some((p) => p.test(title || ''))
}

function parseOdtReclamations() {
  if (!fs.existsSync(ODT_PATH)) return []
  const contentXml = extractOdtContent(ODT_PATH)
  const fullText = contentXml
    .replace(/<text:line-break\/>/g, '\n')
    .replace(/<[^>]+>/g, '')

  const items = []
  const chunks = fullText.split(/(?=\d{2}\s+(?:мая|июня|июля))/i)
  for (const chunk of chunks) {
    const dateMatch = chunk.match(/^(\d{2})\s+(мая|июня|июля)/i)
    if (!dateMatch) continue
    const dateLabel = `${dateMatch[1]} ${dateMatch[2]} 2026`
    const body = chunk.slice(dateMatch[0].length)
    const entries = body.split(/(?=рекл\s*\d+)/i).filter((s) => /заказ/i.test(s))
    for (const entry of entries) {
      const om = entry.match(/заказ\s*([\d\s]+)\s*[—\-]\s*(.+)/is)
      if (!om) continue
      const orderNo = om[1].replace(/\s+/g, '')
      let description = om[2]
        .replace(/рекл\s*\d+/gi, '')
        .replace(/\d{2}\s+(?:мая|июня|июля).*/i, '')
        .trim()
      if (!orderNo || !description || orderNo.length < 4) continue
      items.push({ dateLabel, orderNo, description, category: categorize(description).name, source: 'ODT' })
    }
  }

  const seen = new Set()
  return items.filter((it) => {
    const k = `${it.orderNo}|${it.description.slice(0, 40)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function extractOdtContent(odtPath) {
  // Use PowerShell from node on Windows
  const { execSync } = require('child_process')
  const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('${odtPath.replace(/'/g, "''")}')
$entry = $zip.Entries | Where-Object { $_.FullName -eq 'content.xml' }
$reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
$text = $reader.ReadToEnd()
$reader.Close(); $zip.Dispose()
[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Output $text
`
  try {
    return execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })
  } catch (e) {
    console.warn('ODT parse failed:', e.message)
    return ''
  }
}

function tryRequire(name) {
  try { return require(name) } catch { return null }
}

function userName(u) {
  if (!u) return ''
  return [u.last_name, u.first_name, u.middle_name].filter(Boolean).join(' ').trim() || u.username || ''
}

function jaccardWords(a, b) {
  const wa = new Set(normalizeText(a).split(' ').filter((w) => w.length > 2))
  const wb = new Set(normalizeText(b).split(' ').filter((w) => w.length > 2))
  if (!wa.size || !wb.size) return 0
  let inter = 0
  for (const w of wa) if (wb.has(w)) inter++
  return inter / (wa.size + wb.size - inter)
}

async function loadUsers() {
  const r = await pool.query(`SELECT id, first_name, last_name, middle_name, username FROM users`)
  const byId = {}
  for (const u of r.rows) byId[u.id] = u
  return byId
}

async function loadTasks(usersById, mizintsovId) {
  const r = await pool.query(`
    SELECT t.*,
      cb.first_name AS creator_first, cb.last_name AS creator_last, cb.middle_name AS creator_middle, cb.username AS creator_username,
      gt.title AS project_title
    FROM tasks t
    LEFT JOIN users cb ON cb.id = t.created_by
    LEFT JOIN global_tasks gt ON gt.id = t.global_task_id
    WHERE t.created_at >= $1 AND t.created_at < $2
    ORDER BY t.created_at
  `, [PERIOD_START, PERIOD_END])

  const assignRes = await pool.query(`
    SELECT ta.task_id, array_agg(ta.user_id) AS assignee_ids
    FROM task_assignments ta
    JOIN tasks t ON t.id = ta.task_id
    WHERE t.created_at >= $1 AND t.created_at < $2
    GROUP BY ta.task_id
  `, [PERIOD_START, PERIOD_END])
  const assignMap = Object.fromEntries(assignRes.rows.map((x) => [x.task_id, x.assignee_ids]))

  const tasks = []
  for (const row of r.rows) {
    if (isExcluded(row.title)) continue
    const creator = userName({
      first_name: row.creator_first,
      last_name: row.creator_last,
      middle_name: row.creator_middle,
      username: row.creator_username,
    })
    const assigneeIds = assignMap[row.id] || []
    const assignees = assigneeIds.map((id) => userName(usersById[id])).filter(Boolean).join('; ')
    const isMizintsov = assigneeIds.includes(mizintsovId)
    tasks.push({
      type: 'task',
      id: row.id,
      title: row.title,
      description: stripHtml(row.description),
      descriptionRaw: row.description,
      created_at: row.created_at,
      status: row.status,
      global_task_id: row.global_task_id,
      project_title: row.project_title,
      creator,
      creator_id: row.created_by,
      assignees,
      assignee_ids: assigneeIds,
      is_mizintsov_executor: isMizintsov,
      order_numbers: extractOrderNumbers(`${row.title} ${row.description}`),
    })
  }
  return tasks
}

async function loadProjects(usersById, mizintsovId) {
  const r = await pool.query(`
    SELECT g.*,
      cb.first_name AS creator_first, cb.last_name AS creator_last, cb.middle_name AS creator_middle, cb.username AS creator_username
    FROM global_tasks g
    LEFT JOIN users cb ON cb.id = g.created_by
    WHERE g.created_at >= $1 AND g.created_at < $2
    ORDER BY g.created_at
  `, [PERIOD_START, PERIOD_END])

  const respRes = await pool.query(`
    SELECT gtr.global_task_id, array_agg(gtr.user_id) AS resp_ids, array_agg(gtr.role) AS roles
    FROM global_task_responsibles gtr
    JOIN global_tasks g ON g.id = gtr.global_task_id
    WHERE g.created_at >= $1 AND g.created_at < $2
    GROUP BY gtr.global_task_id
  `, [PERIOD_START, PERIOD_END])
  const respMap = Object.fromEntries(respRes.rows.map((x) => [x.global_task_id, x]))

  const projects = []
  for (const row of r.rows) {
    if (isExcluded(row.title)) continue
    const creator = userName({
      first_name: row.creator_first,
      last_name: row.creator_last,
      middle_name: row.creator_middle,
      username: row.creator_username,
    })
    const resp = respMap[row.id]
    const respIds = resp?.resp_ids || []
    const responsibles = respIds.map((id) => userName(usersById[id])).filter(Boolean).join('; ')
    projects.push({
      type: 'project',
      id: row.id,
      title: row.title,
      description: stripHtml(row.description),
      created_at: row.created_at,
      status: row.status,
      creator,
      creator_id: row.created_by,
      responsibles,
      responsible_ids: respIds,
      is_mizintsov_executor: respIds.includes(mizintsovId),
      order_numbers: extractOrderNumbers(`${row.title} ${row.description}`),
    })
  }
  return projects
}

async function loadTaskMessages(taskIds) {
  if (!taskIds.length) return {}
  const r = await pool.query(`
    SELECT m.*, u.first_name, u.last_name, u.username
    FROM messages_task m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.task_id = ANY($1::int[])
    ORDER BY m.timestamp
  `, [taskIds])
  const map = {}
  for (const row of r.rows) {
    if (!map[row.task_id]) map[row.task_id] = []
    map[row.task_id].push({
      text: stripHtml(row.text),
      timestamp: row.timestamp,
      sender: userName(row),
      sender_id: row.sender_id,
      explicit_error: hasExplicitError(row.text),
    })
  }
  return map
}

async function loadProjectMessages(projectIds) {
  if (!projectIds.length) return {}
  const r = await pool.query(`
    SELECT m.*, u.first_name, u.last_name, u.username
    FROM global_task_chat_messages m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.global_task_id = ANY($1::int[])
    ORDER BY m.timestamp
  `, [projectIds])
  const map = {}
  for (const row of r.rows) {
    if (!map[row.global_task_id]) map[row.global_task_id] = []
    map[row.global_task_id].push({
      text: stripHtml(row.text),
      timestamp: row.timestamp,
      sender: userName(row),
      sender_id: row.user_id,
      explicit_error: hasExplicitError(row.text),
    })
  }
  return map
}

async function loadTaskHistory(taskIds) {
  if (!taskIds.length) return {}
  const r = await pool.query(`
    SELECT th.*, u.first_name, u.last_name
    FROM task_history th
    LEFT JOIN users u ON u.id = th.changed_by
    WHERE th.task_id = ANY($1::int[])
    ORDER BY th.change_timestamp
  `, [taskIds])
  const map = {}
  for (const row of r.rows) map[row.task_id] = map[row.task_id] || [], map[row.task_id].push(row)
  return map
}

async function loadDescHistory(taskIds) {
  if (!taskIds.length) return {}
  const r = await pool.query(`
    SELECT * FROM task_description_history
    WHERE task_id = ANY($1::int[])
    ORDER BY updated_at
  `, [taskIds])
  const map = {}
  for (const row of r.rows) map[row.task_id] = map[row.task_id] || [], map[row.task_id].push(row)
  return map
}

function findChains(entities) {
  // Group by order number and similar titles
  const chains = []
  const byOrder = {}
  for (const e of entities) {
    for (const on of e.order_numbers) {
      if (!byOrder[on]) byOrder[on] = []
      byOrder[on].push(e)
    }
  }
  for (const [orderNo, group] of Object.entries(byOrder)) {
    if (group.length < 2) continue
    if (orderNo.length < 4) continue
    group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    chains.push({
      orderNo,
      entities: group,
      type: 'same_order',
      evidence: `По заказу ${orderNo} создано ${group.length} связанных задач/проектов с ${group[0].created_at} по ${group[group.length - 1].created_at}`,
    })
  }

  // Similar title chains without order
  const sorted = [...entities].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      const sim = jaccardWords(a.title, b.title)
      if (sim < 0.35) continue
      const days = (new Date(b.created_at) - new Date(a.created_at)) / 86400000
      if (days > 45) continue
      const sharedOrders = a.order_numbers.filter((o) => b.order_numbers.includes(o))
      if (!sharedOrders.length && sim < 0.5) continue
      chains.push({
        orderNo: sharedOrders[0] || '',
        entities: [a, b],
        type: 'similar_topic',
        evidence: `Похожие темы «${a.title}» (#${a.type === 'task' ? a.id : 'P' + a.id}) → «${b.title}» (#${b.type === 'task' ? b.id : 'P' + b.id}), сходство ${(sim * 100).toFixed(0)}%`,
      })
    }
  }
  return chains
}

function analyzeEntity(entity, messages, descHistory, taskHistory, mizintsovId, allEntities) {
  const msgs = messages || []
  const explicitMsgs = msgs.filter((m) => m.explicit_error)
  const explicitInDesc = hasExplicitError(entity.description)
  const explicitInTitle = hasExplicitError(entity.title)

  const indirect = []
  if (descHistory?.length) {
    indirect.push({
      type: 'description_changed',
      evidence: `Описание менялось ${descHistory.length} раз(а). Последнее изменение: ${descHistory[descHistory.length - 1].updated_at}`,
    })
  }
  if (taskHistory?.length) {
    const fixes = taskHistory.filter((h) => hasExplicitError(h.change_description))
    if (fixes.length) {
      indirect.push({
        type: 'history_fix',
        evidence: fixes.map((f) => stripHtml(f.change_description)).join(' | ').slice(0, 500),
      })
    }
  }
  const fixChat = msgs.filter((m) => /исправ|опять|снова|не исправ|остал/i.test(m.text))
  if (fixChat.length) {
    indirect.push({
      type: 'chat_repeat_fix',
      evidence: fixChat.map((m) => `${m.sender}: ${m.text}`).join(' | ').slice(0, 800),
    })
  }

  // Conflicting: open vs close same feature
  const titleNorm = normalizeText(entity.title)
  const conflicts = []
  for (const other of allEntities) {
    if (other === entity) continue
    const otherNorm = normalizeText(other.title)
    const hasOpen = /открыт|добав/i.test(titleNorm)
    const hasClose = /закрыт|запрет/i.test(titleNorm)
    const otherOpen = /открыт|добав/i.test(otherNorm)
    const otherClose = /закрыт|запрет/i.test(otherNorm)
    if ((hasOpen && otherClose) || (hasClose && otherOpen)) {
      const sim = jaccardWords(entity.title, other.title)
      if (sim > 0.25) {
        conflicts.push({
          other,
          evidence: `Возможный конфликт: «${entity.title}» vs «${other.title}»`,
        })
      }
    }
  }

  const category = categorize(`${entity.title} ${entity.description}`)

  let authorFault = 'не определено'
  let executorNote = ''
  const hasExplicit = explicitInTitle || explicitInDesc || explicitMsgs.length > 0
  const hasIndirect = indirect.length > 0 || conflicts.length > 0

  if (entity.is_mizintsov_executor) {
    if (!hasExplicit && !hasIndirect) {
      executorNote = 'Задача у Мизинцова: явных логических ошибок в постановке не найдено — возможная ошибка исполнения'
      authorFault = 'вероятно исполнитель'
    } else if (hasExplicit || hasIndirect) {
      executorNote = 'Задача у Мизинцова, но в постановке/чате есть признаки ошибки автора'
      authorFault = 'вероятно автор'
    }
  } else if (hasExplicit || hasIndirect) {
    authorFault = 'вероятно автор'
  } else {
    authorFault = 'признаков ошибки постановки нет'
  }

  if (explicitMsgs.some((m) => /не так сделали|не увидел|не понял/i.test(m.text))) {
    authorFault = 'вероятно автор (неполное ТЗ)'
  }
  if (fixChat.some((m) => /тут по задаче уже были исправления|опять/i.test(m.text))) {
    authorFault = 'вероятно автор (повторная ошибка / неполное исправление)'
  }

  return {
    category: category.name,
    explicit_errors: [
      explicitInTitle ? `В названии: ${entity.title}` : null,
      explicitInDesc ? `В описании: ${entity.description.slice(0, 300)}` : null,
      ...explicitMsgs.map((m) => `Чат ${m.timestamp} ${m.sender}: ${m.text.slice(0, 200)}`),
    ].filter(Boolean),
    indirect_signs: [
      ...indirect.map((i) => i.evidence),
      ...conflicts.map((c) => c.evidence),
    ],
    author_fault: authorFault,
    executor_note: executorNote,
    conflict_count: conflicts.length,
  }
}

function findRelatedByTopic(recl, allEntities, mizintsovId) {
  const cat = categorize(recl.description)
  const keywords = recl.description.toLowerCase().split(/\s+/).filter((w) => w.length > 4)
  return allEntities
    .filter((e) => {
      const blob = normalizeText(`${e.title} ${e.description}`)
      const catMatch = categorize(`${e.title} ${e.description}`).id === cat.id
      const kwMatch = keywords.filter((k) => blob.includes(k)).length >= 1
      return catMatch || kwMatch
    })
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(0, 8)
}

function findHandoffChain(task, allTasks, mizintsovId) {
  if (!task.is_mizintsov_executor) return []
  const prior = allTasks.filter((t) => {
    if (t.id === task.id) return false
    if (new Date(t.created_at) > new Date(task.created_at)) return false
    const sim = jaccardWords(t.title, task.title)
    const sharedOrders = t.order_numbers.filter((o) => task.order_numbers.includes(o))
    return sim > 0.25 || sharedOrders.length > 0
  })
  return prior
    .filter((t) => !t.assignee_ids?.includes(mizintsovId))
    .slice(0, 5)
}
function matchReclamationToCrm(recl, tasks, projects) {
  const all = [...tasks, ...projects]
  const matches = all.filter((e) => e.order_numbers.includes(recl.orderNo))
  if (!matches.length) {
    const fuzzy = all.filter((e) => {
      const blob = `${e.title} ${e.description}`
      return new RegExp(`\\b${recl.orderNo}\\b`).test(blob) ||
        new RegExp(recl.orderNo.replace(/(\d{2})(\d{3})/, '$1 $2')).test(blob)
    })
    matches.push(...fuzzy)
  }
  return [...new Map(matches.map((m) => [`${m.type}-${m.id}`, m])).values()]
}


async function loadAnalysisData() {
  const usersById = await loadUsers()
  const mizintsov = Object.values(usersById).find((u) =>
    /мизинцов/i.test(`${u.last_name} ${u.first_name}`) || /mizin/i.test(u.username || '')
  )
  if (!mizintsov) throw new Error('Мизинцов не найден')
  const reclamations = parseOdtReclamations()
  const tasks = await loadTasks(usersById, mizintsov.id)
  const projects = await loadProjects(usersById, mizintsov.id)
  const allEntities = [...tasks, ...projects]
  const taskIds = tasks.map((t) => t.id)
  const projectIds = projects.map((p) => p.id)
  const [taskMsgs, projectMsgs, taskHist, descHist] = await Promise.all([
    loadTaskMessages(taskIds), loadProjectMessages(projectIds), loadTaskHistory(taskIds), loadDescHistory(taskIds),
  ])
  const analyzedTasks = tasks.map((t) => ({
    ...t,
    analysis: analyzeEntity(t, taskMsgs[t.id], descHist[t.id], taskHist[t.id], mizintsov.id, allEntities),
  }))
  const analyzedProjects = projects.map((p) => ({
    ...p,
    analysis: analyzeEntity(p, projectMsgs[p.id], null, null, mizintsov.id, allEntities),
  }))
  return {
    mizintsov, usersById, reclamations, tasks, projects, allEntities,
    analyzedTasks, analyzedProjects,
    analyzedAll: [...analyzedTasks, ...analyzedProjects],
    chains: findChains(allEntities), taskMsgs, projectMsgs, taskHist, descHist,
  }
}
function endPool() { return pool.end() }
module.exports = {
  PERIOD_START, PERIOD_END, stripHtml, normalizeText, extractOrderNumbers, formatDate,
  categorize, hasExplicitError, isExcluded, parseOdtReclamations, userName, jaccardWords,
  loadUsers, loadTasks, loadProjects, loadTaskMessages, loadProjectMessages,
  loadTaskHistory, loadDescHistory, findChains, analyzeEntity, findRelatedByTopic,
  findHandoffChain, matchReclamationToCrm, loadAnalysisData, endPool,
}
