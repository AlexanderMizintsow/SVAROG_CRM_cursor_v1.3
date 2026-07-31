/**
 * База знаний отделов (register :5000).
 *
 * FUTURE / backlog:
 *   Сделать поиск технической информации в области описания задач
 *   (отдельная фича, не часть MVP базы знаний).
 */

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const mime = require('mime-types')
const {
  getActorProfile,
  getHeadDepartmentIds,
} = require('../userStatusPermissions')
const {
  extractTextFromFile,
  buildSearchBlob,
  tokenizeSearchQuery,
} = require('./extractKnowledgeText')
const { notifyDepartmentAboutDocument } = require('./knowledgeNotify')
const {
  mapFileRow,
  loadFilesMap,
  loadFilesCounts,
  insertDocumentFile,
  syncPrimaryFileFromChildren,
  rebuildDocumentSearchText,
  collectUploadFiles,
  archiveFileVersion,
} = require('./knowledgeFolderFiles')

const hashFile = (filePath) => {
  const buf = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

const decodeOriginalName = (reqFile) => {
  const name = reqFile?.originalname || reqFile?.filename
  return fixFilenameEncoding(name)
}

/** Восстановление кириллицы из mojibake (UTF-8, прочитанный как Latin-1). */
const fixFilenameEncoding = (raw) => {
  const name = String(raw || '').trim()
  if (!name) return name
  if (/[\u0400-\u04FF]/.test(name)) return name
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8')
    if (/[\u0400-\u04FF]/.test(decoded)) return decoded
    if (decoded.includes('\uFFFD')) return name
    if (decoded.length !== name.length) return decoded
  } catch (_) {}
  return name
}

/** Имя для БЗ: явная UTF-8 строка из body надёжнее Content-Disposition. */
const resolveUploadFileName = (req) => {
  const fromBody = String(
    req.body?.originalFileName || req.body?.fileName || ''
  ).trim()
  if (fromBody) return fixFilenameEncoding(fromBody)
  if (req.file) return decodeOriginalName(req.file)
  return ''
}

/** Имя файла из multipart при множественной загрузке. */
const resolveUploadFileNameAt = (req, file, index) => {
  let names = req.body?.originalFileNames
  if (typeof names === 'string') {
    try {
      names = JSON.parse(names)
    } catch (_) {
      names = null
    }
  }
  if (Array.isArray(names) && names[index]) {
    return fixFilenameEncoding(String(names[index]))
  }
  if (Number(index) === 0) {
    const single = resolveUploadFileName(req)
    if (single) return single
  }
  return decodeOriginalName(file)
}

/** Сравнение имён файлов без учёта регистра и пути */
const normalizeFileName = (name) =>
  String(name || '')
    .trim()
    .replace(/^.*[\\/]/, '')
    .toLowerCase()

const fileNamesDiffer = (a, b) => {
  const na = normalizeFileName(a)
  const nb = normalizeFileName(b)
  if (!na || !nb) return false
  return na !== nb
}

async function archiveCurrentFileVersion(client, doc) {
  await client.query(
    `INSERT INTO knowledge_document_versions (
      document_id, version_number, file_url, file_name, file_type, file_size, file_hash, search_text, uploaded_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (document_id, version_number) DO NOTHING`,
    [
      doc.id,
      doc.version_number || 1,
      doc.file_url,
      doc.file_name,
      doc.file_type,
      doc.file_size,
      doc.file_hash || null,
      doc.search_text || null,
      doc.updated_by || doc.uploaded_by || null,
    ]
  )
}

async function logDocumentEvent(dbPool, documentId, userId, eventType) {
  try {
    await dbPool.query(
      `INSERT INTO knowledge_document_events (document_id, user_id, event_type)
       VALUES ($1, $2, $3)`,
      [documentId, userId, eventType]
    )
  } catch (error) {
    // таблица может ещё не быть создана — не ломаем скачивание
    if (error && error.code !== '42P01') {
      console.warn('knowledge logDocumentEvent:', error.message)
    }
  }
}

const ADMIN_ROLE_NAME = 'Администратор'
const DIRECTOR_ROLE_NAME = 'Директор'
const DIRECTOR_POSITION_NAME = 'Директор'

const CATEGORIES = new Set(['regulations', 'commerce', 'technical', 'templates', 'other'])
const VISIBILITY_MODES = new Set(['all', 'owner_department', 'segments'])

const CATEGORY_LABELS = {
  regulations: 'Регламенты',
  commerce: 'Коммерция',
  technical: 'Техника',
  templates: 'Шаблоны',
  other: 'Прочее',
}

const VISIBILITY_LABELS = {
  all: 'Всем',
  owner_department: 'Только свой отдел',
  segments: 'Выборочно',
}

const resolveUserId = (req) => {
  const fromQuery = req.query?.userId != null ? Number(req.query.userId) : null
  const fromBody = req.body?.userId != null ? Number(req.body.userId) : null
  const id = fromBody || fromQuery
  return Number.isFinite(id) && id > 0 ? id : null
}

const tableMissing = (error) => error && error.code === '42P01'

const parseTags = (raw) => {
  if (Array.isArray(raw)) {
    return raw
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .slice(0, 30)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parseTags(parsed)
    } catch (_) {
      /* comma-separated */
    }
    return trimmed
      .split(/[,;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 30)
  }
  return []
}

const parseSegments = (raw) => {
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch (_) {
      return { departments: [], users: [] }
    }
  }
  if (!data || typeof data !== 'object') return { departments: [], users: [] }
  const departments = Array.isArray(data.departments)
    ? data.departments.map((x) => String(x)).filter(Boolean)
    : []
  const users = Array.isArray(data.users)
    ? data.users.map((x) => String(x)).filter(Boolean)
    : []
  return { departments, users }
}

const isElevated = (actor) => {
  if (!actor) return false
  if (actor.role_name === ADMIN_ROLE_NAME) return true
  if (actor.role_name === DIRECTOR_ROLE_NAME) return true
  if (actor.position_name === DIRECTOR_POSITION_NAME) return true
  return false
}

async function getKnowledgePermissions(dbPool, userId) {
  const actor = await getActorProfile(dbPool, userId)
  if (!actor) {
    return {
      canUpload: false,
      isAdmin: false,
      isDirector: false,
      headDepartmentIds: [],
      departmentId: null,
      actor: null,
    }
  }

  const elevated = isElevated(actor)
  const headDepartmentIds = await getHeadDepartmentIds(dbPool, userId)
  const canUpload = elevated || headDepartmentIds.length > 0

  return {
    canUpload,
    isAdmin: actor.role_name === ADMIN_ROLE_NAME,
    isDirector:
      actor.role_name === DIRECTOR_ROLE_NAME ||
      actor.position_name === DIRECTOR_POSITION_NAME,
    headDepartmentIds,
    departmentId: actor.department_id != null ? Number(actor.department_id) : null,
    actor,
  }
}

async function canManageDocument(dbPool, perms, ownerDepartmentId) {
  if (!perms || !perms.canUpload) return false
  if (perms.isAdmin || perms.isDirector) return true
  const deptId = Number(ownerDepartmentId)
  return perms.headDepartmentIds.includes(deptId)
}

function isVisibleToUser(doc, segments, userId, userDeptId, perms) {
  if (perms?.isAdmin || perms?.isDirector) return true
  if (
    perms?.headDepartmentIds?.length &&
    perms.headDepartmentIds.includes(Number(doc.owner_department_id))
  ) {
    return true
  }

  if (doc.visibility_mode === 'all') return true

  if (doc.visibility_mode === 'owner_department') {
    return userDeptId != null && Number(doc.owner_department_id) === Number(userDeptId)
  }

  if (doc.visibility_mode === 'segments') {
    const depSeg = (segments || []).filter((s) => s.segment_type === 'department')
    const userSeg = (segments || []).filter((s) => s.segment_type === 'user')
    const inDept =
      userDeptId != null &&
      depSeg.some((s) => String(s.segment_value) === String(userDeptId))
    const inUsers = userSeg.some((s) => String(s.segment_value) === String(userId))
    return inDept || inUsers
  }

  return false
}

const mapDoc = (row, segments = [], canManage = false, extra = {}) => {
  const files = Array.isArray(extra.files)
    ? extra.files.map((f) => mapFileRow(f, fixFilenameEncoding))
    : undefined
  const filesCount =
    extra.filesCount != null
      ? Number(extra.filesCount)
      : files
        ? files.length
        : row.file_url
          ? 1
          : 0
  const isFolder =
    row.is_folder === true ||
    row.is_folder === 1 ||
    String(row.is_folder || '') === 'true' ||
    filesCount > 1

  return {
    id: Number(row.id),
    title: row.title,
    description: row.description || '',
    category: row.category,
    categoryLabel: row.category_label || CATEGORY_LABELS[row.category] || row.category,
    ownerDepartmentId: Number(row.owner_department_id),
    ownerDepartmentName: row.owner_department_name || null,
    visibilityMode: row.visibility_mode,
    visibilityLabel: VISIBILITY_LABELS[row.visibility_mode] || row.visibility_mode,
    isFolder: Boolean(isFolder),
    filesCount,
    files,
    fileUrl: row.file_url,
    fileName: fixFilenameEncoding(row.file_name || '') || null,
    fileType: row.file_type || null,
    fileSize: row.file_size != null ? Number(row.file_size) : null,
    fileHash: row.file_hash || null,
    versionNumber: row.version_number != null ? Number(row.version_number) : 1,
    tags: Array.isArray(row.tags) ? row.tags : [],
    uploadedBy: row.uploaded_by != null ? Number(row.uploaded_by) : null,
    uploadedByName: row.uploaded_by_name || null,
    updatedBy: row.updated_by != null ? Number(row.updated_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isFavorite:
      row.is_favorite === true ||
      row.is_favorite === 1 ||
      String(row.is_favorite || '') === 'true',
    segments: {
      departments: segments
        .filter((s) => s.segment_type === 'department')
        .map((s) => String(s.segment_value)),
      users: segments
        .filter((s) => s.segment_type === 'user')
        .map((s) => String(s.segment_value)),
    },
    canManage: Boolean(canManage),
  }
}

const SELECT_BASE = `
  SELECT
    d.*,
    dep.name AS owner_department_name,
    COALESCE(kc.label, d.category) AS category_label,
    TRIM(CONCAT(
      COALESCE(u.last_name, ''), ' ',
      COALESCE(u.first_name, ''), ' ',
      COALESCE(u.middle_name, '')
    )) AS uploaded_by_name
  FROM knowledge_documents d
  LEFT JOIN departments dep ON dep.id = d.owner_department_id
  LEFT JOIN users u ON u.id = d.uploaded_by
  LEFT JOIN knowledge_categories kc ON kc.id = d.category
`

async function loadSegmentsMap(dbPool, documentIds) {
  const map = {}
  if (!documentIds.length) return map
  const { rows } = await dbPool.query(
    `SELECT document_id, segment_type, segment_value
     FROM knowledge_document_segments
     WHERE document_id = ANY($1::int[])`,
    [documentIds]
  )
  rows.forEach((row) => {
    const id = Number(row.document_id)
    if (!map[id]) map[id] = []
    map[id].push(row)
  })
  return map
}

async function replaceSegments(client, documentId, segments) {
  await client.query(`DELETE FROM knowledge_document_segments WHERE document_id = $1`, [
    documentId,
  ])
  const { departments, users } = segments
  for (const depId of departments) {
    await client.query(
      `INSERT INTO knowledge_document_segments (document_id, segment_type, segment_value)
       VALUES ($1, 'department', $2)
       ON CONFLICT DO NOTHING`,
      [documentId, String(depId)]
    )
  }
  for (const uid of users) {
    await client.query(
      `INSERT INTO knowledge_document_segments (document_id, segment_type, segment_value)
       VALUES ($1, 'user', $2)
       ON CONFLICT DO NOTHING`,
      [documentId, String(uid)]
    )
  }
}

const FALLBACK_CATEGORIES = Object.entries(CATEGORY_LABELS).map(([id, label], i) => ({
  id,
  label,
  sortOrder: (i + 1) * 10,
}))

async function loadCategories(dbPool) {
  try {
    const { rows } = await dbPool.query(
      `SELECT id, label, sort_order
       FROM knowledge_categories
       ORDER BY sort_order ASC, label ASC`
    )
    if (!rows.length) return FALLBACK_CATEGORIES
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      sortOrder: Number(r.sort_order) || 0,
    }))
  } catch (error) {
    if (tableMissing(error)) return FALLBACK_CATEGORIES
    throw error
  }
}

