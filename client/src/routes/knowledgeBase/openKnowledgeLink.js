import JSZip from 'jszip'
import Toastify from 'toastify-js'
import { knowledgeBaseApi } from './knowledgeBaseApi'
import { parseKnowledgeHref } from './knowledgeLinkUtils'

const isPdf = (fileType, fileName) => {
  if (
    fileType &&
    (fileType === 'application/pdf' || String(fileType).includes('pdf'))
  ) {
    return true
  }
  return Boolean(fileName && String(fileName).toLowerCase().endsWith('.pdf'))
}

const isImage = (fileType, fileName) => {
  if (fileType && String(fileType).startsWith('image/')) return true
  const name = String(fileName || '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
}

const toastError = (text) => {
  Toastify({
    text,
    duration: 3200,
    close: true,
    gravity: 'top',
    position: 'right',
    backgroundColor: 'linear-gradient(to right, #8B0000, #ff0000)',
  }).showToast()
}

const toastInfo = (text) => {
  Toastify({
    text,
    duration: 2800,
    close: true,
    gravity: 'top',
    position: 'right',
    backgroundColor: 'linear-gradient(to right, #0f766e, #14b8a6)',
  }).showToast()
}

const downloadBlob = (blob, fileName) => {
  const blobUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = fileName || 'file'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(blobUrl)
}

const downloadByUrl = async (url, fileName) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('download failed')
  const blob = await response.blob()
  downloadBlob(blob, fileName)
}

const uniqueZipName = (wanted, used) => {
  let name = String(wanted || 'file').replace(/[\\/:*?"<>|]/g, '_').trim() || 'file'
  if (!used.has(name.toLowerCase())) {
    used.add(name.toLowerCase())
    return name
  }
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let i = 2
  let next = `${base} (${i})${ext}`
  while (used.has(next.toLowerCase())) {
    i += 1
    next = `${base} (${i})${ext}`
  }
  used.add(next.toLowerCase())
  return next
}

/**
 * Скачать все файлы папки одним ZIP (как набор документов).
 */
const downloadFolderAsZip = async (userId, doc) => {
  const files = (doc.files || []).filter((f) => f && f.id)
  if (!files.length) {
    throw new Error('В папке нет файлов')
  }

  toastInfo(`Готовим архив: ${files.length} файл(ов)…`)

  const zip = new JSZip()
  const usedNames = new Set()
  let added = 0

  for (const file of files) {
    const url = knowledgeBaseApi.fileDownloadUrl(userId, doc.id, file.id)
    try {
      const response = await fetch(url)
      if (!response.ok) continue
      const blob = await response.blob()
      const name = uniqueZipName(file.fileName || `file-${file.id}`, usedNames)
      zip.file(name, blob)
      added += 1
    } catch (_) {
      /* пропускаем битый файл */
    }
  }

  if (!added) {
    throw new Error('Не удалось скачать файлы папки')
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const safeTitle = String(doc.title || 'folder')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 80)
  downloadBlob(zipBlob, `${safeTitle || 'folder'}.zip`)
  return { mode: 'zip', count: added, fileName: `${safeTitle}.zip` }
}

/**
 * Открывает файл БЗ как вложения задач: PDF/картинка — просмотр, иначе скачивание.
 * Ссылка на папку (без fileId) — ZIP со всеми файлами.
 * Не переходит на страницу /knowledge-base (чтобы не открывать копию CRM).
 */
export async function openKnowledgeLinkAction(userId, { documentId, fileId } = {}) {
  const id = Number(documentId)
  if (!userId || !Number.isFinite(id) || id <= 0) {
    throw new Error('Некорректная ссылка на базу знаний')
  }

  const doc = await knowledgeBaseApi.getDocument(userId, id)
  if (!doc) throw new Error('Документ не найден')

  const folderFiles = Array.isArray(doc.files) ? doc.files : []
  const isFolder =
    Boolean(doc.isFolder) ||
    Number(doc.filesCount) > 1 ||
    folderFiles.length > 1

  const fid = Number(fileId)
  const hasSpecificFile = Number.isFinite(fid) && fid > 0

  // Ссылка на всю папку → архив со всеми файлами
  if (!hasSpecificFile && isFolder && folderFiles.length > 0) {
    return downloadFolderAsZip(userId, doc)
  }

  let fileType = doc.fileType
  let fileName = doc.fileName || doc.title || 'file'
  let viewUrl = knowledgeBaseApi.viewUrl(userId, id)
  let downloadUrl = knowledgeBaseApi.downloadUrl(userId, id)

  if (hasSpecificFile) {
    const file = folderFiles.find((f) => Number(f.id) === fid)
    if (file) {
      fileType = file.fileType
      fileName = file.fileName || fileName
      viewUrl = knowledgeBaseApi.fileViewUrl(userId, id, fid)
      downloadUrl = knowledgeBaseApi.fileDownloadUrl(userId, id, fid)
    }
  }

  if (isPdf(fileType, fileName) || isImage(fileType, fileName)) {
    window.open(viewUrl, '_blank', 'noopener,noreferrer')
    return { mode: 'view', fileName }
  }

  try {
    await downloadByUrl(downloadUrl, fileName)
  } catch (err) {
    window.open(downloadUrl, '_blank', 'noopener,noreferrer')
  }
  return { mode: 'download', fileName }
}

export const isKnowledgeLinkAnchor = (el) => {
  if (!el || el.tagName !== 'A') return false
  if (el.classList?.contains('kb-link')) return true
  if (el.dataset?.kbDocumentId) return true
  const href = el.getAttribute('href') || ''
  return /knowledge-base/i.test(href)
}

/**
 * Перехват клика по ссылке БЗ в описании. true — событие обработано.
 */
export function handleKnowledgeDescriptionClick(event, userId) {
  const a = event.target?.closest?.('a')
  if (!isKnowledgeLinkAnchor(a)) return false

  event.preventDefault()
  event.stopPropagation()

  const href = a.getAttribute('href') || ''
  const parsed = parseKnowledgeHref(href)
  const documentId =
    Number(a.dataset?.kbDocumentId) || parsed.documentId || null
  const fileId = Number(a.dataset?.kbFileId) || parsed.fileId || null

  openKnowledgeLinkAction(userId, { documentId, fileId }).catch((err) => {
    toastError(
      err?.response?.data?.error || err.message || 'Не удалось открыть файл'
    )
  })
  return true
}
