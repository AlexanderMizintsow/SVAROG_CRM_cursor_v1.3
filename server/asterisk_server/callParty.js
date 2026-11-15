// Кто звонит: компания, контакт и последний комментарий по номеру.
// Короткий номер сотрудника сюда не попадает.

const { normalizePhone } = require("./phoneNumber");

const partySql = `
  SELECT company_id, company_name, dealer_id, contact_name
  FROM (
    SELECT d.company_id,
           c.name_companies AS company_name,
           d.id AS dealer_id,
           NULLIF(btrim(concat_ws(' ', d.last_name, d.first_name, d.middle_name)), '') AS contact_name,
           1 AS source_rank
    FROM dealers d
    JOIN dealer_phone_numbers dpn ON dpn.dealer_id = d.id
    JOIN companies c ON c.id = d.company_id
    WHERE phone_key(dpn.phone_number) = $1
    UNION ALL
    SELECT pnc.company_id,
           c.name_companies,
           (
             SELECT d2.id
             FROM dealers d2
             WHERE d2.company_id = pnc.company_id
             ORDER BY d2.id
             LIMIT 1
           ),
           (
             SELECT NULLIF(btrim(concat_ws(' ', d2.last_name, d2.first_name, d2.middle_name)), '')
             FROM dealers d2
             WHERE d2.company_id = pnc.company_id
             ORDER BY d2.id
             LIMIT 1
           ),
           2
    FROM phone_numbers_companies pnc
    JOIN companies c ON c.id = pnc.company_id
    WHERE phone_key(pnc.phone_number) = $1
  ) found
  ORDER BY source_rank
  LIMIT 1
`;

const commentSql = `
  SELECT text, at
  FROM (
    SELECT description AS text, accepted_at AS at
    FROM calls
    WHERE (phone_key(caller_number) = $1 OR phone_key(receiver_number) = $1)
      AND description IS NOT NULL
      AND btrim(description) <> ''
    UNION ALL
    SELECT cc.comment, cc.created_at
    FROM call_comments cc
    JOIN calls c ON c.id = cc.call_id
    WHERE (phone_key(c.caller_number) = $1 OR phone_key(c.receiver_number) = $1)
      AND cc.comment IS NOT NULL
      AND btrim(cc.comment) <> ''
  ) notes
  ORDER BY at DESC NULLS LAST
  LIMIT 1
`;

const emptyParty = (phone) => ({
  phone: phone || null,
  known: false,
  companyId: null,
  companyName: null,
  dealerId: null,
  contactName: null,
  lastComment: null,
  lastCommentAt: null,
});

const getCallParty = async (pool, phone) => {
  const key = normalizePhone(phone);
  if (!key || key.length <= 5) return emptyParty(key);
  try {
    const found = await pool.query(partySql, [key]);
    const row = found.rows[0];
    let comment = null;
    try {
      const notes = await pool.query(commentSql, [key]);
      comment = notes.rows[0] || null;
    } catch (error) {
      console.error("Комментарий к номеру не прочитан:", error.message);
    }
    if (!row) return emptyParty(key);
    return {
      phone: key,
      known: true,
      companyId: row.company_id,
      companyName: row.company_name,
      dealerId: row.dealer_id,
      contactName: row.contact_name,
      lastComment: comment ? comment.text : null,
      lastCommentAt: comment ? comment.at : null,
    };
  } catch (error) {
    console.error("Ошибка поиска компании по номеру:", error.message);
    return emptyParty(key);
  }
};

module.exports = { getCallParty };