async function loadTags(dbPool) {
  try {
    const { rows } = await dbPool.query(
      `SELECT id, name FROM knowledge_tags ORDER BY lower(name) ASC`
    )
    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
    }))
  } catch (error) {
    if (tableMissing(error)) return []
    throw error
  }
}

async function loadFavoriteIds(dbPool, userId) {
  if (!userId) return new Set()
  try {
    const { rows } = await dbPool.query(
      `SELECT document_id
       FROM knowledge_document_favorites
       WHERE user_id = $1`,
      [userId]
    )
    return new Set(rows.map((r) => Number(r.document_id)))
  } catch (error) {
    if (tableMissing(error)) return new Set()
    throw error
  }
}

async function categoryExists(dbPool, categoryId) {
  const id = String(categoryId || '').trim()
  if (!id) return false
  try {
    const { rows } = await dbPool.query(
      `SELECT 1 FROM knowledge_categories WHERE id = $1 LIMIT 1`,
      [id]
    )
    if (rows.length) return true
    // таблицы ещё нет — допускаем старый набор
  } catch (error) {
    if (tableMissing(error)) return CATEGORIES.has(id)
    throw error
  }
  return CATEGORIES.has(id)
}

async function resolveAllowedTags(dbPool, requestedTags, options = {}) {
  const requested = Array.isArray(requestedTags) ? requestedTags : []
  if (!requested.length) return []
  const allowExisting = Array.isArray(options.allowExisting) ? options.allowExisting : []
  const dict = await loadTags(dbPool)
  const byLower = new Map(dict.map((t) => [String(t.name).trim().toLowerCase(), t.name]))
  const existingByLower = new Map(
    allowExisting
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .map((t) => [t.toLowerCase(), t])
  )
  const resolved = []
  const seen = new Set()
  for (const raw of requested) {
    const key = String(raw || '')
      .trim()
      .toLowerCase()
    if (!key || seen.has(key)) continue
    const fromDict = byLower.get(key)
    const fromExisting = existingByLower.get(key)
    if (fromDict || fromExisting) {
      seen.add(key)
      resolved.push(fromDict || fromExisting)
    }
  }
  return resolved
}

const slugifyCategoryId = (label) => {
  const map = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  }
  const base = String(label || '')
    .trim()
    .toLowerCase()
    .split('')
    .map((ch) => {
      if (map[ch] != null) return map[ch]
      if (/[a-z0-9]/.test(ch)) return ch
      if (/\s|-|_/.test(ch)) return '_'
      return ''
    })
    .join('')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48)
  return base || `cat_${Date.now()}`
}

const requireAdmin = async (dbPool, req, res) => {
  const userId = resolveUserId(req)
  if (!userId) {
    res.status(400).json({ error: 'Укажите userId' })
    return null
  }
  const perms = await getKnowledgePermissions(dbPool, userId)
  if (!perms.isAdmin) {
    res.status(403).json({ error: 'Доступно только администратору' })
    return null
  }
  return { userId, perms }
}

const getPermissions = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const perms = await getKnowledgePermissions(dbPool, userId)
    const [categories, tags] = await Promise.all([
      loadCategories(dbPool),
      loadTags(dbPool),
    ])
    return res.json({
      canUpload: perms.canUpload,
      isAdmin: perms.isAdmin,
      isDirector: perms.isDirector,
      headDepartmentIds: perms.headDepartmentIds,
      departmentId: perms.departmentId,
      categories,
      tags,
      visibilityModes: Object.entries(VISIBILITY_LABELS).map(([id, label]) => ({
        id,
        label,
      })),
    })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица базы знаний не создана. Выполните add_knowledge_base.sql',
      })
    }
    console.error('knowledge getPermissions:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const listDocuments = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    const q = String(req.query.q || '').trim()
    const category = String(req.query.category || '').trim()
    const departmentId =
      req.query.departmentId != null && req.query.departmentId !== ''
        ? Number(req.query.departmentId)
        : null
    const mineOnly = String(req.query.mineOnly || '') === '1'
    const favoriteOnly = String(req.query.favoriteOnly || '') === '1'

    let sql = `${SELECT_BASE} WHERE d.is_archived = FALSE`
    const params = []
    let idx = 1

    if (category) {
      const okCat = await categoryExists(dbPool, category)
      if (okCat) {
        sql += ` AND d.category = $${idx++}`
        params.push(category)
      }
    }
    if (Number.isFinite(departmentId) && departmentId > 0) {
      sql += ` AND d.owner_department_id = $${idx++}`
      params.push(departmentId)
    }
    if (mineOnly && perms.departmentId) {
      sql += ` AND d.owner_department_id = $${idx++}`
      params.push(perms.departmentId)
    }
    if (q) {
      const tokens = tokenizeSearchQuery(q)
      if (tokens.length) {
        // Каждое слово запроса должно встретиться (AND). search_text уже
        // нормализован (регистр + латиница/кириллица-двойники вроде T/Т).
        // Ищем и в карточке, и в файлах папки.
        for (const token of tokens) {
          sql += ` AND (
            COALESCE(d.search_text, '') ILIKE $${idx}
            OR EXISTS (
              SELECT 1 FROM knowledge_document_files kf
              WHERE kf.document_id = d.id
                AND (
                  COALESCE(kf.search_text, '') ILIKE $${idx}
                  OR COALESCE(kf.file_name, '') ILIKE $${idx}
                )
            )
          )`
          params.push(`%${token}%`)
          idx += 1
        }
      }
    }

    sql += ` ORDER BY d.updated_at DESC, d.id DESC LIMIT 500`

    const { rows } = await dbPool.query(sql, params)
    const ids = rows.map((r) => Number(r.id))
    const segmentsMap = await loadSegmentsMap(dbPool, ids)
    const favoriteIds = await loadFavoriteIds(dbPool, userId)
    const filesCounts = await loadFilesCounts(dbPool, ids)

    const visible = rows
      .filter((row) =>
        isVisibleToUser(
          row,
          segmentsMap[Number(row.id)] || [],
          userId,
          perms.departmentId,
          perms
        )
      )
      .map((row) => {
        const canManage = canManageDocumentSync(perms, row.owner_department_id)
        const id = Number(row.id)
        return mapDoc(
          {
            ...row,
            is_favorite: favoriteIds.has(id),
          },
          segmentsMap[id] || [],
          canManage,
          { filesCount: filesCounts[id] || (row.file_url ? 1 : 0) }
        )
      })

    const favoriteCount = visible.filter((doc) => doc.isFavorite).length
    const documents = (favoriteOnly ? visible.filter((doc) => doc.isFavorite) : visible).sort(
      (a, b) => {
        if (Boolean(a.isFavorite) !== Boolean(b.isFavorite)) {
          return a.isFavorite ? -1 : 1
        }
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        if (tb !== ta) return tb - ta
        return Number(b.id) - Number(a.id)
      }
    )

    return res.json({
      documents,
      favoriteCount,
      totalCount: visible.length,
    })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица базы знаний не создана. Выполните add_knowledge_base.sql',
      })
    }
    console.error('knowledge listDocuments:', error)
    return res.status(500).json({ error: error.message || 'Ошибка списка' })
  }
}

function canManageDocumentSync(perms, ownerDepartmentId) {
  if (!perms || !perms.canUpload) return false
  if (perms.isAdmin || perms.isDirector) return true
  return perms.headDepartmentIds.includes(Number(ownerDepartmentId))
}

