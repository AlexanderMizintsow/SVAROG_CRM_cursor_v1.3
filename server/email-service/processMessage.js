const { simpleParser } = require('mailparser')
const _ = require('lodash')

function formatAddress(addr) {
  if (!addr) return ''
  if (typeof addr === 'string') return addr.trim()
  if (addr.text) return addr.text.trim()
  if (Array.isArray(addr.value) && addr.value[0]) {
    const v = addr.value[0]
    if (typeof v === 'string') return v
    if (v.address) return v.name ? `${v.name} <${v.address}>` : v.address
  }
  return ''
}

// Парсинг полного сырого письма (RFC 822) через mailparser — корректно извлекает текст при любом multipart
async function processMessage(res) {
  const fullPart = _.find(res.parts, (p) => p.which === '' || p.which === 'TEXT')
  const raw = fullPart?.body
  if (!raw) {
    console.log('Нет тела письма (parts:', res.parts?.map((p) => p.which), ')')
    return null
  }

  let parsed
  try {
    const rawData =
      typeof raw === 'string' ? Buffer.from(raw, 'utf-8') : raw
    parsed = await simpleParser(rawData)
  } catch (err) {
    console.error('Ошибка парсинга письма:', err)
    return null
  }

  const subject = parsed.subject?.trim() || '(без темы)'
  const from = formatAddress(parsed.from)
  if (!from) {
    console.log('Письмо без отправителя:', subject)
    return null
  }

  const to = formatAddress(parsed.to) || 'Неизвестный получатель'
  const date = parsed.date || null
  const messageId = parsed.messageId || null
  const inReplyTo = parsed.inReplyTo || null
  const htmlToText = (html) => {
    if (!html || typeof html !== 'string') return ''
    let t = html
    t = t.replace(/<br\s*\/?>/gi, '\n')
    t = t.replace(/<\/p>/gi, '\n')
    t = t.replace(/<\/div>/gi, '\n')
    t = t.replace(/<\/tr>/gi, '\n')
    t = t.replace(/<\/li>/gi, '\n')
    t = t.replace(/<hr\s*\/?>/gi, '\n')
    t = t.replace(/<[^>]+>/g, ' ')
    t = t.replace(/&nbsp;/g, ' ')
    t = t.replace(/&amp;/g, '&')
    t = t.replace(/&lt;/g, '<')
    t = t.replace(/&gt;/g, '>')
    t = t.replace(/&quot;/g, '"')
    t = t.split(/\n/).map((line) => line.replace(/\s+/g, ' ').trim()).join('\n')
    return t.replace(/\n{3,}/g, '\n\n').trim()
  }
  const body =
    (parsed.text && parsed.text.trim()) ||
    (parsed.html && htmlToText(parsed.html)) ||
    'Текстовое содержимое отсутствует'
  const attachments = (parsed.attachments || []).map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    content: a.content,
  }))

  return {
    uid: res.attributes?.uid,
    date,
    from,
    to,
    subject,
    messageId,
    inReplyTo,
    body,
    attachments,
    read: (res.attributes?.flags || []).includes('\\Seen'),
  }
}

module.exports = { processMessage }
