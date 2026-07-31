/**
 * Ссылки на документы/файлы базы знаний в описаниях задач и проектов.
 */

export const buildKnowledgeHref = ({ documentId, fileId, label } = {}) => {
  const id = Number(documentId)
  if (!Number.isFinite(id) || id <= 0) return '/knowledge-base'
  const params = new URLSearchParams()
  params.set('documentId', String(id))
  const fid = Number(fileId)
  if (Number.isFinite(fid) && fid > 0) {
    params.set('fileId', String(fid))
  }
  const labelText = String(label || '').trim()
  if (labelText) {
    params.set('label', labelText.slice(0, 180))
  }
  return `/knowledge-base?${params.toString()}`
}

export const buildKnowledgeLinkLabel = ({ title, fileName } = {}) => {
  const t = String(title || '').trim()
  const f = String(fileName || '').trim()
  if (t && f) return `${t} / ${f}`
  return f || t || 'База знаний'
}

/** Текст ссылки с префиксом «Ссылка - » */
export const formatKnowledgeLinkLabel = (label) => {
  const text = String(label || 'База знаний')
    .trim()
    .replace(/^Ссылка\s*[-–—:]\s*/i, '')
  return `Ссылка - ${text || 'База знаний'}`
}

export const escapeHtml = (text) =>
  String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** HTML-якорь для Quill / CRM описаний */
export const buildKnowledgeAnchorHtml = ({ documentId, fileId, label } = {}) => {
  const rawLabel = label || buildKnowledgeLinkLabel({})
  const niceLabel = formatKnowledgeLinkLabel(rawLabel)
  const href = buildKnowledgeHref({
    documentId,
    fileId,
    label: niceLabel.replace(/^Ссылка\s*[-–—:]\s*/i, ''),
  })
  const text = escapeHtml(niceLabel)
  const id = Number(documentId)
  const fid = Number(fileId)
  const dataFile =
    Number.isFinite(fid) && fid > 0 ? ` data-kb-file-id="${fid}"` : ''
  return `<a class="kb-link" href="${href}" data-kb-document-id="${id}"${dataFile}>${text}</a>`
}

/** Маркер для мобильного plain-редактора */
export const buildKnowledgePlainMarker = ({ documentId, fileId, label } = {}) => {
  const id = Number(documentId)
  const fid = Number(fileId)
  const text = formatKnowledgeLinkLabel(label || buildKnowledgeLinkLabel({}))
    .replace(/[\[\]|]/g, ' ')
  if (Number.isFinite(fid) && fid > 0) {
    return `[[kb:${id}:${fid}|${text}]]`
  }
  return `[[kb:${id}|${text}]]`
}

export const parseKnowledgeHref = (href) => {
  try {
    const raw = String(href || '')
    const qIndex = raw.indexOf('?')
    const qs = qIndex >= 0 ? raw.slice(qIndex + 1) : ''
    const params = new URLSearchParams(qs)
    const documentId = Number(params.get('documentId') || params.get('id'))
    const fileId = Number(params.get('fileId'))
    const label = params.get('label')
    return {
      documentId: Number.isFinite(documentId) && documentId > 0 ? documentId : null,
      fileId: Number.isFinite(fileId) && fileId > 0 ? fileId : null,
      label: label ? String(label) : null,
    }
  } catch {
    return { documentId: null, fileId: null, label: null }
  }
}

/** Подсветка и префикс «Ссылка - » для ссылок БЗ в уже сохранённом HTML */
export const enhanceKnowledgeLinksInHtml = (html) => {
  const raw = String(html || '')
  if (!raw || !/knowledge-base|kb-link|data-kb-document-id/i.test(raw)) return raw
  return raw.replace(
    /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi,
    (full, attrs, inner) => {
      const isKb =
        /class=["'][^"']*kb-link/i.test(attrs) ||
        /href=["'][^"']*knowledge-base/i.test(attrs) ||
        /data-kb-document-id=/i.test(attrs)
      if (!isKb) return full
      const plain = String(inner)
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim()
      const labeled = formatKnowledgeLinkLabel(plain || 'База знаний')
      let nextAttrs = attrs
      if (!/class=/i.test(nextAttrs)) {
        nextAttrs += ' class="kb-link"'
      } else if (!/kb-link/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(
          /class=["']([^"']*)["']/i,
          'class="$1 kb-link"'
        )
      }
      return `<a${nextAttrs}>${escapeHtml(labeled)}</a>`
    }
  )
}