const getDocument = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    const { rows } = await dbPool.query(`${SELECT_BASE} WHERE d.id = $1 AND d.is_archived = FALSE`, [
      id,
    ])
    if (!rows.length) return res.status(404).json({ error: 'Документ не найден' })

    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    const segments = segmentsMap[id] || []
    if (!isVisibleToUser(rows[0], segments, userId, perms.departmentId, perms)) {
      return res.status(403).json({ error: 'Нет доступа к документу' })
    }

    const canManage = canManageDocumentSync(perms, rows[0].owner_department_id)
    const favoriteIds = await loadFavoriteIds(dbPool, userId)
    const filesMap = await loadFilesMap(dbPool, [id])
    let files = filesMap[id] || []
    // Совместимость: старый документ без строк в knowledge_document_files
    if (!files.length && rows[0].file_url) {
      files = [
        {
          id: null,
          document_id: id,
          file_url: rows[0].file_url,
          file_name: rows[0].file_name,
          file_type: rows[0].file_type,
          file_size: rows[0].file_size,
          file_hash: rows[0].file_hash,
          version_number: rows[0].version_number,
          sort_order: 0,
          uploaded_by: rows[0].uploaded_by,
          created_at: rows[0].created_at,
          updated_at: rows[0].updated_at,
        },
      ]
    }
    return res.json({
      document: mapDoc(
        {
          ...rows[0],
          is_favorite: favoriteIds.has(id),
        },
        segments,
        canManage,
        { files, filesCount: files.length }
      ),
    })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица базы знаний не создана. Выполните add_knowledge_base.sql',
      })
    }
    console.error('knowledge getDocument:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const toggleFavoriteDocument = (dbPool, shouldFavorite) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    const { rows } = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Документ не найден' })

    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    if (!isVisibleToUser(rows[0], segmentsMap[id] || [], userId, perms.departmentId, perms)) {
      return res.status(403).json({ error: 'Нет доступа к документу' })
    }

    if (shouldFavorite) {
      await dbPool.query(
        `INSERT INTO knowledge_document_favorites (user_id, document_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, id]
      )
    } else {
      await dbPool.query(
        `DELETE FROM knowledge_document_favorites
         WHERE user_id = $1 AND document_id = $2`,
        [userId, id]
      )
    }

    return res.json({ ok: true, isFavorite: shouldFavorite })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_favorites.sql',
      })
    }
    console.error('knowledge toggleFavoriteDocument:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const addFavoriteDocument = (dbPool) => toggleFavoriteDocument(dbPool, true)
const removeFavoriteDocument = (dbPool) => toggleFavoriteDocument(dbPool, false)

const createDocument = (dbPool, io) => async (req, res) => {
  const client = await dbPool.connect()
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    if (!perms.canUpload) {
      return res.status(403).json({
        error: 'Загрузка доступна руководителям отделов, администратору и директору',
      })
    }

    const title = String(req.body.title || '').trim()
    if (!title) return res.status(400).json({ error: 'Укажите название' })

    const description = String(req.body.description || '').trim()
    const category = String(req.body.category || 'other').trim()
    if (!(await categoryExists(dbPool, category))) {
      return res.status(400).json({ error: 'Некорректная категория' })
    }

    const ownerDepartmentId = Number(req.body.ownerDepartmentId)
    if (!Number.isFinite(ownerDepartmentId) || ownerDepartmentId <= 0) {
      return res.status(400).json({ error: 'Укажите отдел-владелец' })
    }

    const allowed = await canManageDocument(dbPool, perms, ownerDepartmentId)
    if (!allowed) {
      return res.status(403).json({ error: 'Можно загружать только для своего отдела' })
    }

    const visibilityMode = String(req.body.visibilityMode || 'all').trim()
    if (!VISIBILITY_MODES.has(visibilityMode)) {
      return res.status(400).json({ error: 'Некорректный режим видимости' })
    }

    const segments = parseSegments(req.body.segments)
    if (visibilityMode === 'segments') {
      if (!segments.departments.length && !segments.users.length) {
        return res.status(400).json({
          error: 'Для выборочной видимости укажите отделы и/или сотрудников',
        })
      }
    }

    const uploadFiles = collectUploadFiles(req)
    if (!uploadFiles.length) {
      return res.status(400).json({ error: 'Прикрепите хотя бы один файл' })
    }

    // В одной загрузке нельзя два файла с одинаковым именем
    const namesInBatch = new Set()
    for (let i = 0; i < uploadFiles.length; i += 1) {
      const n = resolveUploadFileNameAt(req, uploadFiles[i], i)
      const key = normalizeFileName(n)
      if (key && namesInBatch.has(key)) {
        return res.status(400).json({
          error: `В одной загрузке два файла с одинаковым именем: «${n}»`,
        })
      }
      if (key) namesInBatch.add(key)
    }

    const wantFolder =
      String(req.body.isFolder || '') === '1' ||
      String(req.body.is_folder || '') === '1' ||
      uploadFiles.length > 1

    // Для проверки дублей / replace используем первый файл
    req.file = uploadFiles[0]
    const fileUrl = `/uploads/knowledge/${uploadFiles[0].filename}`
    const originalName = resolveUploadFileNameAt(req, uploadFiles[0], 0)
    const fileHash = hashFile(uploadFiles[0].path)
    const forceDuplicate = String(req.body.forceDuplicate || '') === '1'
    const replaceDocumentId =
      req.body.replaceDocumentId != null && req.body.replaceDocumentId !== ''
        ? Number(req.body.replaceDocumentId)
        : null

    if (replaceDocumentId && wantFolder && uploadFiles.length > 1) {
      return res.status(400).json({
        error:
          'Замена версии поддерживает один файл. Для папки добавляйте файлы отдельно.',
      })
    }

    const tags = await resolveAllowedTags(dbPool, parseTags(req.body.tags))
    const extractedText = await extractTextFromFile(uploadFiles[0].path, {
      fileName: originalName,
      mimeType: uploadFiles[0].mimetype,
    })
    const searchBlob = buildSearchBlob({
      title,
      description,
      tags,
      fileName: originalName,
      extractedText,
    })

    // Тот же файл уже есть в отделе
    if (!forceDuplicate && !replaceDocumentId) {
      const dupHash = await dbPool.query(
        `SELECT id, title FROM knowledge_documents
         WHERE is_archived = FALSE
           AND owner_department_id = $1
           AND file_hash = $2
         LIMIT 1`,
        [ownerDepartmentId, fileHash]
      )
      if (dupHash.rows.length) {
        return res.status(409).json({
          code: 'DUPLICATE_HASH',
          error: `Такой же файл уже загружен: «${dupHash.rows[0].title}».`,
          documentId: Number(dupHash.rows[0].id),
        })
      }
    }

    // То же название в отделе — предложить новую версию
    if (!replaceDocumentId) {
      const dupTitle = await dbPool.query(
        `SELECT id, title, version_number, is_folder FROM knowledge_documents
         WHERE is_archived = FALSE
           AND owner_department_id = $1
           AND lower(trim(title)) = lower(trim($2))
         LIMIT 1`,
        [ownerDepartmentId, title]
      )
      if (dupTitle.rows.length) {
        const existingIsFolder =
          dupTitle.rows[0].is_folder === true ||
          dupTitle.rows[0].is_folder === 1
        if (wantFolder || existingIsFolder) {
          return res.status(409).json({
            code: 'TITLE_EXISTS',
            error: `В этом отделе уже есть «${dupTitle.rows[0].title}». Откройте карточку и добавьте файлы в папку, либо выберите другое название.`,
            documentId: Number(dupTitle.rows[0].id),
            versionNumber: Number(dupTitle.rows[0].version_number || 1),
          })
        }
        return res.status(409).json({
          code: 'TITLE_EXISTS',
          error: `В этом отделе уже есть документ «${dupTitle.rows[0].title}». Можно заменить файл новой версией.`,
          documentId: Number(dupTitle.rows[0].id),
          versionNumber: Number(dupTitle.rows[0].version_number || 1),
        })
      }
    }

    await client.query('BEGIN')

    // Новая версия существующего документа
    if (replaceDocumentId) {
      const existing = await client.query(
        `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE FOR UPDATE`,
        [replaceDocumentId]
      )
      if (!existing.rows.length) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Документ для замены не найден' })
      }
      const prev = existing.rows[0]
      if (prev.is_folder === true || prev.is_folder === 1) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          error:
            'Это папка. Добавляйте файлы через «Добавить файл», а не через замену версии.',
        })
      }
      const canReplace = await canManageDocument(dbPool, perms, prev.owner_department_id)
      if (!canReplace) {
        await client.query('ROLLBACK')
        return res.status(403).json({ error: 'Нет прав на замену этого документа' })
      }

      // Защита: новая версия с другим именем файла — только после явного подтверждения
      const confirmDifferentFileName =
        String(req.body.confirmDifferentFileName || '') === '1'
      if (
        !confirmDifferentFileName &&
        fileNamesDiffer(prev.file_name, originalName)
      ) {
        await client.query('ROLLBACK')
        return res.status(409).json({
          code: 'FILE_NAME_MISMATCH',
          error: `Вы загружаете файл «${originalName}», а у документа сейчас «${prev.file_name}». Возможно, выбран не тот файл. Чтобы всё же заменить — подтвердите действие. Переименовать карточку документа можно отдельно, без замены файла.`,
          documentId: replaceDocumentId,
          currentFileName: prev.file_name,
          newFileName: originalName,
        })
      }

      await archiveCurrentFileVersion(client, prev)
      const nextVersion = Number(prev.version_number || 1) + 1
      // Новая версия = тот же документ: название и отдел не меняем (защита от подмены другим файлом)
      const keptTitle = prev.title
      const keptDepartmentId = Number(prev.owner_department_id)
      const searchBlobKept = buildSearchBlob({
        title: keptTitle,
        description,
        tags,
        fileName: originalName,
        extractedText,
      })

      await client.query(
        `UPDATE knowledge_documents SET
          title = $1,
          description = $2,
          category = $3,
          owner_department_id = $4,
          visibility_mode = $5,
          file_url = $6,
          file_name = $7,
          file_type = $8,
          file_size = $9,
          file_hash = $10,
          tags = $11,
          search_text = $12,
          version_number = $13,
          updated_by = $14,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $15`,
        [
          keptTitle,
          description || null,
          category,
          keptDepartmentId,
          visibilityMode,
          fileUrl,
          originalName,
          uploadFiles[0].mimetype || null,
          uploadFiles[0].size != null ? Number(uploadFiles[0].size) : null,
          fileHash,
          tags,
          searchBlobKept || null,
          nextVersion,
          userId,
          replaceDocumentId,
        ]
      )

      // Обновить/создать строку файла
      try {
        const existingFiles = await client.query(
          `SELECT id FROM knowledge_document_files
           WHERE document_id = $1 ORDER BY sort_order ASC, id ASC LIMIT 1`,
          [replaceDocumentId]
        )
        if (existingFiles.rows.length) {
          await client.query(
            `UPDATE knowledge_document_files SET
              file_url = $1, file_name = $2, file_type = $3, file_size = $4,
              file_hash = $5, search_text = $6, version_number = $7,
              uploaded_by = $8, updated_at = CURRENT_TIMESTAMP
             WHERE id = $9`,
            [
              fileUrl,
              originalName,
              uploadFiles[0].mimetype || null,
              uploadFiles[0].size != null ? Number(uploadFiles[0].size) : null,
              fileHash,
              searchBlobKept || null,
              nextVersion,
              userId,
              existingFiles.rows[0].id,
            ]
          )
        } else {
          await insertDocumentFile(client, {
            documentId: replaceDocumentId,
            fileUrl,
            fileName: originalName,
            fileType: uploadFiles[0].mimetype || null,
            fileSize: uploadFiles[0].size,
            fileHash,
            searchText: searchBlobKept,
            sortOrder: 0,
            versionNumber: nextVersion,
            uploadedBy: userId,
          })
        }
      } catch (fileTableError) {
        if (!fileTableError || fileTableError.code !== '42P01') throw fileTableError
      }

      if (visibilityMode === 'segments') {
        await replaceSegments(client, replaceDocumentId, segments)
      } else {
        await client.query(`DELETE FROM knowledge_document_segments WHERE document_id = $1`, [
          replaceDocumentId,
        ])
      }

      await client.query('COMMIT')

      const { rows } = await dbPool.query(`${SELECT_BASE} WHERE d.id = $1`, [replaceDocumentId])
      const segmentsMap = await loadSegmentsMap(dbPool, [replaceDocumentId])
      const filesMap = await loadFilesMap(dbPool, [replaceDocumentId])
      notifyDepartmentAboutDocument(dbPool, io, {
        documentId: replaceDocumentId,
        title: keptTitle,
        ownerDepartmentId: keptDepartmentId,
        uploadedBy: userId,
        isNewVersion: true,
        versionNumber: nextVersion,
      }).catch(() => {})

      return res.status(200).json({
        document: mapDoc(
          rows[0],
          segmentsMap[replaceDocumentId] || [],
          true,
          {
            files: filesMap[replaceDocumentId] || [],
            filesCount: (filesMap[replaceDocumentId] || []).length || 1,
          }
        ),
        replaced: true,
      })
    }

    const insert = await client.query(
      `INSERT INTO knowledge_documents (
        title, description, category, owner_department_id, visibility_mode,
        file_url, file_name, file_type, file_size, file_hash, tags, search_text,
        version_number, uploaded_by, updated_by, is_folder
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,$13,$13,$14)
      RETURNING id`,
      [
        title,
        description || null,
        category,
        ownerDepartmentId,
        visibilityMode,
        fileUrl,
        originalName,
        uploadFiles[0].mimetype || null,
        uploadFiles[0].size != null ? Number(uploadFiles[0].size) : null,
        fileHash,
        tags,
        searchBlob || null,
        userId,
        wantFolder,
      ]
    )
    const docId = Number(insert.rows[0].id)
    if (visibilityMode === 'segments') {
      await replaceSegments(client, docId, segments)
    }

    // Все файлы папки / один файл документа
    try {
      for (let i = 0; i < uploadFiles.length; i += 1) {
        const f = uploadFiles[i]
        const name = resolveUploadFileNameAt(req, f, i)
        const hash = i === 0 ? fileHash : hashFile(f.path)
        const extracted =
          i === 0
            ? extractedText
            : await extractTextFromFile(f.path, {
                fileName: name,
                mimeType: f.mimetype,
              })
        const fileSearch = buildSearchBlob({
          title,
          description,
          tags,
          fileName: name,
          extractedText: extracted,
        })
        await insertDocumentFile(client, {
          documentId: docId,
          fileUrl: `/uploads/knowledge/${f.filename}`,
          fileName: name,
          fileType: f.mimetype || null,
          fileSize: f.size,
          fileHash: hash,
          searchText: fileSearch,
          sortOrder: i,
          versionNumber: 1,
          uploadedBy: userId,
        })
      }
      await rebuildDocumentSearchText(client, docId, {
        title,
        description,
        tags,
      })
    } catch (fileTableError) {
      if (!fileTableError || fileTableError.code !== '42P01') throw fileTableError
    }

    await client.query('COMMIT')

    const { rows } = await dbPool.query(`${SELECT_BASE} WHERE d.id = $1`, [docId])
    const segmentsMap = await loadSegmentsMap(dbPool, [docId])
    const filesMap = await loadFilesMap(dbPool, [docId])

    notifyDepartmentAboutDocument(dbPool, io, {
      documentId: docId,
      title,
      ownerDepartmentId,
      uploadedBy: userId,
      isNewVersion: false,
      versionNumber: 1,
    }).catch(() => {})

    return res.status(201).json({
      document: mapDoc(rows[0], segmentsMap[docId] || [], true, {
        files: filesMap[docId] || [],
        filesCount: (filesMap[docId] || []).length || uploadFiles.length,
      }),
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (_) {}
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица базы знаний не создана. Выполните add_knowledge_base.sql',
      })
    }
    console.error('knowledge createDocument:', error)
    return res.status(500).json({ error: error.message || 'Ошибка создания' })
  } finally {
    client.release()
  }
}

const updateDocument = (dbPool, io) => async (req, res) => {
  const client = await dbPool.connect()
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    if (!perms.canUpload) {
      return res.status(403).json({ error: 'Недостаточно прав' })
    }

    const existing = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!existing.rows.length) return res.status(404).json({ error: 'Документ не найден' })
    const prev = existing.rows[0]

    const allowed = await canManageDocument(dbPool, perms, prev.owner_department_id)
    if (!allowed) return res.status(403).json({ error: 'Нет прав на редактирование' })

    const title = String(req.body.title != null ? req.body.title : prev.title).trim()
    if (!title) return res.status(400).json({ error: 'Укажите название' })

    const description =
      req.body.description != null
        ? String(req.body.description).trim()
        : prev.description || ''
    const category =
      req.body.category != null ? String(req.body.category).trim() : prev.category
    if (!(await categoryExists(dbPool, category))) {
      return res.status(400).json({ error: 'Некорректная категория' })
    }

    let ownerDepartmentId = prev.owner_department_id
    if (req.body.ownerDepartmentId != null && req.body.ownerDepartmentId !== '') {
      ownerDepartmentId = Number(req.body.ownerDepartmentId)
      if (!Number.isFinite(ownerDepartmentId)) {
        return res.status(400).json({ error: 'Некорректный отдел' })
      }
      const canMove = await canManageDocument(dbPool, perms, ownerDepartmentId)
      if (!canMove) {
        return res.status(403).json({ error: 'Нельзя назначить чужой отдел' })
      }
    }

    const visibilityMode =
      req.body.visibilityMode != null
        ? String(req.body.visibilityMode).trim()
        : prev.visibility_mode
    if (!VISIBILITY_MODES.has(visibilityMode)) {
      return res.status(400).json({ error: 'Некорректный режим видимости' })
    }

    const segments =
      req.body.segments != null
        ? parseSegments(req.body.segments)
        : { departments: [], users: [] }

    if (visibilityMode === 'segments') {
      const segs =
        req.body.segments != null
          ? segments
          : await loadSegmentsMap(dbPool, [id]).then((m) => {
              const list = m[id] || []
              return {
                departments: list
                  .filter((s) => s.segment_type === 'department')
                  .map((s) => String(s.segment_value)),
                users: list
                  .filter((s) => s.segment_type === 'user')
                  .map((s) => String(s.segment_value)),
              }
            })
      if (!segs.departments.length && !segs.users.length) {
        return res.status(400).json({
          error: 'Для выборочной видимости укажите отделы и/или сотрудников',
        })
      }
    }

    let fileUrl = prev.file_url
    let fileName = prev.file_name
    let fileType = prev.file_type
    let fileSize = prev.file_size
    let fileHash = prev.file_hash || null
    let versionNumber = Number(prev.version_number || 1)
    let fileChanged = false

    if (req.file) {
      if (prev.is_folder === true || prev.is_folder === 1) {
        return res.status(400).json({
          error:
            'Это папка. Чтобы добавить файл, используйте действие «Добавить файл в папку».',
        })
      }
      fileUrl = `/uploads/knowledge/${req.file.filename}`
      fileName = resolveUploadFileName(req)
      fileType = req.file.mimetype || null
      fileSize = req.file.size != null ? Number(req.file.size) : null
      fileHash = hashFile(req.file.path)
      fileChanged = true
    }

    // Новая версия файла и смена названия — разные операции
    if (fileChanged) {
      const titleChanged =
        String(title || '')
          .trim()
          .toLowerCase() !==
        String(prev.title || '')
          .trim()
          .toLowerCase()
      if (titleChanged) {
        return res.status(400).json({
          code: 'TITLE_LOCKED_ON_VERSION',
          error:
            'При загрузке новой версии файла название документа менять нельзя. Сначала сохраните переименование без нового файла, либо оставьте прежнее название.',
        })
      }
      // Идентичность документа при версии: отдел-владелец тоже не меняем
      ownerDepartmentId = Number(prev.owner_department_id)

      const confirmDifferentFileName =
        String(req.body.confirmDifferentFileName || '') === '1'
      if (!confirmDifferentFileName && fileNamesDiffer(prev.file_name, fileName)) {
        return res.status(409).json({
          code: 'FILE_NAME_MISMATCH',
          error: `Вы загружаете файл «${fileName}», а у документа сейчас «${prev.file_name}». Возможно, выбран не тот файл. Чтобы всё же заменить — подтвердите действие. Переименовать карточку можно отдельно, без замены файла.`,
          documentId: id,
          currentFileName: prev.file_name,
          newFileName: fileName,
        })
      }
    }

    const effectiveTitle = fileChanged ? prev.title : title
    const tags =
      req.body.tags != null
        ? await resolveAllowedTags(dbPool, parseTags(req.body.tags), {
            allowExisting: prev.tags || [],
          })
        : prev.tags || []
    const knowledgeFilePath = req.file
      ? req.file.path
      : path.join(
          __dirname,
          '..',
          '..',
          '..',
          'uploads',
          'knowledge',
          path.basename(String(prev.file_url || ''))
        )
    const extractedText = await extractTextFromFile(knowledgeFilePath, {
      fileName,
      mimeType: fileType,
    })
    const searchBlob = buildSearchBlob({
      title: effectiveTitle,
      description,
      tags,
      fileName,
      extractedText,
    })

    await client.query('BEGIN')

    if (fileChanged) {
      await archiveCurrentFileVersion(client, prev)
      versionNumber = Number(prev.version_number || 1) + 1
      try {
        const existingFiles = await client.query(
          `SELECT id FROM knowledge_document_files
           WHERE document_id = $1 ORDER BY sort_order ASC, id ASC LIMIT 1`,
          [id]
        )
        if (existingFiles.rows.length) {
          await client.query(
            `UPDATE knowledge_document_files SET
              file_url = $1, file_name = $2, file_type = $3, file_size = $4,
              file_hash = $5, search_text = $6, version_number = $7,
              uploaded_by = $8, updated_at = CURRENT_TIMESTAMP
             WHERE id = $9`,
            [
              fileUrl,
              fileName,
              fileType,
              fileSize,
              fileHash,
              searchBlob || null,
              versionNumber,
              userId,
              existingFiles.rows[0].id,
            ]
          )
        } else {
          await insertDocumentFile(client, {
            documentId: id,
            fileUrl,
            fileName,
            fileType,
            fileSize,
            fileHash,
            searchText: searchBlob,
            sortOrder: 0,
            versionNumber,
            uploadedBy: userId,
          })
        }
      } catch (fileTableError) {
        if (!fileTableError || fileTableError.code !== '42P01') throw fileTableError
      }
    }

    await client.query(
      `UPDATE knowledge_documents SET
        title = $1,
        description = $2,
        category = $3,
        owner_department_id = $4,
        visibility_mode = $5,
        file_url = $6,
        file_name = $7,
        file_type = $8,
        file_size = $9,
        file_hash = $10,
        tags = $11,
        search_text = $12,
        version_number = $13,
        updated_by = $14,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $15`,
      [
        effectiveTitle,
        description || null,
        category,
        ownerDepartmentId,
        visibilityMode,
        fileUrl,
        fileName,
        fileType,
        fileSize,
        fileHash,
        tags,
        searchBlob || null,
        versionNumber,
        userId,
        id,
      ]
    )

    if (visibilityMode === 'segments') {
      const segs =
        req.body.segments != null
          ? segments
          : {
              departments: [],
              users: [],
            }
      if (req.body.segments != null) {
        await replaceSegments(client, id, segs)
      }
    } else {
      await client.query(`DELETE FROM knowledge_document_segments WHERE document_id = $1`, [
        id,
      ])
    }

    await client.query('COMMIT')

    const { rows } = await dbPool.query(`${SELECT_BASE} WHERE d.id = $1`, [id])
    const segmentsMap = await loadSegmentsMap(dbPool, [id])

    if (fileChanged) {
      notifyDepartmentAboutDocument(dbPool, io, {
        documentId: id,
        title: effectiveTitle,
        ownerDepartmentId,
        uploadedBy: userId,
        isNewVersion: true,
        versionNumber,
      }).catch(() => {})
    }

    return res.json({
      document: mapDoc(rows[0], segmentsMap[id] || [], true),
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (_) {}
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица базы знаний не создана. Выполните add_knowledge_base.sql',
      })
    }
    console.error('knowledge updateDocument:', error)
    return res.status(500).json({ error: error.message || 'Ошибка обновления' })
  } finally {
    client.release()
  }
}

const deleteDocument = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    const existing = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!existing.rows.length) return res.status(404).json({ error: 'Документ не найден' })

    const allowed = await canManageDocument(dbPool, perms, existing.rows[0].owner_department_id)
    if (!allowed) return res.status(403).json({ error: 'Нет прав на удаление' })

    await dbPool.query(
      `UPDATE knowledge_documents
       SET is_archived = TRUE, updated_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [userId, id]
    )
    return res.json({ ok: true })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица базы знаний не создана. Выполните add_knowledge_base.sql',
      })
    }
    console.error('knowledge deleteDocument:', error)
    return res.status(500).json({ error: error.message || 'Ошибка удаления' })
  }
}

