// Готовит набор: рабочий добавочный менеджера и номер, который есть у компании.
// В АТС отсюда ничего не отправляется.

const { stationNumber } = require('../asterisk_server/originateCall')

const prepareOriginate = async (pool, { userId, companyId, phone }) => {
  const target = stationNumber(phone)
  if (!target) {
    return {
      status: 400,
      error: 'Номер дилера должен быть городским или мобильным',
    }
  }

  const key = `7${target.slice(1)}`
  const owned = await pool.query(
    `SELECT 1
     FROM (
       SELECT d.company_id, phone_key(dpn.phone_number) AS key
       FROM dealers d
       JOIN dealer_phone_numbers dpn ON dpn.dealer_id = d.id
       UNION ALL
       SELECT company_id, phone_key(phone_number)
       FROM phone_numbers_companies
     ) phones
     WHERE company_id = $1 AND key = $2
     LIMIT 1`,
    [companyId, key]
  )
  if (!owned.rows.length) {
    return { status: 400, error: 'Этот номер не найден у компании' }
  }

  const extension = await pool.query(
    `SELECT regexp_replace(phone_number, '\\D', '', 'g') AS extension
     FROM user_phones
     WHERE user_id = $1
       AND (
         lower(phone_type) LIKE '%рабоч%'
         OR lower(phone_type) LIKE '%стационар%'
       )
       AND length(regexp_replace(phone_number, '\\D', '', 'g')) BETWEEN 2 AND 5
     ORDER BY CASE WHEN lower(phone_type) LIKE '%стационар%' THEN 0 ELSE 1 END, id
     LIMIT 1`,
    [userId]
  )
  if (!extension.rows.length) {
    return {
      status: 409,
      error: 'У вас не указан рабочий добавочный. Набор не отправлен.',
    }
  }

  return { extension: extension.rows[0].extension, stationNumber: target }
}

module.exports = { prepareOriginate }
