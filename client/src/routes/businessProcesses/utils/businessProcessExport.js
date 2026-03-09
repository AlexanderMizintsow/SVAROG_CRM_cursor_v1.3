/**
 * Утилиты экспорта и импорта бизнес-процессов.
 * Версионирование формата обеспечивает совместимость при добавлении новых блоков
 * и изменении существующих в будущих версиях.
 */
export const EXPORT_FORMAT_VERSION = 1

/**
 * Создаёт объект для экспорта бизнес-процесса.
 * @param {Object} params
 * @param {string} params.name - название процесса
 * @param {string} params.description - описание
 * @param {Object} params.scheme - схема { nodes, edges, meta }
 * @param {boolean} params.isDraft - черновик
 * @param {number[]} params.visibilityUserIds - ID пользователей для видимости
 * @returns {Object} объект для экспорта
 */
export function createExportData({ name, description, scheme, isDraft, visibilityUserIds }) {
  const schemeData = scheme && typeof scheme === 'object' ? scheme : {}
  return {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'SVAROG_CRM',
    businessProcess: {
      name: String(name || '').trim() || 'Без названия',
      description: String(description || '').trim(),
      is_draft: isDraft !== false,
      visibility_user_ids: Array.isArray(visibilityUserIds) ? [...visibilityUserIds] : [],
      scheme: {
        nodes: Array.isArray(schemeData.nodes) ? schemeData.nodes : [],
        edges: Array.isArray(schemeData.edges) ? schemeData.edges : [],
        meta: schemeData.meta && typeof schemeData.meta === 'object'
          ? { ...schemeData.meta }
          : { gatewayDebugNotify: false },
      },
    },
  }
}

/**
 * Нормализует узел схемы для совместимости с будущими версиями.
 * Неизвестные типы блоков сохраняются; лишние поля игнорируются при рендере.
 * @param {Object} node - узел из импортируемого файла
 * @returns {Object} нормализованный узел
 */
function normalizeNode(node) {
  if (!node || typeof node !== 'object') return null
  return {
    id: node.id,
    type: node.type || 'create_task',
    position: node.position && typeof node.position === 'object'
      ? { x: Number(node.position.x) || 0, y: Number(node.position.y) || 0 }
      : { x: 0, y: 0 },
    label: node.label != null ? String(node.label) : '',
    settings: node.settings && typeof node.settings === 'object' ? { ...node.settings } : {},
  }
}

/**
 * Нормализует ребро схемы.
 */
function normalizeEdge(edge) {
  if (!edge || typeof edge !== 'object') return null
  const result = {
    id: edge.id || `e-${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
  }
  if (edge.sourceHandle != null) result.sourceHandle = edge.sourceHandle
  if (edge.targetHandle != null) result.targetHandle = edge.targetHandle
  if (edge.condition != null) result.condition = edge.condition
  return result
}

/**
 * Проверяет и парсит импортируемый JSON.
 * @param {string} jsonString - содержимое файла
 * @param {Object} options
 * @param {boolean} options.clearVisibility - очистить visibility при импорте (по умолчанию true — для переноса на др. компьютер)
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
export function validateAndParseImport(jsonString, { clearVisibility = true } = {}) {
  if (!jsonString || typeof jsonString !== 'string') {
    return { success: false, error: 'Файл пуст или не является текстом' }
  }

  let parsed
  try {
    parsed = JSON.parse(jsonString)
  } catch (e) {
    return { success: false, error: 'Файл не является корректным JSON' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: 'Неверный формат файла' }
  }

  const bp = parsed.businessProcess
  if (!bp || typeof bp !== 'object') {
    return { success: false, error: 'В файле отсутствует объект businessProcess' }
  }

  const scheme = bp.scheme
  if (!scheme || typeof scheme !== 'object') {
    return { success: false, error: 'В файле отсутствует схема процесса' }
  }

  const rawNodes = Array.isArray(scheme.nodes) ? scheme.nodes : []
  const rawEdges = Array.isArray(scheme.edges) ? scheme.edges : []

  if (rawNodes.length === 0) {
    return { success: false, error: 'Схема не содержит блоков' }
  }

  const version = Number(parsed.version) || 0
  if (version > EXPORT_FORMAT_VERSION) {
    // Будущая версия — предупреждаем, но пытаемся загрузить
    console.warn(
      `[businessProcessExport] Импорт файла версии ${version}, текущая поддерживаемая: ${EXPORT_FORMAT_VERSION}. ` +
      'Часть данных может быть несовместима.'
    )
  }

  const nodes = rawNodes.map(normalizeNode).filter(Boolean)
  const edges = rawEdges.map(normalizeEdge).filter((e) => e && e.source && e.target)
  const meta = scheme.meta && typeof scheme.meta === 'object'
    ? { ...scheme.meta }
    : { gatewayDebugNotify: false }

  const data = {
    name: String(bp.name || '').trim() || 'Импортированный процесс',
    description: String(bp.description || '').trim(),
    is_draft: bp.is_draft !== false,
    visibility_user_ids: clearVisibility ? [] : (Array.isArray(bp.visibility_user_ids) ? bp.visibility_user_ids : []),
    scheme: { nodes, edges, meta },
  }

  return { success: true, data }
}

/**
 * Скачивает JSON-файл в браузере.
 * @param {Object} exportData - объект из createExportData
 * @param {string} filename - имя файла (без расширения)
 */
export function downloadExportFile(exportData, filename = 'business-process') {
  const json = JSON.stringify(exportData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename.replace(/[^\w\s-]/g, '')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
