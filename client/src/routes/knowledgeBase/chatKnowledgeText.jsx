import {
  formatKnowledgeLinkLabel,
  parseKnowledgeHref,
} from './knowledgeLinkUtils'
import { openKnowledgeLinkAction } from './openKnowledgeLink'

/** Рендер plain-текста чата со ссылками БЗ (маркеры и URL). */
export const makeChatKnowledgeRenderer = (userId) => (text) => {
  const src = String(text || '')
  if (!src) return null
  const parts = []
  const re =
    /\[\[kb:(\d+)(?::(\d+))?\|([^\]]+)\]\]|((?:https?:\/\/[^\s]+?)?(?:\/)?knowledge-base\?[^\s]+)/gi
  let last = 0
  let m
  let key = 0
  while ((m = re.exec(src))) {
    if (m.index > last) parts.push(src.slice(last, m.index))
    let parsed
    let label
    if (m[1] != null) {
      parsed = {
        documentId: Number(m[1]),
        fileId: m[2] ? Number(m[2]) : null,
      }
      label = formatKnowledgeLinkLabel(m[3] || 'База знаний')
    } else {
      parsed = parseKnowledgeHref(m[4])
      label = formatKnowledgeLinkLabel(parsed.label || 'файл из базы знаний')
    }
    parts.push(
      <a
        key={`kb-chat-${key++}`}
        href="#kb"
        className="kb-link"
        style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openKnowledgeLinkAction(userId, parsed).catch(() => {})
        }}
      >
        {label}
      </a>
    )
    last = m.index + m[0].length
  }
  if (last < src.length) parts.push(src.slice(last))
  return parts.length ? parts : src
}
