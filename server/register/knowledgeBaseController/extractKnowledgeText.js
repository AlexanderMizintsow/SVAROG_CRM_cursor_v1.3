/**
 * Извлечение текста из файлов базы знаний для поиска.
 * Без OCR и без ИИ: только «живой» текст (PDF/DOCX/XLS/XLSX/TXT).
 */

const fs = require('fs')
const path = require('path')

const MAX_CHARS = 800000

/** Латиница, похожая на кириллицу → кириллица (для поиска «Т» / «T»). */
const LATIN_TO_CYR = {
  A: 'А',
  a: 'а',
  B: 'В',
  E: 'Е',
  e: 'е',
  K: 'К',
  k: 'к',
  M: 'М',
  H: 'Н',
  O: 'О',
  o: 'о',
  P: 'Р',
  p: 'р',
  C: 'С',
  c: 'с',
  T: 'Т',
  t: 'т',
  X: 'Х',
  x: 'х',
  Y: 'У',
  y: 'у',
}

function foldLookalikes(text) {
  if (!text) return ''
  return String(text)
    .replace(/[A-Za-z]/g, (ch) => LATIN_TO_CYR[ch] || ch)
    .toLowerCase()
}

function normalizeExtractedText(text) {
  if (!text) return ''
  return String(text)
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHARS)
}

/** Текст для индекса поиска: нормализация пробелов + свёртка похожих букв. */
function normalizeForSearchIndex(text) {
  return foldLookalikes(normalizeExtractedText(text))
}

/** Токены запроса для поиска (AND по каждому слову). */
function tokenizeSearchQuery(query) {
  const folded = foldLookalikes(String(query || '').trim())
  if (!folded) return []
  return folded
    .split(/[\s,.;:!?()[\]{}"'«»]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

function extOf(fileName, mimeType) {
  const fromName = path.extname(String(fileName || '')).toLowerCase()
  if (fromName) return fromName
  const mime = String(mimeType || '').toLowerCase()
  if (mime.includes('pdf')) return '.pdf'
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return '.docx'
  if (mime.includes('spreadsheetml') || mime.includes('excel') || mime.includes('sheet')) {
    return '.xlsx'
  }
  if (mime.startsWith('text/')) return '.txt'
  return ''
}

async function extractFromPdf(buffer) {
  const { PDFParse } = require('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result?.text || ''
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => {})
    }
  }
}

async function extractFromDocx(buffer) {
  const mammoth = require('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result?.value || ''
}

/**
 * Собираем только непустые ячейки (не весь CSV с миллионами запятых).
 * Числа пишем и как отображаемый текст, и как целое — чтобы артикулы находились.
 */
async function extractFromSpreadsheet(buffer) {
  const XLSX = require('xlsx')
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellText: true,
  })
  const parts = []

  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet || !sheet['!ref']) continue
    parts.push(String(sheetName))

    const range = XLSX.utils.decode_range(sheet['!ref'])
    // Защита от «раздутых» листов (случайный огромный !ref)
    const maxRow = Math.min(range.e.r, range.s.r + 20000)
    const maxCol = Math.min(range.e.c, range.s.c + 200)

    for (let R = range.s.r; R <= maxRow; R++) {
      for (let C = range.s.c; C <= maxCol; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = sheet[addr]
        if (!cell) continue

        if (cell.w != null && String(cell.w).trim() !== '') {
          parts.push(String(cell.w).trim())
        }

        if (cell.v != null && cell.v !== '') {
          if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
            const asInt = Math.round(cell.v)
            if (String(asInt) !== String(cell.w || '').trim()) {
              parts.push(String(asInt))
            }
          } else if (typeof cell.v === 'string') {
            const s = cell.v.trim()
            if (s && s !== String(cell.w || '').trim()) parts.push(s)
          }
        }
      }
    }
  }

  return parts.join(' ')
}

async function extractFromPlainText(buffer) {
  return buffer.toString('utf8')
}

/**
 * @param {string} filePath absolute path on disk
 * @param {{ fileName?: string, mimeType?: string }} [meta]
 * @returns {Promise<string>}
 */
async function extractTextFromFile(filePath, meta = {}) {
  if (!filePath || !fs.existsSync(filePath)) return ''

  const ext = extOf(meta.fileName || filePath, meta.mimeType)
  const buffer = fs.readFileSync(filePath)

  try {
    let raw = ''
    if (ext === '.pdf') {
      raw = await extractFromPdf(buffer)
    } else if (ext === '.docx' || ext === '.doc') {
      raw = await extractFromDocx(buffer)
    } else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      raw = await extractFromSpreadsheet(buffer)
    } else if (ext === '.txt' || ext === '.md' || ext === '.log') {
      raw = await extractFromPlainText(buffer)
    } else if (String(meta.mimeType || '').startsWith('text/')) {
      raw = await extractFromPlainText(buffer)
    }
    return normalizeExtractedText(raw)
  } catch (error) {
    console.warn(
      'knowledge extractTextFromFile failed:',
      meta.fileName || filePath,
      error.message
    )
    return ''
  }
}

function buildSearchBlob({ title, description, tags, fileName, extractedText }) {
  const tagList = Array.isArray(tags) ? tags : []
  return normalizeForSearchIndex(
    [title, description, fileName, ...tagList, extractedText].filter(Boolean).join(' ')
  )
}

module.exports = {
  extractTextFromFile,
  buildSearchBlob,
  normalizeExtractedText,
  normalizeForSearchIndex,
  tokenizeSearchQuery,
  foldLookalikes,
  MAX_CHARS,
}
