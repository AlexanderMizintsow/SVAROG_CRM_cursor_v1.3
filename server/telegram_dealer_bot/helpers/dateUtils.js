// dateUtils.js

const formatDateForSQL = (date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 19).replace('T', ' ')
}

module.exports = formatDateForSQL