const downloadDocument = (dbPool, uploadsRoot) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    const { rows } = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Документ не найден' })

    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    if (!isVisibleToUser(rows[0], segmentsMap[id] || [], userId, perms.departmentId, perms)) {
      return res.status(403).json({ error: 'Нет доступа к файлу' })
    }

    const fileNameOnDisk = path.basename(String(rows[0].file_url || ''))
    const filePath = path.join(uploadsRoot, 'knowledge', fileNameOnDisk)

    if (!fileNameOnDisk || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл на диске не найден' })
    }

    const downloadName = rows[0].file_name || fileNameOnDisk
    const inline =
      String(req.query.inline || '') === '1' || String(req.query.view || '') === '1'
    const contentType =
      rows[0].file_type ||
      mime.lookup(downloadName) ||
      mime.lookup(fileNameOnDisk) ||
      'application/octet-stream'

    if (inline) {
      await logDocumentEvent(dbPool, id, userId, 'view')
      res.setHeader('Content-Type', contentType)
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`
      )
      return res.sendFile(path.resolve(filePath))
    }

    await logDocumentEvent(dbPool, id, userId, 'download')
    return res.download(filePath, downloadName)
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица базы знаний не создана. Выполните add_knowledge_base.sql',
      })
    }
    console.error('knowledge downloadDocument:', error)
    return res.status(500).json({ error: error.message || 'Ошибка скачивания' })
  }
}

/** Переиндексация текста уже загруженных файлов (админ / директор). */
const reindexDocuments = (dbPool, uploadsRoot) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    if (!perms.isAdmin && !perms.isDirector) {
      return res.status(403).json({ error: 'Переиндексация доступна администратору и директору' })
    }

    const { rows } = await dbPool.query(
      `SELECT id, title, description, tags, file_url, file_name, file_type
       FROM knowledge_documents
       WHERE is_archived = FALSE`
    )

    let updated = 0
    let emptyExtract = 0
    for (const row of rows) {
      const filePath = path.join(
        uploadsRoot,
        'knowledge',
        path.basename(String(row.file_url || ''))
      )
      const extractedText = await extractTextFromFile(filePath, {
        fileName: row.file_name,
        mimeType: row.file_type,
      })
      if (!extractedText) emptyExtract += 1
      const searchBlob = buildSearchBlob({
        title: row.title,
        description: row.description,
        tags: row.tags,
        fileName: row.file_name,
        extractedText,
      })
      await dbPool.query(`UPDATE knowledge_documents SET search_text = $1 WHERE id = $2`, [
        searchBlob || null,
        row.id,
      ])
      updated += 1
    }

    return res.json({
      ok: true,
      updated,
      emptyExtract,
      message:
        emptyExtract > 0
          ? `Обновлено ${updated}. Без текста содержимого: ${emptyExtract} (скан/неподдерживаемый формат).`
          : `Обновлено ${updated} документов.`,
    })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Таблица базы знаний не создана. Выполните add_knowledge_base.sql',
      })
    }
    console.error('knowledge reindexDocuments:', error)
    return res.status(500).json({ error: error.message || 'Ошибка переиндексации' })
  }
}

const listVersions = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    const { rows: docs } = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!docs.length) return res.status(404).json({ error: 'Документ не найден' })

    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    if (!isVisibleToUser(docs[0], segmentsMap[id] || [], userId, perms.departmentId, perms)) {
      return res.status(403).json({ error: 'Нет доступа' })
    }

    const { rows } = await dbPool.query(
      `SELECT v.id, v.version_number, v.file_name, v.file_type, v.file_size, v.created_at,
              TRIM(CONCAT(COALESCE(u.last_name,''),' ',COALESCE(u.first_name,''))) AS uploaded_by_name
       FROM knowledge_document_versions v
       LEFT JOIN users u ON u.id = v.uploaded_by
       WHERE v.document_id = $1
       ORDER BY v.version_number DESC`,
      [id]
    )

    return res.json({
      currentVersion: Number(docs[0].version_number || 1),
      versions: rows.map((r) => ({
        id: Number(r.id),
        versionNumber: Number(r.version_number),
        fileName: r.file_name,
        fileType: r.file_type,
        fileSize: r.file_size != null ? Number(r.file_size) : null,
        createdAt: r.created_at,
        uploadedByName: (r.uploaded_by_name || '').trim() || null,
      })),
    })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_versions_audit.sql',
      })
    }
    console.error('knowledge listVersions:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const downloadVersion = (dbPool, uploadsRoot) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    const versionId = Number(req.params.versionId)
    if (!Number.isFinite(id) || !Number.isFinite(versionId)) {
      return res.status(400).json({ error: 'Некорректный id' })
    }

    const perms = await getKnowledgePermissions(dbPool, userId)
    const { rows: docs } = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!docs.length) return res.status(404).json({ error: 'Документ не найден' })

    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    if (!isVisibleToUser(docs[0], segmentsMap[id] || [], userId, perms.departmentId, perms)) {
      return res.status(403).json({ error: 'Нет доступа' })
    }

    const { rows } = await dbPool.query(
      `SELECT * FROM knowledge_document_versions WHERE id = $1 AND document_id = $2`,
      [versionId, id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Версия не найдена' })

    const fileNameOnDisk = path.basename(String(rows[0].file_url || ''))
    const filePath = path.join(uploadsRoot, 'knowledge', fileNameOnDisk)
    if (!fileNameOnDisk || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл версии на диске не найден' })
    }

    await logDocumentEvent(dbPool, id, userId, 'download')
    return res.download(filePath, rows[0].file_name || fileNameOnDisk)
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_versions_audit.sql',
      })
    }
    console.error('knowledge downloadVersion:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const listEvents = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    const { rows: docs } = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!docs.length) return res.status(404).json({ error: 'Документ не найден' })

    const canManage = canManageDocumentSync(perms, docs[0].owner_department_id)
    if (!canManage) {
      return res.status(403).json({ error: 'Аудит доступен редакторам документа' })
    }

    const { rows } = await dbPool.query(
      `SELECT e.id, e.event_type, e.created_at, e.user_id,
              TRIM(CONCAT(COALESCE(u.last_name,''),' ',COALESCE(u.first_name,''))) AS user_name
       FROM knowledge_document_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.document_id = $1
       ORDER BY e.created_at DESC
       LIMIT 200`,
      [id]
    )

    return res.json({
      events: rows.map((r) => ({
        id: Number(r.id),
        eventType: r.event_type,
        eventLabel: r.event_type === 'view' ? 'Просмотр' : 'Скачивание',
        createdAt: r.created_at,
        userId: r.user_id != null ? Number(r.user_id) : null,
        userName: (r.user_name || '').trim() || '—',
      })),
    })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_versions_audit.sql',
      })
    }
    console.error('knowledge listEvents:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const createCategory = (dbPool) => async (req, res) => {
  try {
    const auth = await requireAdmin(dbPool, req, res)
    if (!auth) return

    const label = String(req.body.label || '').trim()
    if (!label || label.length > 200) {
      return res.status(400).json({ error: 'Укажите название категории (до 200 символов)' })
    }

    let id = String(req.body.id || '').trim() || slugifyCategoryId(label)
    id = id.replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 64)
    if (!id) id = `cat_${Date.now()}`

    const sortOrder =
      req.body.sortOrder != null && Number.isFinite(Number(req.body.sortOrder))
        ? Number(req.body.sortOrder)
        : 100

    for (let i = 0; i < 20; i += 1) {
      const candidate = i === 0 ? id : `${id}_${i + 1}`.slice(0, 64)
      try {
        const { rows } = await dbPool.query(
          `INSERT INTO knowledge_categories (id, label, sort_order)
           VALUES ($1, $2, $3)
           RETURNING id, label, sort_order`,
          [candidate, label, sortOrder]
        )
        return res.status(201).json({
          category: {
            id: rows[0].id,
            label: rows[0].label,
            sortOrder: Number(rows[0].sort_order) || 0,
          },
        })
      } catch (error) {
        if (error && error.code === '23505') continue
        throw error
      }
    }
    return res.status(409).json({ error: 'Не удалось создать уникальный код категории' })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_taxonomy.sql',
      })
    }
    console.error('knowledge createCategory:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const deleteCategory = (dbPool) => async (req, res) => {
  try {
    const auth = await requireAdmin(dbPool, req, res)
    if (!auth) return

    const id = String(req.params.id || '').trim()
    if (!id) return res.status(400).json({ error: 'Некорректный id' })

    const usage = await dbPool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM knowledge_documents
       WHERE is_archived = FALSE AND category = $1`,
      [id]
    )
    const count = Number(usage.rows[0]?.cnt || 0)
    if (count > 0) {
      return res.status(409).json({
        code: 'CATEGORY_IN_USE',
        error: `Категорию нельзя удалить: есть ${count} документ(ов). Сначала смените категорию у документов.`,
        documentCount: count,
      })
    }

    const del = await dbPool.query(
      `DELETE FROM knowledge_categories WHERE id = $1 RETURNING id`,
      [id]
    )
    if (!del.rows.length) return res.status(404).json({ error: 'Категория не найдена' })
    return res.json({ ok: true, id })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_taxonomy.sql',
      })
    }
    console.error('knowledge deleteCategory:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const createTag = (dbPool) => async (req, res) => {
  try {
    const auth = await requireAdmin(dbPool, req, res)
    if (!auth) return

    const name = String(req.body.name || '').trim()
    if (!name || name.length > 100) {
      return res.status(400).json({ error: 'Укажите тег (до 100 символов)' })
    }

    try {
      const { rows } = await dbPool.query(
        `INSERT INTO knowledge_tags (name) VALUES ($1)
         RETURNING id, name`,
        [name]
      )
      return res.status(201).json({
        tag: { id: Number(rows[0].id), name: rows[0].name },
      })
    } catch (error) {
      if (error && error.code === '23505') {
        return res.status(409).json({ error: 'Такой тег уже есть' })
      }
      throw error
    }
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_taxonomy.sql',
      })
    }
    console.error('knowledge createTag:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const deleteTag = (dbPool) => async (req, res) => {
  try {
    const auth = await requireAdmin(dbPool, req, res)
    if (!auth) return

    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id' })

    const tagRow = await dbPool.query(
      `SELECT id, name FROM knowledge_tags WHERE id = $1`,
      [id]
    )
    if (!tagRow.rows.length) return res.status(404).json({ error: 'Тег не найден' })
    const tagName = tagRow.rows[0].name

    const usage = await dbPool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM knowledge_documents
       WHERE is_archived = FALSE
         AND EXISTS (
           SELECT 1 FROM unnest(tags) t WHERE lower(trim(t)) = lower(trim($1))
         )`,
      [tagName]
    )
    const count = Number(usage.rows[0]?.cnt || 0)
    if (count > 0) {
      return res.status(409).json({
        code: 'TAG_IN_USE',
        error: `Тег нельзя удалить: используется в ${count} документ(ах). Сначала снимите тег с документов.`,
        documentCount: count,
      })
    }

    await dbPool.query(`DELETE FROM knowledge_tags WHERE id = $1`, [id])
    return res.json({ ok: true, id })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_taxonomy.sql',
      })
    }
    console.error('knowledge deleteTag:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const addDocumentFile = (dbPool, io) => async (req, res) => {
  const client = await dbPool.connect()
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    if (!perms.canUpload) {
      return res.status(403).json({ error: 'Недостаточно прав' })
    }

    const uploadFiles = collectUploadFiles(req)
    if (!uploadFiles.length) {
      return res.status(400).json({ error: 'Прикрепите файл' })
    }

    const existing = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!existing.rows.length) return res.status(404).json({ error: 'Документ не найден' })
    const prev = existing.rows[0]

    const allowed = await canManageDocument(dbPool, perms, prev.owner_department_id)
    if (!allowed) return res.status(403).json({ error: 'Нет прав на редактирование' })

    // Текущие файлы папки (для проверки имён)
    let currentFiles = []
    try {
      const cur = await dbPool.query(
        `SELECT id, file_name, version_number, file_url, file_type, file_size, file_hash,
                search_text, uploaded_by, document_id
         FROM knowledge_document_files
         WHERE document_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [id]
      )
      currentFiles = cur.rows
    } catch (e) {
      if (!e || e.code !== '42P01') throw e
    }

    // Если у старого документа ещё нет строк — учитываем file_* карточки
    if (
      !currentFiles.length &&
      prev.file_url &&
      prev.file_name
    ) {
      currentFiles = [
        {
          id: null,
          document_id: id,
          file_name: prev.file_name,
          version_number: prev.version_number || 1,
          file_url: prev.file_url,
          file_type: prev.file_type,
          file_size: prev.file_size,
          file_hash: prev.file_hash,
          search_text: prev.search_text,
          uploaded_by: prev.uploaded_by,
        },
      ]
    }

    const byName = new Map()
    currentFiles.forEach((row) => {
      const key = normalizeFileName(row.file_name)
      if (key) byName.set(key, row)
    })

    const planned = []
    const conflicts = []
    const seenInBatch = new Map()

    for (let i = 0; i < uploadFiles.length; i += 1) {
      const f = uploadFiles[i]
      const name = resolveUploadFileNameAt(req, f, i)
      const key = normalizeFileName(name)
      if (!key) {
        return res.status(400).json({ error: 'Некорректное имя файла' })
      }
      if (seenInBatch.has(key)) {
        return res.status(400).json({
          error: `В одной загрузке два файла с одинаковым именем: «${name}»`,
        })
      }
      seenInBatch.set(key, true)

      const existingFile = byName.get(key)
      if (existingFile) {
        conflicts.push({
          fileName: name,
          fileId: existingFile.id != null ? Number(existingFile.id) : null,
          currentFileName: existingFile.file_name,
          versionNumber: Number(existingFile.version_number || 1),
          uploadIndex: i,
        })
        planned.push({ type: 'replace', upload: f, name, existing: existingFile, index: i })
      } else {
        planned.push({ type: 'add', upload: f, name, index: i })
      }
    }

    const replaceSameNames = String(req.body.replaceSameNames || '') === '1'
    if (conflicts.length && !replaceSameNames) {
      const names = conflicts.map((c) => `«${c.fileName}»`).join(', ')
      return res.status(409).json({
        code: 'FOLDER_FILE_NAME_EXISTS',
        error:
          conflicts.length === 1
            ? `В папке уже есть файл ${names}. Заменить его новой версией?`
            : `В папке уже есть файлы с такими именами: ${names}. Заменить их новыми версиями?`,
        documentId: id,
        conflicts,
      })
    }

    await client.query('BEGIN')
    await client.query(
      `UPDATE knowledge_documents SET is_folder = TRUE, updated_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [userId, id]
    )

    const { rows: maxSort } = await client.query(
      `SELECT COALESCE(MAX(sort_order), -1)::int AS m FROM knowledge_document_files WHERE document_id = $1`,
      [id]
    )
    let sortOrder = Number(maxSort[0]?.m ?? -1) + 1

    // Если у старого документа ещё нет строк файлов — переносим текущий
    const { rows: existingFileRows } = await client.query(
      `SELECT id FROM knowledge_document_files WHERE document_id = $1 LIMIT 1`,
      [id]
    )
    if (!existingFileRows.length && prev.file_url) {
      const insertedLegacy = await insertDocumentFile(client, {
        documentId: id,
        fileUrl: prev.file_url,
        fileName: prev.file_name,
        fileType: prev.file_type,
        fileSize: prev.file_size,
        fileHash: prev.file_hash,
        searchText: prev.search_text,
        sortOrder: 0,
        versionNumber: prev.version_number || 1,
        uploadedBy: prev.uploaded_by || userId,
      })
      sortOrder = Math.max(sortOrder, 1)
      // подставить id для replace по имени из «legacy»
      planned.forEach((p) => {
        if (
          p.type === 'replace' &&
          p.existing &&
          p.existing.id == null &&
          normalizeFileName(p.existing.file_name) ===
            normalizeFileName(prev.file_name)
        ) {
          p.existing = { ...p.existing, id: insertedLegacy.id }
        }
      })
    }

    let replacedCount = 0
    let addedCount = 0

    for (const item of planned) {
      const f = item.upload
      const name = item.name
      const hash = hashFile(f.path)
      const extracted = await extractTextFromFile(f.path, {
        fileName: name,
        mimeType: f.mimetype,
      })
      const fileSearch = buildSearchBlob({
        title: prev.title,
        description: prev.description || '',
        tags: prev.tags || [],
        fileName: name,
        extractedText: extracted,
      })
      const fileUrl = `/uploads/knowledge/${f.filename}`

      if (item.type === 'replace') {
        let existingRow = item.existing
        if (!existingRow?.id) {
          const found = await client.query(
            `SELECT * FROM knowledge_document_files
             WHERE document_id = $1 AND lower(trim(file_name)) = lower(trim($2))
             LIMIT 1`,
            [id, name]
          )
          existingRow = found.rows[0]
        } else {
          const found = await client.query(
            `SELECT * FROM knowledge_document_files WHERE id = $1 AND document_id = $2`,
            [existingRow.id, id]
          )
          existingRow = found.rows[0]
        }
        if (!existingRow) {
          await client.query('ROLLBACK')
          return res.status(404).json({
            error: `Не найден файл «${name}» для замены`,
          })
        }

        try {
          await archiveFileVersion(client, existingRow)
        } catch (e) {
          if (e && e.code === '42P01') {
            await client.query('ROLLBACK')
            return res.status(503).json({
              error: 'Выполните миграцию add_knowledge_base_file_versions.sql',
            })
          }
          throw e
        }

        const nextVersion = Number(existingRow.version_number || 1) + 1
        await client.query(
          `UPDATE knowledge_document_files SET
            file_url = $1, file_name = $2, file_type = $3, file_size = $4,
            file_hash = $5, search_text = $6, version_number = $7,
            uploaded_by = $8, updated_at = CURRENT_TIMESTAMP
           WHERE id = $9`,
          [
            fileUrl,
            name,
            f.mimetype || null,
            f.size != null ? Number(f.size) : null,
            hash,
            fileSearch || null,
            nextVersion,
            userId,
            existingRow.id,
          ]
        )
        replacedCount += 1
      } else {
        await insertDocumentFile(client, {
          documentId: id,
          fileUrl,
          fileName: name,
          fileType: f.mimetype || null,
          fileSize: f.size,
          fileHash: hash,
          searchText: fileSearch,
          sortOrder: sortOrder,
          versionNumber: 1,
          uploadedBy: userId,
        })
        sortOrder += 1
        addedCount += 1
      }
    }

    await syncPrimaryFileFromChildren(client, id)
    await rebuildDocumentSearchText(client, id)
    await client.query('COMMIT')

    const { rows } = await dbPool.query(`${SELECT_BASE} WHERE d.id = $1`, [id])
    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    const filesMap = await loadFilesMap(dbPool, [id])

    if (replacedCount > 0) {
      const replacedNames = planned
        .filter((p) => p.type === 'replace')
        .map((p) => p.name)
        .filter(Boolean)
      notifyDepartmentAboutDocument(dbPool, io, {
        documentId: id,
        title: prev.title,
        ownerDepartmentId: prev.owner_department_id,
        uploadedBy: userId,
        isNewVersion: true,
        versionNumber: Number(prev.version_number || 1) + 1,
        fileName: replacedNames.join(', ') || null,
      }).catch(() => {})
    }

    return res.status(replacedCount && !addedCount ? 200 : 201).json({
      document: mapDoc(rows[0], segmentsMap[id] || [], true, {
        files: filesMap[id] || [],
        filesCount: (filesMap[id] || []).length,
      }),
      replacedCount,
      addedCount,
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (_) {}
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_folders.sql',
      })
    }
    console.error('knowledge addDocumentFile:', error)
    return res.status(500).json({ error: error.message || 'Ошибка добавления файла' })
  } finally {
    client.release()
  }
}

const deleteDocumentFile = (dbPool) => async (req, res) => {
  const client = await dbPool.connect()
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    if (!Number.isFinite(id) || !Number.isFinite(fileId)) {
      return res.status(400).json({ error: 'Некорректный id' })
    }

    const perms = await getKnowledgePermissions(dbPool, userId)
    const existing = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!existing.rows.length) return res.status(404).json({ error: 'Документ не найден' })

    const allowed = await canManageDocument(dbPool, perms, existing.rows[0].owner_department_id)
    if (!allowed) return res.status(403).json({ error: 'Нет прав на удаление файла' })

    await client.query('BEGIN')
    const del = await client.query(
      `DELETE FROM knowledge_document_files
       WHERE id = $1 AND document_id = $2
       RETURNING id`,
      [fileId, id]
    )
    if (!del.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Файл не найден в папке' })
    }

    const { rows: left } = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM knowledge_document_files WHERE document_id = $1`,
      [id]
    )
    const count = Number(left[0]?.cnt || 0)
    if (count <= 1) {
      await client.query(
        `UPDATE knowledge_documents SET is_folder = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [count > 1, userId, id]
      )
    }
    await syncPrimaryFileFromChildren(client, id)
    await rebuildDocumentSearchText(client, id)
    await client.query(
      `UPDATE knowledge_documents SET is_folder = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [count > 1, userId, id]
    )
    await client.query('COMMIT')

    const { rows } = await dbPool.query(`${SELECT_BASE} WHERE d.id = $1`, [id])
    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    const filesMap = await loadFilesMap(dbPool, [id])
    return res.json({
      ok: true,
      document: mapDoc(rows[0], segmentsMap[id] || [], true, {
        files: filesMap[id] || [],
        filesCount: (filesMap[id] || []).length,
      }),
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (_) {}
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_folders.sql',
      })
    }
    console.error('knowledge deleteDocumentFile:', error)
    return res.status(500).json({ error: error.message || 'Ошибка удаления файла' })
  } finally {
    client.release()
  }
}

