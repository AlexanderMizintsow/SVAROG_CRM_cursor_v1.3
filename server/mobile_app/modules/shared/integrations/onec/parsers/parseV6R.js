const STATUS_WHITELIST = [
  'В логистике',
  'Устранено',
  'Новая',
  'В работе',
  'Выполнено',
  'Заказано',
]

const parseV6R = (raw) => {
  const lines = String(raw || '')
    .split('\n')
    .map((line) => line.trim().replace(/^s;/, ''))
    .filter((line) => line && !line.toLowerCase().startsWith('q11'))

  return lines
    .map((line) => {
      const parts = line.split(':')
      if (parts.length < 3) return null

      const requestNumber = parts[0].trim().replace(/^0+/, '') || 'Не указан'
      let status = parts[1].trim()
      if (status.match(/\d{2}\.\d{2}\.\d{4}/) || !STATUS_WHITELIST.includes(status)) {
        status = 'Статус не распознан'
      }

      const orderNumber = parts[2].trim() === '00' ? 'Не указан' : parts[2].trim()

      const commentParts = []
      let skipNext = false
      for (let i = 3; i < parts.length; i += 1) {
        const part = parts[i].trim()
        if (skipNext) {
          skipNext = false
          continue
        }
        if (part === 'истина' && i + 1 < parts.length && parts[i + 1].match(/\d{2}\.\d{2}\.\d{4}/)) {
          commentParts.push(`Дата: ${parts[i + 1]}`)
          skipNext = true
          continue
        }
        if (part === 'ложь' && i + 1 < parts.length && parts[i + 1].match(/\d{2}\.\d{2}\.\d{4}/)) {
          skipNext = true
          continue
        }
        if (part !== 'истина' && part !== 'ложь') {
          const clean = part.replace(/^:|:$/g, '')
          if (clean) commentParts.push(clean)
        }
      }

      const comment = commentParts
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/:(\S)/g, ': $1')
        .trim()

      if (requestNumber === 'Не указан' && orderNumber === 'Не указан' && !comment) {
        return null
      }

      return {
        requestNumber,
        orderNumber,
        status,
        comment,
      }
    })
    .filter(Boolean)
}

module.exports = {
  parseV6R,
}
