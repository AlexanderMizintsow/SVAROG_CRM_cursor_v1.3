const stripHtml = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, '')
    .trim()

const parseClosedClaims = (raw) => {
  const source = String(raw || '')
  const sections = source
    .split(/\n\s*─{5,}\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  return sections
    .map((section) => {
      const contractor = stripHtml(section.match(/Контрагент:\s*([^<\n]+)/i)?.[1] || '')
      const inn = stripHtml(section.match(/ИНН:\s*([^<\n]+)/i)?.[1] || '')
      const defect = stripHtml(section.match(/Дефект:\s*([^<\n]+)/i)?.[1] || '')
      const location = stripHtml(section.match(/Место:\s*([^<\n]+)/i)?.[1] || '')
      const requestNumber = stripHtml(section.match(/Заявка №:\s*([^<\n]+)/i)?.[1] || '')
      const date = stripHtml(section.match(/Дата:\s*([^<\n]+)/i)?.[1] || '')

      if (!requestNumber) return null
      return {
        requestNumber,
        contractor,
        inn: inn === '[отсутствует]' ? null : inn,
        defect,
        location,
        date,
      }
    })
    .filter(Boolean)
}

module.exports = {
  parseClosedClaims,
}