const downloadDocumentFile = (dbPool, uploadsRoot) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    if (!Number.isFinite(id) || !Number.isFinite(fileId)) {
      return res.status(400).json({ error: 'Некорректный id' })
    }

    const perms = await getKnowledgePermissions(dbPool, userId)
    const { rows } = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Документ не найден' })

    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    if (!isVisibleToUser(rows[0], segmentsMap[id] || [], userId, perms.departmentId, perms)) {
      return res.status(403).json({ error: 'Нет доступа к файлу' })
    }

    const fileRes = await dbPool.query(
      `SELECT * FROM knowledge_document_files WHERE id = $1 AND document_id = $2`,
      [fileId, id]
    )
    if (!fileRes.rows.length) {
      return res.status(404).json({ error: 'Файл не найден' })
    }
    const fileRow = fileRes.rows[0]
    const fileNameOnDisk = path.basename(String(fileRow.file_url || ''))
    const filePath = path.join(uploadsRoot, 'knowledge', fileNameOnDisk)
    if (!fileNameOnDisk || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл на диске не найден' })
    }

    const downloadName = fileRow.file_name || fileNameOnDisk
    const inline =
      String(req.query.inline || '') === '1' || String(req.query.view || '') === '1'
    const contentType =
      fileRow.file_type ||
      mime.lookup(downloadName) ||
      mime.lookup(fileNameOnDisk) ||
      'application/octet-stream'

    if (inline) {
      await logDocumentEvent(dbPool, id, userId, 'view')
      res.setHeader('Content-Type', contentType)
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`
      )
      return res.sendFile(path.resolve(filePath))
    }

    await logDocumentEvent(dbPool, id, userId, 'download')
    return res.download(filePath, downloadName)
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_folders.sql',
      })
    }
    console.error('knowledge downloadDocumentFile:', error)
    return res.status(500).json({ error: error.message || 'Ошибка скачивания' })
  }
}

const convertDocumentToFolder = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id' })

    const perms = await getKnowledgePermissions(dbPool, userId)
    const existing = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!existing.rows.length) return res.status(404).json({ error: 'Документ не найден' })
    const prev = existing.rows[0]
    const allowed = await canManageDocument(dbPool, perms, prev.owner_department_id)
    if (!allowed) return res.status(403).json({ error: 'Нет прав' })

    const client = await dbPool.connect()
    try {
      await client.query('BEGIN')
      const { rows: files } = await client.query(
        `SELECT id FROM knowledge_document_files WHERE document_id = $1 LIMIT 1`,
        [id]
      )
      if (!files.length && prev.file_url) {
        await insertDocumentFile(client, {
          documentId: id,
          fileUrl: prev.file_url,
          fileName: prev.file_name,
          fileType: prev.file_type,
          fileSize: prev.file_size,
          fileHash: prev.file_hash,
          searchText: prev.search_text,
          sortOrder: 0,
          versionNumber: prev.version_number || 1,
          uploadedBy: prev.uploaded_by || userId,
        })
      }
      await client.query(
        `UPDATE knowledge_documents SET is_folder = TRUE, updated_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [userId, id]
      )
      await client.query('COMMIT')
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch (_) {}
      throw e
    } finally {
      client.release()
    }

    const { rows } = await dbPool.query(`${SELECT_BASE} WHERE d.id = $1`, [id])
    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    const filesMap = await loadFilesMap(dbPool, [id])
    return res.json({
      document: mapDoc(rows[0], segmentsMap[id] || [], true, {
        files: filesMap[id] || [],
        filesCount: (filesMap[id] || []).length,
      }),
    })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_folders.sql',
      })
    }
    console.error('knowledge convertDocumentToFolder:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

/**
 * Замена файла в папке новой версией (история — в knowledge_document_file_versions).
 */
const replaceDocumentFile = (dbPool, io) => async (req, res) => {
  const client = await dbPool.connect()
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    if (!Number.isFinite(id) || !Number.isFinite(fileId)) {
      return res.status(400).json({ error: 'Некорректный id' })
    }

    const uploadFiles = collectUploadFiles(req)
    if (!uploadFiles.length) {
      return res.status(400).json({ error: 'Прикрепите новый файл' })
    }
    const upload = uploadFiles[0]
    const newName = resolveUploadFileNameAt(req, upload, 0)

    const perms = await getKnowledgePermissions(dbPool, userId)
    if (!perms.canUpload) {
      return res.status(403).json({ error: 'Недостаточно прав' })
    }

    const existing = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!existing.rows.length) return res.status(404).json({ error: 'Документ не найден' })
    const prev = existing.rows[0]
    const allowed = await canManageDocument(dbPool, perms, prev.owner_department_id)
    if (!allowed) return res.status(403).json({ error: 'Нет прав на замену файла' })

    await client.query('BEGIN')
    const fileRes = await client.query(
      `SELECT * FROM knowledge_document_files
       WHERE id = $1 AND document_id = $2
       FOR UPDATE`,
      [fileId, id]
    )
    if (!fileRes.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Файл не найден в папке' })
    }
    const current = fileRes.rows[0]

    const confirmDifferentFileName =
      String(req.body.confirmDifferentFileName || '') === '1'
    if (!confirmDifferentFileName && fileNamesDiffer(current.file_name, newName)) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        code: 'FILE_NAME_MISMATCH',
        error: `Вы загружаете «${newName}», а сейчас в папке «${current.file_name}». Чтобы всё же заменить — подтвердите действие.`,
        documentId: id,
        fileId,
        currentFileName: current.file_name,
        newFileName: newName,
      })
    }

    try {
      await archiveFileVersion(client, current)
    } catch (e) {
      if (e && e.code === '42P01') {
        await client.query('ROLLBACK')
        return res.status(503).json({
          error: 'Выполните миграцию add_knowledge_base_file_versions.sql',
        })
      }
      throw e
    }

    const nextVersion = Number(current.version_number || 1) + 1
    const fileUrl = `/uploads/knowledge/${upload.filename}`
    const fileHash = hashFile(upload.path)
    const extracted = await extractTextFromFile(upload.path, {
      fileName: newName,
      mimeType: upload.mimetype,
    })
    const fileSearch = buildSearchBlob({
      title: prev.title,
      description: prev.description || '',
      tags: prev.tags || [],
      fileName: newName,
      extractedText: extracted,
    })

    await client.query(
      `UPDATE knowledge_document_files SET
        file_url = $1,
        file_name = $2,
        file_type = $3,
        file_size = $4,
        file_hash = $5,
        search_text = $6,
        version_number = $7,
        uploaded_by = $8,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9`,
      [
        fileUrl,
        newName,
        upload.mimetype || null,
        upload.size != null ? Number(upload.size) : null,
        fileHash,
        fileSearch || null,
        nextVersion,
        userId,
        fileId,
      ]
    )

    await syncPrimaryFileFromChildren(client, id)
    await rebuildDocumentSearchText(client, id)
    await client.query(
      `UPDATE knowledge_documents SET updated_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [userId, id]
    )
    await client.query('COMMIT')

    const { rows } = await dbPool.query(`${SELECT_BASE} WHERE d.id = $1`, [id])
    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    const filesMap = await loadFilesMap(dbPool, [id])

    notifyDepartmentAboutDocument(dbPool, io, {
      documentId: id,
      title: prev.title,
      ownerDepartmentId: prev.owner_department_id,
      uploadedBy: userId,
      isNewVersion: true,
      versionNumber: nextVersion,
      fileName: newName,
    }).catch(() => {})

    return res.json({
      replaced: true,
      versionNumber: nextVersion,
      document: mapDoc(rows[0], segmentsMap[id] || [], true, {
        files: filesMap[id] || [],
        filesCount: (filesMap[id] || []).length,
      }),
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (_) {}
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_file_versions.sql',
      })
    }
    console.error('knowledge replaceDocumentFile:', error)
    return res.status(500).json({ error: error.message || 'Ошибка замены файла' })
  } finally {
    client.release()
  }
}

/**
 * Переименование файла в папке (только метаданные, без загрузки).
 */
const renameDocumentFile = (dbPool) => async (req, res) => {
  const client = await dbPool.connect()
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    if (!Number.isFinite(id) || !Number.isFinite(fileId)) {
      return res.status(400).json({ error: 'Некорректный id' })
    }

    const nextName = String(req.body.fileName || req.body.file_name || '').trim()
    if (!nextName) {
      return res.status(400).json({ error: 'Укажите новое имя файла' })
    }
    if (nextName.length > 255) {
      return res.status(400).json({ error: 'Слишком длинное имя файла' })
    }
    if (/[\\/]/.test(nextName)) {
      return res.status(400).json({ error: 'Имя файла не должно содержать слэши' })
    }

    const perms = await getKnowledgePermissions(dbPool, userId)
    if (!perms.canUpload) {
      return res.status(403).json({ error: 'Недостаточно прав' })
    }

    const existing = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!existing.rows.length) return res.status(404).json({ error: 'Документ не найден' })
    const prev = existing.rows[0]
    const allowed = await canManageDocument(dbPool, perms, prev.owner_department_id)
    if (!allowed) return res.status(403).json({ error: 'Нет прав на переименование' })

    await client.query('BEGIN')
    const fileRes = await client.query(
      `SELECT * FROM knowledge_document_files
       WHERE id = $1 AND document_id = $2
       FOR UPDATE`,
      [fileId, id]
    )
    if (!fileRes.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Файл не найден в папке' })
    }
    const current = fileRes.rows[0]

    if (!fileNamesDiffer(current.file_name, nextName)) {
      await client.query('ROLLBACK')
      const { rows } = await dbPool.query(`${SELECT_BASE} WHERE d.id = $1`, [id])
      const segmentsMap = await loadSegmentsMap(dbPool, [id])
      const filesMap = await loadFilesMap(dbPool, [id])
      return res.json({
        renamed: false,
        document: mapDoc(rows[0], segmentsMap[id] || [], true, {
          files: filesMap[id] || [],
          filesCount: (filesMap[id] || []).length,
        }),
        message: 'Имя не изменилось',
      })
    }

    const dup = await client.query(
      `SELECT id FROM knowledge_document_files
       WHERE document_id = $1 AND id <> $2
         AND lower(trim(file_name)) = lower(trim($3))
       LIMIT 1`,
      [id, fileId, nextName]
    )
    if (dup.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        code: 'FOLDER_FILE_NAME_EXISTS',
        error: `В папке уже есть файл «${nextName}»`,
      })
    }

    const fileSearch = buildSearchBlob({
      title: prev.title,
      description: prev.description || '',
      tags: prev.tags || [],
      fileName: nextName,
      extractedText: current.search_text || '',
    })

    await client.query(
      `UPDATE knowledge_document_files SET
        file_name = $1,
        search_text = $2,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [nextName, fileSearch || null, fileId]
    )

    await syncPrimaryFileFromChildren(client, id)
    await rebuildDocumentSearchText(client, id)
    await client.query(
      `UPDATE knowledge_documents SET updated_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [userId, id]
    )
    await client.query('COMMIT')

    const { rows } = await dbPool.query(`${SELECT_BASE} WHERE d.id = $1`, [id])
    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    const filesMap = await loadFilesMap(dbPool, [id])
    return res.json({
      renamed: true,
      document: mapDoc(rows[0], segmentsMap[id] || [], true, {
        files: filesMap[id] || [],
        filesCount: (filesMap[id] || []).length,
      }),
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (_) {}
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_folders.sql',
      })
    }
    console.error('knowledge renameDocumentFile:', error)
    return res.status(500).json({ error: error.message || 'Ошибка переименования' })
  } finally {
    client.release()
  }
}

const listFileVersions = (dbPool) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    if (!Number.isFinite(id) || !Number.isFinite(fileId)) {
      return res.status(400).json({ error: 'Некорректный id' })
    }

    const perms = await getKnowledgePermissions(dbPool, userId)
    const { rows: docs } = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!docs.length) return res.status(404).json({ error: 'Документ не найден' })

    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    if (!isVisibleToUser(docs[0], segmentsMap[id] || [], userId, perms.departmentId, perms)) {
      return res.status(403).json({ error: 'Нет доступа' })
    }

    const fileRes = await dbPool.query(
      `SELECT * FROM knowledge_document_files WHERE id = $1 AND document_id = $2`,
      [fileId, id]
    )
    if (!fileRes.rows.length) {
      return res.status(404).json({ error: 'Файл не найден' })
    }
    const current = fileRes.rows[0]

    const { rows } = await dbPool.query(
      `SELECT v.id, v.version_number, v.file_name, v.file_type, v.file_size, v.created_at,
              TRIM(CONCAT(COALESCE(u.last_name,''),' ',COALESCE(u.first_name,''))) AS uploaded_by_name
       FROM knowledge_document_file_versions v
       LEFT JOIN users u ON u.id = v.uploaded_by
       WHERE v.file_id = $1 AND v.document_id = $2
       ORDER BY v.version_number DESC`,
      [fileId, id]
    )

    return res.json({
      file: mapFileRow(current, fixFilenameEncoding),
      currentVersion: Number(current.version_number || 1),
      versions: rows.map((r) => ({
        id: Number(r.id),
        versionNumber: Number(r.version_number),
        fileName: fixFilenameEncoding(r.file_name || '') || null,
        fileType: r.file_type,
        fileSize: r.file_size != null ? Number(r.file_size) : null,
        createdAt: r.created_at,
        uploadedByName: (r.uploaded_by_name || '').trim() || null,
      })),
    })
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_file_versions.sql',
      })
    }
    console.error('knowledge listFileVersions:', error)
    return res.status(500).json({ error: error.message || 'Ошибка' })
  }
}

const downloadFileVersion = (dbPool, uploadsRoot) => async (req, res) => {
  try {
    const userId = resolveUserId(req)
    if (!userId) return res.status(400).json({ error: 'Укажите userId' })
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    const versionId = Number(req.params.versionId)
    if (!Number.isFinite(id) || !Number.isFinite(fileId) || !Number.isFinite(versionId)) {
      return res.status(400).json({ error: 'Некорректный id' })
    }

    const perms = await getKnowledgePermissions(dbPool, userId)
    const { rows } = await dbPool.query(
      `SELECT * FROM knowledge_documents WHERE id = $1 AND is_archived = FALSE`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Документ не найден' })

    const segmentsMap = await loadSegmentsMap(dbPool, [id])
    if (!isVisibleToUser(rows[0], segmentsMap[id] || [], userId, perms.departmentId, perms)) {
      return res.status(403).json({ error: 'Нет доступа к файлу' })
    }

    const ver = await dbPool.query(
      `SELECT * FROM knowledge_document_file_versions
       WHERE id = $1 AND file_id = $2 AND document_id = $3`,
      [versionId, fileId, id]
    )
    if (!ver.rows.length) return res.status(404).json({ error: 'Версия не найдена' })

    const fileRow = ver.rows[0]
    const fileNameOnDisk = path.basename(String(fileRow.file_url || ''))
    const filePath = path.join(uploadsRoot, 'knowledge', fileNameOnDisk)
    if (!fileNameOnDisk || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл на диске не найден' })
    }

    const downloadName = fileRow.file_name || fileNameOnDisk
    await logDocumentEvent(dbPool, id, userId, 'download')
    return res.download(filePath, downloadName)
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(503).json({
        error: 'Выполните миграцию add_knowledge_base_file_versions.sql',
      })
    }
    console.error('knowledge downloadFileVersion:', error)
    return res.status(500).json({ error: error.message || 'Ошибка скачивания' })
  }
}

module.exports = {
  getPermissions,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  downloadDocument,
  addDocumentFile,
  deleteDocumentFile,
  downloadDocumentFile,
  replaceDocumentFile,
  renameDocumentFile,
  listFileVersions,
  downloadFileVersion,
  convertDocumentToFolder,
  reindexDocuments,
  listVersions,
  downloadVersion,
  listEvents,
  createCategory,
  deleteCategory,
  createTag,
  deleteTag,
  addFavoriteDocument,
  removeFavoriteDocument,
  CATEGORY_LABELS,
  VISIBILITY_LABELS,
}
